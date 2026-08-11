export const CONTACT_JOB_ROLES = [
  { value: 'care_manager', label: 'ケアマネジャー' },
  { value: 'chief_care_manager', label: '主任ケアマネジャー' },
  { value: 'social_worker', label: '社会福祉士' },
  { value: 'msw', label: 'MSW' },
  { value: 'nurse', label: '看護師' },
  { value: 'public_health_nurse', label: '保健師' },
  { value: 'discharge_support', label: '退院支援担当' },
  { value: 'counselor', label: '相談員' },
  { value: 'facility_manager', label: '施設長・管理者' },
  { value: 'doctor', label: '医師' },
  { value: 'other', label: 'その他' },
] as const

export type ContactJobRole = (typeof CONTACT_JOB_ROLES)[number]['value']

export type Contact = {
  id: string
  name: string
  job_role: ContactJobRole
  job_role_other: string | null
  note: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FacilityAffiliation = {
  id: string
  facility_id: string
  contact_id: string
  started_on: string
  ended_on: string | null
  created_at: string
  contact: Contact
}

export type FacilityMemoHistory = {
  id: string
  facility_id: string
  previous_memo: string
  new_memo: string
  changed_by_label: string
  created_at: string
}

export type ContactDraft = {
  name: string
  job_role: ContactJobRole
  job_role_other: string
  note: string
}

export function contactJobRoleLabel(contact: Pick<Contact, 'job_role' | 'job_role_other'>): string {
  if (contact.job_role === 'other') {
    return contact.job_role_other?.trim() || 'その他'
  }
  return CONTACT_JOB_ROLES.find((role) => role.value === contact.job_role)?.label ?? contact.job_role
}
