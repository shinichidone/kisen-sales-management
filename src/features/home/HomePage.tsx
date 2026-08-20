import { Compass, MapPin, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DisplayNameEditor } from '../../components/DisplayNameEditor'
import type { AppView } from '../../components/layout/AppShell'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { updateAppUserDisplayName } from '../../lib/appUsersApi'
import { APP_NAME } from '../../lib/brand'
import { getErrorMessage } from '../../lib/errors'
import { fetchServices } from '../../lib/facilitiesApi'
import { fetchAllReferralCases, type ReferralCaseSummary } from '../../lib/referralsApi'
import { fetchAllSalesVisits, type SalesVisitSummary } from '../../lib/salesVisitsApi'
import type { Service } from '../../types/facility'
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

function greetingLabel(): string {
  const hour =
    Number(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }),
    ) % 24
  if (hour < 5) return 'こんばんは'
  if (hour < 11) return 'おはよう'
  if (hour < 18) return 'こんにちは'
  return 'こんばんは'
}

function displayNameWithSan(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'さん'
  return /さん$/.test(trimmed) ? trimmed : `${trimmed}さん`
}

function serviceShortName(service: Service): string {
  if (service.code === 'shoeicho') return '昭栄町'
  if (service.code === 'minami-hanadai') return '南花台'
  if (service.code === 'houmon-kango') return '訪問看護'
  return service.name
}

export function HomePage({ onNavigate, onQuickEntry }: Props) {
  const { appUser, refreshAppUser } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [visits, setVisits] = useState<SalesVisitSummary[]>([])
  const [referrals, setReferrals] = useState<ReferralCaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextServices, nextVisits, nextReferrals] = await Promise.all([
        fetchServices(),
        fetchAllSalesVisits(),
        fetchAllReferralCases(),
      ])
      setServices(nextServices)
      setVisits(nextVisits)
      setReferrals(nextReferrals)
    } catch (err) {
      console.error('ホームの読み込みに失敗しました:', err)
      setError(getErrorMessage(err, 'ホームの読み込みに失敗しました。'))
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
    () => visits.filter((visit) => toJstDateString(visit.visited_at).startsWith(monthPrefix)),
    [visits, monthPrefix],
  )
  const monthReferrals = useMemo(
    () => referrals.filter((referral) => referral.referred_on.startsWith(monthPrefix)),
    [referrals, monthPrefix],
  )

  const overallVisitCount = monthVisits.length
  const overallMetCount = monthVisits.filter((visit) => visit.result === 'met').length
  const overallReferralCount = monthReferrals.length

  const myVisits = useMemo(
    () => (appUser ? monthVisits.filter((visit) => visit.created_by === appUser.id) : []),
    [monthVisits, appUser],
  )
  const myVisitCount = myVisits.length
  const myMetCount = myVisits.filter((visit) => visit.result === 'met').length

  const serviceRows = useMemo(
    () =>
      services.map((service) => ({
        id: service.id,
        name: serviceShortName(service),
        metCount: monthVisits.filter(
          (visit) => visit.result === 'met' && visit.service_ids.includes(service.id),
        ).length,
        referralCount: monthReferrals.filter((referral) => referral.service_id === service.id)
          .length,
      })),
    [services, monthVisits, monthReferrals],
  )

  const givenName = displayNameWithSan(appUser?.display_name ?? '')
  const isAdmin = appUser?.role === 'system_admin'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <Compass size={22} strokeWidth={1.8} className={styles.brandMark} />
          <p className={styles.brand}>{APP_NAME}</p>
        </div>
        <h1 className={styles.greeting}>
          {greetingLabel()}、{givenName}
        </h1>
        {appUser ? (
          <DisplayNameEditor
            currentName={appUser.display_name}
            onSave={async (name) => {
              await updateAppUserDisplayName(appUser.id, name)
              await refreshAppUser()
            }}
          />
        ) : null}
        <p className={styles.lead}>今月の営業状況を確認しましょう</p>
      </header>

      {loading ? <LoadingSpinner /> : null}
      {error ? <div className={styles.alert}>{error}</div> : null}

      {!loading ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>会社全体｜今月</h2>
            <div className={styles.companyGrid}>
              <div className={styles.activityCard}>
                <p className={styles.cardEyebrow}>活動</p>
                <div className={styles.splitKpi}>
                  <div>
                    <span className={styles.kpiValueActivity}>{overallVisitCount}</span>
                    <span className={styles.kpiLabel}>訪問</span>
                  </div>
                  <div>
                    <span className={styles.kpiValueActivity}>{overallMetCount}</span>
                    <span className={styles.kpiLabel}>面会</span>
                  </div>
                </div>
              </div>
              <div className={styles.referralCard}>
                <p className={styles.cardEyebrowReferral}>紹介</p>
                <div className={styles.singleKpi}>
                  <span className={styles.kpiValueReferral}>{overallReferralCount}</span>
                  <span className={styles.kpiLabel}>紹介件数</span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>サービス別営業活動</h2>
            <div className={styles.serviceList}>
              {serviceRows.map((row) => (
                <div key={row.id} className={styles.serviceRow}>
                  <p className={styles.serviceName}>{row.name}</p>
                  <p className={styles.serviceMetrics}>
                    面会 <strong>{row.metCount}</strong>
                    <span className={styles.dot}>｜</span>
                    紹介 <strong className={styles.referralNum}>{row.referralCount}</strong>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>あなた｜今月</h2>
            <div className={styles.youCard}>
              <span>
                訪問 <strong>{myVisitCount}</strong>
              </span>
              <span className={styles.dot}>｜</span>
              <span>
                面会 <strong>{myMetCount}</strong>
              </span>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <button type="button" className={styles.cta} onClick={() => onQuickEntry('visit')}>
              <Plus size={22} strokeWidth={2.2} />
              営業記録を登録
            </button>
            <button type="button" className={styles.subLink} onClick={() => onNavigate('map')}>
              <MapPin size={16} strokeWidth={1.8} />
              近くの営業先を見る
            </button>
          </section>

          {isAdmin ? (
            <button type="button" className={styles.adminLink} onClick={() => onNavigate('users')}>
              ユーザー管理
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
