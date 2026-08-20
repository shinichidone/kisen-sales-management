import { Compass, MapPin, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DisplayNameEditor } from '../../components/DisplayNameEditor'
import type { AppView } from '../../components/layout/AppShell'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { updateAppUserDisplayName } from '../../lib/appUsersApi'
import { APP_NAME } from '../../lib/brand'
import { getErrorMessage } from '../../lib/errors'
import { fetchFacilities, fetchServices } from '../../lib/facilitiesApi'
import { fetchAllReferralCases, type ReferralCaseSummary } from '../../lib/referralsApi'
import { fetchAllSalesVisits, type SalesVisitSummary } from '../../lib/salesVisitsApi'
import type { Facility, Service } from '../../types/facility'
import { referralStatusLabel } from '../../types/referral'
import { salesVisitResultLabel } from '../../types/salesVisit'
import { FacilityDetail } from '../facilities/FacilityDetail'
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

function formatMonthLabel(monthValue: string): string {
  const [year, month] = monthValue.split('-')
  return `${Number(year)}年${Number(month)}月`
}

function formatVisitDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(ymd: string): string {
  const [year, month, day] = ymd.split('-')
  return `${Number(year)}/${Number(month)}/${Number(day)}`
}

type MonthListKind = 'visits' | 'met' | 'referrals'

function serviceShortName(service: Service): string {
  if (service.code === 'shoeicho') return '昭栄町'
  if (service.code === 'minami-hanadai') return '南花台'
  if (service.code === 'houmon-kango') return '訪問看護'
  return service.name
}

export function HomePage({ onNavigate, onQuickEntry }: Props) {
  const { appUser, refreshAppUser } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [visits, setVisits] = useState<SalesVisitSummary[]>([])
  const [referrals, setReferrals] = useState<ReferralCaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthListKind, setMonthListKind] = useState<MonthListKind | null>(null)
  const [detailFacilityId, setDetailFacilityId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextServices, nextFacilities, nextVisits, nextReferrals] = await Promise.all([
        fetchServices(),
        fetchFacilities(),
        fetchAllSalesVisits(),
        fetchAllReferralCases(),
      ])
      setServices(nextServices)
      setFacilities(nextFacilities)
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
  const monthLabel = formatMonthLabel(monthPrefix)

  const facilityNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const facility of facilities) {
      map.set(facility.id, facility.name)
    }
    return map
  }, [facilities])

  const monthVisitItems = useMemo(() => {
    const rows = monthListKind === 'met' ? monthVisits.filter((visit) => visit.result === 'met') : monthVisits
    return [...rows].sort((a, b) => b.visited_at.localeCompare(a.visited_at))
  }, [monthListKind, monthVisits])

  const monthReferralItems = useMemo(
    () => [...monthReferrals].sort((a, b) => b.referred_on.localeCompare(a.referred_on)),
    [monthReferrals],
  )

  const listTitle =
    monthListKind === 'visits'
      ? `${monthLabel}の訪問`
      : monthListKind === 'met'
        ? `${monthLabel}の面会`
        : `${monthLabel}の紹介`

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
            <p className={styles.sectionHint}>数字をタップすると、今月の一覧が見られます</p>
            <div className={styles.companyGrid}>
              <div className={styles.activityCard}>
                <p className={styles.cardEyebrow}>活動</p>
                <div className={styles.splitKpi}>
                  <button
                    type="button"
                    className={styles.kpiButton}
                    onClick={() => setMonthListKind('visits')}
                  >
                    <span className={styles.kpiValueActivity}>{overallVisitCount}</span>
                    <span className={styles.kpiLabel}>訪問</span>
                  </button>
                  <button
                    type="button"
                    className={styles.kpiButton}
                    onClick={() => setMonthListKind('met')}
                  >
                    <span className={styles.kpiValueActivity}>{overallMetCount}</span>
                    <span className={styles.kpiLabel}>面会</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={styles.referralCardButton}
                onClick={() => setMonthListKind('referrals')}
              >
                <p className={styles.cardEyebrowReferral}>紹介</p>
                <div className={styles.singleKpi}>
                  <span className={styles.kpiValueReferral}>{overallReferralCount}</span>
                  <span className={styles.kpiLabel}>紹介件数</span>
                </div>
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>サービス別営業活動｜今月</h2>
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

      {monthListKind ? (
        <div className={styles.listOverlay}>
          <div className={styles.listPanel} role="dialog" aria-modal="true" aria-labelledby="month-list-title">
            <div className={styles.listHeader}>
              <div>
                <h2 id="month-list-title">{listTitle}</h2>
                <p>施設をタップすると詳細を開けます</p>
              </div>
              <button type="button" className={styles.listClose} onClick={() => setMonthListKind(null)}>
                閉じる
              </button>
            </div>
            <div className={styles.listBody}>
              {monthListKind === 'referrals' ? (
                monthReferralItems.length === 0 ? (
                  <p className={styles.listEmpty}>今月の紹介はまだありません。</p>
                ) : (
                  monthReferralItems.map((referral, index) => (
                    <button
                      key={`${referral.facility_id}-${referral.referred_on}-${index}`}
                      type="button"
                      className={styles.listItem}
                      onClick={() => setDetailFacilityId(referral.facility_id)}
                    >
                      <span className={styles.listItemDate}>{formatDateLabel(referral.referred_on)}</span>
                      <span className={styles.listItemName}>
                        {facilityNameById.get(referral.facility_id) ?? '（施設名なし）'}
                      </span>
                      <span className={styles.listItemMeta}>{referralStatusLabel(referral.status)}</span>
                    </button>
                  ))
                )
              ) : monthVisitItems.length === 0 ? (
                <p className={styles.listEmpty}>
                  {monthListKind === 'met' ? '今月の面会はまだありません。' : '今月の訪問はまだありません。'}
                </p>
              ) : (
                monthVisitItems.map((visit, index) => (
                  <button
                    key={`${visit.facility_id}-${visit.visited_at}-${index}`}
                    type="button"
                    className={styles.listItem}
                    onClick={() => setDetailFacilityId(visit.facility_id)}
                  >
                    <span className={styles.listItemDate}>{formatVisitDateTime(visit.visited_at)}</span>
                    <span className={styles.listItemName}>
                      {facilityNameById.get(visit.facility_id) ?? '（施設名なし）'}
                    </span>
                    <span className={styles.listItemMeta}>{salesVisitResultLabel(visit.result)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {detailFacilityId ? (
        <FacilityDetail
          facilityId={detailFacilityId}
          services={services}
          initialTab={monthListKind === 'referrals' ? 'referrals' : 'visits'}
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
