const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const {
  openDatabase,
  backup
} = require('../database/sqlite/connection.cjs');
const {
  cents,
  decimal
} = require('../services/money.cjs');
function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-sqlite-storage-'));
  return {
    folder,
    file: path.join(folder, 'test.sqlite'),
    cleanup: () => fs.rmSync(folder, {
      recursive: true,
      force: true
    })
  };
}
test('SQLite initializes once and persists balances and migrations after reopen', () => {
  const f = fixture();
  let db;
  try {
    db = openDatabase(f.file);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM categories').get().n, 7);
    db.prepare("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Teste',1234,'income','2024-12-31',7,1)").run();
    const count = db.prepare('SELECT count(*) n FROM schema_migrations').get().n;
    db.close();
    db = openDatabase(f.file);
    assert.equal(db.prepare('SELECT valor_centavos FROM transactions').get().valor_centavos, 1234);
    assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n, count);
  } finally {
    if (db) db.close();
    f.cleanup();
  }
});
test('corrupt or unknown databases are preserved and fail initialization', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.file, 'invalid sqlite data');
    const before = fs.readFileSync(f.file);
    assert.throws(() => openDatabase(f.file), e => e.code === 'SQLITE_INITIALIZATION_FAILED');
    assert.deepEqual(fs.readFileSync(f.file), before);
  } finally {
    f.cleanup();
  }
});
test('failed financial transaction rolls back every write', () => {
  const f = fixture();
  process.env.SQLITE_PATH = f.file;
  const db = require('../db');
  try {
    assert.throws(() => db.transaction(() => {
      db.run("INSERT INTO accounts(nome,tipo) VALUES('Rollback','reserve')");
      db.run("INSERT INTO accounts(nome,tipo) VALUES('Rollback','reserve')");
    }));
    assert.equal(db.one("SELECT count(*) n FROM accounts WHERE nome='Rollback'").n, 0);
    assert.throws(() => db.transaction(() => Promise.resolve()), /síncrono/);
  } finally {
    db.end();
    f.cleanup();
  }
});
test('money parsing never rounds and preserves integer-cent precision', () => {
  assert.equal(cents('0.10') + cents('0.20'), 30n);
  assert.equal(decimal(9007199254740993n), '90071992547409.93');
  assert.equal(decimal(-1n), '-0.01');
  for (const value of ['1.001', '1e3', NaN, [], null, '10000000000']) assert.throws(() => cents(value));
});
test('migration backup and rollback preserve an existing database', () => {
  const f = fixture();
  let db;
  try {
    const migrations = path.join(f.folder, 'migrations');
    fs.mkdirSync(migrations);
    fs.copyFileSync(path.resolve('database/sqlite/migrations/001_initial.sql'), path.join(migrations, '001_initial.sql'));
    db = openDatabase(f.file, {
      migrationsDir: migrations
    });
    db.prepare("INSERT INTO accounts(nome,tipo) VALUES('Preservar','reserve')").run();
    db.close();
    db = null;
    fs.writeFileSync(path.join(migrations, '002_fail.sql'), "CREATE TABLE temporary_changes(id INTEGER); INVALID SQL;");
    assert.throws(() => openDatabase(f.file, {
      migrationsDir: migrations
    }));
    fs.unlinkSync(path.join(migrations, '002_fail.sql'));
    db = openDatabase(f.file, {
      migrationsDir: migrations
    });
    assert.equal(db.prepare("SELECT count(*) n FROM accounts WHERE nome='Preservar'").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='temporary_changes'").get().n, 0);
    assert.ok(fs.readdirSync(path.join(f.folder, 'backups')).some(x => x.endsWith('.sqlite')));
  } finally {
    if (db) db.close();
    f.cleanup();
  }
});
test('online backup restores a consistent independent database', async () => {
  const f = fixture();
  let db, copy;
  try {
    db = openDatabase(f.file);
    db.prepare("INSERT INTO accounts(nome,tipo) VALUES('Backup','reserve')").run();
    const target = path.join(f.folder, 'backup.sqlite');
    await backup(db, target);
    copy = openDatabase(target);
    assert.equal(copy.prepare("SELECT count(*) n FROM accounts WHERE nome='Backup'").get().n, 1);
  } finally {
    if (copy) copy.close();
    if (db) db.close();
    f.cleanup();
  }
});
test('schema checksum prevents silently changing an applied migration', () => {
  const f = fixture();
  let db;
  try {
    const dir = path.join(f.folder, 'migrations');
    fs.mkdirSync(dir);
    const file = path.join(dir, '001_initial.sql');
    fs.copyFileSync(path.resolve('database/sqlite/migrations/001_initial.sql'), file);
    db = openDatabase(f.file, {
      migrationsDir: dir
    });
    db.close();
    db = null;
    fs.appendFileSync(file, '-- changed');
    assert.throws(() => openDatabase(f.file, {
      migrationsDir: dir
    }));
  } finally {
    if (db) db.close();
    f.cleanup();
  }
});
test('maintenance scripts initialize and back up only the explicit test path', () => {
  const f = fixture();
  try {
    const {
      spawnSync
    } = require('node:child_process');
    const env = {
      ...process.env,
      SQLITE_PATH: f.file
    };
    let result = spawnSync(process.execPath, ['scripts/sqlite-maintenance.cjs'], {
      env,
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr);
    const target = path.join(f.folder, 'manual-backup.sqlite');
    result = spawnSync(process.execPath, ['scripts/sqlite-backup.cjs', target], {
      env,
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(target));
    const before = fs.readFileSync(target);
    result = spawnSync(process.execPath, ['scripts/sqlite-backup.cjs', target], {
      env,
      encoding: 'utf8',
      windowsHide: true
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(target), before);
  } finally {
    f.cleanup();
  }
});
test('unknown non-empty databases are not adopted or overwritten', () => {
  const f = fixture();
  let raw;
  try {
    const {
      DatabaseSync
    } = require('node:sqlite');
    raw = new DatabaseSync(f.file);
    raw.exec("CREATE TABLE unrelated(id INTEGER PRIMARY KEY); INSERT INTO unrelated VALUES(7)");
    raw.close();
    raw = null;
    assert.throws(() => openDatabase(f.file), e => e.code === 'SQLITE_INITIALIZATION_FAILED');
    raw = new DatabaseSync(f.file);
    assert.equal(raw.prepare('SELECT id FROM unrelated').get().id, 7);
    assert.equal(raw.prepare("SELECT count(*) n FROM sqlite_master WHERE name='schema_migrations'").get().n, 0);
  } finally {
    if (raw) raw.close();
    f.cleanup();
  }
});

test('concurrent initialization does not duplicate schema or seed accounts',async()=>{
 const f=fixture();let db;try{const {spawn}=require('node:child_process');const start=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/sqlite-maintenance.cjs'],{env:{...process.env,SQLITE_PATH:f.file},windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);child.once('error',reject);child.once('exit',code=>resolve({code,stderr}));});const results=await Promise.all([start(),start()]);assert.deepEqual(results.map(result=>result.code),[0,0],JSON.stringify(results));db=openDatabase(f.file);assert.equal(db.prepare('SELECT count(*) n FROM accounts').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n,2);}finally{if(db)db.close();f.cleanup();}
});
