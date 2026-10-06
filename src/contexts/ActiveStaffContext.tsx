import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createStaffMember, fetchStaffMembers } from '../lib/staffMembersApi'
import type { StaffMember } from '../types/staffMember'
import { useAuth } from './AuthContext'

type ActiveStaffContextValue = {
  staffMembers: StaffMember[]
  activeStaff: StaffMember | null
  activeStaffName: string
  loadingStaff: boolean
  selectStaff: (staffId: string) => void
  addStaff: (name: string) => Promise<StaffMember>
}

const ActiveStaffContext = createContext<ActiveStaffContextValue | null>(null)

function storageKey(appUserId: string): string {
  return `compass-active-staff:${appUserId}`
}

export function ActiveStaffProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null)
  const [loadingStaff, setLoadingStaff] = useState(false)

  useEffect(() => {
    let active = true
    if (!appUser) {
      setStaffMembers([])
      setActiveStaff(null)
      return
    }

    setLoadingStaff(true)
    void fetchStaffMembers(appUser.id)
      .then((members) => {
        if (!active) return
        setStaffMembers(members)
        const savedId = window.localStorage.getItem(storageKey(appUser.id))
        setActiveStaff(members.find((member) => member.id === savedId) ?? members[0] ?? null)
      })
      .catch((error) => console.error('スタッフ一覧の取得に失敗しました:', error))
      .finally(() => {
        if (active) setLoadingStaff(false)
      })

    return () => {
      active = false
    }
  }, [appUser])

  const selectStaff = useCallback(
    (staffId: string) => {
      const selected = staffMembers.find((member) => member.id === staffId)
      if (!selected || !appUser) return
      setActiveStaff(selected)
      window.localStorage.setItem(storageKey(appUser.id), selected.id)
    },
    [appUser, staffMembers],
  )

  const addStaff = useCallback(
    async (name: string) => {
      if (!appUser) throw new Error('ログイン情報を確認できませんでした。')
      const created = await createStaffMember(appUser.id, name)
      setStaffMembers((previous) => [...previous, created])
      setActiveStaff(created)
      window.localStorage.setItem(storageKey(appUser.id), created.id)
      return created
    },
    [appUser],
  )

  const value = useMemo<ActiveStaffContextValue>(
    () => ({
      staffMembers,
      activeStaff,
      activeStaffName: activeStaff?.name ?? appUser?.display_name ?? '',
      loadingStaff,
      selectStaff,
      addStaff,
    }),
    [staffMembers, activeStaff, appUser, loadingStaff, selectStaff, addStaff],
  )

  return <ActiveStaffContext.Provider value={value}>{children}</ActiveStaffContext.Provider>
}

export function useActiveStaff(): ActiveStaffContextValue {
  const context = useContext(ActiveStaffContext)
  if (!context) throw new Error('useActiveStaff は ActiveStaffProvider の内側で使用してください。')
  return context
}
