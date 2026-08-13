export const SALES_VISIT_RESULTS = [
  { value: 'not_met', label: '未面会' },
  { value: 'materials_only', label: '資料渡しのみ' },
  { value: 'met', label: '面会済み' },
] as const

export type SalesVisitResult = (typeof SALES_VISIT_RESULTS)[number]['value']

export function salesVisitResultLabel(result: SalesVisitResult): string {
  return SALES_VISIT_RESULTS.find((item) => item.value === result)?.label ?? result
}

export type SalesVisit = {
  id: string
  facility_id: string
  visited_at: string
  result: SalesVisitResult
  memo: string
  registered_by: string
  created_by: string | null
  next_follow_up_on: string | null
  follow_up_note: string
  follow_up_assignee: string
  created_at: string
  updated_at: string
  contact_ids: string[]
  service_ids: string[]
}

export type SalesVisitDraft = {
  visited_at: string
  result: SalesVisitResult
  contact_ids: string[]
  service_ids: string[]
  memo: string
  next_follow_up_on: string
  follow_up_note: string
  follow_up_assignee: string
}
