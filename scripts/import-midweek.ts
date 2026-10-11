import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
async function main() {
  const { syncMidweek } = await import('../src/lib/midweek-sync')
  const { prisma } = await import('../src/lib/db')
  try {
    for (let batch = 0; batch < 100; batch++) {
      const state = await syncMidweek(batch === 0)
      console.log(JSON.stringify(state))
      if (!state || ('busy' in state && state.busy) || !('remaining' in state) || !state.remaining) break
    }
  } finally { await prisma.$disconnect() }
}
main().catch(() => { console.error('手冊匯入未完成，請检查資料庫與來源連線'); process.exitCode = 1 })
