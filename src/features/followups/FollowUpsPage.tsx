import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { getErrorMessage } from '../../lib/errors'
import { fetchServices } from '../../lib/facilitiesApi'
import {
  completeFollowUp,
  fetchFollowUps,
  type FollowUpItem,
} from '../../lib/salesVisitsApi'
import type { Service } from '../../types/facility'
import { FacilityDetail } from '../facilities/FacilityDetail'
import styles from './FollowUpsPage.module.css'

type Category = 'overdue' | 'today' | 'next7'

function todayInJst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function categorize(dateStr: string, today: string): Category | null {
  if (dateStr < today) return 'overdue'
  if (dateStr === today) return 'today'
  const diffDays = Math.round(
    (new Date(`${dateStr}T00:00:00+09:00`).getTime() -
      new Date(`${today}T00:00:00+09:00`).getTime()) /
      86_400_000,
  )
  return diffDays <= 7 ? 'next7' : null
}

export function FollowUpsPage() {
  const [items, setItems] = useState<FollowUpItem[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [detailFacilityId, setDetailFacilityId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextItems, nextServices] = await Promise.all([fetchFollowUps(), fetchServices()])
      setItems(nextItems)
      setServices(nextServices)
    } catch (err) {
      console.error('フォロー予定の読み込みに失敗しました:', err)
      setError(getErrorMessage(err, 'フォロー予定の読み込みに失敗しました。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const today = useMemo(() => todayInJst(), [])

  const groups = useMemo(() => {
    const result: Record<Category, FollowUpItem[]> = { overdue: [], today: [], next7: [] }
    for (const item of items) {
      const category = categorize(item.next_follow_up_on, today)
      if (category) result[category].push(item)
    }
    return result
  }, [items, today])

  async function handleComplete(item: FollowUpItem) {
    if (
      !window.confirm(
        `「${item.facility_name}」のフォロー予定（${item.next_follow_up_on}）を対応済みにしますか？`,
      )
    ) {
      return
    }
    setError(null)
    setMessage(null)
    try {
      await completeFollowUp(item.visit_id)
      setItems((prev) => prev.filter((i) => i.visit_id !== item.visit_id))
      setMessage('対応済みにしました。')
    } catch (err) {
      console.error('フォロー対応済み処理に失敗しました:', err)
      setError(getErrorMessage(err, '対応済み処理に失敗しました。'))
    }
  }

  function renderGroup(title: string, key: Category, emptyText: string) {
    const list = groups[key]
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {title}
          <span className={key === 'overdue' ? styles.countWarn : styles.count}>
            {list.length}
          </span>
        </h2>
        {list.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <div className={styles.list}>
            {list.map((item) => (
              <div key={item.visit_id} className={styles.card}>
                <strong>{item.facility_name}</strong>
                <span>予定日: {item.next_follow_up_on}</span>
                {item.follow_up_assignee ? <span>担当: {item.follow_up_assignee}</span> : null}
                {item.follow_up_note ? <span>内容: {item.follow_up_note}</span> : null}
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setDetailFacilityId(item.facility_id)}
                  >
                    施設を開く
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => void handleComplete(item)}
                  >
                    対応済みにする
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>次回フォロー管理</h1>
        <p className={styles.muted}>
          営業履歴の登録時に設定した「次回フォロー予定」を確認できます。
        </p>
      </div>

      {loading ? <LoadingSpinner /> : null}
      {error ? <div className={styles.alert}>{error}</div> : null}
      {message ? <div className={styles.alertOk}>{message}</div> : null}

      {!loading ? (
        <div className={styles.groups}>
          {renderGroup('期限超過', 'overdue', '期限超過のフォロー予定はありません。')}
          {renderGroup('今日', 'today', '今日のフォロー予定はありません。')}
          {renderGroup('今後7日', 'next7', '今後7日以内のフォロー予定はありません。')}
        </div>
      ) : null}

      {detailFacilityId ? (
        <FacilityDetail
          facilityId={detailFacilityId}
          services={services}
          onClose={() => {
            setDetailFacilityId(null)
            void reload()
          }}
          onFacilityUpdated={() => {}}
        />
      ) : null}
    </div>
  )
}
