const {
  app,
  BrowserWindow,
  dialog,
  utilityProcess,
  shell,
  ipcMain
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {
  randomBytes
} = require('node:crypto');
let backend;
let window;
let shuttingDown = false;
let backendExited = false;
let readyToQuit = false;
const config = require('./config.cjs').desktopConfig({
  packaged: app.isPackaged
});
const smoke = process.argv.includes('--desktop-smoke-test');
app.setName('Financeiro');
app.setAppUserModelId('br.com.kayanlucas.financeiro');
const testProfile = process.argv.find(arg => arg.startsWith('--desktop-test-profile='));
const desktopData = testProfile && (smoke || config.development || process.argv.includes('--desktop-secondary-probe')) ? testProfile.slice('--desktop-test-profile='.length) : path.join(app.getPath('appData'), 'DashGastosDesktop');
fs.mkdirSync(desktopData, {
  recursive: true
});
app.setPath('userData', desktopData);
const diagnostics=require('../services/diagnostics.cjs');
diagnostics.configure(path.join(desktopData,'logs'));
diagnostics.log('DESKTOP_START');
const {createDataController,authorized}=require('./data-controller.cjs');
const dataDialogs=smoke ? require('./data-smoke.cjs').createDialogs(desktopData) : dialog;
let dataController;
let dataSequence=0;
const dataRequests=new Map();
function dataRequest(command,file) {
  return new Promise((resolve,reject)=>{
    if(!backend || backendExited) {reject(Object.assign(new Error('Backend indisponível.'),{code:'BACKEND_UNAVAILABLE'}));return;}
    const id=++dataSequence;
    dataRequests.set(id,{resolve,reject});
    try {backend.postMessage({type:'data-command',id,command,path:file});}
    catch(error) {dataRequests.delete(id);reject(error);}
  });
}
const token = randomBytes(32).toString('hex');
const report = {
  integration: 'local-express',
  mode: config.development ? 'development' : 'static',
  startedAt: new Date().toISOString()
};
function saveReport() {
  if (!smoke) return;
  fs.mkdirSync(path.join(desktopData, 'reports'), {
    recursive: true
  });
  fs.writeFileSync(path.join(desktopData, 'reports/electron-smoke.json'), JSON.stringify(report, null, 2));
}
async function stopBackend() {
  if (!backend || backendExited) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      backend.kill();
      resolve();
    }, 30000);
    backend.once('exit', code => {
      clearTimeout(timeout);
      report.backendExitCode = code;
      resolve();
    });
    backend.postMessage({
      type: 'stop'
    });
  });
}
function fail(code) {
  if (shuttingDown) return;
  report.error = code;
  diagnostics.log('DESKTOP_ERROR',{code});
  const reason=code==='SQLITE_INITIALIZATION_FAILED' ? 'Não foi possível ler o banco de dados. O arquivo foi preservado. Verifique as permissões e os backups.' : code==='FRONTEND_BUILD_MISSING' ? 'Os arquivos da interface não estão disponíveis. Execute o build ou verifique a instalação.' : code==='RESTORE_RECOVERY_REQUIRED' ? 'A recuperação do banco precisa de atenção. Preserve a pasta de dados e os backups.' : 'Um serviço local não pôde iniciar ou foi interrompido. Feche e abra o aplicativo novamente.';
  if (!smoke) dialog.showErrorBox('Não foi possível abrir o dashboard', reason+' Consulte os logs na pasta de dados do aplicativo. Código: '+code);
  app.quit();
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (smoke) report.secondInstanceDetected = true;
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.on('before-quit', event => {
    if (readyToQuit) return;
    event.preventDefault();
    if (shuttingDown) return;
    shuttingDown = true;
    Promise.resolve(dataController?.wait()).catch(error=>diagnostics.log('DATA_SHUTDOWN_ERROR',error)).then(stopBackend).finally(() => {
      readyToQuit = true;
      saveReport();
      app.quit();
    });
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => {
    if (!config.development && !fs.existsSync(path.join(config.dist, 'index.html'))) {
      fail('FRONTEND_BUILD_MISSING');
      return;
    }
    backend = utilityProcess.fork(path.join(__dirname, 'backend.cjs'), [], {
      cwd: config.workingDirectory,
      serviceName: 'Financeiro Backend',
      stdio: 'pipe'
    });
    // Do not forward arbitrary worker output: it may include environment diagnostics.
    backend.stdout?.resume();
    backend.stderr?.resume();
    const startup = setTimeout(() => fail('BACKEND_START_TIMEOUT'), 20000);
    backend.once('exit', code => {
      backendExited = true;
      for(const {reject} of dataRequests.values()) reject(Object.assign(new Error('Backend encerrado.'),{code:'BACKEND_UNAVAILABLE'}));
      dataRequests.clear();
      clearTimeout(startup);
      if (!shuttingDown) fail('BACKEND_EXIT_' + code);
    });
    backend.on('message', async message => {
      if(message?.type==='data-result') {
        const waiting=dataRequests.get(message.id);
        dataRequests.delete(message.id);
        if(waiting) {
          if(message.error) waiting.reject(Object.assign(new Error('Falha na operação de dados.'),{code:message.error}));
          else waiting.resolve(message.result);
        }
        return;
      }
      if (message?.type === 'failed') {
        clearTimeout(startup);
        fail(message.code);
        return;
      }
      if (message?.type !== 'ready' || shuttingDown || window) return;
      clearTimeout(startup);
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(message.origin)) {
        fail('INVALID_BACKEND_ORIGIN');
        return;
      }
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(message.apiOrigin)) {
        fail('INVALID_API_ORIGIN');
        return;
      }
      report.mode = config.development ? 'development' : 'static';
      report.apiOrigin = message.apiOrigin;
      report.origin = message.origin;
      report.backendPid = message.pid;
      report.databasePath = message.databasePath;
      window = new BrowserWindow({
        ...config.window,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true
        }
      });
      dataController=createDataController({dialog:dataDialogs,getWindow:()=>window,request:dataRequest,metadata:path.join(path.dirname(message.databasePath),'last-backup.json'),unavailable:()=>shuttingDown || backendExited});
      for(const command of ['status','backup','restore']) ipcMain.handle('data:'+command,(event,...args)=>{
        if(args.length || !authorized(event,window?.webContents,message.origin)) return {ok:false,message:'Operação não autorizada.'};
        return dataController.perform(command);
      });
      window.webContents.on('page-title-updated', event => event.preventDefault());
      const contentsId = window.webContents.id;
      window.webContents.session.webRequest.onBeforeSendHeaders({
        urls: [message.origin + '/*', message.apiOrigin + '/*']
      }, (details, callback) => {
        if (details.webContentsId === contentsId && [message.origin, message.apiOrigin].includes(new URL(details.url).origin)) details.requestHeaders['X-Desktop-Capability'] = token;
        callback({
          requestHeaders: details.requestHeaders
        });
      });
      window.webContents.setWindowOpenHandler(({
        url
      }) => {
        try {
          const external = new URL(url);
          if (external.origin === 'https://www.coingecko.com' && !external.username && !external.password) shell.openExternal(external.href).catch(() => {});
        } catch (_error) {/* Deny malformed URLs. */}
        return {
          action: 'deny'
        };
      });
      const guardNavigation = (event, url) => {
        try {
          const target = new URL(url);
          if (target.origin !== message.origin || target.username || target.password) event.preventDefault();
        } catch { event.preventDefault(); }
      };
      window.webContents.on('will-navigate', guardNavigation);
      window.webContents.on('will-redirect', guardNavigation);
      window.webContents.on('will-attach-webview', event => event.preventDefault());
      window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
      report.rendererErrors = [];
      window.webContents.on('console-message', details => {
        if (smoke && details?.level === 'error') report.rendererErrors.push({
          level: 'error',
          message: String(details.message).slice(0, 300)
        });
      });
      window.webContents.on('render-process-gone', () => {
        if (!shuttingDown) fail('RENDERER_EXIT');
      });
      window.once('ready-to-show', () => {
        if (!smoke) window.show();
      });
      try {
        await window.loadURL(message.origin);
        if (smoke) {
          const prefs = window.webContents.getLastWebPreferences();
          report.archived = app.getAppPath().endsWith('.asar');
          report.packaged=app.isPackaged;
          report.appName=app.getName();
          report.appVersion=app.getVersion();
          report.iconAvailable=Boolean(config.window.icon && fs.existsSync(config.window.icon));
          report.versions={electron:process.versions.electron,node:process.versions.node,sqlite:process.versions.sqlite};
          report.loadedURL = window.webContents.getURL();
          report.security = {
            contextIsolation: prefs.contextIsolation,
            nodeIntegration: prefs.nodeIntegration,
            sandbox: prefs.sandbox
          };
          report.unauthorizedStatus = (await fetch(message.apiOrigin + '/api/dashboard')).status;
          const summaryResponse = await fetch(message.apiOrigin + '/api/dashboard', {
            headers: {
              'X-Desktop-Capability': token
            }
          });
          report.dashboardStatus = summaryResponse.status;
          const summary = await summaryResponse.json();
          report.summary = {
            receitas: summary.receitas,
            despesas: summary.despesas,
            saldo: summary.saldo
          };
          if(process.argv.includes('--desktop-empty-smoke')) {
            const planning=await fetch(message.apiOrigin+'/api/planning',{headers:{'X-Desktop-Capability':token}}).then(response=>response.json());
            report.emptyInitialization=summary.receitas==='0.00' && summary.despesas==='0.00' && summary.saldo==='0.00' && planning.count===0;
            app.quit();return;
          }
          report.financialWrites=await require('./finance-smoke.cjs')(window.webContents);
          report.chartRendered = summary.categories?.length ? await window.webContents.executeJavaScript(`new Promise(resolve => {
            const deadline=Date.now()+5000;
            const check=()=>{
              const canvas=document.querySelector('canvas[aria-label="Despesas por categoria"]');
              if(canvas&&canvas.width&&canvas.height){const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;if(pixels.some((v,i)=>i%4===3&&v>0)){resolve(true);return;}}
              if(Date.now()>deadline){resolve(false);return;}setTimeout(check,50);
            };check();
          })`) : null;
          report.planning = await require('./planning-smoke.cjs')(window.webContents);
          report.dataManagement=await require('./data-smoke.cjs').run(window.webContents,dataDialogs);
          report.windowStatus = (await fetch(message.origin, {
            headers: {
              'X-Desktop-Capability': token
            }
          })).status;
          report.secondaryExitCode = await new Promise(resolve => {
            const child = require('node:child_process').spawn(process.execPath, [...(app.isPackaged ? [] : [app.getAppPath()]), '--desktop-secondary-probe', ...(testProfile ? [testProfile] : [])], {
              windowsHide: true,
              stdio: 'ignore'
            });
            const timeout = setTimeout(() => {
              child.kill();
              resolve(-1);
            }, 10000);
            child.once('error', () => {
              clearTimeout(timeout);
              resolve(-1);
            });
            child.once('exit', code => {
              clearTimeout(timeout);
              setImmediate(() => resolve(code));
            });
          });
          if (process.argv.includes('--desktop-test-backend-exit')) {
            backend.kill();
          } else app.quit();
        }
      } catch (_error) {
        fail('WINDOW_LOAD_FAILED');
      }
    });
    backend.postMessage({
      type: 'start',
      token,
      databasePath: path.join(app.getPath('userData'), config.development ? 'development' : 'data', 'dash-gastos.sqlite'),
      development: config.development,
      offlineTest:smoke
    });
  }).catch(() => fail('DESKTOP_START_FAILED'));
}
