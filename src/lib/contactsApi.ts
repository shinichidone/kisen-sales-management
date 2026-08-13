import type {
  Contact,
  ContactDraft,
  ContactJobRole,
  FacilityAffiliation,
} from '../types/contact'
import { getSupabase } from './supabase'

type ContactRow = {
  id: string
  name: string
  job_role: ContactJobRole
  job_role_other: string | null
  note: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type AffiliationRow = {
  id: string
  facility_id: string
  contact_id: string
  started_on: string
  ended_on: string | null
  created_at: string
  contacts: ContactRow | ContactRow[] | null
}

function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    job_role: row.job_role,
    job_role_other: row.job_role_other,
    note: row.note,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapAffiliation(row: AffiliationRow): FacilityAffiliation {
  const contactRaw = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts
  if (!contactRaw) {
    throw new Error('担当者情報の取得に失敗しました。')
  }
  return {
    id: row.id,
    facility_id: row.facility_id,
    contact_id: row.contact_id,
    started_on: row.started_on,
    ended_on: row.ended_on,
    created_at: row.created_at,
    contact: mapContact(contactRaw),
  }
}

function normalizeDraft(draft: ContactDraft): {
  name: string
  job_role: ContactJobRole
  job_role_other: string | null
  note: string
} {
  const name = draft.name.trim()
  if (!name) throw new Error('担当者名は必須です。')

  if (draft.job_role === 'other') {
    const other = draft.job_role_other.trim()
    if (!other) throw new Error('職種「その他」の場合は内容を入力してください。')
    return {
      name,
      job_role: 'other',
      job_role_other: other,
      note: draft.note.trim(),
    }
  }

  return {
    name,
    job_role: draft.job_role,
    job_role_other: null,
    note: draft.note.trim(),
  }
}

export async function fetchFacilityAffiliations(
  facilityId: string,
): Promise<{ current: FacilityAffiliation[]; past: FacilityAffiliation[] }> {
  const { data, error } = await getSupabase()
    .from('facility_affiliations')
    .select(
      `
      id,
      facility_id,
      contact_id,
      started_on,
      ended_on,
      created_at,
      contacts (
        id,
        name,
        job_role,
        job_role_other,
        note,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .eq('facility_id', facilityId)
    .order('started_on', { ascending: false })

  if (error) throw error

  const mapped = ((data ?? []) as AffiliationRow[]).map(mapAffiliation)
  return {
    current: mapped.filter((item) => item.ended_on === null),
    past: mapped.filter((item) => item.ended_on !== null),
  }
}

export async function createContactAtFacility(
  facilityId: string,
  draft: ContactDraft,
): Promise<FacilityAffiliation> {
  const payload = normalizeDraft(draft)
  const supabase = getSupabase()

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert(payload)
    .select(
      'id, name, job_role, job_role_other, note, is_active, created_at, updated_at',
    )
    .single()

  if (contactError) throw contactError

  const { data: affiliation, error: affiliationError } = await supabase
    .from('facility_affiliations')
    .insert({
      facility_id: facilityId,
      contact_id: (contact as ContactRow).id,
    })
    .select(
      `
      id,
      facility_id,
      contact_id,
      started_on,
      ended_on,
      created_at,
      contacts (
        id,
        name,
        job_role,
        job_role_other,
        note,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .single()

  if (affiliationError) {
    await supabase.from('contacts').delete().eq('id', (contact as ContactRow).id)
    throw affiliationError
  }

  return mapAffiliation(affiliation as AffiliationRow)
}

export async function updateContact(
  contactId: string,
  draft: ContactDraft,
): Promise<Contact> {
  const payload = normalizeDraft(draft)
  const { data, error } = await getSupabase()
    .from('contacts')
    .update(payload)
    .eq('id', contactId)
    .select(
      'id, name, job_role, job_role_other, note, is_active, created_at, updated_at',
    )
    .single()

  if (error) throw error
  return mapContact(data as ContactRow)
}

/** 現施設の担当者一覧から外す（人物データは残す＝異動） */
export async function endAffiliation(affiliationId: string): Promise<void> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const { error } = await getSupabase()
    .from('facility_affiliations')
    .update({ ended_on: today })
    .eq('id', affiliationId)
    .is('ended_on', null)

  if (error) throw error
}

/**
 * 施設の担当者情報を完全に削除する（登録ミスの訂正用）。
 * 対象の所属レコードを削除し、その人物が他に所属を持たない場合は
 * 人物データ（contacts）自体も削除する。
 */
export async function deleteFacilityContact(
  affiliationId: string,
  contactId: string,
): Promise<{ contactDeleted: boolean }> {
  const supabase = getSupabase()

  const { error: deleteAffiliationError } = await supabase
    .from('facility_affiliations')
    .delete()
    .eq('id', affiliationId)
  if (deleteAffiliationError) throw deleteAffiliationError

  const { count, error: countError } = await supabase
    .from('facility_affiliations')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
  if (countError) throw countError

  if ((count ?? 0) === 0) {
    const { error: deleteContactError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
    if (deleteContactError) throw deleteContactError
    return { contactDeleted: true }
  }

  return { contactDeleted: false }
}

/** 既存の人物を別施設へ現所属として追加（異動先登録） */
export async function transferContactToFacility(
  contactId: string,
  toFacilityId: string,
  fromAffiliationId?: string,
): Promise<FacilityAffiliation> {
  const supabase = getSupabase()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

  if (fromAffiliationId) {
    const { error: endError } = await supabase
      .from('facility_affiliations')
      .update({ ended_on: today })
      .eq('id', fromAffiliationId)
      .is('ended_on', null)
    if (endError) throw endError
  }

  const { data, error } = await supabase
    .from('facility_affiliations')
    .insert({
      facility_id: toFacilityId,
      contact_id: contactId,
      started_on: today,
    })
    .select(
      `
      id,
      facility_id,
      contact_id,
      started_on,
      ended_on,
      created_at,
      contacts (
        id,
        name,
        job_role,
        job_role_other,
        note,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('この担当者はすでに当該施設の現所属です。')
    }
    throw error
  }

  return mapAffiliation(data as AffiliationRow)
}
