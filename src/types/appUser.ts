export const APP_ROLES = [
  { value: 'staff', label: '一般スタッフ' },
  { value: 'facility_admin', label: '事業所管理者' },
  { value: 'system_admin', label: 'システム管理者' },
] as const

export type AppRole = (typeof APP_ROLES)[number]['value']

export function appRoleLabel(role: AppRole): string {
  return APP_ROLES.find((item) => item.value === role)?.label ?? role
}

export const APP_USER_STATUSES = [
  { value: 'pending', label: '承認待ち' },
  { value: 'active', label: '有効' },
  { value: 'disabled', label: '無効化' },
] as const

export type AppUserStatus = (typeof APP_USER_STATUSES)[number]['value']

export function appUserStatusLabel(status: AppUserStatus): string {
  return APP_USER_STATUSES.find((item) => item.value === status)?.label ?? status
}

export type AppUser = {
  id: string
  email: string
  display_name: string
  role: AppRole
  status: AppUserStatus
  created_at: string
  updated_at: string
}

export type AppUserWithServices = AppUser & { service_ids: string[] }
