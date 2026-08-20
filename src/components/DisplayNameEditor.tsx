import { useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import styles from './DisplayNameEditor.module.css'

type Props = {
  currentName: string
  onSave: (name: string) => Promise<void>
}

export function DisplayNameEditor({ currentName, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setValue(currentName)
  }, [currentName, editing])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const name = value.trim()
    if (!name) {
      setError('表示名を入力してください。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(name)
      setEditing(false)
    } catch (err) {
      setError(getErrorMessage(err, '名前の更新に失敗しました。'))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button type="button" className={styles.link} onClick={() => setEditing(true)}>
        名前を変更
      </button>
    )
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSave(event)}>
      <input
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="name"
        aria-label="表示名"
      />
      <button className={styles.primary} type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存'}
      </button>
      <button
        className={styles.ghost}
        type="button"
        disabled={saving}
        onClick={() => {
          setEditing(false)
          setError(null)
        }}
      >
        キャンセル
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  )
}
