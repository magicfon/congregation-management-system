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

const supabaseServer = fs.readFileSync('src/lib/supabase-server.ts', 'utf8')
const supabaseClient = fs.readFileSync('src/lib/supabase.ts', 'utf8')
const authLib = fs.readFileSync('src/lib/auth.ts', 'utf8')
const simpleLoginRoute = fs.readFileSync('src/app/api/simple-login/route.ts', 'utf8')
const gitignore = fs.readFileSync('.gitignore', 'utf8')

assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(supabaseServer + supabaseClient + authLib), 'source must not contain hard-coded JWT/API tokens')
assert(!/OpenClaw2026Secret/.test(authLib), 'NextAuth must not use a hard-coded fallback secret')
assert(/secret:\s*process\.env\.NEXTAUTH_SECRET/.test(authLib), 'NextAuth secret should come from NEXTAUTH_SECRET only')
assert(/process\.env\.SUPABASE_SERVICE_KEY/.test(supabaseServer), 'server Supabase client should read SUPABASE_SERVICE_KEY from env')
assert(!/SUPABASE_SERVICE_KEY\s*\|\|/.test(supabaseServer), 'server Supabase client must not fallback to a hard-coded service key')
assert(simpleLoginRoute.includes("../../../lib/supabase-server"), 'simple-login should use the server Supabase client consistently')
assert(gitignore.split(/\r?\n/).includes('.env.production'), '.env.production must be ignored')

console.log('regression checks passed')
