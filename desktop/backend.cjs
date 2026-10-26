const http = require('node:http');
const path = require('node:path');
let server;
let developmentServer;
let stopping = false;
let started = false;
let closing;
let databasePath;
let dataOperation;
let staged;
const management=require('../database/sqlite/data-management.cjs');
const diagnostics=require('../services/diagnostics.cjs');
const runtime = require('../services/runtime.cjs').createServiceRuntime();
function stop() {
  if (closing) return closing;
  stopping = true;
  runtime.pause();
  closing = (async () => {
    if(dataOperation) await dataOperation.catch(()=>{});
    staged?.cleanup();staged=undefined;
    if (developmentServer) await developmentServer.close();
    if (server) await new Promise(resolve => {
      server.close(resolve);
      server.closeIdleConnections();
    });
    await runtime.stop();
    process.parentPort.postMessage({
      type: 'stopped'
    });
    process.exit(0);
  })();
  return closing;
}
process.parentPort.on('message', async ({
  data
}) => {
  if(data?.type==='data-command' && started && !stopping) {
    const reply=value=>process.parentPort.postMessage({type:'data-result',id:data.id,...value});
    if(dataOperation || !Number.isSafeInteger(data.id)) {reply({error:'DATA_BUSY'});return;}
    dataOperation=(async()=>{
      switch(data.command) {
        case 'backup': return management.createBackup(require('../db').get(),data.path);
        case 'prepare':
          staged?.cleanup();staged=await management.prepareRestore(data.path,databasePath);return {ready:true};
        case 'cancel': staged?.cleanup();staged=undefined;return {cancelled:true};
        case 'restore': {
          if(!staged) throw Object.assign(new Error('Backup não validado.'),{code:'BACKUP_INVALID'});
          try {return await runtime.maintenance(()=>management.replaceDatabase(databasePath,staged.file));}
          finally {staged.cleanup();staged=undefined;}
        }
        default: throw Object.assign(new Error('Operação inválida.'),{code:'DATA_INVALID'});
      }
    })();
    try {
      const result=await dataOperation;
      diagnostics.log(data.command==='backup' ? 'BACKUP_COMPLETE' : data.command==='restore' ? 'RESTORE_COMPLETE' : 'DATA_PREPARATION_COMPLETE');
      reply({result});
    }
    catch(error) {diagnostics.log('DATA_ERROR',error);reply({error:error.code || 'DATA_FAILED'});}
    finally {dataOperation=undefined;}
    return;
  }
  if (data?.type === 'stop') {
    await stop();
    return;
  }
  if (data?.type !== 'start' || started || stopping) return;
  started = true;
  try {
    if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token) || typeof data.development !== 'boolean') throw Object.assign(new Error('Inicialização inválida'), {code: 'INVALID_START_MESSAGE'});
    if (typeof data.databasePath !== 'string' || !path.isAbsolute(data.databasePath)) throw Object.assign(new Error('Caminho SQLite inválido'), {
      code: 'SQLITE_PATH_INVALID'
    });
    process.env.SQLITE_PATH = data.databasePath;
    databasePath=data.databasePath;
    // Only the main process's isolated smoke harness requests offline simulation.
    if(data.offlineTest===true) globalThis.fetch=async()=>{throw Object.assign(new Error('Offline test'),{code:'ENETUNREACH'});};
    diagnostics.configure(path.join(path.dirname(path.dirname(databasePath)),'logs'));
    try {management.recoverRestore(databasePath);}
    catch(error) {
      diagnostics.log('RESTORE_RECOVERY_FAILED',error);
      throw Object.assign(new Error('Recuperação pendente.'),{code:'RESTORE_RECOVERY_REQUIRED'});
    }
    runtime.initialize();
    diagnostics.log('BACKEND_READY');
    if (stopping) return;
    server = http.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const apiOrigin = 'http://127.0.0.1:' + server.address().port;
    let origin = apiOrigin;
    if (data.development === true) {
      const {
        pathToFileURL
      } = require('node:url');
      const vite = await import(pathToFileURL(path.resolve(__dirname, '../frontend/node_modules/vite/dist/node/index.js')).href);
      developmentServer = await vite.createServer({
        root: path.resolve(__dirname, '../frontend'),
        configFile: path.resolve(__dirname, '../frontend/vite.config.js'),
        server: {
          host: '127.0.0.1',
          port: 0,
          strictPort: false,
          proxy: {
            '/api': {
              target: apiOrigin
            }
          },
          headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
          }
        }
      });
      await developmentServer.listen();
      origin = 'http://127.0.0.1:' + developmentServer.httpServer.address().port;
    }
    const {
      createApp
    } = require('../server');
    server.on('request', createApp({
      allowedOrigins: [origin, apiOrigin],
      frontendDir: path.resolve(__dirname, '../frontend/dist'),
      desktopToken: data.token,
      runtime
    }));
    runtime.start();
    process.parentPort.postMessage({
      type: 'ready',
      origin,
      apiOrigin,
      databasePath: data.databasePath,
      pid: process.pid
    });
  } catch (error) {
    diagnostics.log('BACKEND_START_FAILED',error);
    process.parentPort.postMessage({
      type: 'failed',
      code: error.code || 'BACKEND_START_FAILED'
    });
    await stop();
  }
});
