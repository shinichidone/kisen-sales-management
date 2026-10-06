import { useState } from 'react'
import { APP_NAME, APP_NAME_JA } from '../../lib/brand'
import { getErrorMessage } from '../../lib/errors'
import { getSupabase } from '../../lib/supabase'
import styles from './AuthPages.module.css'

type Mode = 'login' | 'signup' | 'forgot'

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
        },
      })
      if (signUpError) throw signUpError

      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setMessage(
          '登録しました。ログインタブから同じメールアドレスとパスワードでログインしてください。システム管理者の承認後に利用できます。',
        )
      }
    } catch (err) {
      console.error('新規登録に失敗しました:', err)
      setError(getErrorMessage(err, '新規登録に失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const redirectTo = new URL(window.location.href)
      redirectTo.search = '?reset-password=1'
      redirectTo.hash = ''

      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: redirectTo.toString() },
      )
      if (resetError) throw resetError

      setMessage(
        'パスワード再設定メールを送信しました。メール内のリンクを開いて、新しいパスワードを設定してください。',
      )
    } catch (err) {
      console.error('パスワード再設定メールの送信に失敗しました:', err)
      setError(getErrorMessage(err, 'パスワード再設定メールを送信できませんでした。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <strong>{APP_NAME}</strong>
          <span>{APP_NAME_JA}</span>
        </div>

        <div className={styles.tabs} hidden={mode === 'forgot'}>
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
            <button
              type="button"
              className={styles.textButton}
              onClick={() => switchMode('forgot')}
            >
              パスワードを忘れた方
            </button>
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting ? 'ログイン中…' : 'ログイン'}
            </button>
          </form>
        ) : mode === 'signup' ? (
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
              登録後、システム管理者が「ユーザー管理」で承認すると利用できます。確認メールは使いません。
            </p>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleForgotPassword}>
            <div className={styles.formIntro}>
              <strong>パスワードを再設定</strong>
              <p>登録済みのメールアドレスへ、再設定用のリンクを送ります。</p>
            </div>
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
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting ? '送信中…' : '再設定メールを送る'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => switchMode('login')}
            >
              ログイン画面へ戻る
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
