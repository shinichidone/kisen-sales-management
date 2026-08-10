import { AppShell } from './components/layout/AppShell'
import { SetupGate } from './components/SetupGate'
import { MapPage } from './features/map/MapPage'
import { hasRequiredEnv } from './lib/env'

export default function App() {
  const envStatus = hasRequiredEnv()

  return (
    <AppShell>
      {envStatus.ok ? <MapPage /> : <SetupGate missing={envStatus.missing} />}
    </AppShell>
  )
}
