/** 居宅介護支援事業所の重複判定・住所照合用（import 専用） */

const LEGAL_PREFIXES = [
  '社会福祉法人',
  '医療法人社団',
  '医療法人',
  '一般社団法人',
  '特定非営利活動法人',
  'NPO法人',
  '株式会社',
  '有限会社',
  '合同会社',
  '（株）',
  '(株)',
  '（有）',
  '(有)',
]

const NAME_SUFFIXES = [
  '居宅介護支援事業所',
  '居宅介護支援センター',
  'ケアプランセンター',
  '介護支援センター',
]

const KANJI_NUM = {
  一: '1',
  二: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
  十: '10',
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeName(value) {
  let text = String(value ?? '').normalize('NFKC').trim()
  for (const prefix of LEGAL_PREFIXES) {
    text = text.replaceAll(prefix, '')
  }
  text = text.replace(/[ 　]/g, '')
  return text
}

export function nameCore(value) {
  let text = normalizeName(value)
  for (const suffix of NAME_SUFFIXES) {
    text = text.replaceAll(suffix, '')
  }
  return text
}

export function normalizeAddress(value) {
  let text = String(value ?? '').normalize('NFKC').trim()
  text = text.replace(/日本|, Japan/g, '')
  text = text.replace(/〒\d{3}-?\d{4}/g, '')
  text = text.replace(/大阪府/g, '')
  text = text.replace(/[ 　]/g, '')
  text = text.replace(/[‐－―ー−]/g, '-')
  text = text.replace(/([一二三四五六七八九十])丁目/g, (_, k) => `${KANJI_NUM[k] ?? k}丁目`)
  text = text.replace(/丁目/g, '-')
  text = text.replace(/番地の/g, '-')
  text = text.replace(/番地/g, '-')
  text = text.replace(/番/g, '-')
  text = text.replace(/号室/g, '')
  text = text.replace(/号/g, '')
  text = text.replace(/の/g, '-')
  text = text.replace(/-+/g, '-')
  text = text.replace(/^-|-$/g, '')
  return text
}

export function streetKey(value) {
  const normalized = normalizeAddress(value)
  const match = normalized.match(/河内長野市(.+)/)
  return match ? match[1] : normalized
}

export function namesLikelySame(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ca = nameCore(a)
  const cb = nameCore(b)
  if (ca && cb && (ca === cb || ca.includes(cb) || cb.includes(ca))) {
    return ca.length >= 2 && cb.length >= 2
  }
  return false
}

export function addressesLikelySame(a, b) {
  const sa = streetKey(a)
  const sb = streetKey(b)
  if (!sa || !sb) return false
  if (sa === sb) return true
  const compactA = sa.replace(/-/g, '')
  const compactB = sb.replace(/-/g, '')
  if (compactA === compactB) return true
  return (
    (compactA.length >= 8 && compactB.includes(compactA.slice(0, 8))) ||
    (compactB.length >= 8 && compactA.includes(compactB.slice(0, 8)))
  )
}

export function phonesLikelySame(a, b) {
  const da = digitsOnly(a)
  const db = digitsOnly(b)
  return da.length >= 9 && da === db
}

export function findExistingDuplicate(incoming, existingList) {
  for (const existing of existingList) {
    if (
      incoming.google_place_id &&
      existing.google_place_id &&
      incoming.google_place_id === existing.google_place_id
    ) {
      return { reason: 'place_id', facility: existing }
    }
  }

  for (const existing of existingList) {
    if (phonesLikelySame(incoming.phone, existing.phone) && namesLikelySame(incoming.name, existing.name)) {
      return { reason: 'phone_name', facility: existing }
    }
  }

  for (const existing of existingList) {
    if (namesLikelySame(incoming.name, existing.name) && addressesLikelySame(incoming.address, existing.address)) {
      return { reason: 'name_address', facility: existing }
    }
  }

  return null
}

export function scorePlaceCandidate(incoming, candidate) {
  let score = 0
  const reasons = []

  if (namesLikelySame(incoming.name, candidate.name)) {
    score += 40
    reasons.push('name')
  } else if (
    nameCore(incoming.name) &&
    normalizeName(candidate.name).includes(nameCore(incoming.name))
  ) {
    score += 20
    reasons.push('name_partial')
  }

  if (addressesLikelySame(incoming.address, candidate.address)) {
    score += 40
    reasons.push('address')
  }

  if (phonesLikelySame(incoming.phone, candidate.phone)) {
    score += 50
    reasons.push('phone')
  }

  const inKawachinagano =
    String(candidate.address ?? '').includes('河内長野') ||
    String(candidate.city ?? '').includes('河内長野')
  if (inKawachinagano) {
    score += 10
    reasons.push('city')
  }

  return { score, reasons }
}
