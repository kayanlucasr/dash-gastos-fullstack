const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const {
  spawnSync
} = require('node:child_process');
const {
  openDatabase
} = require('../database/sqlite/connection.cjs');
const electron = require('electron'),
  root = path.resolve(__dirname, '..');
const appPath = process.env.DESKTOP_SMOKE_APP || root;
const packagedExecutable=process.env.DESKTOP_SMOKE_EXE;
const persistentProfile=process.env.DESKTOP_SMOKE_PERSISTENT_PROFILE;
const reopenCount=Number(process.env.DESKTOP_SMOKE_REOPEN_COUNT || 1);
if(!Number.isInteger(reopenCount) || reopenCount<1 || reopenCount>10) throw new Error('Invalid repeat count');
if(persistentProfile && (path.dirname(path.resolve(persistentProfile))!==path.resolve(os.tmpdir()) || !/^financeiro-install-data-[a-f0-9-]+$/.test(path.basename(persistentProfile)))) throw new Error('Invalid isolated installation test profile');
fs.mkdirSync(path.join(root, 'backups'), {recursive: true});
function profile(accented=false) {
  return fs.mkdtempSync(path.join(os.tmpdir(), accented ? 'dash-electron-test-ação-' : 'dash-electron-test-'));
}
function seed(folder, development = false) {
  const file = path.join(folder, development ? 'development' : 'data', 'dash-gastos.sqlite');
  const db = openDatabase(file);
  try {
    db.prepare("INSERT INTO planning_items(name,planned_date,amount_cents) VALUES('Persistência planejamento','2000-01-01',123)").run();
    db.prepare("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Teste isolado',100010,'income',?,7,1)").run(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
    db.prepare("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,source_account_id) VALUES('Teste isolado',1025,'expense',substr(?,1,10),1,1)").run(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()));
  } finally {
    db.close();
  }
}
function run(folder, args = []) {
  const profileReport = path.join(folder, 'reports/electron-smoke.json');
  fs.rmSync(profileReport, {
    force: true
  });
  const result = spawnSync(packagedExecutable || electron, [...(packagedExecutable ? [] : [appPath]), '--desktop-smoke-test', '--desktop-test-profile=' + folder, ...args], {
    cwd: root,
    env: {
      ...process.env,
      DB_HOST: '127.0.0.1',
      DB_PORT: '1',
      DB_NAME: 'unused-postgres',
      ...(packagedExecutable ? {PATH:path.join(process.env.SystemRoot || 'C:/Windows','System32')} : {})
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Electron não encerrou normalmente.');
  assert.ok(fs.existsSync(profileReport), 'Electron não gerou relatório.');
  return JSON.parse(fs.readFileSync(profileReport, 'utf8'));
}
async function verify(report, folder, mode) {
  assert.equal(report.error, undefined);
  assert.equal(report.mode, mode);
  assert.equal(report.dashboardStatus, 200);
  assert.equal(report.windowStatus, 200);
  assert.equal(report.unauthorizedStatus, 403);
  assert.deepEqual(report.security, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  });
  assert.equal(report.backendExitCode, 0);
  assert.equal(report.secondInstanceDetected, true);
  assert.equal(report.secondaryExitCode, 0);
  assert.ok(path.resolve(report.databasePath).startsWith(path.resolve(folder) + path.sep));
  assert.deepEqual(report.rendererErrors, []);
  assert.equal(report.summary.receitas, '1000.10');
  assert.equal(report.summary.saldo, '989.85');
  assert.equal(report.summary.despesas, '10.25');
  assert.equal(report.chartRendered, true);
  assert.deepEqual(report.financialWrites,{income:true,expense:true,edit:true,cancel:true,statement:true,balance:true});
  assert.equal(report.appName,'Financeiro');
  assert.equal(report.iconAvailable,true);
  if(packagedExecutable) assert.equal(report.packaged,true);
  assert.deepEqual(report.dataManagement,{backup:true,cancelled:true,restored:true,reloaded:true});
  assert.deepEqual(report.planning, {created:true,edited:true,deletionCancelled:true,deleted:true,persisted:true,total:'1.23'});
  await assert.rejects(fetch(report.origin, {
    signal: AbortSignal.timeout(2000)
  }));
  await assert.rejects(fetch(report.apiOrigin, {
    signal: AbortSignal.timeout(2000)
  }));
}
(async () => {
  const folders = [];
  try {
    const normalProfile = persistentProfile || profile(true);
    fs.mkdirSync(normalProfile,{recursive:true});
    folders.push(normalProfile);
    if(!fs.existsSync(path.join(normalProfile,'data/dash-gastos.sqlite'))) {
      const empty=run(normalProfile,['--desktop-empty-smoke']);
      assert.equal(empty.error,undefined);assert.equal(empty.emptyInitialization,true);
      assert.ok(fs.existsSync(path.join(normalProfile,'data/dash-gastos.sqlite')));
      assert.equal(empty.backendExitCode,0);
      fs.writeFileSync(path.join(root,'backups/electron-smoke-empty.json'),JSON.stringify(empty,null,2));
      seed(normalProfile);
    }
    const normal = run(normalProfile);
    await verify(normal, normalProfile, 'static');
    fs.writeFileSync(path.join(root, 'backups/electron-smoke-success.json'), JSON.stringify(normal, null, 2));
    for(let repeat=0;repeat<reopenCount;repeat++) {
      const reopened = run(normalProfile);
      await verify(reopened, normalProfile, 'static');
      assert.deepEqual(reopened.summary, normal.summary);
    }
    if(reopenCount>1) fs.writeFileSync(path.join(root,'backups/phase8/repeated-starts.json'),JSON.stringify({reopens:reopenCount,passed:true,packaged:Boolean(packagedExecutable),accentedProfile:normalProfile.includes('ação')},null,2));
    const crashed = run(normalProfile, ['--desktop-test-backend-exit']);
    assert.match(crashed.error, /^BACKEND_EXIT_/);
    fs.writeFileSync(path.join(root, 'backups/electron-smoke-backend-exit.json'), JSON.stringify(crashed, null, 2));
    await assert.rejects(fetch(crashed.apiOrigin, {signal: AbortSignal.timeout(2000)}));
    if (process.env.DESKTOP_SMOKE_APP || packagedExecutable) {
      assert.equal(normal.archived, true);
      console.log(packagedExecutable ? 'Financeiro.exe: backend, SQLite, Chart.js, planejamento, backup/restauração, offline e reabertura validados.' : 'ASAR: backend, SQLite, frontend, reabertura e encerramento validados.');
      return;
    }
    const devProfile = profile();
    folders.push(devProfile);
    seed(devProfile, true);
    const development = run(devProfile, ['--desktop-dev']);
    await verify(development, devProfile, 'development');
    assert.notEqual(development.origin, development.apiOrigin);
    fs.writeFileSync(path.join(root, 'backups/electron-smoke-development.json'), JSON.stringify(development, null, 2));
    const badProfile = profile();
    folders.push(badProfile);
    fs.mkdirSync(path.join(badProfile, 'data'));
    fs.writeFileSync(path.join(badProfile, 'data/dash-gastos.sqlite'), 'invalid sqlite file');
    const failure = run(badProfile);
    assert.equal(failure.error, 'SQLITE_INITIALIZATION_FAILED');
    assert.equal(fs.readFileSync(path.join(badProfile, 'data/dash-gastos.sqlite'), 'utf8'), 'invalid sqlite file');
    fs.writeFileSync(path.join(root, 'backups/electron-smoke-failure.json'), JSON.stringify(failure, null, 2));
    console.log('Electron + SQLite: criação, reabertura, Chart.js, Vite/build, isolamento e falha de banco validados sem PostgreSQL.');
  } finally {
    for (const folder of folders) {
      if(folder===persistentProfile) continue;
      if(path.dirname(path.resolve(folder))!==path.resolve(os.tmpdir()) || !path.basename(folder).startsWith('dash-electron-test-')) throw new Error('Invalid profile cleanup');
      function remove(entry){const stat=fs.lstatSync(entry);if(stat.isDirectory()&&!stat.isSymbolicLink()){for(const child of fs.readdirSync(entry))remove(path.join(entry,child));fs.rmdirSync(entry);}else fs.unlinkSync(entry);}
      remove(folder);
    }
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
