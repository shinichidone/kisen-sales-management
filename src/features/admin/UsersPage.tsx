import { useCallback, useEffect, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { fetchAppUsers, setAppUserServices, updateAppUserRoleStatus } from '../../lib/appUsersApi'
import { getErrorMessage } from '../../lib/errors'
import { fetchServices } from '../../lib/facilitiesApi'
import { APP_ROLES, APP_USER_STATUSES, type AppRole, type AppUserStatus, type AppUserWithServices } from '../../types/appUser'
import type { Service } from '../../types/facility'
import styles from './UsersPage.module.css'

export function UsersPage() {
  const { appUser: me } = useAuth()
  const [users, setUsers] = useState<AppUserWithServices[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextUsers, nextServices] = await Promise.all([fetchAppUsers(), fetchServices()])
      setUsers(nextUsers)
      setServices(nextServices)
    } catch (err) {
      console.error('ユーザー一覧の読み込みに失敗しました:', err)
      setError(getErrorMessage(err, 'ユーザー一覧の読み込みに失敗しました。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleRoleChange(user: AppUserWithServices, role: AppRole) {
    setSavingId(user.id)
    setError(null)
    setMessage(null)
    try {
      await updateAppUserRoleStatus(user.id, { role, status: user.status })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)))
      setMessage(`「${user.display_name}」の役割を更新しました。`)
    } catch (err) {
      console.error('役割の更新に失敗しました:', err)
      setError(getErrorMessage(err, '役割の更新に失敗しました。'))
    } finally {
      setSavingId(null)
    }
  }

  async function handleStatusChange(user: AppUserWithServices, status: AppUserStatus) {
    setSavingId(user.id)
    setError(null)
    setMessage(null)
    try {
      await updateAppUserRoleStatus(user.id, { role: user.role, status })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status } : u)))
      setMessage(`「${user.display_name}」のステータスを更新しました。`)
    } catch (err) {
      console.error('ステータスの更新に失敗しました:', err)
      setError(getErrorMessage(err, 'ステータスの更新に失敗しました。'))
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleService(user: AppUserWithServices, serviceId: string) {
    const nextServiceIds = user.service_ids.includes(serviceId)
      ? user.service_ids.filter((id) => id !== serviceId)
      : [...user.service_ids, serviceId]

    setSavingId(user.id)
    setError(null)
    setMessage(null)
    try {
      await setAppUserServices(user.id, nextServiceIds)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, service_ids: nextServiceIds } : u)),
      )
    } catch (err) {
      console.error('所属事業所の更新に失敗しました:', err)
      setError(getErrorMessage(err, '所属事業所の更新に失敗しました。'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>ユーザー管理</h1>
        <p className={styles.muted}>
          新規登録されたユーザーの承認、役割・所属事業所の設定を行います。
        </p>
      </div>

      {loading ? <LoadingSpinner /> : null}
      {error ? <div className={styles.alert}>{error}</div> : null}
      {message ? <div className={styles.alertOk}>{message}</div> : null}

      {!loading ? (
        <div className={styles.list}>
          {users.map((user) => {
            const isSelf = user.id === me?.id
            return (
              <div key={user.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{user.display_name}</strong>
                    <span className={styles.email}>{user.email}</span>
                  </div>
                  <span
                    className={
                      user.status === 'active'
                        ? styles.statusBadgeActive
                        : user.status === 'pending'
                          ? styles.statusBadgePending
                          : styles.statusBadgeDisabled
                    }
                  >
                    {APP_USER_STATUSES.find((s) => s.value === user.status)?.label}
                  </span>
                </div>

                {isSelf ? (
                  <p className={styles.hint}>自分自身の役割・ステータスはここから変更できません。</p>
                ) : (
                  <div className={styles.row}>
                    <label className={styles.label}>
                      役割
                      <select
                        className={styles.select}
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(e) => void handleRoleChange(user, e.target.value as AppRole)}
                      >
                        {APP_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.label}>
                      ステータス
                      <select
                        className={styles.select}
                        value={user.status}
                        disabled={savingId === user.id}
                        onChange={(e) =>
                          void handleStatusChange(user, e.target.value as AppUserStatus)
                        }
                      >
                        {APP_USER_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div>
                  <p className={styles.sectionTitle}>所属事業所（事業所管理者の権限スコープに使用）</p>
                  <div className={styles.checkGroup}>
                    {services.map((service) => (
                      <label key={service.id} className={styles.checkItem}>
                        <input
                          type="checkbox"
                          checked={user.service_ids.includes(service.id)}
                          disabled={isSelf || savingId === user.id}
                          onChange={() => void handleToggleService(user, service.id)}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
