export const SALES_VISIT_RESULTS = [
  { value: 'not_met', label: '未面会' },
  { value: 'report_delivered', label: '報告書' },
  { value: 'flyer_delivered', label: 'チラシ' },
  { value: 'brochure_delivered', label: 'パンフレット' },
  { value: 'service_sheet_delivered', label: '提供表' },
  { value: 'instruction_request', label: '指示書依頼' },
  { value: 'met', label: '面会済み' },
] as const

export type SalesVisitResult =
  | (typeof SALES_VISIT_RESULTS)[number]['value']
  | 'materials_only'

export function salesVisitResultLabel(result: SalesVisitResult): string {
  if (result === 'materials_only') return '資料渡し（旧記録）'
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
