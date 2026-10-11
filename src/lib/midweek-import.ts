import { load } from 'cheerio'
import { createHash } from 'crypto'
import { MeetingError, type MeetingItem, type Section, type SourceWeek } from './midweek'

export const INDEX_URL = 'https://www.jw.org/cmn-hant/多媒體圖書館/耶和華見證人聚會手冊/'
const basePath = new URL(INDEX_URL).pathname
export const clean = (text: string) => text.replace(/[\u200b-\u200f\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
export function officialUrl(value: string) {
  const url = new URL(value, INDEX_URL)
  if (url.origin !== 'https://www.jw.org' || !url.pathname.startsWith(basePath) || url.username || url.password) throw new MeetingError('來源網址不正確')
  url.hash = ''
  return url.href
}
export async function fetchOfficial(url: string) {
  const response = await fetch(officialUrl(url), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`來源讀取失敗 (${response.status})`)
  const html = await response.text()
  if (html.length > 3_000_000 || !html.includes('<article')) throw new Error('來源頁面格式不正確')
  return html
}
export function discoverYears(html: string) {
  const $ = load(html)
  const years = $('#yearFilter option').map((_, e) => $(e).attr('value')).get().filter(v => /^\d{4}$/.test(v))
  if (!years.length) throw new Error('找不到手冊年份，請檢查來源網站')
  return years.map(y => officialUrl(`${INDEX_URL}?pubFilter=mwb&yearFilter=${y}`))
}
export function discoverIssues(html: string) {
  const $ = load(html)
  const links = $('h3 a[href]').map((_, e) => $(e).attr('href')!).get().filter(href => {
    const path = decodeURIComponent(new URL(href, INDEX_URL).pathname)
    return /\d{4}年/.test(path) && !/參考|mwbr/.test(path) && path.split('/').filter(Boolean).length === 4
  })
  if (!links.length) throw new Error('找不到手冊期別')
  return [...new Set(links.map(officialUrl))]
}
export function discoverWeeks(html: string, issue: string) {
  const $ = load(html); $('rt,rp').remove()
  const urls = $('h2 a[href]').filter((_, e) => /^\d{1,2}月\d{1,2}/.test(clean($(e).text()))).map((_, e) => officialUrl($(e).attr('href')!)).get()
  if (!urls.length) throw new Error(`找不到週次：${decodeURIComponent(issue).split('/').filter(Boolean).pop()}`)
  return [...new Set(urls)]
}
export function parseWeek(html: string, url: string): SourceWeek {
  const $ = load(html); $('rt,rp,.pageNum,.footnoteLink').remove()
  const article = $('article.jwac').first()
  const label = clean(article.find('h1').first().text())
  const date = label.match(/(\d{1,2})月(\d{1,2})/)
  const issue = (article.attr('class') || '').match(/iss-(\d{4})(\d{2})/)
  const yearInUrl = decodeURIComponent(url).match(/(\d{4})年/)
  let year = Number(issue?.[1] || yearInUrl?.[1])
  if (!date || !year) throw new Error('無法解析手冊日期')
  if (issue?.[2] === '01' && date[1] === '12') year--
  const week = `${year}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}`
  const reading = clean(article.find('h2').first().text())
  const body = article.find('.bodyTxt').first().length ? article.find('.bodyTxt').first() : article
  const nodes = body.find('h2,h3,p').toArray()
  const modern = body.find('h3').toArray().some(e => /^\d+[．.、]/.test(clean($(e).text())))
  let section: Section = 'opening'
  const seen = new Set<Section>()
  const items: MeetingItem[] = []
  const add = (title: string, minutes: number, id: string, role = '', counsel = 0) => items.push({ id, section, title, minutes, counsel, role, person: '', assistant: '', highlight: '' })
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i], el = $(node), text = clean(el.text())
    if (node.tagName === 'h2') {
      if (/上帝話語/.test(text)) section = 'treasures'
      else if (/用心準備/.test(text)) section = 'ministry'
      else if (/基督徒的生活/.test(text)) section = 'living'
      else continue
      seen.add(section); continue
    }
    const music = /^(?:唱詩|唱\d{4}年區域大會)/.test(text)
    if (modern && !(node.tagName === 'h3' && (/^\d+[．.、]/.test(text) || /^結語/.test(text))) && !music) continue
    if (!modern && (node.tagName !== 'p' || !el.parent().is('li'))) continue
    const id = el.attr('id') || `item-${i}`
    const song = text.match(/唱詩(?:第)?\s*(\d+)\s*首/)
    const specialSong = text.match(/唱\d{4}年區域大會的?新歌/)
    const duration = text.match(/[（(](?:不超過)?\s*(\d+)\s*分鐘/)
    if (song || specialSong) {
      const closing = /結語/.test(text)
      if (closing) add('結語', Number(duration?.[1] || 3), `${id}-closing`)
      add(song ? `唱詩第[${song[1]}]首` : specialSong![0], section === 'opening' ? 5 : 4, `${id}-song`, /禱告/.test(text) ? '禱告' : '')
      if (/開場白/.test(text)) add('開場白', Number(duration?.[1] || 1), `${id}-opening`)
      continue
    }
    let minutes = duration ? Number(duration[1]) : NaN
    let description = text
    if (modern && !duration) {
      for (let j = i + 1; j < nodes.length && nodes[j].tagName === 'p'; j++) {
        const match = clean($(nodes[j]).text()).match(/^[（(](\d+)分鐘/)
        if (match) { minutes = Number(match[1]); description = clean($(nodes[j]).text()); break }
      }
    }
    if (!Number.isFinite(minutes)) {
      if (modern) throw new Error(`無法解析節目時長：${text}`)
      continue
    }
    const title = text.split(/[（(]/)[0].replace(/^\d+[．.、]\s*/, '').trim()
    const student = /經文朗讀/.test(title)
    const studentPart = section === 'ministry' && minutes <= 6 && !/短片/.test(title) && !/節目包括討論|由主席擔任/.test(description)
    const demonstration = studentPart && !/演講/.test(title)
    add(title, minutes, id, student || (studentPart && !demonstration) ? '學生' : demonstration ? '學生/助手' : /會[眾衆]研經班/.test(title) ? '主持人' : '', student || studentPart ? 1 : 0)
  }
  const memorial = seen.size === 0 && /紀念聚會/.test(reading)
  if (memorial) add('本週手冊未提供一般週中聚會節目，請參閱紀念聚會資料', 0, 'memorial')
  if (!memorial && (seen.size !== 3 || items.length < 8 || items.filter(i => i.title.startsWith('唱')).length !== 3 || !reading)) throw new Error(`節目解析不完整：${label}`)
  const normalized = officialUrl(url)
  return { id: createHash('sha256').update(normalized).digest('hex').slice(0, 24), url: normalized, week, label, reading, items, hash: createHash('sha256').update(JSON.stringify({ week, reading, items })).digest('hex') }
}
