import { useState } from 'react'
import { APP_NAME, APP_NAME_JA } from '../../lib/brand'
import { getErrorMessage } from '../../lib/errors'
import { getSupabase } from '../../lib/supabase'
import styles from './AuthPages.module.css'

export function PasswordResetPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。')
      return
    }
    if (password !== confirmation) {
      setError('確認用パスワードが一致しません。')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await getSupabase().auth.getSession()
      if (!data.session) {
        throw new Error('再設定リンクが無効または期限切れです。もう一度メールを送信してください。')
      }

      const { error: updateError } = await getSupabase().auth.updateUser({ password })
      if (updateError) throw updateError

      await getSupabase().auth.signOut()
      setCompleted(true)
    } catch (err) {
      console.error('パスワードの更新に失敗しました:', err)
      setError(getErrorMessage(err, 'パスワードを更新できませんでした。'))
    } finally {
      setSubmitting(false)
    }
  }

  function returnToLogin() {
    window.history.replaceState({}, '', window.location.pathname)
    window.location.reload()
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <strong>{APP_NAME}</strong>
          <span>{APP_NAME_JA}</span>
        </div>

        {completed ? (
          <div className={styles.form}>
            <div className={styles.alertOk}>
              パスワードを変更しました。新しいパスワードでログインしてください。
            </div>
            <button className={styles.primary} type="button" onClick={returnToLogin}>
              ログイン画面へ
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formIntro}>
              <strong>新しいパスワードを設定</strong>
              <p>新しいパスワードを2回入力してください。</p>
            </div>
            {error ? <div className={styles.alert}>{error}</div> : null}
            <label className={styles.label}>
              新しいパスワード
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.togglePasswordBtn}
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? '隠す' : '表示'}
                </button>
              </div>
            </label>
            <label className={styles.label}>
              新しいパスワード（確認）
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting ? '変更中…' : 'パスワードを変更'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
