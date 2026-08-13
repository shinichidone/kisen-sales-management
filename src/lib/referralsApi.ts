import type { ReferralCase, ReferralCaseDraft, ReferralStatus } from '../types/referral'
import { getSupabase } from './supabase'

type ReferralCaseRow = {
  id: string
  case_number: string
  source_facility_id: string
  source_contact_id: string | null
  service_id: string
  related_visit_id: string | null
  referred_on: string
  status: ReferralCase['status']
  lost_reason: ReferralCase['lost_reason']
  lost_reason_other: string | null
  note: string
  created_at: string
  updated_at: string
}

const referralCaseSelect = `
  id,
  case_number,
  source_facility_id,
  source_contact_id,
  service_id,
  related_visit_id,
  referred_on,
  status,
  lost_reason,
  lost_reason_other,
  note,
  created_at,
  updated_at
`

function mapReferralCase(row: ReferralCaseRow): ReferralCase {
  return { ...row }
}

function normalizeDraft(draft: ReferralCaseDraft) {
  if (!draft.service_id) throw new Error('対象サービスを選択してください。')
  if (!draft.referred_on) throw new Error('紹介日は必須です。')

  if (draft.status === 'lost') {
    if (!draft.lost_reason) {
      throw new Error('利用に至らなかった理由を選択してください。')
    }
    if (draft.lost_reason === 'other' && !draft.lost_reason_other.trim()) {
      throw new Error('理由が「その他」の場合は内容を入力してください。')
    }
  }

  return {
    source_contact_id: draft.source_contact_id || null,
    service_id: draft.service_id,
    related_visit_id: draft.related_visit_id || null,
    referred_on: draft.referred_on,
    status: draft.status,
    lost_reason: draft.status === 'lost' ? draft.lost_reason || null : null,
    lost_reason_other:
      draft.status === 'lost' && draft.lost_reason === 'other'
        ? draft.lost_reason_other.trim()
        : null,
    note: draft.note.trim(),
  }
}

export type ReferralCaseSummary = {
  facility_id: string
  referred_on: string
  status: ReferralStatus
}

/** 営業分析一覧（STEP6）用に、全施設分の紹介案件を軽量な形で取得する */
export async function fetchAllReferralCases(): Promise<ReferralCaseSummary[]> {
  const { data, error } = await getSupabase()
    .from('referral_cases')
    .select('source_facility_id, referred_on, status')

  if (error) throw error
  return (
    (data ?? []) as { source_facility_id: string; referred_on: string; status: ReferralStatus }[]
  ).map((row) => ({
    facility_id: row.source_facility_id,
    referred_on: row.referred_on,
    status: row.status,
  }))
}

export async function fetchFacilityReferralCases(facilityId: string): Promise<ReferralCase[]> {
  const { data, error } = await getSupabase()
    .from('referral_cases')
    .select(referralCaseSelect)
    .eq('source_facility_id', facilityId)
    .order('referred_on', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as ReferralCaseRow[]).map(mapReferralCase)
}

export async function createReferralCase(
  facilityId: string,
  draft: ReferralCaseDraft,
): Promise<ReferralCase> {
  const payload = normalizeDraft(draft)
  const { data, error } = await getSupabase()
    .from('referral_cases')
    .insert({ source_facility_id: facilityId, ...payload })
    .select(referralCaseSelect)
    .single()

  if (error) throw error
  return mapReferralCase(data as unknown as ReferralCaseRow)
}

export async function updateReferralCase(
  caseId: string,
  draft: ReferralCaseDraft,
): Promise<ReferralCase> {
  const payload = normalizeDraft(draft)
  const { data, error } = await getSupabase()
    .from('referral_cases')
    .update(payload)
    .eq('id', caseId)
    .select(referralCaseSelect)
    .single()

  if (error) throw error
  return mapReferralCase(data as unknown as ReferralCaseRow)
}
