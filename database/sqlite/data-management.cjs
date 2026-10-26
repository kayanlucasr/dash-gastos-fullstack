const fs = require('node:fs');
const path = require('node:path');
const {randomUUID,createHash} = require('node:crypto');
const {DatabaseSync,backup} = require('node:sqlite');
const {openDatabase} = require('./connection.cjs');
const migrations = path.join(__dirname,'migrations');
const diagnostics=require('../../services/diagnostics.cjs');
const fail = code => Object.assign(new Error(code),{code});
function removeTemporary(entry) {
  // Only our private stages/markers/backup temporaries can be cleanup roots.
  if(!path.isAbsolute(entry) || !/^(?:\.restore-pending|\.restore-stage-[a-zA-Z0-9]+|\.dash-backup-[a-f0-9-]+\.sqlite(?:-wal|-shm)?)$/.test(path.basename(entry))) throw fail('DATA_CLEANUP_INVALID');
  function remove(current) {
    let stat;
    try {stat=fs.lstatSync(current);} catch(error) {if(error.code==='ENOENT') return;throw error;}
    if(stat.isDirectory() && !stat.isSymbolicLink()) {
      for(const child of fs.readdirSync(current)) remove(path.join(current,child));
      fs.rmdirSync(current);
    } else fs.unlinkSync(current);
  }
  // Individual operations avoid the Windows Unicode-path recursive rm issue.
  remove(entry);
  if(fs.existsSync(entry)) throw fail('DATA_CLEANUP_FAILED');
}
function standalone(file) {
  const db=new DatabaseSync(file);
  try {db.exec('PRAGMA journal_mode=DELETE;');} finally {db.close();}
}
function syncJSON(file,value) {
  const fd=fs.openSync(file,'w');
  try {fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
function schema(db) {
  return db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
}
function validate(file) {
  if (!path.isAbsolute(file) || !fs.statSync(file).isFile() || fs.statSync(file).size===0) throw fail('BACKUP_INVALID');
  let db,reference;
  try {
    db=new DatabaseSync(file,{readOnly:true});
    if (db.prepare('PRAGMA integrity_check').all().some(row=>Object.values(row)[0]!=='ok') || db.prepare('PRAGMA foreign_key_check').all().length) throw fail('BACKUP_INVALID');
    const expected=fs.readdirSync(migrations).filter(name=>/^\d+_.*\.sql$/.test(name)).sort().map(name=>({version:name.slice(0,-4),sql:fs.readFileSync(path.join(migrations,name),'utf8')}));
    const versions=db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all();
    if (versions.length!==expected.length || expected.some((entry,i)=>versions[i].version!==entry.version || versions[i].checksum!==createHash('sha256').update(entry.sql).digest('hex'))) throw fail('BACKUP_INCOMPATIBLE');
    reference=new DatabaseSync(':memory:');
    reference.exec("CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))) STRICT");
    for (const entry of expected) reference.exec(entry.sql);
    // Reject missing/modified tables, views, indexes and unexpected triggers.
    if (JSON.stringify(schema(db))!==JSON.stringify(schema(reference))) throw fail('BACKUP_INCOMPATIBLE');
  } catch(error) {
    if (error.code==='BACKUP_INCOMPATIBLE') throw error;
    throw fail('BACKUP_INVALID');
  } finally {db?.close();reference?.close();}
}
async function createBackup(connection,target) {
  if (!path.isAbsolute(target) || fs.existsSync(target) || ['-wal','-shm','-journal'].some(s=>fs.existsSync(target+s))) throw fail('BACKUP_DESTINATION');
  const temporary=path.join(path.dirname(target),'.dash-backup-'+randomUUID()+'.sqlite');
  try {
    await backup(connection,temporary);
    standalone(temporary);
    validate(temporary);
    // COPYFILE_EXCL prevents overwriting a file created while the backup ran.
    fs.copyFileSync(temporary,target,fs.constants.COPYFILE_EXCL);
    const fd=fs.openSync(target,'r+');try {fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    validate(target);
    return {at:new Date().toISOString()};
  } finally {for(const suffix of ['','-wal','-shm']) removeTemporary(temporary+suffix);}
}
async function prepareRestore(source,live) {
  if (fs.realpathSync(source).toLowerCase()===fs.realpathSync(live).toLowerCase()) throw fail('BACKUP_IS_CURRENT');
  validate(source);
  const folder=fs.mkdtempSync(path.join(path.dirname(live),'.restore-stage-'));
  let connection;
  try {
    connection=new DatabaseSync(source,{readOnly:true});
    const staged=path.join(folder,'validated.sqlite');
    await backup(connection,staged);standalone(staged);validate(staged);
    return {file:staged,cleanup:()=>removeTemporary(folder)};
  } catch(error) {removeTemporary(folder);throw error;}
  finally {connection?.close();}
}
function pendingPath(live) {return path.join(path.dirname(live),'.restore-pending');}
function recoverRestore(live) {
  const pending=pendingPath(live);
  if(!fs.existsSync(pending)) return;
  const original=path.join(pending,'original.sqlite');
  let committed=false;
  try {committed=JSON.parse(fs.readFileSync(path.join(pending,'state.json'),'utf8')).committed===true;} catch { /* Incomplete marker: recover conservatively. */ }
  if(committed) validate(live);
  else if(fs.existsSync(original)) {
    if(fs.existsSync(live)) {
      const failed=path.join(path.dirname(live),'backups','interrupted-restore-'+randomUUID()+'.sqlite');
      fs.mkdirSync(path.dirname(failed),{recursive:true});fs.renameSync(live,failed);
      for(const suffix of ['-wal','-shm','-journal']) if(fs.existsSync(live+suffix)) fs.renameSync(live+suffix,failed+suffix);
    }
    fs.renameSync(original,live);validate(live);
  } else {
    if(!fs.existsSync(live)) throw fail('RESTORE_RECOVERY_REQUIRED');
    validate(live);
  }
  removeTemporary(pending);
  diagnostics.log(committed ? 'RESTORE_COMMIT_RECOVERED' : 'RESTORE_ORIGINAL_RECOVERED');
}
async function replaceDatabase(live,staged,{afterReplace=()=>{}}={}) {
  diagnostics.log('RESTORE_START');
  validate(staged);
  if(['-wal','-shm','-journal'].some(s=>fs.existsSync(live+s))) throw fail('DATABASE_STILL_OPEN');
  const safety=path.join(path.dirname(live),'backups','before-restore-'+randomUUID()+'.sqlite');
  fs.mkdirSync(path.dirname(safety),{recursive:true});
  let connection;
  try {connection=new DatabaseSync(live);await createBackup(connection,safety);} finally {connection?.close();}
  diagnostics.log('RESTORE_SAFETY_CREATED');
  if(['-wal','-shm','-journal'].some(s=>fs.existsSync(live+s))) throw fail('DATABASE_STILL_OPEN');
  const pending=pendingPath(live);
  fs.mkdirSync(pending); // Never replace an unresolved recovery operation.
  try {
    fs.copyFileSync(staged,path.join(pending,'replacement.sqlite'),fs.constants.COPYFILE_EXCL);
    syncJSON(path.join(pending,'state.json'),{committed:false});
    fs.renameSync(live,path.join(pending,'original.sqlite'));
    fs.renameSync(path.join(pending,'replacement.sqlite'),live);
    afterReplace();
    validate(live);
    const check=openDatabase(live,{allowRestorePending:true});check.close();
    syncJSON(path.join(pending,'state.json'),{committed:true});
  } catch(error) {
    try {recoverRestore(live);} catch(recoveryError) {throw Object.assign(fail('RESTORE_RECOVERY_REQUIRED'),{cause:recoveryError});}
    diagnostics.log('RESTORE_ROLLED_BACK',error);
    throw error;
  }
  // Cleanup failure leaves a committed marker for next startup; data is valid.
  try {recoverRestore(live);} catch { /* Retry on next launch. */ }
  return {at:new Date().toISOString()};
}
module.exports={validate,createBackup,prepareRestore,replaceDatabase,recoverRestore};
