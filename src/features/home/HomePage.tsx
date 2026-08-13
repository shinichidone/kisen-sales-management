import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppView } from '../../components/layout/AppShell'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../lib/errors'
import { fetchAllReferralCases, type ReferralCaseSummary } from '../../lib/referralsApi'
import {
  fetchAllSalesVisits,
  fetchFollowUps,
  type SalesVisitSummary,
} from '../../lib/salesVisitsApi'
import styles from './HomePage.module.css'

type QuickEntryKind = 'browse' | 'visit' | 'referral'

type Props = {
  onNavigate: (view: AppView) => void
  onQuickEntry: (kind: QuickEntryKind) => void
}

function todayInJst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function toJstDateString(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function categorizeFollowUp(dateStr: string, today: string): 'overdue' | 'today' | 'next7' | null {
  if (dateStr < today) return 'overdue'
  if (dateStr === today) return 'today'
  const diffDays = Math.round(
    (new Date(`${dateStr}T00:00:00+09:00`).getTime() -
      new Date(`${today}T00:00:00+09:00`).getTime()) /
      86_400_000,
  )
  return diffDays <= 7 ? 'next7' : null
}

export function HomePage({ onNavigate, onQuickEntry }: Props) {
  const { appUser } = useAuth()
  const [visits, setVisits] = useState<SalesVisitSummary[]>([])
  const [referrals, setReferrals] = useState<ReferralCaseSummary[]>([])
  const [followUpDates, setFollowUpDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextVisits, nextReferrals, followUps] = await Promise.all([
        fetchAllSalesVisits(),
        fetchAllReferralCases(),
        fetchFollowUps(),
      ])
      setVisits(nextVisits)
      setReferrals(nextReferrals)
      setFollowUpDates(followUps.map((item) => item.next_follow_up_on))
    } catch (err) {
      console.error('ホームダッシュボードの読み込みに失敗しました:', err)
      setError(getErrorMessage(err, 'ダッシュボードの読み込みに失敗しました。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const today = useMemo(() => todayInJst(), [])
  const monthPrefix = useMemo(() => today.slice(0, 7), [today])

  const monthVisits = useMemo(
    () => visits.filter((v) => toJstDateString(v.visited_at).startsWith(monthPrefix)),
    [visits, monthPrefix],
  )
  const monthReferrals = useMemo(
    () => referrals.filter((r) => r.referred_on.startsWith(monthPrefix)),
    [referrals, monthPrefix],
  )

  const overallVisitCount = monthVisits.length
  const overallMetCount = monthVisits.filter((v) => v.result === 'met').length
  const overallReferralCount = monthReferrals.length
  const overallStartedCount = monthReferrals.filter((r) => r.status === 'started').length

  const myVisits = useMemo(
    () => (appUser ? monthVisits.filter((v) => v.created_by === appUser.id) : []),
    [monthVisits, appUser],
  )
  const myVisitCount = myVisits.length
  const myMetCount = myVisits.filter((v) => v.result === 'met').length

  const followUpCounts = useMemo(() => {
    const counts = { overdue: 0, today: 0, next7: 0 }
    for (const date of followUpDates) {
      const category = categorizeFollowUp(date, today)
      if (category) counts[category] += 1
    }
    return counts
  }, [followUpDates, today])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>ようこそ、{appUser?.display_name ?? ''}さん</h1>
        <p className={styles.muted}>今月の営業活動の状況とフォロー予定を確認できます。</p>
      </div>

      {loading ? <LoadingSpinner /> : null}
      {error ? <div className={styles.alert}>{error}</div> : null}

      {!loading ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>会社全体（今月）</h2>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{overallVisitCount}</span>
                <span className={styles.statLabel}>訪問数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{overallMetCount}</span>
                <span className={styles.statLabel}>面会数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{overallReferralCount}</span>
                <span className={styles.statLabel}>紹介数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{overallStartedCount}</span>
                <span className={styles.statLabel}>利用開始数</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>あなたの成績（今月）</h2>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{myVisitCount}</span>
                <span className={styles.statLabel}>訪問数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{myMetCount}</span>
                <span className={styles.statLabel}>面会数</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>フォロー予定</h2>
            <div className={styles.followRow}>
              <button type="button" className={styles.followCard} onClick={() => onNavigate('followups')}>
                <span className={styles.followCountWarn}>{followUpCounts.overdue}</span>
                <span>期限超過</span>
              </button>
              <button type="button" className={styles.followCard} onClick={() => onNavigate('followups')}>
                <span className={styles.followCount}>{followUpCounts.today}</span>
                <span>今日</span>
              </button>
              <button type="button" className={styles.followCard} onClick={() => onNavigate('followups')}>
                <span className={styles.followCount}>{followUpCounts.next7}</span>
                <span>今後7日</span>
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>ショートカット</h2>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => onQuickEntry('browse')}>
                近くの営業先を探す
              </button>
              <button type="button" className={styles.primary} onClick={() => onQuickEntry('visit')}>
                営業記録を登録
              </button>
              <button type="button" className={styles.secondary} onClick={() => onNavigate('map')}>
                営業MAPを開く
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
