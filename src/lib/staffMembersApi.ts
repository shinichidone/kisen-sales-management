import type { StaffMember } from '../types/staffMember'
import { getSupabase } from './supabase'

export async function fetchStaffMembers(appUserId: string): Promise<StaffMember[]> {
  const { data, error } = await getSupabase()
    .from('app_staff_members')
    .select('id, app_user_id, name, is_active, created_at, updated_at')
    .eq('app_user_id', appUserId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as StaffMember[]
}

export async function createStaffMember(appUserId: string, nameValue: string): Promise<StaffMember> {
  const name = nameValue.trim()
  if (!name) throw new Error('スタッフ名を入力してください。')

  const { data, error } = await getSupabase()
    .from('app_staff_members')
    .insert({ app_user_id: appUserId, name })
    .select('id, app_user_id, name, is_active, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('同じ名前のスタッフがすでに登録されています。')
    throw error
  }
  return data as StaffMember
}
