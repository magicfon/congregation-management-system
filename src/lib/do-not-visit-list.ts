// 拒絕拜訪文字處理（純函式，前後端共用；ADR-0086）

export const MAX_DO_NOT_VISIT_ADDRESS = 100

/** 整格正規化：統一換行、去掉每行頭尾空白與空行。 */
export function normalizeDoNotVisit(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean).join('\n')
}

/** 切成地址清單：換行與半形逗號都算分隔（舊資料有用逗號）；註記接在地址後，不切全形標點。 */
export function doNotVisitList(value: string): string[] {
  return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
}

/** 合併兩份內容：先保留 base，再接上 extra 中 base 沒有的地址；新內容一律一行一個。 */
export function mergeDoNotVisit(base: string, extra: string): string {
  const seen = new Set(doNotVisitList(base))
  const added = doNotVisitList(extra).filter(item => !seen.has(item) && seen.add(item))
  return normalizeDoNotVisit([base, ...added].join('\n'))
}
