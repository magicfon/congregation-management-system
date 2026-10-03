const assert = require('node:assert/strict');
const { executeSql } = require('./execute-db-sql.cjs');
async function check() {
  let attempts = 0, delays = [];
  const options = { log: () => {}, wait: async ms => delays.push(ms) };
  const failed = { status: 1, stderr: "Error: P1001\nCan't reach database server", stdout: '' };
  assert.equal(await executeSql('prisma/line-display-name.sql', { ...options, run: () => ++attempts < 3 ? failed : { status: 0 } }), 0);
  assert.equal(attempts, 3); assert.deepEqual(delays, [5000, 10000]);
  attempts = 0; delays = [];
  assert.equal(await executeSql('prisma/line-display-name.sql', { ...options, run: () => { attempts++; return failed; } }), 1);
  assert.equal(attempts, 4); assert.deepEqual(delays, [5000, 10000, 20000]);
  attempts = 0;
  assert.equal(await executeSql('prisma/line-display-name.sql', { ...options, run: () => { attempts++; return { status: 1, stderr: 'Error: P2010 SQL syntax error' }; } }), 1);
  assert.equal(attempts, 1, 'SQL errors must not retry or be ignored');
  assert.equal(await executeSql('prisma/line-display-name.sql', { ...options, run: () => ({ status: null, error: new Error('process failed') }) }), 1);
  const pkg = require('../package.json');
  for (const command of Object.values(pkg.scripts).filter(value => value.startsWith('node scripts/execute-db-sql.cjs '))) {
    assert.ok(require('node:fs').existsSync(command.split(' ').at(-1)));
  }
  assert.ok(require('node:fs').readFileSync('.vercelignore', 'utf8').includes('!scripts/execute-db-sql.cjs'));
  console.log('Database retry recovery, exhaustion, SQL failure and packaging checks passed');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
