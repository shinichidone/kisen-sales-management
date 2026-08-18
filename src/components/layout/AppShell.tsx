import { BarChart3, Handshake, Home, MapPin, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_NAME, APP_NAME_JA } from '../../lib/brand'
import type { AppUser } from '../../types/appUser'
import styles from './AppShell.module.css'

export type AppView = 'home' | 'map' | 'analytics' | 'users'

type Props = {
  children: ReactNode
  activeView: AppView
  onChangeView: (view: AppView) => void
  appUser: AppUser | null
  onSignOut: () => void
  onQuickEntry: (kind: 'visit' | 'referral') => void
}

const NAV_ITEMS: { view: AppView; label: string; adminOnly?: boolean }[] = [
  { view: 'home', label: 'ホーム' },
  { view: 'map', label: 'MAP' },
  { view: 'analytics', label: '分析' },
  { view: 'users', label: 'ユーザー管理', adminOnly: true },
]

export function AppShell({
  children,
  activeView,
  onChangeView,
  appUser,
  onSignOut,
  onQuickEntry,
}: Props) {
  const isAdmin = appUser?.role === 'system_admin'

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <strong>{APP_NAME}</strong>
          <span>{APP_NAME_JA}</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.view}
              type="button"
              className={activeView === item.view ? styles.navItemActive : styles.navItem}
              onClick={() => onChangeView(item.view)}
            >
              {item.label}
            </button>
          ))}
          <button type="button" className={styles.navItem} onClick={() => onQuickEntry('visit')}>
            営業記録
          </button>
          <button type="button" className={styles.navItem} onClick={() => onQuickEntry('referral')}>
            紹介案件
          </button>
        </nav>
        <div className={styles.user}>
          {appUser ? <span className={styles.userName}>{appUser.display_name}</span> : null}
          <button type="button" className={styles.signOutBtn} onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <button
        type="button"
        className={styles.mobileSignOutBtn}
        onClick={onSignOut}
        aria-label="ログアウト"
      >
        ログアウト
      </button>

      <nav className={styles.mobileNav} aria-label="メインメニュー">
        <button
          type="button"
          className={activeView === 'home' ? styles.mobileNavItemActive : styles.mobileNavItem}
          onClick={() => onChangeView('home')}
        >
          <Home size={22} strokeWidth={1.8} />
          <span>ホーム</span>
        </button>
        <button
          type="button"
          className={activeView === 'map' ? styles.mobileNavItemActive : styles.mobileNavItem}
          onClick={() => onChangeView('map')}
        >
          <MapPin size={22} strokeWidth={1.8} />
          <span>MAP</span>
        </button>
        <button
          type="button"
          className={styles.mobileNavCta}
          onClick={() => onQuickEntry('visit')}
          aria-label="営業記録を登録"
        >
          <span className={styles.mobileNavCtaBtn}>
            <Plus size={26} strokeWidth={2.2} />
          </span>
          <span>営業記録</span>
        </button>
        <button
          type="button"
          className={styles.mobileNavItem}
          onClick={() => onQuickEntry('referral')}
        >
          <Handshake size={22} strokeWidth={1.8} />
          <span>紹介案件</span>
        </button>
        <button
          type="button"
          className={activeView === 'analytics' ? styles.mobileNavItemActive : styles.mobileNavItem}
          onClick={() => onChangeView('analytics')}
        >
          <BarChart3 size={22} strokeWidth={1.8} />
          <span>分析</span>
        </button>
      </nav>
    </div>
  )
}
