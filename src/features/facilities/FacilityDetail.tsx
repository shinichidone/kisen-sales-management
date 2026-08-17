import { useCallback, useEffect, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import {
  createContactAtFacility,
  deleteFacilityContact,
  endAffiliation,
  fetchFacilityAffiliations,
  updateContact,
} from '../../lib/contactsApi'
import { cityFromAddressText } from '../../lib/city'
import { getErrorMessage } from '../../lib/errors'
import { geocodeAddress } from '../../lib/geocode'
import {
  fetchFacilityById,
  fetchFacilityMemoHistories,
  updateFacility,
  updateFacilitySharedMemo,
} from '../../lib/facilitiesApi'
import { createReferralCase, fetchFacilityReferralCases, updateReferralCase } from '../../lib/referralsApi'
import {
  createSalesVisit,
  fetchFacilitySalesVisits,
  nowForDatetimeLocalInput,
  toDatetimeLocalInput,
  updateSalesVisit,
} from '../../lib/salesVisitsApi'
import type { AppUserWithServices } from '../../types/appUser'
import {
  CONTACT_JOB_ROLES,
  contactJobRoleLabel,
  type ContactDraft,
  type ContactJobRole,
  type FacilityAffiliation,
  type FacilityMemoHistory,
} from '../../types/contact'
import {
  FACILITY_TYPES,
  facilityTypeLabel,
  type Facility,
  type FacilityType,
  type Service,
} from '../../types/facility'
import {
  REFERRAL_LOST_REASONS,
  REFERRAL_STATUSES,
  referralLostReasonLabel,
  referralStatusLabel,
  type ReferralCase,
  type ReferralCaseDraft,
  type ReferralLostReason,
  type ReferralStatus,
} from '../../types/referral'
import {
  SALES_VISIT_RESULTS,
  salesVisitResultLabel,
  type SalesVisit,
  type SalesVisitDraft,
  type SalesVisitResult,
} from '../../types/salesVisit'
import { FacilityLocationEditor } from './FacilityLocationEditor'
import styles from './FacilityDetail.module.css'

type Tab = 'overview' | 'contacts' | 'visits' | 'referrals' | 'memo'
export type FacilityDetailTab = Tab

type Props = {
  facilityId: string
  services: Service[]
  initialTab?: Tab
  onClose: () => void
  onFacilityUpdated: (facility: Facility) => void
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function canEditVisit(
  visit: Pick<SalesVisit, 'created_by' | 'created_at' | 'service_ids'>,
  appUser: AppUserWithServices | null,
): boolean {
  if (!appUser) return false
  if (appUser.role === 'system_admin') return true
  if (appUser.role === 'facility_admin') {
    return visit.service_ids.some((id) => appUser.service_ids.includes(id))
  }
  if (!visit.created_by || visit.created_by !== appUser.id) return false
  return Date.now() - new Date(visit.created_at).getTime() <= SEVEN_DAYS_MS
}

function canEditReferral(
  item: Pick<ReferralCase, 'service_id'>,
  appUser: AppUserWithServices | null,
): boolean {
  if (!appUser) return false
  if (appUser.role === 'system_admin') return true
  if (appUser.role === 'facility_admin') return appUser.service_ids.includes(item.service_id)
  return false
}

const emptyContactDraft: ContactDraft = {
  name: '',
  job_role: 'care_manager',
  job_role_other: '',
  note: '',
}

function emptyVisitDraft(): SalesVisitDraft {
  return {
    visited_at: nowForDatetimeLocalInput(),
    result: 'met',
    contact_ids: [],
    service_ids: [],
    memo: '',
    next_follow_up_on: '',
    follow_up_note: '',
    follow_up_assignee: '',
  }
}

function todayForDateInput(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function emptyReferralDraft(): ReferralCaseDraft {
  return {
    source_contact_id: '',
    service_id: '',
    related_visit_id: '',
    referred_on: todayForDateInput(),
    status: 'referred',
    lost_reason: '',
    lost_reason_other: '',
    note: '',
  }
}

export function FacilityDetail({
  facilityId,
  services,
  initialTab,
  onClose,
  onFacilityUpdated,
}: Props) {
  const { appUser } = useAuth()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'overview')
  const [facility, setFacility] = useState<Facility | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [facilityType, setFacilityType] = useState<FacilityType>('home_care_support')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(0)
  const [lng, setLng] = useState(0)
  const [locating, setLocating] = useState(false)
  const [savingOverview, setSavingOverview] = useState(false)

  const [currentContacts, setCurrentContacts] = useState<FacilityAffiliation[]>([])
  const [pastContacts, setPastContacts] = useState<FacilityAffiliation[]>([])
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContactDraft)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)

  const [salesVisits, setSalesVisits] = useState<SalesVisit[]>([])
  const [visitDraft, setVisitDraft] = useState<SalesVisitDraft>(emptyVisitDraft)
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
  const [savingVisit, setSavingVisit] = useState(false)

  const [referralCases, setReferralCases] = useState<ReferralCase[]>([])
  const [referralDraft, setReferralDraft] = useState<ReferralCaseDraft>(emptyReferralDraft)
  const [editingReferralId, setEditingReferralId] = useState<string | null>(null)
  const [savingReferral, setSavingReferral] = useState(false)

  const [memo, setMemo] = useState('')
  const [histories, setHistories] = useState<FacilityMemoHistory[]>([])
  const [savingMemo, setSavingMemo] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextFacility, affiliations, nextHistories, nextVisits, nextReferrals] =
        await Promise.all([
          fetchFacilityById(facilityId),
          fetchFacilityAffiliations(facilityId),
          fetchFacilityMemoHistories(facilityId),
          fetchFacilitySalesVisits(facilityId),
          fetchFacilityReferralCases(facilityId),
        ])
      setFacility(nextFacility)
      setName(nextFacility.name)
      setFacilityType(nextFacility.facility_type)
      setPhone(nextFacility.phone ?? '')
      setAddress(nextFacility.address)
      setLat(nextFacility.lat)
      setLng(nextFacility.lng)
      setMemo(nextFacility.shared_memo)
      setCurrentContacts(affiliations.current)
      setPastContacts(affiliations.past)
      setHistories(nextHistories)
      setSalesVisits(nextVisits)
      setReferralCases(nextReferrals)
    } catch (err) {
      console.error('施設詳細の読み込みに失敗しました:', err)
      setError(getErrorMessage(err, '施設詳細の読み込みに失敗しました。'))
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  const knownContacts = [...currentContacts, ...pastContacts]
    .map((item) => item.contact)
    .filter((contact, index, arr) => arr.findIndex((c) => c.id === contact.id) === index)

  function contactNameLookup(contactId: string): string {
    return knownContacts.find((c) => c.id === contactId)?.name ?? '（不明な担当者）'
  }

  function serviceNameLookup(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? '（不明なサービス）'
  }

  function toggleVisitContact(contactId: string) {
    setVisitDraft((prev) => ({
      ...prev,
      contact_ids: prev.contact_ids.includes(contactId)
        ? prev.contact_ids.filter((id) => id !== contactId)
        : [...prev.contact_ids, contactId],
    }))
  }

  function toggleVisitService(serviceId: string) {
    setVisitDraft((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter((id) => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }))
  }

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleSaveOverview(event: React.FormEvent) {
    event.preventDefault()
    setSavingOverview(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateFacility(facilityId, {
        name,
        facility_type: facilityType,
        phone,
        city: cityFromAddressText(address) || facility?.city || '未設定',
        address,
        lat,
        lng,
      })
      setFacility(updated)
      onFacilityUpdated(updated)
      setMessage('施設情報を更新しました。')
    } catch (err) {
      console.error('施設情報の更新に失敗しました:', err)
      setError(getErrorMessage(err, '更新に失敗しました。'))
    } finally {
      setSavingOverview(false)
    }
  }

  async function handleSaveContact(event: React.FormEvent) {
    event.preventDefault()
    setSavingContact(true)
    setError(null)
    setMessage(null)
    try {
      if (editingContactId) {
        await updateContact(editingContactId, contactDraft)
        setMessage('担当者情報を更新しました。')
      } else {
        await createContactAtFacility(facilityId, contactDraft)
        setMessage('担当者を追加しました。')
      }
      setContactDraft(emptyContactDraft)
      setEditingContactId(null)
      const affiliations = await fetchFacilityAffiliations(facilityId)
      setCurrentContacts(affiliations.current)
      setPastContacts(affiliations.past)
    } catch (err) {
      console.error('担当者の保存に失敗しました:', err)
      setError(getErrorMessage(err, '担当者の保存に失敗しました。'))
    } finally {
      setSavingContact(false)
    }
  }

  async function handleEndAffiliation(affiliationId: string, contactName: string) {
    if (!window.confirm(`「${contactName}」を現在の担当者一覧から外しますか？\n人物データと過去所属は残ります。`)) {
      return
    }
    setError(null)
    setMessage(null)
    try {
      await endAffiliation(affiliationId)
      const affiliations = await fetchFacilityAffiliations(facilityId)
      setCurrentContacts(affiliations.current)
      setPastContacts(affiliations.past)
      setMessage('現所属から外しました（過去所属に残ります）。')
    } catch (err) {
      console.error('所属の更新に失敗しました:', err)
      setError(getErrorMessage(err, '所属の更新に失敗しました。'))
    }
  }

  async function handleDeleteAffiliation(item: FacilityAffiliation) {
    const historyNote = item.ended_on ? '（過去の履歴です）' : ''
    if (
      !window.confirm(
        `「${item.contact.name}」の担当者情報を完全に削除しますか？${historyNote}\nこの操作は取り消せません。`,
      )
    ) {
      return
    }
    setError(null)
    setMessage(null)
    try {
      const result = await deleteFacilityContact(item.id, item.contact.id)
      if (editingContactId === item.contact.id) {
        setEditingContactId(null)
        setContactDraft(emptyContactDraft)
      }
      const affiliations = await fetchFacilityAffiliations(facilityId)
      setCurrentContacts(affiliations.current)
      setPastContacts(affiliations.past)
      setMessage(
        result.contactDeleted
          ? '担当者を削除しました（他施設の所属もないため人物データも削除しました）。'
          : 'この施設での担当者情報を削除しました。',
      )
    } catch (err) {
      console.error('担当者の削除に失敗しました:', err)
      setError(getErrorMessage(err, '削除に失敗しました。'))
    }
  }

  async function handleSaveVisit(event: React.FormEvent) {
    event.preventDefault()
    setSavingVisit(true)
    setError(null)
    setMessage(null)
    try {
      if (editingVisitId) {
        await updateSalesVisit(editingVisitId, visitDraft)
        setMessage('営業履歴を更新しました。')
      } else {
        if (!appUser) throw new Error('ログイン情報を確認できませんでした。')
        await createSalesVisit(facilityId, visitDraft, {
          id: appUser.id,
          displayName: appUser.display_name,
        })
        setMessage('営業履歴を登録しました。')
      }
      setVisitDraft(emptyVisitDraft())
      setEditingVisitId(null)
      setSalesVisits(await fetchFacilitySalesVisits(facilityId))
    } catch (err) {
      console.error('営業履歴の保存に失敗しました:', err)
      setError(getErrorMessage(err, '営業履歴の保存に失敗しました。'))
    } finally {
      setSavingVisit(false)
    }
  }

  function startEditVisit(visit: SalesVisit) {
    setEditingVisitId(visit.id)
    setVisitDraft({
      visited_at: toDatetimeLocalInput(visit.visited_at),
      result: visit.result,
      contact_ids: visit.contact_ids,
      service_ids: visit.service_ids,
      memo: visit.memo,
      next_follow_up_on: visit.next_follow_up_on ?? '',
      follow_up_note: visit.follow_up_note,
      follow_up_assignee: visit.follow_up_assignee,
    })
    setTab('visits')
  }

  async function handleSaveReferral(event: React.FormEvent) {
    event.preventDefault()
    setSavingReferral(true)
    setError(null)
    setMessage(null)
    try {
      if (editingReferralId) {
        await updateReferralCase(editingReferralId, referralDraft)
        setMessage('紹介案件を更新しました。')
      } else {
        await createReferralCase(facilityId, referralDraft)
        setMessage('紹介案件を登録しました。')
      }
      setReferralDraft(emptyReferralDraft())
      setEditingReferralId(null)
      setReferralCases(await fetchFacilityReferralCases(facilityId))
    } catch (err) {
      console.error('紹介案件の保存に失敗しました:', err)
      setError(getErrorMessage(err, '紹介案件の保存に失敗しました。'))
    } finally {
      setSavingReferral(false)
    }
  }

  function startEditReferral(item: ReferralCase) {
    setEditingReferralId(item.id)
    setReferralDraft({
      source_contact_id: item.source_contact_id ?? '',
      service_id: item.service_id,
      related_visit_id: item.related_visit_id ?? '',
      referred_on: item.referred_on,
      status: item.status,
      lost_reason: item.lost_reason ?? '',
      lost_reason_other: item.lost_reason_other ?? '',
      note: item.note,
    })
    setTab('referrals')
  }

  async function handleSaveMemo(event: React.FormEvent) {
    event.preventDefault()
    setSavingMemo(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateFacilitySharedMemo(
        facilityId,
        memo,
        appUser?.display_name ?? '不明なユーザー',
      )
      setFacility(updated)
      setMemo(updated.shared_memo)
      onFacilityUpdated(updated)
      setHistories(await fetchFacilityMemoHistories(facilityId))
      setMessage('共有メモを更新しました。')
    } catch (err) {
      console.error('共有メモの更新に失敗しました:', err)
      setError(getErrorMessage(err, 'メモの更新に失敗しました。'))
    } finally {
      setSavingMemo(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2>{facility?.name ?? '施設詳細'}</h2>
            <p>
              {facility
                ? `${facilityTypeLabel(facility.facility_type)} · ${facility.city}`
                : '読み込み中…'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === 'overview' ? styles.tabActive : styles.tab}
            onClick={() => setTab('overview')}
          >
            概要
          </button>
          <button
            type="button"
            className={tab === 'contacts' ? styles.tabActive : styles.tab}
            onClick={() => setTab('contacts')}
          >
            担当者
          </button>
          <button
            type="button"
            className={tab === 'visits' ? styles.tabActive : styles.tab}
            onClick={() => setTab('visits')}
          >
            営業履歴
          </button>
          <button
            type="button"
            className={tab === 'referrals' ? styles.tabActive : styles.tab}
            onClick={() => setTab('referrals')}
          >
            紹介案件
          </button>
          <button
            type="button"
            className={tab === 'memo' ? styles.tabActive : styles.tab}
            onClick={() => setTab('memo')}
          >
            共有メモ
          </button>
        </div>

        <div className={styles.body}>
          {loading ? <LoadingSpinner /> : null}
          {error ? <div className={styles.alert}>{error}</div> : null}
          {message ? <div className={styles.alertOk}>{message}</div> : null}

          {!loading && facility && tab === 'overview' ? (
            <form className={styles.form} onSubmit={handleSaveOverview}>
              <label className={styles.label}>
                施設名
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                施設種別
                <select
                  className={styles.select}
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value as FacilityType)}
                >
                  {FACILITY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                住所
                <input
                  className={styles.input}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                電話番号
                <input
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <div>
                <p className={styles.sectionTitle}>地図上の位置</p>
                <p className={styles.muted}>
                  いまMAPに表示されている位置です。ピンをドラッグ、または地図をタップして修正できます。
                </p>
                <FacilityLocationEditor
                  lat={lat}
                  lng={lng}
                  onMove={(position) => {
                    setLat(position.lat)
                    setLng(position.lng)
                  }}
                />
                <p className={styles.muted}>
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={locating || !address.trim()}
                    onClick={() => {
                      void (async () => {
                        setLocating(true)
                        setError(null)
                        try {
                          const result = await geocodeAddress(address)
                          if (!result) {
                            setError('住所から位置を特定できませんでした。地図上でピンを動かしてください。')
                            return
                          }
                          setLat(result.lat)
                          setLng(result.lng)
                          setMessage('住所の位置にピンを合わせました。ずれていればドラッグで微調整してください。')
                        } catch (err) {
                          console.error('住所からの位置特定に失敗しました:', err)
                          setError(getErrorMessage(err, '住所から位置を特定できませんでした。'))
                        } finally {
                          setLocating(false)
                        }
                      })()
                    }}
                  >
                    {locating ? '位置を検索中…' : '住所から位置を合わせる'}
                  </button>
                </div>
              </div>
              <div className={styles.actions}>
                <button className={styles.primary} type="submit" disabled={savingOverview}>
                  {savingOverview ? '保存中…' : '概要を保存'}
                </button>
              </div>
            </form>
          ) : null}

          {!loading && facility && tab === 'contacts' ? (
            <>
              <form className={styles.form} onSubmit={handleSaveContact}>
                <h3 className={styles.sectionTitle}>
                  {editingContactId ? '担当者を編集' : '担当者を追加'}
                </h3>
                <label className={styles.label}>
                  氏名
                  <input
                    className={styles.input}
                    value={contactDraft.name}
                    onChange={(e) =>
                      setContactDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.label}>
                  職種
                  <select
                    className={styles.select}
                    value={contactDraft.job_role}
                    onChange={(e) =>
                      setContactDraft((prev) => ({
                        ...prev,
                        job_role: e.target.value as ContactJobRole,
                      }))
                    }
                  >
                    {CONTACT_JOB_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                {contactDraft.job_role === 'other' ? (
                  <label className={styles.label}>
                    その他の職種名
                    <input
                      className={styles.input}
                      value={contactDraft.job_role_other}
                      onChange={(e) =>
                        setContactDraft((prev) => ({
                          ...prev,
                          job_role_other: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                ) : null}
                <label className={styles.label}>
                  メモ（任意）
                  <textarea
                    className={styles.textarea}
                    value={contactDraft.note}
                    onChange={(e) =>
                      setContactDraft((prev) => ({ ...prev, note: e.target.value }))
                    }
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={savingContact}>
                    {savingContact ? '保存中…' : editingContactId ? '担当者を更新' : '担当者を追加'}
                  </button>
                  {editingContactId ? (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        setEditingContactId(null)
                        setContactDraft(emptyContactDraft)
                      }}
                    >
                      キャンセル
                    </button>
                  ) : null}
                </div>
              </form>

              <div>
                <h3 className={styles.sectionTitle}>現在の担当者</h3>
                {currentContacts.length === 0 ? (
                  <p className={styles.empty}>まだ担当者が登録されていません。</p>
                ) : (
                  <div className={styles.list}>
                    {currentContacts.map((item) => (
                      <div key={item.id} className={styles.card}>
                        <strong>{item.contact.name}</strong>
                        <span>
                          {contactJobRoleLabel(item.contact)}
                          {item.contact.note ? ` · ${item.contact.note}` : ''}
                        </span>
                        <span>所属開始: {item.started_on}</span>
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => {
                              setEditingContactId(item.contact.id)
                              setContactDraft({
                                name: item.contact.name,
                                job_role: item.contact.job_role,
                                job_role_other: item.contact.job_role_other ?? '',
                                note: item.contact.note,
                              })
                              setTab('contacts')
                            }}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() =>
                              void handleEndAffiliation(item.id, item.contact.name)
                            }
                          >
                            異動・一覧から外す
                          </button>
                          <button
                            type="button"
                            className={styles.danger}
                            onClick={() => void handleDeleteAffiliation(item)}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className={styles.sectionTitle}>過去に在籍していた担当者</h3>
                {pastContacts.length === 0 ? (
                  <p className={styles.empty}>過去所属はまだありません。</p>
                ) : (
                  <div className={styles.list}>
                    {pastContacts.map((item) => (
                      <div key={item.id} className={styles.card}>
                        <strong>{item.contact.name}</strong>
                        <span>{contactJobRoleLabel(item.contact)}</span>
                        <span>
                          {item.started_on} 〜 {item.ended_on}
                        </span>
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => {
                              setEditingContactId(item.contact.id)
                              setContactDraft({
                                name: item.contact.name,
                                job_role: item.contact.job_role,
                                job_role_other: item.contact.job_role_other ?? '',
                                note: item.contact.note,
                              })
                              setTab('contacts')
                            }}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className={styles.danger}
                            onClick={() => void handleDeleteAffiliation(item)}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {!loading && facility && tab === 'visits' ? (
            <>
              <form className={styles.form} onSubmit={handleSaveVisit}>
                <h3 className={styles.sectionTitle}>
                  {editingVisitId ? '営業履歴を編集' : '営業履歴を登録'}
                </h3>
                <label className={styles.label}>
                  訪問日時
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={visitDraft.visited_at}
                    onChange={(e) =>
                      setVisitDraft((prev) => ({ ...prev, visited_at: e.target.value }))
                    }
                    required
                  />
                </label>
                <div>
                  <p className={styles.sectionTitle}>営業結果</p>
                  <div className={styles.checkGroup}>
                    {SALES_VISIT_RESULTS.map((option) => (
                      <label key={option.value} className={styles.checkItem}>
                        <input
                          type="radio"
                          name="sales-visit-result"
                          checked={visitDraft.result === option.value}
                          onChange={() =>
                            setVisitDraft((prev) => ({
                              ...prev,
                              result: option.value as SalesVisitResult,
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={styles.sectionTitle}>面会者（複数選択可）</p>
                  {knownContacts.length === 0 ? (
                    <p className={styles.empty}>担当者タブで先に担当者を登録してください。</p>
                  ) : (
                    <div className={styles.checkGroup}>
                      {knownContacts.map((contact) => (
                        <label key={contact.id} className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={visitDraft.contact_ids.includes(contact.id)}
                            onChange={() => toggleVisitContact(contact.id)}
                          />
                          <span>
                            {contact.name}（{contactJobRoleLabel(contact)}）
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className={styles.sectionTitle}>今回営業したサービス（複数選択可）</p>
                  <div className={styles.checkGroup}>
                    {services.map((service) => (
                      <label key={service.id} className={styles.checkItem}>
                        <input
                          type="checkbox"
                          checked={visitDraft.service_ids.includes(service.id)}
                          onChange={() => toggleVisitService(service.id)}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className={styles.label}>
                  営業内容メモ（任意）
                  <textarea
                    className={styles.textarea}
                    value={visitDraft.memo}
                    onChange={(e) =>
                      setVisitDraft((prev) => ({ ...prev, memo: e.target.value }))
                    }
                  />
                </label>
                <p className={styles.muted}>
                  登録者: {editingVisitId ? '（元の登録者を維持します）' : (appUser?.display_name ?? '不明なユーザー')}
                </p>
                <p className={styles.sectionTitle}>次回フォロー（任意）</p>
                <label className={styles.label}>
                  次回フォロー予定日
                  <input
                    type="date"
                    className={styles.input}
                    value={visitDraft.next_follow_up_on}
                    onChange={(e) =>
                      setVisitDraft((prev) => ({
                        ...prev,
                        next_follow_up_on: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.label}>
                  フォロー担当社員
                  <input
                    className={styles.input}
                    value={visitDraft.follow_up_assignee}
                    onChange={(e) =>
                      setVisitDraft((prev) => ({
                        ...prev,
                        follow_up_assignee: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.label}>
                  フォロー内容
                  <textarea
                    className={styles.textarea}
                    value={visitDraft.follow_up_note}
                    onChange={(e) =>
                      setVisitDraft((prev) => ({ ...prev, follow_up_note: e.target.value }))
                    }
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={savingVisit}>
                    {savingVisit ? '保存中…' : editingVisitId ? '営業履歴を更新' : '営業履歴を登録'}
                  </button>
                  {editingVisitId ? (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        setEditingVisitId(null)
                        setVisitDraft(emptyVisitDraft())
                      }}
                    >
                      キャンセル
                    </button>
                  ) : null}
                </div>
              </form>

              <div>
                <h3 className={styles.sectionTitle}>営業履歴一覧</h3>
                {salesVisits.length === 0 ? (
                  <p className={styles.empty}>まだ営業履歴が登録されていません。</p>
                ) : (
                  <div className={styles.list}>
                    {salesVisits.map((visit) => (
                      <div key={visit.id} className={styles.card}>
                        <strong>
                          {new Date(visit.visited_at).toLocaleString('ja-JP')} ・{' '}
                          {salesVisitResultLabel(visit.result)}
                        </strong>
                        {visit.contact_ids.length > 0 ? (
                          <span>
                            面会者: {visit.contact_ids.map(contactNameLookup).join('、')}
                          </span>
                        ) : null}
                        {visit.service_ids.length > 0 ? (
                          <span>
                            対象サービス: {visit.service_ids.map(serviceNameLookup).join('、')}
                          </span>
                        ) : null}
                        {visit.memo ? <span>メモ: {visit.memo}</span> : null}
                        {visit.next_follow_up_on ? (
                          <span>
                            次回フォロー: {visit.next_follow_up_on}
                            {visit.follow_up_assignee ? `（${visit.follow_up_assignee}）` : ''}
                            {visit.follow_up_note ? ` - ${visit.follow_up_note}` : ''}
                          </span>
                        ) : null}
                        <span>登録: {visit.registered_by}</span>
                        {canEditVisit(visit, appUser) ? (
                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              className={styles.secondary}
                              onClick={() => startEditVisit(visit)}
                            >
                              編集
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {!loading && facility && tab === 'referrals' ? (
            <>
              <form className={styles.form} onSubmit={handleSaveReferral}>
                <h3 className={styles.sectionTitle}>
                  {editingReferralId ? '紹介案件を編集' : '紹介案件を登録'}
                </h3>
                <label className={styles.label}>
                  紹介元担当者（任意）
                  <select
                    className={styles.select}
                    value={referralDraft.source_contact_id}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({
                        ...prev,
                        source_contact_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">担当者未指定</option>
                    {knownContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}（{contactJobRoleLabel(contact)}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  対象サービス
                  <select
                    className={styles.select}
                    value={referralDraft.service_id}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({ ...prev, service_id: e.target.value }))
                    }
                    required
                  >
                    <option value="">選択してください</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  紹介日
                  <input
                    type="date"
                    className={styles.input}
                    value={referralDraft.referred_on}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({ ...prev, referred_on: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.label}>
                  関連営業履歴（任意）
                  <select
                    className={styles.select}
                    value={referralDraft.related_visit_id}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({
                        ...prev,
                        related_visit_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">なし</option>
                    {salesVisits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {new Date(visit.visited_at).toLocaleString('ja-JP')} ・
                        {salesVisitResultLabel(visit.result)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  ステータス
                  <select
                    className={styles.select}
                    value={referralDraft.status}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({
                        ...prev,
                        status: e.target.value as ReferralStatus,
                        lost_reason: e.target.value === 'lost' ? prev.lost_reason : '',
                        lost_reason_other: e.target.value === 'lost' ? prev.lost_reason_other : '',
                      }))
                    }
                  >
                    {REFERRAL_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {referralDraft.status === 'lost' ? (
                  <>
                    <label className={styles.label}>
                      利用に至らなかった理由
                      <select
                        className={styles.select}
                        value={referralDraft.lost_reason}
                        onChange={(e) =>
                          setReferralDraft((prev) => ({
                            ...prev,
                            lost_reason: e.target.value as ReferralLostReason,
                          }))
                        }
                        required
                      >
                        <option value="">選択してください</option>
                        {REFERRAL_LOST_REASONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {referralDraft.lost_reason === 'other' ? (
                      <label className={styles.label}>
                        理由の詳細
                        <input
                          className={styles.input}
                          value={referralDraft.lost_reason_other}
                          onChange={(e) =>
                            setReferralDraft((prev) => ({
                              ...prev,
                              lost_reason_other: e.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
                <label className={styles.label}>
                  メモ（任意）
                  <textarea
                    className={styles.textarea}
                    value={referralDraft.note}
                    onChange={(e) =>
                      setReferralDraft((prev) => ({ ...prev, note: e.target.value }))
                    }
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={savingReferral}>
                    {savingReferral
                      ? '保存中…'
                      : editingReferralId
                        ? '紹介案件を更新'
                        : '紹介案件を登録'}
                  </button>
                  {editingReferralId ? (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        setEditingReferralId(null)
                        setReferralDraft(emptyReferralDraft())
                      }}
                    >
                      キャンセル
                    </button>
                  ) : null}
                </div>
              </form>

              <div>
                <h3 className={styles.sectionTitle}>紹介案件一覧</h3>
                {referralCases.length === 0 ? (
                  <p className={styles.empty}>まだ紹介案件が登録されていません。</p>
                ) : (
                  <div className={styles.list}>
                    {referralCases.map((item) => (
                      <div key={item.id} className={styles.card}>
                        <strong>
                          {item.case_number} ・ {referralStatusLabel(item.status)}
                        </strong>
                        <span>紹介日: {item.referred_on}</span>
                        <span>対象サービス: {serviceNameLookup(item.service_id)}</span>
                        {item.source_contact_id ? (
                          <span>紹介元担当者: {contactNameLookup(item.source_contact_id)}</span>
                        ) : null}
                        {item.note ? <span>メモ: {item.note}</span> : null}
                        {item.status === 'lost' ? (
                          <span>
                            理由: {referralLostReasonLabel(item.lost_reason, item.lost_reason_other)}
                          </span>
                        ) : null}
                        {canEditReferral(item, appUser) ? (
                          <div className={styles.cardActions}>
                            <button
                              type="button"
                              className={styles.secondary}
                              onClick={() => startEditReferral(item)}
                            >
                              編集
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {!loading && facility && tab === 'memo' ? (
            <>
              <form className={styles.form} onSubmit={handleSaveMemo}>
                <label className={styles.label}>
                  施設共有メモ
                  <textarea
                    className={styles.textarea}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="訪問しやすい曜日、駐車場、注意事項など"
                  />
                </label>
                <p className={styles.muted}>更新者: {appUser?.display_name ?? '不明なユーザー'}</p>
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={savingMemo}>
                    {savingMemo ? '保存中…' : 'メモを保存'}
                  </button>
                </div>
              </form>

              <div>
                <h3 className={styles.sectionTitle}>変更履歴</h3>
                {histories.length === 0 ? (
                  <p className={styles.empty}>まだ変更履歴はありません。</p>
                ) : (
                  <div className={styles.list}>
                    {histories.map((item) => (
                      <div key={item.id} className={styles.historyItem}>
                        <time>
                          {new Date(item.created_at).toLocaleString('ja-JP')} ·{' '}
                          {item.changed_by_label}
                        </time>
                        <div>
                          {item.previous_memo || '（空）'} → {item.new_memo || '（空）'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
