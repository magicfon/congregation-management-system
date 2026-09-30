const site = 'https://sites.google.com/view/jwnanzhi'
const sheet = (id: string, query = '') => ({
  url: `https://docs.google.com/spreadsheets/d/${id}/edit${query}`,
  embed: `https://docs.google.com/spreadsheets/d/${id}/htmlembed${query}`,
  pdf: id,
})

export type BulletinSource = { label: string; url: string; embed?: string; pdf?: string }
export type BulletinCategory = {
  slug: string
  title: string
  shortTitle: string
  description: string
  icon: 'talk' | 'book' | 'notice' | 'people' | 'location' | 'service' | 'report'
  sources: BulletinSource[]
}

// Sources observed on the existing public Google Site. Content stays in Google.
export const bulletinCategories: BulletinCategory[] = [
  { slug: 'public-talks', title: '公眾演講秩序表', shortTitle: '公眾演講', description: '查看公眾演講與聚會安排。', icon: 'talk', sources: [
    { label: '公眾演講秩序表', ...sheet('10dCF6Wcqp-11g4vHSYGCekfvGvBE8MKzOqTxgt9-jtM') },
  ] },
  { slug: 'midweek-meeting', title: '傳道與生活聚會節目表', shortTitle: '傳道與生活', description: '查看週中聚會節目與參與安排。', icon: 'book', sources: [
    { label: '本週聚會節目', url: `${site}/${encodeURIComponent('傳道與生活聚會節目表')}`, embed: 'https://script.google.com/macros/s/AKfycbwZK_BLnGTntnI8TB1IgChMieyJvLu9bV28MBP9YLSHqh6o8ixcnLBhfOX-uZRacjEd3g/exec' },
    { label: '週中秩序表', url: 'https://docs.google.com/document/d/1VKh8B9vlz371N2-wDfbEHXNUgHVgFMuFL1LIA-kXO9E/edit', pdf: '1VKh8B9vlz371N2-wDfbEHXNUgHVgFMuFL1LIA-kXO9E' },
  ] },
  { slug: 'announcements', title: '會眾公告', shortTitle: '會眾公告', description: '查看會眾消息與重要通知。', icon: 'notice', sources: [
    { label: '原會眾公告頁', url: `${site}/${encodeURIComponent('會眾公告')}` },
  ] },
  { slug: 'ministry-groups', title: '傳道組別', shortTitle: '傳道組別', description: '查看傳道小組與組別安排。', icon: 'people', sources: [
    { label: '傳道小組', ...sheet('1e0rozAsYVVxztZUw7cPQsykrqKUVJd6d8q8MXRKNkk8') },
  ] },
  { slug: 'meeting-points', title: '傳道集合地點', shortTitle: '集合地點', description: '出發前查看集合資訊。', icon: 'location', sources: [
    { label: '集合資訊', url: `${site}/${encodeURIComponent('傳道集合地點')}`, embed: 'https://script.google.com/macros/s/AKfycbxavTob4QCszKzaH62_lbJs-ej6ZrVdHKMhv-0PqeK9SMzhVC-20N8X_L5IhrZmMY7z/exec' },
    { label: '傳道集合地點表', ...sheet('1Tc0_yU19einTBWErNFJ7laQe8qK_C59SpNNZS_Z4QQU', '?gid=1240525928') },
  ] },
  { slug: 'service-roster', title: '服務安排表', shortTitle: '服務安排', description: '查看輪值與會眾組織安排。', icon: 'service', sources: [
    { label: '輪值表', ...sheet('1mEUaWpY6yAUTtXJP1gXVhKezt8413uadoPLN4t3e10Y', '?gid=1495819990') },
    { label: '組織表', ...sheet('108JU7H_v6Insxpdzk092f4s1nEQSk1uLNacdoG5i5HA') },
  ] },
  { slug: 'territory-report', title: '傳道區域回報', shortTitle: '區域回報', description: '開啟既有 Google 表單填寫回報。', icon: 'report', sources: [
    { label: '楠梓會眾挨家逐戶區域回報表', url: 'https://docs.google.com/forms/d/e/1FAIpQLSdMB4xTmixE0659_0M9cPmL-Vx34vXx39l3PIFbtvE0F1yK8g/viewform' },
  ] },
]
