const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openDatabase}=require('../database/sqlite/connection.cjs');
const {validate,createBackup,prepareRestore,replaceDatabase,recoverRestore}=require('../database/sqlite/data-management.cjs');
function fixture() {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-data-test-'));
  const live=path.join(folder,'live.sqlite');
  return {folder,live,cleanup(){
    assert.equal(path.dirname(path.resolve(folder)),path.resolve(os.tmpdir()));
    fs.rmSync(folder,{recursive:true,force:true});
  }};
}
const seed=db=>{
  db.prepare("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Receita preservada',12345,'income','2026-01-01',7,1)").run();
  db.prepare("INSERT INTO planning_items(name,planned_date,amount_cents) VALUES('Planejamento preservado','2020-01-01',123)").run();
};
function snapshot(file) {
  const db=new DatabaseSync(file,{readOnly:true});
  try {return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,db.prepare('SELECT * FROM "'+name+'"').all()]);}
  finally {db.close();}
}
test('backup, restore and reopening work in accented paths without abandoned pending state',async()=>{
  const f=fixture();let db,staged;
  const folder=path.join(f.folder,'Finanças João');fs.mkdirSync(folder);
  const live=path.join(folder,'live.sqlite'),file=path.join(folder,'backup.sqlite');
  try {
    db=openDatabase(live);seed(db);await createBackup(db,file);
    assert.equal(fs.readdirSync(folder).some(name=>name.startsWith('.dash-backup-')),false);
    staged=await prepareRestore(file,live);db.close();db=undefined;
    await replaceDatabase(live,staged.file);staged.cleanup();staged=undefined;
    assert.equal(fs.existsSync(path.join(folder,'.restore-pending')),false);
    db=openDatabase(live);assert.equal(db.prepare('SELECT count(*) n FROM transactions').get().n,1);
  } finally {
    db?.close();staged?.cleanup();
    // Test fixture only: cleanup must also work on Node versions affected by Unicode rm.
    function remove(entry){const stat=fs.lstatSync(entry);if(stat.isDirectory()&&!stat.isSymbolicLink()){for(const child of fs.readdirSync(entry)) remove(path.join(entry,child));fs.rmdirSync(entry);}else fs.unlinkSync(entry);}
    assert.equal(path.dirname(f.folder),os.tmpdir());remove(f.folder);
  }
});
test('backup includes committed WAL data, is independently valid and never overwrites files',async()=>{
  const f=fixture();let db;
  try {
    db=openDatabase(f.live);seed(db);
    assert.ok(fs.statSync(f.live+'-wal').size>0);
    const target=path.join(f.folder,'backup.sqlite');
    const result=await createBackup(db,target);assert.ok(Date.parse(result.at));validate(target);
    assert.deepEqual(snapshot(target),snapshot(f.live));
    const bytes=fs.readFileSync(target);
    await assert.rejects(createBackup(db,target),{code:'BACKUP_DESTINATION'});
    assert.deepEqual(fs.readFileSync(target),bytes);
    await assert.rejects(createBackup(db,path.join(f.folder,'missing','backup.sqlite')));
    assert.equal(fs.readdirSync(f.folder).some(name=>name.startsWith('.dash-backup-')),false);
  } finally {db?.close();f.cleanup();}
});
test('restore replaces all data and preserves the previous complete database in a safety backup',async()=>{
  const f=fixture();let db,staged;
  try {
    db=openDatabase(f.live);seed(db);
    const backup=path.join(f.folder,'saved.sqlite');await createBackup(db,backup);
    db.prepare("UPDATE transactions SET valor_centavos=99999").run();
    const prior=snapshot(f.live);
    staged=await prepareRestore(backup,f.live);db.close();db=undefined;
    await replaceDatabase(f.live,staged.file);
    assert.deepEqual(snapshot(f.live),snapshot(backup));
    const safety=fs.readdirSync(path.join(f.folder,'backups')).find(name=>name.startsWith('before-restore-'));
    assert.deepEqual(snapshot(path.join(f.folder,'backups',safety)),prior);
    db=openDatabase(f.live);assert.equal(db.prepare('SELECT valor_centavos FROM transactions').get().valor_centavos,12345);db.close();db=undefined;
    recoverRestore(f.live);assert.deepEqual(snapshot(f.live),snapshot(backup));
  } finally {db?.close();staged?.cleanup();f.cleanup();}
});
test('invalid, empty, unknown, future-version and tampered backups are rejected without touching live data',async()=>{
  const f=fixture();let db;
  try {
    db=openDatabase(f.live);seed(db);db.close();db=undefined;
    const original=fs.readFileSync(f.live);
    for(const [name,content] of [['invalid','not sqlite'],['empty','']]) {
      const file=path.join(f.folder,name);fs.writeFileSync(file,content);
      await assert.rejects(prepareRestore(file,f.live));assert.deepEqual(fs.readFileSync(f.live),original);
    }
    const unknown=path.join(f.folder,'unknown.sqlite');db=new DatabaseSync(unknown);db.exec('CREATE TABLE test(id INTEGER)');db.close();db=undefined;
    assert.throws(()=>validate(unknown));
    const changed=path.join(f.folder,'changed.sqlite');fs.copyFileSync(f.live,changed);
    db=new DatabaseSync(changed);db.exec("INSERT INTO schema_migrations(version,checksum) VALUES('999_future','future')");db.close();db=undefined;
    assert.throws(()=>validate(changed),{code:'BACKUP_INCOMPATIBLE'});
    fs.copyFileSync(f.live,changed);db=new DatabaseSync(changed);db.exec('CREATE TRIGGER unexpected AFTER INSERT ON planning_items BEGIN DELETE FROM transactions; END');db.close();db=undefined;
    assert.throws(()=>validate(changed),{code:'BACKUP_INCOMPATIBLE'});
    await assert.rejects(prepareRestore(f.live,f.live),{code:'BACKUP_IS_CURRENT'});
    assert.deepEqual(fs.readFileSync(f.live),original);
  } finally {db?.close();f.cleanup();}
});
test('restoration failure rolls back the original data and keeps the safety backup',async()=>{
  const f=fixture();let db,staged;
  try {
    db=openDatabase(f.live);seed(db);const file=path.join(f.folder,'backup.sqlite');await createBackup(db,file);
    db.prepare("UPDATE planning_items SET amount_cents=888").run();const prior=snapshot(f.live);
    staged=await prepareRestore(file,f.live);db.close();db=undefined;
    let injected=false;
    await assert.rejects(replaceDatabase(f.live,staged.file,{afterReplace(){injected=true;throw new Error('Simulated disk failure');}}));
    assert.equal(injected,true);
    assert.deepEqual(snapshot(f.live),prior);validate(f.live);
    assert.ok(fs.readdirSync(path.join(f.folder,'backups')).some(name=>name.startsWith('before-restore-')));
    assert.equal(fs.existsSync(path.join(f.folder,'.restore-pending')),false);
  } finally {db?.close();staged?.cleanup();f.cleanup();}
});
test('an interrupted replacement recovers the original on startup and preserves the rejected candidate',()=>{
  const f=fixture();let db;
  try {
    db=openDatabase(f.live);seed(db);db.close();db=undefined;const prior=snapshot(f.live);
    const pending=path.join(f.folder,'.restore-pending');fs.mkdirSync(pending);
    fs.writeFileSync(path.join(pending,'state.json'),'{interrupted');
    fs.renameSync(f.live,path.join(pending,'original.sqlite'));fs.writeFileSync(f.live,'partial replacement');
    assert.throws(()=>openDatabase(f.live),{code:'RESTORE_RECOVERY_REQUIRED'});
    recoverRestore(f.live);assert.deepEqual(snapshot(f.live),prior);
    assert.ok(fs.readdirSync(path.join(f.folder,'backups')).some(name=>name.startsWith('interrupted-restore-')));
    recoverRestore(f.live);
  } finally {db?.close();f.cleanup();}
});
test('restore refuses a database still held open by another process/connection',async()=>{
  const f=fixture();let db,staged;
  try {
    db=openDatabase(f.live);seed(db);const file=path.join(f.folder,'saved.sqlite');await createBackup(db,file);
    staged=await prepareRestore(file,f.live);
    await assert.rejects(replaceDatabase(f.live,staged.file),{code:'DATABASE_STILL_OPEN'});
    assert.equal(db.prepare('SELECT count(*) n FROM transactions').get().n,1);
  } finally {db?.close();staged?.cleanup();f.cleanup();}
});

test('abrupt process exit during replacement is recovered on the next initialization',async()=>{
  const f=fixture();let db,staged;
  try {
    db=openDatabase(f.live);seed(db);const file=path.join(f.folder,'saved.sqlite');await createBackup(db,file);
    db.prepare('UPDATE planning_items SET amount_cents=777').run();const prior=snapshot(f.live);
    staged=await prepareRestore(file,f.live);db.close();db=undefined;
    const child=require('node:child_process').spawnSync(process.execPath,['-e',
      "require('./database/sqlite/data-management.cjs').replaceDatabase(process.argv[1],process.argv[2],{afterReplace(){process.exit(23);}}).catch(()=>process.exit(24));",
      f.live,staged.file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',windowsHide:true,timeout:10000});
    assert.equal(child.status,23,child.stderr);
    assert.throws(()=>openDatabase(f.live),{code:'RESTORE_RECOVERY_REQUIRED'});
    recoverRestore(f.live);assert.deepEqual(snapshot(f.live),prior);
    db=openDatabase(f.live);assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
  } finally {db?.close();staged?.cleanup();f.cleanup();}
});
