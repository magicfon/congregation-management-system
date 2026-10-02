export const MAX_ANNOUNCEMENT_BYTES = 4_000_000
export class AnnouncementInputError extends Error {}

export function announcementDetails(title: string | null, filename: string | null) {
  const name = (filename ?? '').split(/[\\/]/).pop()?.trim() ?? ''
  const heading = title?.trim() || name.replace(/\.pdf$/i, '')
  if (!name.toLowerCase().endsWith('.pdf') || name.length > 150) throw new AnnouncementInputError('請選擇 PDF 檔案')
  if (!heading || heading.length > 80) throw new AnnouncementInputError('公告標題請填寫 1–80 個字')
  return { title: heading, filename: name }
}

export async function readAnnouncementPdf(request: Request): Promise<Buffer> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/pdf')) throw new AnnouncementInputError('請上傳 PDF 檔案')
  if (Number(request.headers.get('content-length')) > MAX_ANNOUNCEMENT_BYTES) throw new AnnouncementInputError('PDF 不可超過 4 MB')
  const reader = request.body?.getReader()
  if (!reader) throw new AnnouncementInputError('請選擇 PDF 檔案')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_ANNOUNCEMENT_BYTES) { await reader.cancel(); throw new AnnouncementInputError('PDF 不可超過 4 MB') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const content = Buffer.concat(chunks)
  if (content.subarray(0, 5).toString() !== '%PDF-' || !content.subarray(-1024).toString('latin1').includes('%%EOF')) throw new AnnouncementInputError('檔案不是完整的 PDF')
  return content
}

export function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin }
