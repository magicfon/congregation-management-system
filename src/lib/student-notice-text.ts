// 學生練習通知單的純文字工具，前後端共用（ADR-0090）。
const weekday = ['日', '一', '二', '三', '四', '五', '六']
export const displayDate = (date: string) => `${Number(date.slice(0, 4))}/${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（週${weekday[new Date(`${date}T12:00:00Z`).getUTCDay()]}）`


// 轉交用的 S-89-CH 通知單圖片：在瀏覽器以 canvas 依紙本版面畫出，使用裝置字型，不經伺服器。
export async function studentNoticeImage(notice: { name: string; assistant: string; date: string; title: string }): Promise<Blob> {
  const width = 750, height = 960, scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale; canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const font = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'; ctx.textBaseline = 'alphabetic'
  ctx.font = `bold 38px ${font}`; ctx.textAlign = 'center'
  ctx.fillText('傳道與生活聚會學生練習通知', width / 2, 58)
  ctx.textAlign = 'left'
  const field = (label: string, value: string, y: number) => {
    ctx.font = `bold 32px ${font}`; ctx.fillText(label, 36, y)
    ctx.font = `32px ${font}`; ctx.fillText(value, 146, y - 6)
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(146, y + 10); ctx.lineTo(714, y + 10); ctx.stroke(); ctx.setLineDash([])
  }
  const [year, month, day] = notice.date.split('-').map(Number)
  field('姓名：', notice.name, 138)
  field('助手：', notice.assistant, 218)
  field('日期：', `${year}/${month}/${day}`, 290)
  ctx.font = `bold 32px ${font}`; ctx.fillText('節目編號：', 36, 372)
  ctx.font = `28px ${font}`
  // 節目名稱過長時換行。
  let line = '', y = 370
  for (const char of notice.title) {
    if (ctx.measureText(line + char).width > 480) { ctx.fillText(line, 226, y); line = ''; y += 38 }
    line += char
  }
  ctx.fillText(line, 226, y)
  ctx.font = `bold 32px ${font}`; ctx.fillText('受訓班別：', 36, 476)
  ;['第一班', '第二班', '第三班'].forEach((label, index) => {
    const top = 506 + index * 54
    ctx.lineWidth = 2; ctx.strokeRect(78, top, 26, 26)
    if (index === 0) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(82, top + 13); ctx.lineTo(90, top + 22); ctx.lineTo(104, top + 2); ctx.stroke() }
    ctx.font = `32px ${font}`; ctx.fillText(label, 138, top + 26)
  })
  const note = '學生注意：《傳道與生活聚會手冊》裡提供了學生練習的資料來源和學習要點。請查看《傳道與生活聚會指示》（S-38）中關於學生練習的指示。'
  ctx.font = `22px ${font}`
  line = ''; y = 754
  for (const char of note) {
    if (ctx.measureText(line + char).width > 680) { ctx.fillText(line, 36, y); line = ''; y += 34 }
    line += char
  }
  ctx.fillText(line, 36, y)
  ctx.font = `bold 22px ${font}`; ctx.fillText('學生注意：', 36, 754)
  ctx.font = `20px ${font}`; ctx.fillText('S-89-CH   11/23', 36, 924)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法產生圖片')), 'image/png'))
}
