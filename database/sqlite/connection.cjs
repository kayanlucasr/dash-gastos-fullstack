const fs = require('node:fs');
const path = require('node:path');
const {
  DatabaseSync,
  backup
} = require('node:sqlite');
const {
  createHash,
  randomUUID
} = require('node:crypto');
const os = require('node:os');
function defaultPath() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), '.local/share'), 'DashGastosDesktop', 'development', 'dash-gastos.sqlite');
}
function openDatabase(filename, {
  migrationsDir = path.join(__dirname, 'migrations'),
  allowRestorePending = false
} = {}) {
  if (!path.isAbsolute(filename)) throw new Error('O caminho SQLite deve ser absoluto.');
  if(!allowRestorePending && fs.existsSync(path.join(path.dirname(filename),'.restore-pending'))) throw Object.assign(new Error('Existe uma restauração pendente. Reabra o aplicativo desktop para recuperar os dados.'),{code:'RESTORE_RECOVERY_REQUIRED'});
  if (filename.toLowerCase().includes('.asar' + path.sep) || filename.toLowerCase().includes('.asar/')) throw new Error('SQLite não pode ficar no ASAR.');
  fs.mkdirSync(path.dirname(filename), {
    recursive: true
  });
  const existed = fs.existsSync(filename);
  let connection;
  try {
    connection = new DatabaseSync(filename);
    connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const quick = connection.prepare('PRAGMA quick_check').get();
    if (Object.values(quick)[0] !== 'ok') throw new Error('SQLite não passou na verificação de integridade.');
    const tables = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    if (tables.length && !tables.some(t => t.name === 'schema_migrations')) throw new Error('Banco existente sem versão reconhecida; arquivo preservado.');
    const known = tables.length ? connection.prepare('SELECT version,checksum FROM schema_migrations').all() : [];
    const files = fs.readdirSync(migrationsDir).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
    if (known.some(m => !files.includes(m.version + '.sql'))) throw new Error('Banco criado por uma versão mais nova; atualização recusada.');
    const pending = [];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const version = file.slice(0, -4);
      const old = known.find(m => m.version === version);
      if (old && old.checksum !== checksum) throw new Error('Migration já aplicada foi alterada: ' + version);
      if (!old) pending.push({
        version,
        sql,
        checksum
      });
    }
    if (existed && tables.length && pending.length) {
      const dir = path.join(path.dirname(filename), 'backups');
      fs.mkdirSync(dir, {
        recursive: true
      });
      connection.prepare('VACUUM INTO ?').run(path.join(dir, 'before-migration-' + Date.now() + '-' + randomUUID() + '.sqlite'));
    }
    // Concurrent first opens can race while changing journal mode; SQLite may
    // return BUSY immediately here despite busy_timeout. Retry only this setup
    // operation, before beginning any migration or financial transaction.
    const journalDeadline = Date.now() + 5000;
    const journalWait = new Int32Array(new SharedArrayBuffer(4));
    while (true) {
      try {
        connection.exec('PRAGMA journal_mode=WAL;');
        break;
      } catch (error) {
        if (error.errcode !== 5 || Date.now() >= journalDeadline) throw error;
        Atomics.wait(journalWait, 0, 0, 25);
      }
    }
    connection.exec('PRAGMA synchronous=FULL;');
    connection.exec('BEGIN IMMEDIATE');
    try {
      connection.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))) STRICT");
      for (const migration of pending) {
        const applied = connection.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(migration.version);
        if (applied) {
          if (applied.checksum !== migration.checksum) throw new Error('Checksum de migration incompatível.');
          continue;
        }
        connection.exec(migration.sql);
        connection.prepare('INSERT INTO schema_migrations(version,checksum) VALUES(?,?)').run(migration.version, migration.checksum);
      }
      if (connection.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Falha na integridade referencial.');
      const required = ['accounts', 'categories', 'transactions', 'investment_valuations', 'monthly_closings', 'monthly_category_totals', 'market_indicators', 'market_quotes', 'market_sync_state'];
      for (const name of required) if (!connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) throw new Error('Tabela SQLite ausente: ' + name);
      const columns = {
        transactions: ['id', 'valor_centavos', 'data', 'cancelled_at', 'source_account_id', 'destination_account_id'],
        accounts: ['id', 'nome', 'tipo'],
        investment_valuations: ['valor_centavos', 'transaction_id'],
        monthly_closings: ['month', 'summary', 'revision'],
        market_quotes: ['quoted_at', 'price', 'provider'],
        market_sync_state: ['next_attempt_at', 'lease_until']
      };
      for (const [table, names] of Object.entries(columns)) {
        const actual = connection.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name);
        if (names.some(name => !actual.includes(name))) throw new Error('Estrutura SQLite incompatível: ' + table);
      }
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
    return connection;
  } catch (error) {
    if (connection) connection.close();
    throw Object.assign(new Error('Não foi possível abrir ou atualizar o banco SQLite. O arquivo existente foi preservado.'), {
      cause: error,
      code: 'SQLITE_INITIALIZATION_FAILED'
    });
  }
}
module.exports = {
  openDatabase,
  defaultPath,
  backup
};
