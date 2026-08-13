import type { SalesVisit, SalesVisitDraft, SalesVisitResult } from '../types/salesVisit'
import { getSupabase } from './supabase'

type SalesVisitRow = {
  id: string
  facility_id: string
  visited_at: string
  result: SalesVisitResult
  memo: string
  registered_by: string
  created_by: string | null
  next_follow_up_on: string | null
  follow_up_note: string
  follow_up_assignee: string
  created_at: string
  updated_at: string
  sales_visit_contacts?: { contact_id: string }[] | null
  sales_visit_services?: { service_id: string }[] | null
}

const salesVisitSelect = `
  id,
  facility_id,
  visited_at,
  result,
  memo,
  registered_by,
  created_by,
  next_follow_up_on,
  follow_up_note,
  follow_up_assignee,
  created_at,
  updated_at,
  sales_visit_contacts ( contact_id ),
  sales_visit_services ( service_id )
`

function mapSalesVisit(row: SalesVisitRow): SalesVisit {
  return {
    id: row.id,
    facility_id: row.facility_id,
    visited_at: row.visited_at,
    result: row.result,
    memo: row.memo,
    registered_by: row.registered_by,
    created_by: row.created_by,
    next_follow_up_on: row.next_follow_up_on,
    follow_up_note: row.follow_up_note,
    follow_up_assignee: row.follow_up_assignee,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact_ids: (row.sales_visit_contacts ?? []).map((item) => item.contact_id),
    service_ids: (row.sales_visit_services ?? []).map((item) => item.service_id),
  }
}

/** <input type="datetime-local"> 用の現在時刻文字列（ローカルタイム） */
export function nowForDatetimeLocalInput(): string {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** DBの timestamptz を <input type="datetime-local"> 用の文字列に変換 */
export function toDatetimeLocalInput(isoString: string): string {
  const date = new Date(isoString)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function normalizeDraft(draft: SalesVisitDraft) {
  if (!draft.visited_at) throw new Error('訪問日時は必須です。')
  const visitedAtIso = new Date(draft.visited_at).toISOString()

  if (draft.result === 'met' && draft.contact_ids.length === 0) {
    throw new Error('面会済みの場合は面会者を1名以上選択してください。')
  }

  return {
    visited_at: visitedAtIso,
    result: draft.result,
    memo: draft.memo.trim(),
    next_follow_up_on: draft.next_follow_up_on || null,
    follow_up_note: draft.follow_up_note.trim(),
    follow_up_assignee: draft.follow_up_assignee.trim(),
  }
}

export type SalesVisitSummary = {
  facility_id: string
  visited_at: string
  result: SalesVisitResult
  created_by: string | null
}

/** 営業分析一覧（STEP6）・ホーム（STEP7）用に、全施設分の営業履歴を軽量な形で取得する */
export async function fetchAllSalesVisits(): Promise<SalesVisitSummary[]> {
  const { data, error } = await getSupabase()
    .from('sales_visits')
    .select('facility_id, visited_at, result, created_by')

  if (error) throw error
  return (data ?? []) as SalesVisitSummary[]
}

export async function fetchFacilitySalesVisits(facilityId: string): Promise<SalesVisit[]> {
  const { data, error } = await getSupabase()
    .from('sales_visits')
    .select(salesVisitSelect)
    .eq('facility_id', facilityId)
    .order('visited_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return ((data ?? []) as unknown as SalesVisitRow[]).map(mapSalesVisit)
}

export type CurrentUser = {
  id: string
  displayName: string
}

export async function createSalesVisit(
  facilityId: string,
  draft: SalesVisitDraft,
  currentUser: CurrentUser,
): Promise<SalesVisit> {
  const payload = normalizeDraft(draft)
  const supabase = getSupabase()

  const { data: inserted, error: insertError } = await supabase
    .from('sales_visits')
    .insert({
      facility_id: facilityId,
      ...payload,
      registered_by: currentUser.displayName,
      created_by: currentUser.id,
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  const visitId = (inserted as { id: string }).id

  try {
    if (draft.contact_ids.length > 0) {
      const { error } = await supabase.from('sales_visit_contacts').insert(
        draft.contact_ids.map((contactId) => ({ visit_id: visitId, contact_id: contactId })),
      )
      if (error) throw error
    }
    if (draft.service_ids.length > 0) {
      const { error } = await supabase.from('sales_visit_services').insert(
        draft.service_ids.map((serviceId) => ({ visit_id: visitId, service_id: serviceId })),
      )
      if (error) throw error
    }
  } catch (err) {
    await supabase.from('sales_visits').delete().eq('id', visitId)
    throw err
  }

  const { data: full, error: fetchError } = await supabase
    .from('sales_visits')
    .select(salesVisitSelect)
    .eq('id', visitId)
    .single()

  if (fetchError) throw fetchError
  return mapSalesVisit(full as unknown as SalesVisitRow)
}

export type FollowUpItem = {
  visit_id: string
  facility_id: string
  facility_name: string
  visited_at: string
  next_follow_up_on: string
  follow_up_note: string
  follow_up_assignee: string
}

type FollowUpRow = {
  id: string
  facility_id: string
  visited_at: string
  next_follow_up_on: string
  follow_up_note: string
  follow_up_assignee: string
  facilities: { name: string } | { name: string }[] | null
}

/** 次回フォロー予定が設定されている営業履歴を、予定日が近い順に取得する */
export async function fetchFollowUps(): Promise<FollowUpItem[]> {
  const { data, error } = await getSupabase()
    .from('sales_visits')
    .select(
      `
      id,
      facility_id,
      visited_at,
      next_follow_up_on,
      follow_up_note,
      follow_up_assignee,
      facilities ( name )
    `,
    )
    .not('next_follow_up_on', 'is', null)
    .order('next_follow_up_on', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as FollowUpRow[]).map((row) => {
    const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities
    return {
      visit_id: row.id,
      facility_id: row.facility_id,
      facility_name: facility?.name ?? '（不明な施設）',
      visited_at: row.visited_at,
      next_follow_up_on: row.next_follow_up_on,
      follow_up_note: row.follow_up_note,
      follow_up_assignee: row.follow_up_assignee,
    }
  })
}

/** フォロー対応済みにする（次回フォロー予定を解除） */
export async function completeFollowUp(visitId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('sales_visits')
    .update({ next_follow_up_on: null })
    .eq('id', visitId)

  if (error) throw error
}

export async function updateSalesVisit(
  visitId: string,
  draft: SalesVisitDraft,
): Promise<SalesVisit> {
  const payload = normalizeDraft(draft)
  const supabase = getSupabase()

  const { error: updateError } = await supabase
    .from('sales_visits')
    .update(payload)
    .eq('id', visitId)
  if (updateError) throw updateError

  const { error: deleteContactsError } = await supabase
    .from('sales_visit_contacts')
    .delete()
    .eq('visit_id', visitId)
  if (deleteContactsError) throw deleteContactsError

  const { error: deleteServicesError } = await supabase
    .from('sales_visit_services')
    .delete()
    .eq('visit_id', visitId)
  if (deleteServicesError) throw deleteServicesError

  if (draft.contact_ids.length > 0) {
    const { error } = await supabase.from('sales_visit_contacts').insert(
      draft.contact_ids.map((contactId) => ({ visit_id: visitId, contact_id: contactId })),
    )
    if (error) throw error
  }
  if (draft.service_ids.length > 0) {
    const { error } = await supabase.from('sales_visit_services').insert(
      draft.service_ids.map((serviceId) => ({ visit_id: visitId, service_id: serviceId })),
    )
    if (error) throw error
  }

  const { data: full, error: fetchError } = await supabase
    .from('sales_visits')
    .select(salesVisitSelect)
    .eq('id', visitId)
    .single()

  if (fetchError) throw fetchError
  return mapSalesVisit(full as unknown as SalesVisitRow)
}
