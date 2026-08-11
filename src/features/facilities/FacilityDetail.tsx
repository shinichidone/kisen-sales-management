import { useCallback, useEffect, useState } from 'react'
import {
  createContactAtFacility,
  endAffiliation,
  fetchFacilityAffiliations,
  updateContact,
} from '../../lib/contactsApi'
import {
  fetchFacilityById,
  fetchFacilityMemoHistories,
  updateFacility,
  updateFacilitySharedMemo,
} from '../../lib/facilitiesApi'
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
import styles from './FacilityDetail.module.css'

type Tab = 'overview' | 'contacts' | 'memo'

type Props = {
  facilityId: string
  services: Service[]
  onClose: () => void
  onFacilityUpdated: (facility: Facility) => void
}

const emptyContactDraft: ContactDraft = {
  name: '',
  job_role: 'care_manager',
  job_role_other: '',
  note: '',
}

export function FacilityDetail({
  facilityId,
  services,
  onClose,
  onFacilityUpdated,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [facility, setFacility] = useState<Facility | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [facilityType, setFacilityType] = useState<FacilityType>('home_care_support')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [targetServiceIds, setTargetServiceIds] = useState<string[]>([])
  const [savingOverview, setSavingOverview] = useState(false)

  const [currentContacts, setCurrentContacts] = useState<FacilityAffiliation[]>([])
  const [pastContacts, setPastContacts] = useState<FacilityAffiliation[]>([])
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContactDraft)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)

  const [memo, setMemo] = useState('')
  const [changedBy, setChangedBy] = useState('営業スタッフ')
  const [histories, setHistories] = useState<FacilityMemoHistory[]>([])
  const [savingMemo, setSavingMemo] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextFacility, affiliations, nextHistories] = await Promise.all([
        fetchFacilityById(facilityId),
        fetchFacilityAffiliations(facilityId),
        fetchFacilityMemoHistories(facilityId),
      ])
      setFacility(nextFacility)
      setName(nextFacility.name)
      setFacilityType(nextFacility.facility_type)
      setPhone(nextFacility.phone ?? '')
      setCity(nextFacility.city)
      setAddress(nextFacility.address)
      setTargetServiceIds(nextFacility.target_service_ids)
      setMemo(nextFacility.shared_memo)
      setCurrentContacts(affiliations.current)
      setPastContacts(affiliations.past)
      setHistories(nextHistories)
    } catch (err) {
      setError(err instanceof Error ? err.message : '施設詳細の読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    void reload()
  }, [reload])

  function toggleService(id: string) {
    setTargetServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

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
        city,
        address,
        target_service_ids: targetServiceIds,
      })
      setFacility(updated)
      onFacilityUpdated(updated)
      setMessage('施設情報を更新しました。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました。')
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
      setError(err instanceof Error ? err.message : '担当者の保存に失敗しました。')
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
      setError(err instanceof Error ? err.message : '所属の更新に失敗しました。')
    }
  }

  async function handleSaveMemo(event: React.FormEvent) {
    event.preventDefault()
    setSavingMemo(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateFacilitySharedMemo(facilityId, memo, changedBy)
      setFacility(updated)
      setMemo(updated.shared_memo)
      onFacilityUpdated(updated)
      setHistories(await fetchFacilityMemoHistories(facilityId))
      setMessage('共有メモを更新しました。')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メモの更新に失敗しました。')
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
            className={tab === 'memo' ? styles.tabActive : styles.tab}
            onClick={() => setTab('memo')}
          >
            共有メモ
          </button>
        </div>

        <div className={styles.body}>
          {loading ? <p className={styles.empty}>読み込み中…</p> : null}
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
                市区町村
                <input
                  className={styles.input}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
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
                <p className={styles.sectionTitle}>営業対象サービス</p>
                <div className={styles.checkGroup}>
                  {services.map((service) => (
                    <label key={service.id} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={targetServiceIds.includes(service.id)}
                        onChange={() => toggleService(service.id)}
                      />
                      <span>{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className={styles.muted}>
                位置情報（緯度経度）と Google Place ID はMAP登録時の値を維持します。
              </p>
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
                            className={styles.danger}
                            onClick={() =>
                              void handleEndAffiliation(item.id, item.contact.name)
                            }
                          >
                            異動・一覧から外す
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
                <label className={styles.label}>
                  更新者名（ログイン導入前の暫定）
                  <input
                    className={styles.input}
                    value={changedBy}
                    onChange={(e) => setChangedBy(e.target.value)}
                  />
                </label>
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
