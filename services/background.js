const finance = require('./finance');
const market = require('./market');
let active = null;
let timer = null;
let paused = false;
function tick() {
  if (paused) return Promise.resolve();
  if (active) return active;
  active = (async () => {
    try {
      await finance.atomic(c => finance.refreshClosed(c));
      if (!paused) await market.syncAll();
    } catch (error) {
      require('./diagnostics.cjs').log('BACKGROUND_ERROR',error);
      console.error('Falha na manutenção periódica:', error.code || 'INTERNAL_ERROR');
    }
  })().finally(() => {
    active = null;
  });
  return active;
}
function start() {
  if (timer) return timer;
  paused = false;
  tick();
  timer = setInterval(tick, 60 * 60 * 1000);
  timer.unref();
  return timer;
}
function pause() {
  paused = true;
  clearInterval(timer);
  timer = null;
}
async function stop() {
  pause();
  if (active) await active;
}
module.exports = {
  start,
  pause,
  stop,
  tick
};
