import { useCallback, useEffect, useState } from 'react'
import { AppShell, type AppView } from './components/layout/AppShell'
import { LoadingSpinner } from './components/LoadingSpinner'
import { SetupGate } from './components/SetupGate'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ActiveStaffProvider } from './contexts/ActiveStaffContext'
import { UsersPage } from './features/admin/UsersPage'
import { AnalyticsPage } from './features/analytics/AnalyticsPage'
import { LoginPage } from './features/auth/LoginPage'
import { PasswordResetPage } from './features/auth/PasswordResetPage'
import { PendingApprovalPage } from './features/auth/PendingApprovalPage'
import { FacilityDetail, type FacilityDetailTab } from './features/facilities/FacilityDetail'
import { HomePage } from './features/home/HomePage'
import { MapPage } from './features/map/MapPage'
import { FacilityPicker } from './features/quickEntry/FacilityPicker'
import { hasRequiredEnv } from './lib/env'
import { fetchServices } from './lib/facilitiesApi'
import type { Service } from './types/facility'

type QuickEntryKind = 'browse' | 'visit' | 'referral'

const QUICK_ENTRY_TAB: Record<QuickEntryKind, FacilityDetailTab> = {
  browse: 'overview',
  visit: 'visits',
  referral: 'referrals',
}

function AuthenticatedApp() {
  const { appUser, signOut } = useAuth()
  const [view, setView] = useState<AppView>('home')
  const [services, setServices] = useState<Service[]>([])
  const [quickEntry, setQuickEntry] = useState<QuickEntryKind | null>(null)
  const [openFacility, setOpenFacility] = useState<{
    id: string
    tab: FacilityDetailTab
  } | null>(null)

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch((err) => console.error('サービス一覧の取得に失敗しました:', err))
  }, [])

  const startQuickEntry = useCallback((kind: QuickEntryKind) => {
    setQuickEntry(kind)
  }, [])

  return (
    <>
      <AppShell
        activeView={view}
        onChangeView={setView}
        appUser={appUser}
        onSignOut={() => void signOut()}
        onQuickEntry={startQuickEntry}
      >
        {view === 'home' ? (
          <HomePage onNavigate={setView} onQuickEntry={startQuickEntry} />
        ) : view === 'map' ? (
          <MapPage />
        ) : view === 'users' ? (
          <UsersPage />
        ) : (
          <AnalyticsPage />
        )}
      </AppShell>

      {quickEntry ? (
        <FacilityPicker
          mode={quickEntry}
          onSelect={(facilityId) => {
            setOpenFacility({ id: facilityId, tab: QUICK_ENTRY_TAB[quickEntry] })
            setQuickEntry(null)
          }}
          onCancel={() => setQuickEntry(null)}
        />
      ) : null}

      {openFacility ? (
        <FacilityDetail
          facilityId={openFacility.id}
          services={services}
          initialTab={openFacility.tab}
          onClose={() => setOpenFacility(null)}
          onFacilityUpdated={() => {}}
        />
      ) : null}
    </>
  )
}

function AuthGate() {
  const { loading, session, appUser, signOut } = useAuth()

  const isPasswordReset = new URLSearchParams(window.location.search).has('reset-password')

  if (loading) {
    return <LoadingSpinner fullPage label="読み込み中…" />
  }

  if (isPasswordReset) {
    return <PasswordResetPage />
  }

  if (!session) {
    return <LoginPage />
  }

  if (!appUser || appUser.status !== 'active') {
    return <PendingApprovalPage appUser={appUser} onSignOut={() => void signOut()} />
  }

  return <AuthenticatedApp />
}

export default function App() {
  const envStatus = hasRequiredEnv()

  if (!envStatus.ok) {
    return <SetupGate missing={envStatus.missing} />
  }

  return (
    <AuthProvider>
      <ActiveStaffProvider>
        <AuthGate />
      </ActiveStaffProvider>
    </AuthProvider>
  )
}
