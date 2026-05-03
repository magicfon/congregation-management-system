const fs = require('fs')
const assert = require('assert')

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert(pkg.dependencies && pkg.dependencies.googleapis, 'googleapis must be listed in dependencies for scripts/daily-sync.ts')

const membersRoute = fs.readFileSync('src/app/api/members/route.ts', 'utf8')
const memberByIdRoute = fs.readFileSync('src/app/api/members/[id]/route.ts', 'utf8')
assert(membersRoute.includes('SAFE_MEMBER_COLUMNS'), 'members list route should use an explicit safe member column list')
assert(memberByIdRoute.includes('SAFE_MEMBER_COLUMNS'), 'member detail route should use an explicit safe member column list')
assert(!membersRoute.includes(".select('*')"), 'members list route must not select password via select(*)')
assert(!memberByIdRoute.includes(".select('*')"), 'member detail route must not select password via select(*)')
assert(!/SAFE_MEMBER_COLUMNS\s*=\s*['"][^'"]*password/i.test(membersRoute + memberByIdRoute), 'safe member column list must not include password')
assert(/import \{ hash \} from 'bcryptjs'/.test(membersRoute), 'member creation must hash passwords before storing')
assert(/password:\s*passwordHash/.test(membersRoute), 'member creation must store the password hash, not plaintext')

const statisticsRoute = fs.readFileSync('src/app/api/statistics/route.ts', 'utf8')
assert(!/from\('schedules'\)[\s\S]*?\.eq\('status',\s*'scheduled'\)/.test(statisticsRoute), 'statistics scheduleCount should count all schedules, not only status=scheduled')

console.log('regression checks passed')
