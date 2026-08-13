import { useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { getSupabase } from '../../lib/supabase'
import styles from './AuthPages.module.css'

type Mode = 'login' | 'signup'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setMessage(null)
    setShowPassword(false)
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
    } catch (err) {
      console.error('ログインに失敗しました:', err)
      setError(getErrorMessage(err, 'ログインに失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault()
    if (!displayName.trim()) {
      setError('お名前を入力してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const { error: signUpError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: window.location.origin,
        },
      })
      if (signUpError) throw signUpError
      setMessage(
        '登録しました。確認メールに記載されたリンクを開いてください。メール確認後、システム管理者の承認が完了するとログインできます。',
      )
    } catch (err) {
      console.error('新規登録に失敗しました:', err)
      setError(getErrorMessage(err, '新規登録に失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <strong>営業活動管理ツール</strong>
          <span>営業情報を会社のデータ資産へ</span>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === 'login' ? styles.tabActive : styles.tab}
            onClick={() => switchMode('login')}
          >
            ログイン
          </button>
          <button
            type="button"
            className={mode === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => switchMode('signup')}
          >
            新規登録
          </button>
        </div>

        {error ? <div className={styles.alert}>{error}</div> : null}
        {message ? <div className={styles.alertOk}>{message}</div> : null}

        {mode === 'login' ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <label className={styles.label}>
              メールアドレス
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className={styles.label}>
              パスワード
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  {showPassword ? '隠す' : '表示'}
                </button>
              </div>
            </label>
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting ? 'ログイン中…' : 'ログイン'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleSignup}>
            <label className={styles.label}>
              お名前
              <input
                className={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="表示名（例: 山田太郎）"
              />
            </label>
            <label className={styles.label}>
              メールアドレス
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className={styles.label}>
              パスワード
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  {showPassword ? '隠す' : '表示'}
                </button>
              </div>
            </label>
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting ? '登録中…' : '新規登録'}
            </button>
            <p className={styles.hint}>
              登録後、メール確認とシステム管理者による承認が必要です。承認されるまでデータは表示されません。
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
