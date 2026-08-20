import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { getErrorMessage } from '../../lib/errors'
import { fetchFacilities, fetchServices } from '../../lib/facilitiesApi'
import { fetchAllReferralCases, type ReferralCaseSummary } from '../../lib/referralsApi'
import { fetchAllSalesVisits, type SalesVisitSummary } from '../../lib/salesVisitsApi'
import { facilityTypeLabel, type Facility, type Service } from '../../types/facility'
import { FacilityDetail } from '../facilities/FacilityDetail'
import styles from './AnalyticsPage.module.css'

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

type SortPreset = 'visits_desc' | 'visits_asc' | 'referrals_desc' | 'referrals_asc'

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

function currentMonthValue(): string {
  return todayInJst().slice(0, 7)
}

function formatMonthLabel(monthValue: string): string {
  const [year, month] = monthValue.split('-')
  return `${Number(year)}年${Number(month)}月`
}

function serviceShortName(service: Service): string {
  if (service.code === 'shoeicho') return '昭栄町'
  if (service.code === 'minami-hanadai') return '南花台'
  if (service.code === 'houmon-kango') return '訪問看護'
  return service.name
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

const SORT_PRESETS: { value: SortPreset; label: string; key: SortKey; dir: SortDir }[] = [
  { value: 'visits_desc', label: '営業件数が多い順', key: 'visitCount', dir: 'desc' },
  { value: 'visits_asc', label: '営業件数が少ない順', key: 'visitCount', dir: 'asc' },
  { value: 'referrals_desc', label: '紹介数が多い順', key: 'referralCount', dir: 'desc' },
  { value: 'referrals_asc', label: '紹介数が少ない順', key: 'referralCount', dir: 'asc' },
]

export function AnalyticsPage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [visits, setVisits] = useState<SalesVisitSummary[]>([])
  const [referrals, setReferrals] = useState<ReferralCaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceId, setServiceId] = useState<string>('all')
  const [period, setPeriod] = useState<'all' | 'month'>('month')
  const [monthValue, setMonthValue] = useState(currentMonthValue)
  const [sortKey, setSortKey] = useState<SortKey>('visitCount')
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

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      if (serviceId !== 'all' && !visit.service_ids.includes(serviceId)) return false
      if (period === 'month' && !toJstDateString(visit.visited_at).startsWith(monthValue)) {
        return false
      }
      return true
    })
  }, [visits, serviceId, period, monthValue])

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) => {
      if (serviceId !== 'all' && referral.service_id !== serviceId) return false
      if (period === 'month' && !referral.referred_on.startsWith(monthValue)) return false
      return true
    })
  }, [referrals, serviceId, period, monthValue])

  const rows = useMemo<Row[]>(() => {
    return facilities.map((facility) => {
      const facilityVisits = filteredVisits.filter((visit) => visit.facility_id === facility.id)
      const facilityReferrals = filteredReferrals.filter(
        (referral) => referral.facility_id === facility.id,
      )

      const visitCount = facilityVisits.length
      const metCount = facilityVisits.filter((visit) => visit.result === 'met').length
      const meetRate = visitCount > 0 ? metCount / visitCount : null

      const lastVisitedOn = facilityVisits.reduce<string | null>((latest, visit) => {
        const date = toJstDateString(visit.visited_at)
        return !latest || date > latest ? date : latest
      }, null)
      const daysSinceLastVisit = lastVisitedOn
        ? Math.round(
            (new Date(`${today}T00:00:00+09:00`).getTime() -
              new Date(`${lastVisitedOn}T00:00:00+09:00`).getTime()) /
              86_400_000,
          )
        : null

      const referralCount = facilityReferrals.length
      const startedCount = facilityReferrals.filter((referral) => referral.status === 'started')
        .length
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
  }, [facilities, filteredVisits, filteredReferrals, today])

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

  const sortPreset = useMemo<SortPreset | ''>(() => {
    const match = SORT_PRESETS.find((item) => item.key === sortKey && item.dir === sortDir)
    return match?.value ?? ''
  }, [sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' ? 'asc' : 'desc')
  }

  function handleSortPreset(value: string) {
    const preset = SORT_PRESETS.find((item) => item.value === value)
    if (!preset) return
    setSortKey(preset.key)
    setSortDir(preset.dir)
  }

  function formatRate(rate: number | null): string {
    return rate === null ? '－' : `${Math.round(rate * 100)}%`
  }

  const periodLabel = period === 'all' ? '全期間' : formatMonthLabel(monthValue)
  const selectedService = services.find((service) => service.id === serviceId)
  const scopeLabel = selectedService ? ` ／ ${serviceShortName(selectedService)}` : ''

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>営業分析一覧</h1>
        <p className={styles.muted}>
          事業所と月を指定して、営業件数・紹介数の多い順／少ない順で比較できます。
        </p>
      </div>

      <section className={styles.filters} aria-label="絞り込み">
        <div className={styles.filterBlock}>
          <p className={styles.filterLabel}>事業所</p>
          <div className={styles.chips}>
            <button
              type="button"
              className={serviceId === 'all' ? styles.chipActive : styles.chip}
              onClick={() => setServiceId('all')}
            >
              すべて
            </button>
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={serviceId === service.id ? styles.chipActive : styles.chip}
                onClick={() => setServiceId(service.id)}
              >
                {serviceShortName(service)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterBlock}>
          <p className={styles.filterLabel}>期間</p>
          <div className={styles.chips}>
            <button
              type="button"
              className={period === 'all' ? styles.chipActive : styles.chip}
              onClick={() => setPeriod('all')}
            >
              全期間
            </button>
            <button
              type="button"
              className={period === 'month' ? styles.chipActive : styles.chip}
              onClick={() => setPeriod('month')}
            >
              月を指定
            </button>
          </div>
          {period === 'month' ? (
            <label className={styles.monthField}>
              <span className={styles.monthCaption}>対象月</span>
              <input
                type="month"
                className={styles.monthInput}
                value={monthValue}
                max={currentMonthValue()}
                onChange={(event) => setMonthValue(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <label className={styles.filterBlock}>
          <span className={styles.filterLabel}>並び順</span>
          <select
            className={styles.select}
            value={sortPreset}
            onChange={(event) => handleSortPreset(event.target.value)}
          >
            {SORT_PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
            {sortPreset === '' ? <option value="">その他の並び</option> : null}
          </select>
        </label>
      </section>

      <p className={styles.resultHint}>
        {periodLabel}
        {scopeLabel}
      </p>

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

      {!loading && facilities.length > 0 ? (
        <div className={styles.mobileList}>
          {sortedRows.map((row) => (
            <button
              key={row.facility.id}
              type="button"
              className={styles.mobileRow}
              onClick={() => setDetailFacilityId(row.facility.id)}
            >
              <span className={styles.mobileVisitCount}>
                {row.visitCount}
                <span className={styles.mobileVisitLabel}>訪問</span>
              </span>
              <span className={styles.mobileFacility}>
                <span className={styles.mobileName}>{row.facility.name}</span>
                <span className={styles.facilityMeta}>
                  {facilityTypeLabel(row.facility.facility_type)} · {row.facility.city}
                </span>
              </span>
            </button>
          ))}
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
