import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <strong>喜仙 営業活動管理ツール</strong>
          <span>営業情報を会社のデータ資産へ</span>
        </div>
        <div className={styles.badge}>STEP2 · 施設・担当者</div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
