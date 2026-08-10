import type { Facility, FacilityDraft, Service } from '../types/facility'
import { getSupabase } from './supabase'

type FacilityRow = {
  id: string
  google_place_id: string | null
  name: string
  facility_type: Facility['facility_type']
  address: string
  city: string
  phone: string | null
  lat: number
  lng: number
  shared_memo: string
  is_active: boolean
  created_at: string
  updated_at: string
  facility_target_services?: { service_id: string }[] | null
}

function mapFacility(row: FacilityRow): Facility {
  return {
    id: row.id,
    google_place_id: row.google_place_id,
    name: row.name,
    facility_type: row.facility_type,
    address: row.address,
    city: row.city,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
    shared_memo: row.shared_memo,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    target_service_ids: (row.facility_target_services ?? []).map((item) => item.service_id),
  }
}

export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await getSupabase()
    .from('services')
    .select('id, code, name, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as Service[]
}

export async function fetchFacilities(): Promise<Facility[]> {
  const { data, error } = await getSupabase()
    .from('facilities')
    .select(
      `
      id,
      google_place_id,
      name,
      facility_type,
      address,
      city,
      phone,
      lat,
      lng,
      shared_memo,
      is_active,
      created_at,
      updated_at,
      facility_target_services ( service_id )
    `,
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as FacilityRow[]).map(mapFacility)
}

export type DuplicateMatch = {
  reason: 'place_id' | 'name_address'
  facility: Facility
}

export async function findDuplicateFacility(
  draft: Pick<FacilityDraft, 'google_place_id' | 'name' | 'address'>,
): Promise<DuplicateMatch | null> {
  const supabase = getSupabase()

  if (draft.google_place_id) {
    const { data, error } = await supabase
      .from('facilities')
      .select(
        `
        id,
        google_place_id,
        name,
        facility_type,
        address,
        city,
        phone,
        lat,
        lng,
        shared_memo,
        is_active,
        created_at,
        updated_at,
        facility_target_services ( service_id )
      `,
      )
      .eq('google_place_id', draft.google_place_id)
      .maybeSingle()

    if (error) throw error
    if (data) {
      return { reason: 'place_id', facility: mapFacility(data as FacilityRow) }
    }
  }

  const { data, error } = await supabase
    .from('facilities')
    .select(
      `
      id,
      google_place_id,
      name,
      facility_type,
      address,
      city,
      phone,
      lat,
      lng,
      shared_memo,
      is_active,
      created_at,
      updated_at,
      facility_target_services ( service_id )
    `,
    )
    .eq('name', draft.name.trim())
    .eq('address', draft.address.trim())
    .maybeSingle()

  if (error) throw error
  if (data) {
    return { reason: 'name_address', facility: mapFacility(data as FacilityRow) }
  }

  return null
}

export async function createFacility(draft: FacilityDraft): Promise<Facility> {
  if (draft.target_service_ids.length === 0) {
    throw new Error('営業対象サービスを1つ以上選択してください。')
  }

  const duplicate = await findDuplicateFacility(draft)
  if (duplicate) {
    const label =
      duplicate.reason === 'place_id'
        ? '同じ Google Place ID の施設'
        : '同じ施設名＋住所の施設'
    throw new Error(
      `重複の可能性があります。${label}が既に登録されています（${duplicate.facility.name}）。`,
    )
  }

  const supabase = getSupabase()

  const { data: inserted, error: insertError } = await supabase
    .from('facilities')
    .insert({
      google_place_id: draft.google_place_id,
      name: draft.name.trim(),
      facility_type: draft.facility_type,
      address: draft.address.trim(),
      city: draft.city.trim(),
      phone: draft.phone.trim() || null,
      lat: draft.lat,
      lng: draft.lng,
      shared_memo: draft.shared_memo.trim(),
    })
    .select(
      `
      id,
      google_place_id,
      name,
      facility_type,
      address,
      city,
      phone,
      lat,
      lng,
      shared_memo,
      is_active,
      created_at,
      updated_at
    `,
    )
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      throw new Error('同じ Google Place ID の施設が既に登録されています。')
    }
    throw insertError
  }

  const facilityId = (inserted as FacilityRow).id

  const { error: linkError } = await supabase.from('facility_target_services').insert(
    draft.target_service_ids.map((serviceId) => ({
      facility_id: facilityId,
      service_id: serviceId,
    })),
  )

  if (linkError) {
    // 中途半端な施設行を残さない
    await supabase.from('facilities').delete().eq('id', facilityId)
    throw linkError
  }

  const { data: full, error: fetchError } = await supabase
    .from('facilities')
    .select(
      `
      id,
      google_place_id,
      name,
      facility_type,
      address,
      city,
      phone,
      lat,
      lng,
      shared_memo,
      is_active,
      created_at,
      updated_at,
      facility_target_services ( service_id )
    `,
    )
    .eq('id', facilityId)
    .single()

  if (fetchError) throw fetchError
  return mapFacility(full as FacilityRow)
}
