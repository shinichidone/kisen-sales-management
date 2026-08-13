/**
 * catch(err) の err は必ずしも Error インスタンスとは限らない
 * （Supabaseのネットワークエラー等がプレーンオブジェクトの場合がある）ため、
 * message を可能な限り拾って表示用文字列に変換する。
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) {
      return message
    }
  }
  return fallback
}
