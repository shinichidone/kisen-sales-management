import styles from './LoadingSpinner.module.css'

type Props = {
  label?: string
  /** ページ全体を覆う中央配置にする（画面遷移中など） */
  fullPage?: boolean
}

export function LoadingSpinner({ label = '読み込み中…', fullPage = false }: Props) {
  return (
    <div className={fullPage ? styles.fullPage : styles.inline}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
