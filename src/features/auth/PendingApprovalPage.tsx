import { APP_NAME, APP_NAME_JA } from '../../lib/brand'
import type { AppUser } from '../../types/appUser'
import styles from './AuthPages.module.css'

type Props = {
  appUser: AppUser | null
  onSignOut: () => void
}

export function PendingApprovalPage({ appUser, onSignOut }: Props) {
  const isDisabled = appUser?.status === 'disabled'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <strong>{APP_NAME}</strong>
          <span>{APP_NAME_JA}</span>
        </div>

        <div className={isDisabled ? styles.alert : styles.alertWarn}>
          {isDisabled
            ? 'このアカウントは無効化されています。心当たりがない場合はシステム管理者にご確認ください。'
            : '登録ありがとうございます。現在システム管理者の承認待ちです。承認されるとご利用いただけます。'}
        </div>

        <dl className={styles.meta}>
          <dt>お名前</dt>
          <dd>{appUser?.display_name ?? '（不明）'}</dd>
          <dt>メールアドレス</dt>
          <dd>{appUser?.email ?? '（不明）'}</dd>
        </dl>

        <button type="button" className={styles.secondary} onClick={onSignOut}>
          ログアウト
        </button>
      </div>
    </div>
  )
}
