import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 開始植入種子資料…')

  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.member.upsert({
    where: { email: 'admin@congregation.local' },
    update: {},
    create: {
      name: '系統管理員',
      email: 'admin@congregation.local',
      password: adminPassword,
      role: 'admin',
      active: true,
    },
  })
  console.log('✓ 建立管理員帳號:', admin.email)

  const memberPassword = await hash('member123', 12)
  const members = await Promise.all([
    prisma.member.upsert({
      where: { email: 'john@congregation.local' },
      update: {},
      create: { name: '王大明', email: 'john@congregation.local', password: memberPassword, role: 'publisher', active: true },
    }),
    prisma.member.upsert({
      where: { email: 'mary@congregation.local' },
      update: {},
      create: { name: '李小美', email: 'mary@congregation.local', password: memberPassword, role: 'publisher', active: true },
    }),
    prisma.member.upsert({
      where: { email: 'peter@congregation.local' },
      update: {},
      create: { name: '陳彼得', email: 'peter@congregation.local', password: memberPassword, role: 'elder', active: true },
    }),
  ])
  console.log(`✓ 建立 ${members.length} 位成員`)

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)

  const areasData = [
    { name: '東區第一街道', description: '包含忠孝東路一段至三段', assignedTo: '王大明', lastActivityAt: daysAgo(2) },
    { name: '東區第二街道', description: '包含忠孝東路四段至五段', assignedTo: '李小美', lastActivityAt: daysAgo(10) },
    { name: '西區住宅區', description: '西門町附近住宅密集區', assignedTo: '陳彼得', lastActivityAt: daysAgo(35) },
    { name: '南區商業街', description: '信義路商圈周邊', assignedTo: null, lastActivityAt: daysAgo(45) },
    { name: '北區公寓群', description: '士林夜市周邊公寓', assignedTo: '王大明', lastActivityAt: daysAgo(5) },
    { name: '中央市場區', description: '傳統市場周邊區域', assignedTo: null, lastActivityAt: daysAgo(60) },
  ]

  await prisma.area.deleteMany()
  for (const area of areasData) {
    await prisma.area.create({ data: area })
  }
  console.log(`✓ 建立 ${areasData.length} 個區域`)

  await prisma.setting.upsert({
    where: { key: 'idle_threshold_days' },
    update: {},
    create: { key: 'idle_threshold_days', value: '30' },
  })
  console.log('✓ 建立預設設定')

  console.log('\n🎉 種子資料植入完成！')
  console.log('   管理員：admin@congregation.local / admin123')
  console.log('   成員：  john@congregation.local  / member123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
