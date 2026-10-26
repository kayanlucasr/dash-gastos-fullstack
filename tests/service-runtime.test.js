const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  createServiceRuntime
} = require('../services/runtime.cjs');
function fixture() {
  const events = [];
  const runtime = createServiceRuntime({
    database: {
      get() {
        events.push('database.open');
      },
      end() {
        events.push('database.close');
      }
    },
    background: {
      start() {
        events.push('jobs.start');
      },
      pause() {
        events.push('jobs.pause');
      },
      async stop() {
        events.push('jobs.stop');
      }
    },
    market: {
      async stop() {
        events.push('market.stop');
      }
    }
  });
  return {
    runtime,
    events
  };
}
test('services initialize once, start once and close in dependency order', async () => {
  const {
    runtime,
    events
  } = fixture();
  runtime.initialize();
  runtime.initialize();
  runtime.start();
  runtime.start();
  assert.equal(runtime.getState(), 'ready');
  const first = runtime.stop(),
    second = runtime.stop();
  assert.equal(first, second);
  await first;
  assert.equal(runtime.getState(), 'stopped');
  assert.deepEqual(events, ['database.open', 'jobs.start', 'jobs.pause', 'market.stop', 'jobs.stop', 'database.close']);
  assert.throws(() => runtime.start(), /reiniciados/);
});
test('API gate rejects requests before readiness and during shutdown', async () => {
  const {
    runtime
  } = fixture();
  let status,
    allowed = 0;
  const res = {
    status(n) {
      status = n;
      return this;
    },
    set() {
      return this;
    },
    json() {
      return this;
    }
  };
  runtime.middleware({}, res, () => allowed++);
  assert.equal(status, 503);
  runtime.initialize();
  runtime.middleware({}, res, () => allowed++);
  assert.equal(allowed, 1);
  runtime.pause();
  runtime.middleware({}, res, () => allowed++);
  assert.equal(status, 503);
  assert.equal(allowed, 1);
  await runtime.stop();
});
test('database initialization failures are surfaced and release resources', () => {
  let closed = false;
  const runtime = createServiceRuntime({
    database: {
      get() {
        throw Object.assign(new Error('invalid database'), {
          code: 'SQLITE_INITIALIZATION_FAILED'
        });
      },
      end() {
        closed = true;
      }
    }
  });
  assert.throws(() => runtime.initialize(), e => e.code === 'SQLITE_INITIALIZATION_FAILED');
  assert.equal(runtime.getState(), 'failed');
  assert.equal(closed, true);
});
test('database closes only after market requests and scheduled jobs finish', async () => {
  const events = [];
  let release;
  const runtime = createServiceRuntime({
    database: {
      get() {},
      end() {
        events.push('close');
      }
    },
    background: {
      start() {},
      pause() {
        events.push('pause');
      },
      async stop() {
        events.push('jobs.done');
      }
    },
    market: {
      stop() {
        return new Promise(resolve => {
          release = resolve;
        });
      }
    }
  });
  runtime.initialize();
  const stop = runtime.stop();
  assert.deepEqual(events, ['pause']);
  release();
  await stop;
  assert.deepEqual(events, ['pause', 'jobs.done', 'close']);
});
test('scheduler cannot resume writes between pause and database shutdown', async () => {
  const {
    runtime,
    events
  } = fixture();
  runtime.start();
  runtime.pause();
  runtime.pause();
  await runtime.stop();
  assert.equal(events.filter(e => e === 'jobs.pause').length, 1);
  assert.equal(events.at(-1), 'database.close');
});

test('maintenance blocks API access, drains jobs, closes and reopens SQLite before resuming',async()=>{
  const {runtime,events}=fixture();runtime.start();
  await runtime.maintenance(async()=>{
    assert.equal(runtime.getState(),'maintenance');
    assert.equal(events.at(-1),'database.close');
    let status;
    runtime.middleware({}, {status(value){status=value;return this;},set(){return this;},json(){}},()=>assert.fail('API must be blocked'));
    assert.equal(status,503);
    await assert.rejects(runtime.maintenance(async()=>{}),{code:'DATA_BUSY'});
    events.push('restore');
  });
  assert.equal(runtime.getState(),'ready');
  assert.deepEqual(events.slice(-3),['restore','database.open','jobs.start']);
  await runtime.stop();
});

test('failed restore reopens the recovered database, but recovery-required failures never create a new database',async()=>{
  const {runtime,events}=fixture();runtime.start();
  await assert.rejects(runtime.maintenance(async()=>{throw new Error('Recovered restore failure');}));
  assert.equal(runtime.getState(),'ready');
  const opens=events.filter(event=>event==='database.open').length;
  await assert.rejects(runtime.maintenance(async()=>{throw Object.assign(new Error('Recovery required'),{code:'RESTORE_RECOVERY_REQUIRED'});}));
  assert.equal(runtime.getState(),'failed');
  assert.equal(events.filter(event=>event==='database.open').length,opens);
  await runtime.stop();
});

test('shutdown waits for an ongoing restoration and does not restart jobs or reopen SQLite',async()=>{
  const {runtime,events}=fixture();runtime.start();let release;
  const maintenance=runtime.maintenance(()=>new Promise(resolve=>{release=resolve;}));
  while(!release) await new Promise(resolve=>setImmediate(resolve));
  const opens=events.filter(event=>event==='database.open').length;
  const stop=runtime.stop();release();await maintenance;await stop;
  assert.equal(runtime.getState(),'stopped');
  assert.equal(events.filter(event=>event==='database.open').length,opens);
  assert.equal(events.filter(event=>event==='jobs.start').length,1);
});
