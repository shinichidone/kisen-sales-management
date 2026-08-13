import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase } from '../lib/supabase'
import type { AppUserWithServices } from '../types/appUser'

type AuthContextValue = {
  /** 初回のセッション確認が完了するまで true */
  loading: boolean
  session: Session | null
  /** ログイン中ユーザーの app_users 行（role/status/所属事業所を含む）。未承認や取得前は null */
  appUser: AppUserWithServices | null
  refreshAppUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AppUserRow = {
  id: string
  email: string
  display_name: string
  role: AppUserWithServices['role']
  status: AppUserWithServices['status']
  created_at: string
  updated_at: string
  app_user_services?: { service_id: string }[] | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUserWithServices | null>(null)

  const loadAppUser = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setAppUser(null)
      return
    }
    const { data, error } = await getSupabase()
      .from('app_users')
      .select(
        'id, email, display_name, role, status, created_at, updated_at, app_user_services ( service_id )',
      )
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('ユーザー情報の取得に失敗しました:', error)
      setAppUser(null)
      return
    }
    const row = data as AppUserRow | null
    setAppUser(
      row
        ? {
            id: row.id,
            email: row.email,
            display_name: row.display_name,
            role: row.role,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            service_ids: (row.app_user_services ?? []).map((s) => s.service_id),
          }
        : null,
    )
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadAppUser(data.session?.user.id)
      if (active) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadAppUser(nextSession?.user.id).finally(() => {
        if (active) setLoading(false)
      })
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadAppUser])

  const refreshAppUser = useCallback(async () => {
    await loadAppUser(session?.user.id)
  }, [loadAppUser, session])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ loading, session, appUser, refreshAppUser, signOut }),
    [loading, session, appUser, refreshAppUser, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth は AuthProvider の内側で使用してください。')
  }
  return ctx
}
