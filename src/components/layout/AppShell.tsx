import type { ReactNode } from 'react'
import type { AppUser } from '../../types/appUser'
import styles from './AppShell.module.css'

export type AppView = 'home' | 'map' | 'followups' | 'analytics' | 'users'

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
  { view: 'followups', label: 'フォロー管理' },
  { view: 'analytics', label: '分析' },
  { view: 'users', label: 'ユーザー管理', adminOnly: true },
]

const MOBILE_NAV_ITEMS: { view: AppView; label: string; icon: string }[] = [
  { view: 'home', label: 'ホーム', icon: '🏠' },
  { view: 'map', label: 'MAP', icon: '📍' },
  { view: 'followups', label: 'フォロー', icon: '⏰' },
  { view: 'analytics', label: '分析', icon: '📊' },
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
          <strong>営業活動管理ツール</strong>
          <span>営業情報を会社のデータ資産へ</span>
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

      <nav className={styles.mobileNav}>
        {MOBILE_NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={activeView === item.view ? styles.mobileNavItemActive : styles.mobileNavItem}
            onClick={() => onChangeView(item.view)}
          >
            <span className={styles.mobileNavIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.mobileNavItem}
          onClick={() => onQuickEntry('visit')}
        >
          <span className={styles.mobileNavIcon}>📝</span>
          <span>営業記録</span>
        </button>
        <button
          type="button"
          className={styles.mobileNavItem}
          onClick={() => onQuickEntry('referral')}
        >
          <span className={styles.mobileNavIcon}>🤝</span>
          <span>紹介案件</span>
        </button>
      </nav>
    </div>
  )
}
