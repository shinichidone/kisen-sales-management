import styles from '../features/map/MapPage.module.css'

type Props = {
  missing: string[]
}

export function SetupGate({ missing }: Props) {
  return (
    <div style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <div className={styles.card}>
        <h2>環境変数の設定が必要です</h2>
        <p className={styles.muted}>
          Phase1 を動かすには Supabase と Google Maps の設定が必要です。
        </p>
        <div className={styles.alertWarn} style={{ marginTop: '1rem' }}>
          未設定: {missing.join(', ')}
        </div>
        <ol style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.8 }}>
          <li>
            プロジェクト直下で <code>cp .env.example .env</code>
          </li>
          <li>Supabase の Project URL / anon key を記入</li>
          <li>Google Maps API キーを記入</li>
          <li>
            Supabase SQL Editor で{' '}
            <code>supabase/migrations/20260310000000_phase1_facilities.sql</code> を実行
          </li>
          <li>
            <code>npm run dev</code> を再起動
          </li>
        </ol>
        <p className={styles.hint}>詳細手順は README.md を参照してください。</p>
      </div>
    </div>
  )
}
