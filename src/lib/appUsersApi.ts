import type { AppRole, AppUserStatus, AppUserWithServices } from '../types/appUser'
import { getSupabase } from './supabase'

type AppUserRow = {
  id: string
  email: string
  display_name: string
  role: AppRole
  status: AppUserStatus
  created_at: string
  updated_at: string
  app_user_services?: { service_id: string }[] | null
}

const appUserSelect = `
  id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  app_user_services ( service_id )
`

function mapAppUser(row: AppUserRow): AppUserWithServices {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    service_ids: (row.app_user_services ?? []).map((item) => item.service_id),
  }
}

export async function fetchAppUsers(): Promise<AppUserWithServices[]> {
  const { data, error } = await getSupabase()
    .from('app_users')
    .select(appUserSelect)
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as unknown as AppUserRow[]).map(mapAppUser)
}

export async function updateAppUserRoleStatus(
  userId: string,
  input: { role: AppRole; status: AppUserStatus },
): Promise<void> {
  const { error } = await getSupabase().from('app_users').update(input).eq('id', userId)
  if (error) throw error
}

/** 所属事業所（複数選択）を丸ごと入れ替える */
export async function setAppUserServices(userId: string, serviceIds: string[]): Promise<void> {
  const supabase = getSupabase()

  const { error: deleteError } = await supabase
    .from('app_user_services')
    .delete()
    .eq('user_id', userId)
  if (deleteError) throw deleteError

  if (serviceIds.length > 0) {
    const { error: insertError } = await supabase
      .from('app_user_services')
      .insert(serviceIds.map((serviceId) => ({ user_id: userId, service_id: serviceId })))
    if (insertError) throw insertError
  }
}
