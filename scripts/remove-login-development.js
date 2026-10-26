const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  execFileSync
} = require('node:child_process');
require('dotenv').config({
  quiet: true
});
const {
  Pool
} = require('pg');
const target = process.env.DB_NAME;
if (target !== 'dash_gastos' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST) || process.env.NODE_ENV === 'production' || process.argv[2] !== '--confirmed-remove-login') {
  throw new Error('Alvo não autorizado. Exige dash_gastos local e confirmação de desenvolvimento.');
}
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: target,
  connectionTimeoutMillis: 5000
};
const pool = new Pool(config);
const childEnv = {
  ...process.env,
  PGHOST: config.host,
  PGPORT: String(config.port),
  PGUSER: config.user,
  PGPASSWORD: config.password,
  PGDATABASE: target
};
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const temp = 'dash_gastos_auth_restore_check_' + stamp;
const dir = path.resolve(__dirname, '../backups');
fs.mkdirSync(dir, {
  recursive: true
});
const backup = path.join(dir, target + '_' + stamp + '.dump');
const run = (name, args) => execFileSync(path.join(bin, name + '.exe'), args, {
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});
const digest = async (c, table) => (await c.query(`SELECT md5(COALESCE(jsonb_agg(row ORDER BY row::text)::text,'[]')) hash,count(*)::int count FROM (SELECT to_jsonb(t)-'user_id' AS row FROM public.${table} t) x`)).rows[0];
(async () => {
  let client,
    restored,
    created = false;
  try {
    client = await pool.connect();
    const expected = ['accounts', 'categories', 'investment_valuations', 'market_indicators', 'market_quotes', 'market_sync_state', 'monthly_category_totals', 'monthly_closings', 'schema_migrations', 'transactions', 'users'];
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
    if (JSON.stringify(tables) !== JSON.stringify(expected)) throw new Error('Inventário mudou; migração recusada.');
    if ((await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n > 1) throw new Error('Mais de um usuário; não combinar carteiras.');
    if ((await client.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n) throw new Error('Feche a aplicação e outras conexões antes de migrar.');
    console.log('Alvo validado: dash_gastos local. Backup antes da remoção de users; dados financeiros preservados.');
    run('pg_dump', ['--format=custom', '--file', backup, '--no-password']);
    run('pg_restore', ['--list', backup]);
    await client.query('CREATE DATABASE "' + temp + '" TEMPLATE template0');
    created = true;
    run('pg_restore', ['--exit-on-error', '--no-owner', '--dbname', temp, backup]);
    restored = new Pool({
      ...config,
      database: temp
    });
    const financial = tables.filter(t => !['users', 'schema_migrations'].includes(t));
    const original = {};
    for (const table of tables) original[table] = await digest(restored, table);
    const migration = fs.readFileSync(path.resolve(__dirname, '../database/migrations/003_single_wallet.sql'), 'utf8');
    await restored.query('BEGIN');
    await restored.query(migration);
    for (const table of financial) if (JSON.stringify(await digest(restored, table)) !== JSON.stringify(original[table])) throw new Error('Dados financeiros alterados no ensaio.');
    await restored.query('COMMIT');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('LOCK TABLE ' + tables.map(t => 'public.' + t).join(',') + ' IN ACCESS EXCLUSIVE MODE');
    for (const table of tables) if (JSON.stringify(await digest(client, table)) !== JSON.stringify(original[table])) throw new Error('Dados mudaram desde o backup.');
    await client.query(migration);
    for (const table of financial) if (JSON.stringify(await digest(client, table)) !== JSON.stringify(original[table])) throw new Error('Dados financeiros alterados na migração.');
    await client.query('COMMIT');
    const report = {
      database: target,
      backup,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'),
      restoreVerified: true,
      removedAuthenticationUsers: original.users.count,
      preservedTransactions: original.transactions.count,
      completedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(dir, 'remove_login_' + stamp + '.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Reconstrução interrompida:', e.code || e.message);
    process.exitCode = 1;
  } finally {
    if (restored) await restored.end();
    if (created && client) await client.query('DROP DATABASE "' + temp + '"');
    if (client) client.release();
    await pool.end();
  }
})();
