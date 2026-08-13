import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { getErrorMessage } from '../../lib/errors'
import { fetchFacilities, fetchServices } from '../../lib/facilitiesApi'
import { fetchAllReferralCases } from '../../lib/referralsApi'
import { fetchAllSalesVisits } from '../../lib/salesVisitsApi'
import { facilityTypeLabel, type Facility, type Service } from '../../types/facility'
import { FacilityDetail } from '../facilities/FacilityDetail'
import styles from './AnalyticsPage.module.css'

type Period = 'all' | 'month'

type SortKey =
  | 'name'
  | 'visitCount'
  | 'metCount'
  | 'meetRate'
  | 'daysSinceLastVisit'
  | 'referralCount'
  | 'startedCount'
  | 'startRate'

type SortDir = 'asc' | 'desc'

type Row = {
  facility: Facility
  visitCount: number
  metCount: number
  meetRate: number | null
  lastVisitedOn: string | null
  daysSinceLastVisit: number | null
  referralCount: number
  startedCount: number
  startRate: number | null
}

function toJstDateString(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function todayInJst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '施設名' },
  { key: 'visitCount', label: '訪問数' },
  { key: 'metCount', label: '面会数' },
  { key: 'meetRate', label: '面会率' },
  { key: 'daysSinceLastVisit', label: '最終訪問からの日数' },
  { key: 'referralCount', label: '紹介数' },
  { key: 'startedCount', label: '利用開始数' },
  { key: 'startRate', label: '利用開始率' },
]

export function AnalyticsPage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [visits, setVisits] = useState<{ facility_id: string; visited_at: string; result: string }[]>(
    [],
  )
  const [referrals, setReferrals] = useState<
    { facility_id: string; referred_on: string; status: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [sortKey, setSortKey] = useState<SortKey>('daysSinceLastVisit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [detailFacilityId, setDetailFacilityId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextFacilities, nextServices, nextVisits, nextReferrals] = await Promise.all([
        fetchFacilities(),
        fetchServices(),
        fetchAllSalesVisits(),
        fetchAllReferralCases(),
      ])
      setFacilities(nextFacilities)
      setServices(nextServices)
      setVisits(nextVisits)
      setReferrals(nextReferrals)
    } catch (err) {
      console.error('営業分析データの読み込みに失敗しました:', err)
      setError(getErrorMessage(err, '営業分析データの読み込みに失敗しました。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const today = useMemo(() => todayInJst(), [])
  const monthPrefix = useMemo(() => today.slice(0, 7), [today])

  const rows = useMemo<Row[]>(() => {
    return facilities.map((facility) => {
      const facilityVisits = visits.filter((v) => v.facility_id === facility.id)
      const facilityReferrals = referrals.filter((r) => r.facility_id === facility.id)

      const periodVisits =
        period === 'month'
          ? facilityVisits.filter((v) => toJstDateString(v.visited_at).startsWith(monthPrefix))
          : facilityVisits
      const periodReferrals =
        period === 'month'
          ? facilityReferrals.filter((r) => r.referred_on.startsWith(monthPrefix))
          : facilityReferrals

      const visitCount = periodVisits.length
      const metCount = periodVisits.filter((v) => v.result === 'met').length
      const meetRate = visitCount > 0 ? metCount / visitCount : null

      const lastVisitedOn = facilityVisits.reduce<string | null>((latest, v) => {
        const d = toJstDateString(v.visited_at)
        return !latest || d > latest ? d : latest
      }, null)
      const daysSinceLastVisit = lastVisitedOn
        ? Math.round(
            (new Date(`${today}T00:00:00+09:00`).getTime() -
              new Date(`${lastVisitedOn}T00:00:00+09:00`).getTime()) /
              86_400_000,
          )
        : null

      const referralCount = periodReferrals.length
      const startedCount = periodReferrals.filter((r) => r.status === 'started').length
      const startRate = referralCount > 0 ? startedCount / referralCount : null

      return {
        facility,
        visitCount,
        metCount,
        meetRate,
        lastVisitedOn,
        daysSinceLastVisit,
        referralCount,
        startedCount,
        startRate,
      }
    })
  }, [facilities, visits, referrals, period, monthPrefix, today])

  const sortedRows = useMemo(() => {
    const withValue = (row: Row): number | string => {
      switch (sortKey) {
        case 'name':
          return row.facility.name
        case 'visitCount':
          return row.visitCount
        case 'metCount':
          return row.metCount
        case 'meetRate':
          return row.meetRate ?? -1
        case 'daysSinceLastVisit':
          return row.daysSinceLastVisit ?? Number.MAX_SAFE_INTEGER
        case 'referralCount':
          return row.referralCount
        case 'startedCount':
          return row.startedCount
        case 'startRate':
          return row.startRate ?? -1
        default:
          return 0
      }
    }

    const sorted = [...rows].sort((a, b) => {
      const va = withValue(a)
      const vb = withValue(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'ja')
      }
      return va - vb
    })

    if (sortDir === 'desc') sorted.reverse()
    return sorted
  }, [rows, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function formatRate(rate: number | null): string {
    return rate === null ? '－' : `${Math.round(rate * 100)}%`
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>営業分析一覧</h1>
        <p className={styles.muted}>
          営業先ごとの数字を一覧で比較できます。列見出しをクリックすると並び替えできます。
        </p>
      </div>

      <div className={styles.periodTabs}>
        <button
          type="button"
          className={period === 'all' ? styles.periodActive : styles.period}
          onClick={() => setPeriod('all')}
        >
          全期間
        </button>
        <button
          type="button"
          className={period === 'month' ? styles.periodActive : styles.period}
          onClick={() => setPeriod('month')}
        >
          今月
        </button>
      </div>

      {loading ? <LoadingSpinner /> : null}
      {error ? <div className={styles.alert}>{error}</div> : null}

      {!loading && facilities.length === 0 ? (
        <p className={styles.empty}>まだ施設が登録されていません。</p>
      ) : null}

      {!loading && facilities.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.facility.id}>
                  <td>
                    <button
                      type="button"
                      className={styles.facilityLink}
                      onClick={() => setDetailFacilityId(row.facility.id)}
                    >
                      {row.facility.name}
                    </button>
                    <span className={styles.facilityMeta}>
                      {facilityTypeLabel(row.facility.facility_type)} · {row.facility.city}
                    </span>
                  </td>
                  <td>{row.visitCount}</td>
                  <td>{row.metCount}</td>
                  <td>{formatRate(row.meetRate)}</td>
                  <td>
                    {row.daysSinceLastVisit === null ? '訪問なし' : `${row.daysSinceLastVisit}日`}
                  </td>
                  <td>{row.referralCount}</td>
                  <td>{row.startedCount}</td>
                  <td>{formatRate(row.startRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
