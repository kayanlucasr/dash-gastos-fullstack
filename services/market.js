const repo = require('../repositories/market.repository');
const {
  error
} = require('./finance');
const shutdownController = new AbortController();
async function json(url, headers = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    headers,
    signal: AbortSignal.any([AbortSignal.timeout(10000), shutdownController.signal])
  });
  if (!response.ok) throw error(response.status === 429 ? 'Limite de requisições do provedor.' : 'Provedor indisponível (HTTP ' + response.status + ').', 502);
  return response.json();
}
function point(price, timestamp, change = null) {
  const value = Number(price),
    date = new Date(timestamp);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 300000) throw error('Resposta inválida do provedor.', 502);
  const variation = change === null || change === undefined ? null : Number(change);
  if (variation !== null && !Number.isFinite(variation)) throw error('Variação inválida.', 502);
  return {
    price: String(price),
    at: date.toISOString(),
    change: variation
  };
}
async function provider(indicator, fetcher = fetch, history = false) {
  const code = indicator.code;
  if (['USD', 'EUR'].includes(code) || code === 'BTC' && !process.env.COINGECKO_API_KEY) {
    const pair = code + '-BRL';
    const headers = process.env.AWESOME_API_KEY ? {
      'x-api-key': process.env.AWESOME_API_KEY
    } : {};
    const data = await json('https://economia.awesomeapi.com.br/json/last/' + pair, headers, fetcher);
    const current = data[code + 'BRL'];
    if (!current) throw error('Resposta inválida.', 502);
    const result = [point(current.bid, Number(current.timestamp) * 1000, current.pctChange)];
    if (history) {
      const rows = await json('https://economia.awesomeapi.com.br/json/daily/' + pair + '/360', headers, fetcher);
      if (!Array.isArray(rows)) throw error('Histórico inválido.', 502);
      for (const row of rows) result.push(point(row.bid, Number(row.timestamp) * 1000, row.pctChange));
    }
    return result.map(p => ({
      ...p,
      provider: 'awesome'
    }));
  }
  if (code === 'BTC') {
    if (!process.env.COINGECKO_API_KEY) throw error('Configure COINGECKO_API_KEY no backend.', 503);
    const headers = {
      'x-cg-demo-api-key': process.env.COINGECKO_API_KEY
    };
    const data = await json('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true', headers, fetcher);
    if (!data.bitcoin) throw error('Resposta inválida.', 502);
    const result = [point(data.bitcoin.brl, data.bitcoin.last_updated_at * 1000, data.bitcoin.brl_24h_change)];
    if (history) {
      const data = await json('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=brl&days=365', headers, fetcher);
      if (!Array.isArray(data.prices)) throw error('Histórico inválido.', 502);
      for (const row of data.prices) result.push(point(row[1], row[0]));
    }
    return result;
  }
  if (code === 'IBOV') {
    if (!process.env.BRAPI_TOKEN) throw error('Configure BRAPI_TOKEN no backend.', 503);
    const data = await json('https://brapi.dev/api/quote/%5EBVSP' + (history ? '?range=1y&interval=1d' : ''), {
      Authorization: 'Bearer ' + process.env.BRAPI_TOKEN
    }, fetcher);
    const item = data.results?.[0];
    if (!item) throw error('Resposta inválida.', 502);
    const result = [point(item.regularMarketPrice, item.regularMarketTime, item.regularMarketChangePercent)];
    if (history) for (const row of item.historicalDataPrice || []) result.push(point(row.close, row.date * 1000));
    return result;
  }
  if (code === 'GOLD') {
    if (!process.env.GOLDAPI_KEY) throw error('Configure GOLDAPI_KEY no backend.', 503);
    const data = await json('https://www.goldapi.io/api/XAU/USD', {
      'x-access-token': process.env.GOLDAPI_KEY
    }, fetcher);
    return [point(data.price, data.timestamp * 1000, data.chp)];
  }
  throw error('Indicador inválido.');
}
async function fetchOne(indicator, fetcher = fetch) {
  const claim = repo.claim(indicator.code);
  if (!claim) return;
  try {
    const points = await provider(indicator, fetcher, claim.history);
    if (!points.length) throw error('Provedor sem dados.', 502);
    repo.success(indicator, points);
  } catch (e) {
    require('./diagnostics.cjs').log('MARKET_UNAVAILABLE',{code:e.code || 'PROVIDER_ERROR'});
    repo.failure(indicator.code, e.status ? e.message : 'Falha ao consultar o provedor.');
  }
}
const pending = new Set();
function syncOne(indicator, fetcher = fetch) {
  if (shutdownController.signal.aborted) return Promise.resolve();
  const task = fetchOne(indicator, fetcher);
  pending.add(task);
  return task.finally(() => pending.delete(task));
}
async function stop() {
  shutdownController.abort();
  await Promise.allSettled([...pending]);
}
async function drain() { await Promise.allSettled([...pending]); }
async function syncAll() {
  if (shutdownController.signal.aborted) return;
  await Promise.allSettled(repo.indicators().map(i => syncOne(i)));
}
async function read(code = 'USD', days = '30') {
  if (!['7', '30', '180', '365'].includes(String(days))) throw error('Período de mercado inválido.');
  if (!repo.indicators().some(i => i.code === code)) throw error('Indicador inválido.');
  return repo.read(code, Number(days));
}
module.exports = {
  drain,
  stop,
  provider,
  point,
  syncOne,
  syncAll,
  read
};
