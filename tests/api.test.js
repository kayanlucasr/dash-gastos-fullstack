const {
  test,
  before,
  after
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-sqlite-api-'));
process.env.SQLITE_PATH = path.join(temp, 'financial-test.sqlite');
let db, server, base, finance, available, reserve, investment;
async function request(route, method = 'GET', body) {
  const r = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: r.status,
    data: await r.json()
  };
}
const income = (valor = '1000.00', data) => ({
  descricao: 'Receita de teste',
  tipo: 'income',
  valor,
  category_id: 7,
  ...(data ? {
    data
  } : {})
});
before(async () => {
  db = require('../db');
  db.get();
  finance = require('../services/finance');
  available = finance.accounts()[0].id;
  reserve = (await finance.createAccount({
    nome: 'Reserva de teste',
    tipo: 'reserve'
  })).id;
  investment = (await finance.createAccount({
    nome: 'Investimento de teste',
    tipo: 'investment'
  })).id;
  server = require('../server').listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(r => server.close(r));
  if (db) db.end();
  fs.rmSync(temp, {
    recursive: true,
    force: true
  });
});
async function query(sql, params = []) {
  const statement = db.get().prepare(sql);
  if (/^SELECT/i.test(sql)) return {
    rows: statement.all(...params)
  };
  statement.run(...params);
  return {
    rows: []
  };
}
test('SQLite schema enforces relationships and has no identity tables', () => {
  const tables = db.all("SELECT name FROM sqlite_master WHERE type='table'");
  assert.deepEqual(tables.filter(t => /^(users|sessions|tokens|refresh_tokens|password_resets)$/i.test(t.name)), []);
  for (const {name} of tables) {
    assert.deepEqual(db.all('SELECT name FROM pragma_table_info(?)', [name]).filter(c => /^(user_id|password|password_hash|session_token|refresh_token)$/i.test(c.name)), [], name);
  }
  assert.throws(() => db.run("INSERT INTO transactions(descricao,valor_centavos,tipo,data,source_account_id,destination_account_id) VALUES('Teste',100,'transfer','2026-01-01',?,999999)", [available]), e => e.errcode === 787);
  assert.throws(() => db.run("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Teste',-1,'income','2026-01-01',7,?)", [available]), e => e.errcode === 275);
});
test('HTTP works without tokens and no authentication endpoints remain', async () => {
  for (const valor of ['1.001', '-1', '0', '1e3']) assert.equal((await request('/transactions', 'POST', income(valor))).status, 400);
  for (const endpoint of ['/transactions', '/dashboard', '/dashboard/categories', '/finance/accounts', '/finance/wealth']) assert.equal((await request(endpoint)).status, 200);
  for (const endpoint of ['/auth/login', '/auth/register', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']) assert.equal((await fetch(base + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{}'
  })).status, 404);
  assert.equal((await fetch(base + '/profile')).status, 404);
  const created = await request('/transactions', 'POST', income('0.10'));
  assert.equal(created.status, 201);
  assert.equal((await request('/transactions/' + created.data.id, 'PUT', income('0.20'))).status, 200);
  assert.equal((await request('/transactions/' + created.data.id, 'DELETE')).status, 200);
});
test('API rejects external origins, DNS rebinding hosts and non-JSON writes', async () => {
  assert.equal((await fetch(base + '/transactions', {
    headers: {
      Origin: 'https://external.example'
    }
  })).status, 403);
  const hostStatus = await new Promise((resolve, reject) => require('node:http').get(base + '/transactions', {
    headers: {
      Host: 'external.example'
    }
  }, response => {
    response.resume();
    resolve(response.statusCode);
  }).on('error', reject));
  assert.equal(hostStatus, 403);
  assert.equal((await fetch(base + '/transactions', {
    headers: {
      'Sec-Fetch-Site': 'cross-site'
    }
  })).status, 403);
  assert.equal((await fetch(base + '/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: '{}'
  })).status, 415);
  const allowed = await fetch(base + '/transactions', {
    headers: {
      Origin: 'http://localhost:5173'
    }
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const {
    createLocalAccess
  } = require('../middlewares/local-access.middleware');
  let status;
  createLocalAccess(['http://localhost:5173'])({
    socket: {
      remoteAddress: '192.168.1.2'
    },
    headers: {}
  }, {
    status(n) {
      status = n;
      return this;
    },
    json() {}
  }, () => assert.fail('Remote access allowed'));
  assert.equal(status, 403);
});
test('decimal arithmetic, transfers, redemptions and insufficient balance', async () => {
  await finance.save(income('1000.10'));
  await finance.save({
    descricao: 'Aporte reserva',
    valor: '200.00',
    tipo: 'transfer',
    source_account_id: available,
    destination_account_id: reserve
  });
  await finance.save({
    descricao: 'Aporte investimento',
    valor: '300.00',
    tipo: 'transfer',
    source_account_id: available,
    destination_account_id: investment
  });
  await finance.save({
    descricao: 'Resgate',
    valor: '50.00',
    tipo: 'transfer',
    source_account_id: reserve,
    destination_account_id: available
  });
  const a = await finance.accounts();
  assert.equal(a.find(x => x.id === available).saldo, '550.10');
  assert.equal(a.find(x => x.id === reserve).saldo, '150.00');
  assert.equal(a.find(x => x.id === investment).saldo, '300.00');
  await assert.rejects(finance.save({
    descricao: 'Sem saldo',
    valor: '9000',
    tipo: 'transfer',
    source_account_id: reserve,
    destination_account_id: available
  }), e => e.status === 409);
  const d = await finance.dashboard();
  assert.equal(d.receitas, '1000.10');
  assert.equal(d.despesas, '0.00');
  assert.equal(d.investimentos, '300.00');
});
test('monthly catch-up is idempotent and retroactive updates revise summaries', async () => {
  const record = await finance.save(income('10.25', '2024-12-31'));
  const d = await finance.dashboard('2024-12');
  assert.equal(d.receitas, '10.25');
  const first = (await query("SELECT revision FROM monthly_closings WHERE month='2024-12-01'", [])).rows[0].revision;
  await Promise.all([finance.dashboard(), finance.dashboard()]);
  assert.equal((await query("SELECT revision FROM monthly_closings WHERE month='2024-12-01'", [])).rows[0].revision, first);
  await finance.save(income('20.25', '2024-12-31'), record.id);
  assert.equal((await finance.dashboard('2024-12')).receitas, '20.25');
  assert.equal((await finance.dashboard('2025-01')).saldo_inicial, '20.25');
  await finance.cancel(record.id);
  assert.equal((await finance.dashboard('2024-12')).receitas, '0.00');
  assert.deepEqual(finance.monthBounds('2024-02'), ['2024-02-01', '2024-03-01']);
  assert.throws(() => finance.monthBounds('2024-13'));
});
test('soft cancellation retains records and monthly categories exclude transfers', async () => {
  const r = await finance.save({
    descricao: 'Despesa',
    valor: '12.34',
    tipo: 'expense',
    category_id: 7
  });
  const d = await finance.dashboard();
  assert.equal(d.categories[0].total, '12.34');
  assert.equal((await finance.statement({
    tipo: 'income'
  })).every(x => x.tipo === 'income'), true);
  await finance.cancel(r.id);
  assert.ok((await query('SELECT cancelled_at FROM transactions WHERE id=?', [r.id])).rows[0].cancelled_at);
  assert.deepEqual((await finance.dashboard()).categories, []);
});
test('investment valuation is separate from monthly contributions', async () => {
  await finance.valuation({
    account_id: investment,
    data: finance.today(),
    valor: '350.00'
  });
  const a = await finance.accounts();
  assert.equal(a.find(x => x.id === investment).patrimonio, '350.00');
  assert.equal((await finance.dashboard()).investimentos, '300.00');
  assert.ok((await finance.wealth()).evolution.length);
});
test('concurrent redemptions cannot spend the same money twice', async () => {
  const a = await finance.createAccount({
    nome: 'Concorrência',
    tipo: 'reserve'
  });
  await finance.save({
    descricao: 'Financiar reserva',
    tipo: 'transfer',
    valor: '10.00',
    source_account_id: available,
    destination_account_id: a.id
  });
  const payload = {
    descricao: 'Resgate concorrente',
    tipo: 'transfer',
    valor: '8.00',
    source_account_id: a.id,
    destination_account_id: available
  };
  const results = await Promise.allSettled([finance.save(payload), finance.save(payload)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await finance.accounts()).find(x => x.id === a.id).saldo, '2.00');
});
test('valuations allow realized gains, retain contribution totals and recompute retroactive changes', async () => {
  const yesterday = new Date(Date.parse(finance.today() + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  const a = await finance.createAccount({
    nome: 'Ganho e resgate',
    tipo: 'investment'
  });
  const funding = await finance.save(income('100.00', yesterday));
  const contribution = await finance.save({
    descricao: 'Aporte',
    tipo: 'transfer',
    valor: '100.00',
    data: yesterday,
    source_account_id: available,
    destination_account_id: a.id
  });
  await finance.valuation({
    account_id: a.id,
    data: yesterday,
    valor: '120.00'
  });
  await finance.save({
    descricao: 'Resgate com ganho',
    tipo: 'transfer',
    valor: '120.00',
    source_account_id: a.id,
    destination_account_id: available
  });
  assert.equal((await finance.accounts()).find(x => x.id === a.id).saldo, '0.00');
  await finance.save({
    descricao: 'Aporte corrigido',
    tipo: 'transfer',
    valor: '90.00',
    data: yesterday,
    source_account_id: available,
    destination_account_id: a.id
  }, contribution.id);
  assert.equal((await finance.accounts()).find(x => x.id === a.id).saldo, '0.00');
  assert.ok(funding.id);
});
test('market caches valid quotes, handles API failures and never fabricates values', async () => {
  const market = require('../services/market');
  const indicator = (await query("SELECT * FROM market_indicators WHERE code='USD'")).rows[0];
  let calls = 0;
  const timestamp = Math.floor(Date.now() / 1000);
  const good = async url => {
    calls++;
    return {
      ok: true,
      json: async () => url.includes('/daily/') ? [{
        bid: '5.10',
        timestamp,
        pctChange: '0.2'
      }] : {
        USDBRL: {
          bid: '5.10',
          timestamp,
          pctChange: '0.2'
        }
      }
    };
  };
  await market.syncOne(indicator, good);
  assert.equal(calls, 2);
  await market.syncOne(indicator, good);
  assert.equal(calls, 2);
  assert.equal((await market.read('USD', '7')).indicators.find(i => i.code === 'USD').price, '5.10');
  await query("UPDATE market_sync_state SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE indicator_code='USD'");
  await market.syncOne(indicator, async () => ({
    ok: false,
    status: 429
  }));
  const failed = (await market.read('USD', '7')).indicators.find(i => i.code === 'USD');
  assert.equal(failed.price, '5.10');
  assert.match(failed.error, /Limite/);
  await query("UPDATE market_sync_state SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE indicator_code='USD'");
  await market.syncOne(indicator, async () => ({
    ok: true,
    json: async () => ({
      USDBRL: {
        bid: 'NaN',
        timestamp
      }
    })
  }));
  assert.equal((await market.read('USD', '7')).indicators.find(i => i.code === 'USD').price, '5.10');
  const saved = process.env.GOLDAPI_KEY;
  delete process.env.GOLDAPI_KEY;
  try {
    await assert.rejects(market.provider({
      code: 'GOLD'
    }), e => e.status === 503);
  } finally {
    if (saved) process.env.GOLDAPI_KEY = saved;
  }
  assert.throws(() => market.point(0, Date.now()));
  assert.throws(() => market.point(1, 'invalid'));
});
test('opening balances are not income, and reserve-to-investment is a contribution', async () => {
  const before = await finance.dashboard();
  const account = (await finance.accounts())[0].id;
  const reserveAccount = (await finance.createAccount({
    nome: 'Reserva',
    tipo: 'reserve'
  })).id;
  const investAccount = (await finance.createAccount({
    nome: 'Investimento',
    tipo: 'investment'
  })).id;
  await finance.save({
    descricao: 'Saldo inicial',
    tipo: 'adjustment',
    valor: '100.00',
    destination_account_id: account
  });
  await finance.save({
    descricao: 'Reserva',
    tipo: 'transfer',
    valor: '50.00',
    source_account_id: account,
    destination_account_id: reserveAccount
  });
  await finance.save({
    descricao: 'Investir reserva',
    tipo: 'transfer',
    valor: '30.00',
    source_account_id: reserveAccount,
    destination_account_id: investAccount
  });
  const result = await finance.dashboard();
  assert.equal(result.receitas, before.receitas);
  assert.equal(Number(result.investimentos) - Number(before.investimentos), 30);
  await assert.rejects(finance.save(income('1', '2024-02-30')), e => e.status === 400);
  await assert.rejects(finance.createAccount(null), e => e.status === 400);
  await assert.rejects(finance.valuation({
    account_id: investAccount,
    data: finance.today(),
    valor: [10]
  }), e => e.status === 400);
});
test('desktop Express factory separates SPA routes and protects the API', async () => {
  const fixture = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'dash-desktop-http-'));
  fs.writeFileSync(require('node:path').join(fixture, 'index.html'), '<!doctype html><title>Desktop fixture</title>');
  const local = require('node:http').createServer();
  await new Promise(resolve => local.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + local.address().port;
  const capability = 'test-only-desktop-capability';
  local.on('request', require('../server').createApp({
    allowedOrigins: [origin],
    frontendDir: fixture,
    desktopToken: capability
  }));
  try {
    assert.equal((await fetch(origin + '/api/dashboard')).status, 403);
    const headers = {
      'X-Desktop-Capability': capability
    };
    assert.equal((await fetch(origin + '/api/dashboard', {
      headers
    })).status, 200);
    const page = await fetch(origin + '/dashboard', {
      headers
    });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal((await fetch(origin + '/api/dashboard', {
      headers: {
        ...headers,
        Origin: 'https://external.example'
      }
    })).status, 403);
  } finally {
    await new Promise(resolve => {
      local.close(resolve);
      local.closeIdleConnections();
    });
    fs.rmSync(fixture, {
      recursive: true,
      force: true
    });
  }
});
test('offline market failures leave cached data and financial operations available', async () => {
  const market = require('../services/market');
  const indicator = db.one("SELECT * FROM market_indicators WHERE code='USD'");
  db.run("UPDATE market_sync_state SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE indicator_code='USD'");
  await market.syncOne(indicator, async () => {
    throw new Error('offline');
  });
  assert.equal((await market.read('USD', '7')).indicators.find(i => i.code === 'USD').price, '5.10');
  const before = await finance.dashboard();
  const row = await finance.save(income('0.01'));
  const after = await finance.dashboard();
  assert.equal(require('../services/money.cjs').cents(after.receitas, {
    aggregate: true
  }) - require('../services/money.cjs').cents(before.receitas, {
    aggregate: true
  }), 1n);
  await finance.cancel(row.id);
});
test('market shutdown drains pending requests before SQLite is closed', async () => {
  const market = require('../services/market');
  const indicator = db.one("SELECT * FROM market_indicators WHERE code='USD'");
  db.run("UPDATE market_sync_state SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE indicator_code='USD'");
  const task = market.syncOne(indicator, (_url, {
    signal
  }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new Error('aborted'));else signal.addEventListener('abort', () => reject(new Error('aborted')), {
      once: true
    });
  }));
  await market.stop();
  await task;
  assert.equal(db.one("SELECT lease_until FROM market_sync_state WHERE indicator_code='USD'").lease_until, null);
  assert.equal((await finance.dashboard()).month, finance.today().slice(0, 7));
});
test('standalone Express uses the shared lifecycle and preserves SQLite on close', async () => {
  const {
    createServiceRuntime
  } = require('../services/runtime.cjs');
  const runtime = createServiceRuntime({
    database: db,
    background: {
      start() {},
      pause() {},
      async stop() {}
    },
    market: {
      async stop() {}
    }
  });
  const instance = await require('../server').startLocalServer({
    port: 0,
    runtime
  });
  const origin = 'http://127.0.0.1:' + instance.server.address().port;
  try {
    const response = await fetch(origin + '/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(income('0.03'))
    });
    assert.equal(response.status, 201);
    const record = await response.json();
    assert.equal(record.valor, '0.03');
    assert.equal((await fetch(origin + '/dashboard')).status, 200);
    runtime.pause();
    const unavailable = await fetch(origin + '/dashboard');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('retry-after'), '1');
  } finally {
    await instance.close();
    await instance.close();
  }
  assert.equal(runtime.getState(), 'stopped');
  await assert.rejects(fetch(origin, {
    signal: AbortSignal.timeout(1000)
  }));
  assert.ok(db.one("SELECT id FROM transactions WHERE valor_centavos=3"));
});
