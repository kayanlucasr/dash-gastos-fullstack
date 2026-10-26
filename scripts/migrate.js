require('dotenv').config({
  quiet: true
});
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../database/postgres/connection.cjs');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(90251025)');
    for (const file of fs.readdirSync(path.join(__dirname, '../database/migrations')).filter(f => /^00[2-9]_.*\.sql$/.test(f)).sort()) {
      const version = file.slice(0, -4);
      if (!(await c.query('SELECT version FROM schema_migrations WHERE version=$1', [version])).rows.length) {
        if (version === '003_single_wallet') throw new Error('Use o procedimento protegido db:remove-login após autorização e backup.');
        await c.query(fs.readFileSync(path.join(__dirname, '../database/migrations', file), 'utf8'));
        console.log('Aplicada:', version);
      }
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error(e.code || e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
