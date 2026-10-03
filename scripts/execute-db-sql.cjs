const { spawnSync } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');

// P1001 occurs before SQL execution. Other failures may have executed SQL,
// so keep them fatal rather than replaying a partially completed operation.
async function executeSql(file, options = {}) {
  const run = options.run ?? spawnSync;
  const pause = options.wait ?? wait;
  const log = options.log ?? console.log;
  const delays = [5000, 10000, 20000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const result = run(process.execPath, [require.resolve('prisma'), 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'], {
      encoding: 'utf8', env: process.env, timeout: 120000, windowsHide: true,
    });
    if (result.stdout) log(result.stdout.trimEnd());
    if (result.stderr) log(result.stderr.trimEnd());
    if (result.status === 0) return 0;
    if (result.error) log(`Database command could not complete: ${result.error.message}`);
    const unavailable = /\bP1001\b/.test(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    if (!unavailable || result.error || attempt === delays.length) return result.status || 1;
    log(`Database unavailable; retry ${attempt + 1}/${delays.length} in ${delays[attempt] / 1000}s`);
    await pause(delays[attempt]);
  }
  return 1;
}

module.exports = { executeSql };
if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('SQL file is required'); process.exitCode = 1; }
  else executeSql(file).then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
