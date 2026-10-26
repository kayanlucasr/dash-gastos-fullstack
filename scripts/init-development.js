require('dotenv').config({
  quiet: true
});
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../database/postgres/connection.cjs');
(async () => {
  const c = await pool.connect();
  try {
    if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) throw new Error('Inicialização restrita ao desenvolvimento local.');
    await c.query('BEGIN');
    const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
    if (tables.length) throw new Error('Banco não está vazio. Nenhuma tabela foi alterada.');
    await c.query(fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8'));
    await c.query('COMMIT');
    console.log('Esquema inicializado, sem autenticação ou dados financeiros fictícios.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error(e.code || e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
