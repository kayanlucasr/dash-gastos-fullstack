const db = require('../db');
function indicators() {
  return db.all('SELECT * FROM market_indicators ORDER BY code');
}
function claim(code) {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const state = db.one('SELECT * FROM market_sync_state WHERE indicator_code=?', [code]);
    if (state?.next_attempt_at > now || state?.lease_until > now) return null;
    db.run('INSERT INTO market_sync_state(indicator_code,attempted_at,lease_until) VALUES(?,?,?) ON CONFLICT(indicator_code) DO UPDATE SET attempted_at=excluded.attempted_at,lease_until=excluded.lease_until', [code, now, new Date(Date.now() + 45000).toISOString()]);
    return {
      history: !db.one('SELECT 1 FROM market_quotes WHERE indicator_code=? LIMIT 1', [code])
    };
  });
}
function success(indicator, points) {
  db.transaction(() => {
    const now = new Date().toISOString();
    for (const p of points) db.run('INSERT INTO market_quotes(indicator_code,provider,quoted_at,price,change_percent,fetched_at) VALUES(?,?,?,?,?,?) ON CONFLICT(indicator_code,provider,quoted_at) DO UPDATE SET price=excluded.price,change_percent=COALESCE(excluded.change_percent,market_quotes.change_percent),fetched_at=excluded.fetched_at', [indicator.code, p.provider || indicator.provider, p.at, p.price, p.change === null ? null : String(p.change), now]);
    db.run('UPDATE market_sync_state SET succeeded_at=?,next_attempt_at=?,lease_until=NULL,error=NULL WHERE indicator_code=?', [now, new Date(Date.now() + 86400000).toISOString(), indicator.code]);
  });
}
function failure(code, message) {
  db.transaction(() => db.run('UPDATE market_sync_state SET next_attempt_at=?,lease_until=NULL,error=? WHERE indicator_code=?', [new Date(Date.now() + 3600000).toISOString(), message.slice(0, 255), code]));
}
function read(code, days) {
  const now = Date.now();
  const list = indicators().map(i => {
    const state = db.one('SELECT * FROM market_sync_state WHERE indicator_code=?', [i.code]) || {};
    const quote = db.one('SELECT * FROM market_quotes WHERE indicator_code=? ORDER BY quoted_at DESC LIMIT 1', [i.code]) || {};
    return {
      ...i,
      attempted_at: state.attempted_at || null,
      succeeded_at: state.succeeded_at || null,
      error: state.error || null,
      price: quote.price || null,
      change_percent: quote.change_percent ?? null,
      quoted_at: quote.quoted_at || null,
      fetched_at: quote.fetched_at || null,
      provider: quote.provider || i.provider,
      stale: quote.quoted_at ? Date.parse(quote.quoted_at) < now - 86400000 : false
    };
  });
  const history = db.all(`SELECT quoted_at,price FROM(SELECT quoted_at,price,ROW_NUMBER() OVER(PARTITION BY substr(quoted_at,1,10) ORDER BY quoted_at DESC) n FROM market_quotes WHERE indicator_code=? AND provider=(SELECT provider FROM market_quotes WHERE indicator_code=? ORDER BY quoted_at DESC LIMIT 1) AND quoted_at>=?) WHERE n=1 ORDER BY quoted_at`, [code, code, new Date(now - days * 86400000).toISOString()]);
  return {
    indicators: list,
    history,
    code,
    days
  };
}
module.exports = {
  indicators,
  claim,
  success,
  failure,
  read
};
