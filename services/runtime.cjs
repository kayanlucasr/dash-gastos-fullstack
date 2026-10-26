const database = require('../db');
const background = require('./background');
const market = require('./market');
function createServiceRuntime(dependencies = {}) {
  const db = dependencies.database || database;
  const jobs = dependencies.background || background;
  const quotes = dependencies.market || market;
  let state = 'new';
  let started = false;
  let stopping;
  let maintaining;
  function initialize() {
    if (state === 'ready') return;
    if (state !== 'new') throw new Error('Os serviços não podem ser reiniciados após o encerramento.');
    try {
      db.get();
      state = 'ready';
    } catch (error) {
      state = 'failed';
      db.end();
      throw error;
    }
  }
  function start() {
    initialize();
    if (!started) {
      jobs.start();
      started = true;
    }
  }
  function pause() {
    if (state === 'stopping' || state === 'stopped') return;
    state = 'stopping';
    jobs.pause();
  }
  function stop() {
    if (stopping) return stopping;
    pause();
    stopping = (async () => {
      if (maintaining) await maintaining.catch(() => {});
      // Cancel requests before waiting on the scheduler that may be awaiting them.
      await quotes.stop();
      await jobs.stop();
      db.end();
      state = 'stopped';
    })();
    return stopping;
  }
  function middleware(req, res, next) {
    if (state !== 'ready') return res.status(503).set('Retry-After', '1').json({
      message: 'Serviços locais indisponíveis ou em encerramento.'
    });
    next();
  }
  function maintenance(operation) {
    if(state!=='ready' || maintaining || stopping) return Promise.reject(Object.assign(new Error('Operação de dados indisponível.'),{code:'DATA_BUSY'}));
    state='maintenance';jobs.pause();
    maintaining=(async()=>{
      let recoveryRequired=false;
      try {
        await jobs.stop();
        if(quotes.drain) await quotes.drain();
        db.end();
        return await operation();
      } catch(error) {
        recoveryRequired=error.code==='RESTORE_RECOVERY_REQUIRED';
        if(recoveryRequired) state='failed';
        throw error;
      } finally {
        if(!recoveryRequired && !stopping && state!=='stopping') {
          try {db.get();state='ready';if(started) jobs.start();}
          catch(error) {state='failed';throw error;}
        }
      }
    })().finally(()=>{maintaining=undefined;});
    return maintaining;
  }
  return {
    initialize,
    start,
    pause,
    stop,
    middleware,
    maintenance,
    getState: () => state
  };
}
module.exports = {
  createServiceRuntime
};
