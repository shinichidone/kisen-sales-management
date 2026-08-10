export const FACILITY_TYPES = [
  { value: 'home_care_support', label: '居宅介護支援事業所' },
  { value: 'community_support', label: '地域包括支援センター' },
  { value: 'hospital', label: '病院' },
  { value: 'clinic', label: 'クリニック・診療所' },
  { value: 'care_facility', label: '介護施設' },
  { value: 'other', label: 'その他' },
] as const

export type FacilityType = (typeof FACILITY_TYPES)[number]['value']

export type Service = {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
}

export type Facility = {
  id: string
  google_place_id: string | null
  name: string
  facility_type: FacilityType
  address: string
  city: string
  phone: string | null
  lat: number
  lng: number
  shared_memo: string
  is_active: boolean
  created_at: string
  updated_at: string
  target_service_ids: string[]
}

export type FacilityDraft = {
  google_place_id: string | null
  name: string
  facility_type: FacilityType
  address: string
  city: string
  phone: string
  lat: number
  lng: number
  shared_memo: string
  target_service_ids: string[]
}

export type PlaceCandidate = {
  google_place_id: string
  name: string
  address: string
  city: string
  phone: string
  lat: number
  lng: number
}

export function facilityTypeLabel(type: FacilityType): string {
  return FACILITY_TYPES.find((item) => item.value === type)?.label ?? type
}
