export const REFERRAL_STATUSES = [
  { value: 'referred', label: '紹介' },
  { value: 'adjusting', label: '調整中' },
  { value: 'visiting', label: '見学・面談' },
  { value: 'started', label: '利用開始' },
  { value: 'lost', label: '利用に至らず' },
] as const

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]['value']

export function referralStatusLabel(status: ReferralStatus): string {
  return REFERRAL_STATUSES.find((item) => item.value === status)?.label ?? status
}

export const REFERRAL_LOST_REASONS = [
  { value: 'no_vacancy', label: '空きなし' },
  { value: 'schedule_mismatch', label: '曜日が合わない' },
  { value: 'out_of_area', label: 'エリア外' },
  { value: 'family_declined', label: '本人・家族希望なし' },
  { value: 'chose_other_provider', label: '他事業所に決定' },
  { value: 'hospitalized', label: '入院・状態変化' },
  { value: 'condition_mismatch', label: '条件不一致' },
  { value: 'other', label: 'その他' },
] as const

export type ReferralLostReason = (typeof REFERRAL_LOST_REASONS)[number]['value']

export function referralLostReasonLabel(
  reason: ReferralLostReason | null,
  other: string | null,
): string {
  if (!reason) return ''
  if (reason === 'other') return other?.trim() || 'その他'
  return REFERRAL_LOST_REASONS.find((item) => item.value === reason)?.label ?? reason
}

export type ReferralCase = {
  id: string
  case_number: string
  source_facility_id: string
  source_contact_id: string | null
  service_id: string
  related_visit_id: string | null
  referred_on: string
  status: ReferralStatus
  lost_reason: ReferralLostReason | null
  lost_reason_other: string | null
  note: string
  created_at: string
  updated_at: string
}

export type ReferralCaseDraft = {
  source_contact_id: string
  service_id: string
  related_visit_id: string
  referred_on: string
  status: ReferralStatus
  lost_reason: ReferralLostReason | ''
  lost_reason_other: string
  note: string
}
