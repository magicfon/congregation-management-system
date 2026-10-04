export const syncCounts = ['completionDatesUpdated', 'imported', 'sheetEdits', 'conflicts', 'pushedBack'] as const
export type SyncResult = { ok: boolean; errors: string[]; error?: string; serviceRoster?: { pulled: number; pushed: number; conflicts: unknown[]; errors: string[] } } & Record<typeof syncCounts[number], number>

export function parseSyncResult(value: unknown): SyncResult {
  const result = value as SyncResult | null
  if (!result || typeof result.ok !== 'boolean' || !Array.isArray(result.errors) || result.errors.some(e => typeof e !== 'string') || syncCounts.some(key => !Number.isSafeInteger(result[key]) || result[key] < 0)) throw new Error('同步回應格式異常，無法確認結果。請稍後檢查。')
  if (result.serviceRoster && (!Number.isSafeInteger(result.serviceRoster.pulled) || result.serviceRoster.pulled < 0 || !Number.isSafeInteger(result.serviceRoster.pushed) || result.serviceRoster.pushed < 0 || !Array.isArray(result.serviceRoster.conflicts) || !Array.isArray(result.serviceRoster.errors))) throw new Error('服務安排同步回應格式異常')
  return result
}

export async function checkSync(run: () => Promise<SyncResult>, onResult: (result: SyncResult) => void): Promise<boolean> {
  for (let i = 0; i < 2; i++) {
    const result = parseSyncResult(await run())
    onResult(result)
    if (!result.ok || result.errors.length || result.conflicts || result.serviceRoster?.errors.length || result.serviceRoster?.conflicts.length) throw new Error(result.error || '同步發現錯誤或衝突，已停止檢查；請展開結果查看。')
    if (i === 1) return syncCounts.every(key => result[key] === 0) && !result.serviceRoster?.pulled && !result.serviceRoster?.pushed
  }
  return false
}
