function required(name: string): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.example を参考に .env を作成してください。`,
    )
  }
  return value.trim()
}

function optionalNumber(name: string, fallback: number): number {
  const raw = import.meta.env[name]
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  const num = Number(raw)
  return Number.isFinite(num) ? num : fallback
}

export const env = {
  supabaseUrl: () => required('VITE_SUPABASE_URL'),
  supabaseAnonKey: () => required('VITE_SUPABASE_ANON_KEY'),
  googleMapsApiKey: () => required('VITE_GOOGLE_MAPS_API_KEY'),
  mapDefaultCenter: () => ({
    lat: optionalNumber('VITE_MAP_DEFAULT_LAT', 34.4583),
    lng: optionalNumber('VITE_MAP_DEFAULT_LNG', 135.5661),
  }),
  mapDefaultZoom: () => optionalNumber('VITE_MAP_DEFAULT_ZOOM', 13),
}

export function hasRequiredEnv(): { ok: true } | { ok: false; missing: string[] } {
  const keys = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GOOGLE_MAPS_API_KEY',
  ] as const
  const missing = keys.filter((key) => {
    const value = import.meta.env[key]
    return typeof value !== 'string' || value.trim() === ''
  })
  return missing.length === 0 ? { ok: true } : { ok: false, missing: [...missing] }
}
