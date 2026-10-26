const db = require('../db');
const {
  decimal,
  movement
} = require('../services/money.cjs');
const now = () => new Date().toISOString();
function categories() {
  return db.all('SELECT * FROM categories ORDER BY id');
}
function ensureAccount() {
  const existing = db.one("SELECT id FROM accounts WHERE tipo='available' ORDER BY id LIMIT 1");
  if (existing) return existing.id;
  return Number(db.run("INSERT INTO accounts(nome,tipo) VALUES('Conta disponível','available')").lastInsertRowid);
}
function accounts(at) {
  ensureAccount();
  return db.allBig(`SELECT a.*,
 COALESCE((SELECT SUM(CASE WHEN t.destination_account_id=a.id THEN t.valor_centavos ELSE -t.valor_centavos END) FROM transactions t WHERE t.cancelled_at IS NULL AND t.data<=? AND (t.source_account_id=a.id OR t.destination_account_id=a.id)),0) saldo_centavos,
 COALESCE((SELECT SUM(CASE WHEN t.destination_account_id=a.id THEN t.valor_centavos ELSE -t.valor_centavos END) FROM transactions t WHERE t.cancelled_at IS NULL AND t.tipo='transfer' AND t.data<=? AND (t.source_account_id=a.id OR t.destination_account_id=a.id)),0) aportes_centavos
 FROM accounts a ORDER BY a.id`, [at, at]).map(({
    saldo_centavos,
    aportes_centavos,
    id,
    ...a
  }) => ({
    ...a,
    id: Number(id),
    saldo: decimal(saldo_centavos),
    patrimonio: decimal(saldo_centavos),
    aportes_liquidos: decimal(aportes_centavos)
  }));
}
function findAccount(id) {
  return db.one('SELECT * FROM accounts WHERE id=?', [Number(id)]);
}
function insertAccount(nome, tipo) {
  return db.one('INSERT INTO accounts(nome,tipo) VALUES(?,?) RETURNING *', [nome, tipo]);
}
function findMovement(id) {
  return db.one('SELECT * FROM transactions WHERE id=? AND cancelled_at IS NULL', [Number(id)]);
}
function valuationForMovement(id) {
  return db.one('SELECT id FROM investment_valuations WHERE transaction_id=?', [Number(id)]);
}
function insertMovement(p) {
  return movement(db.one('INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,source_account_id,destination_account_id) VALUES(?,?,?,?,?,?,?) RETURNING *', p));
}
function updateMovement(p, id) {
  return movement(db.one('UPDATE transactions SET descricao=?,valor_centavos=?,tipo=?,data=?,category_id=?,source_account_id=?,destination_account_id=?,updated_at=? WHERE id=? RETURNING *', [...p, now(), Number(id)]));
}
function cancel(id) {
  return db.one('UPDATE transactions SET cancelled_at=?,updated_at=? WHERE id=? AND cancelled_at IS NULL RETURNING id', [now(), now(), Number(id)]);
}
function hasNegativeBalance() {
  return !!db.one(`WITH changes AS (
 SELECT source_account_id id,data,-valor_centavos delta FROM transactions WHERE cancelled_at IS NULL AND source_account_id IS NOT NULL
 UNION ALL SELECT destination_account_id,data,valor_centavos FROM transactions WHERE cancelled_at IS NULL AND destination_account_id IS NOT NULL),
 daily AS(SELECT id,data,SUM(delta) delta FROM changes GROUP BY id,data), running AS(SELECT SUM(delta) OVER(PARTITION BY id ORDER BY data) balance FROM daily)
 SELECT 1 FROM running WHERE balance<0 LIMIT 1`);
}
function valuations() {
  return db.all('SELECT * FROM investment_valuations ORDER BY data,id');
}
function disableValuationAdjustments() {
  db.run('UPDATE transactions SET cancelled_at=? WHERE id IN(SELECT transaction_id FROM investment_valuations)', [now()]);
}
function balance(id, date) {
  return db.integer('SELECT COALESCE(SUM(CASE WHEN destination_account_id=? THEN valor_centavos ELSE -valor_centavos END),0) total FROM transactions WHERE cancelled_at IS NULL AND data<=? AND (source_account_id=? OR destination_account_id=?)', [id, date, id, id]).total;
}
function applyValuation(v, delta) {
  const source = delta < 0n ? v.account_id : null,
    destination = delta > 0n ? v.account_id : null,
    amount = delta < 0n ? -delta : delta;
  if (v.transaction_id) db.run('UPDATE transactions SET valor_centavos=?,data=?,source_account_id=?,destination_account_id=?,cancelled_at=NULL,updated_at=? WHERE id=?', [amount, v.data, source, destination, now(), v.transaction_id]);else {
    const id = db.run("INSERT INTO transactions(valor_centavos,data,source_account_id,destination_account_id,tipo,descricao) VALUES(?,?,?,?,'adjustment','Avaliação patrimonial')", [amount, v.data, source, destination]).lastInsertRowid;
    db.run('UPDATE investment_valuations SET transaction_id=? WHERE id=?', [id, v.id]);
  }
}
function saveValuation(id, date, value) {
  return movement(db.one('INSERT INTO investment_valuations(account_id,data,valor_centavos) VALUES(?,?,?) ON CONFLICT(account_id,data) DO UPDATE SET valor_centavos=excluded.valor_centavos RETURNING *', [Number(id), date, value]));
}
function statement({
  start,
  end,
  tipo
}) {
  const params = [];
  let filter = '';
  if (start) {
    filter += ' AND t.data>=? AND t.data<?';
    params.push(start, end);
  }
  if (tipo) {
    filter += ' AND t.tipo=?';
    params.push(tipo);
  }
  return db.all(`SELECT t.*,(SELECT id FROM investment_valuations WHERE transaction_id=t.id) valuation_id,c.nome categoria,s.nome origem,d.nome destino FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN accounts s ON s.id=t.source_account_id LEFT JOIN accounts d ON d.id=t.destination_account_id WHERE t.cancelled_at IS NULL ${filter} ORDER BY t.data DESC,t.id DESC`, params).map(movement);
}
function summary(start, end) {
  const totals = db.integer(`SELECT
 COALESCE(SUM(CASE WHEN t.tipo='income' AND t.data>=?1 THEN t.valor_centavos ELSE 0 END),0) receitas,
 COALESCE(SUM(CASE WHEN t.tipo='expense' AND t.data>=?1 THEN t.valor_centavos ELSE 0 END),0) despesas,
 COALESCE(SUM(CASE WHEN t.tipo='transfer' AND t.data>=?1 AND d.tipo='reserve' AND s.tipo<>'reserve' THEN t.valor_centavos ELSE 0 END),0) reservas,
 COALESCE(SUM(CASE WHEN t.tipo='transfer' AND t.data>=?1 AND d.tipo='investment' AND s.tipo<>'investment' THEN t.valor_centavos ELSE 0 END),0) investimentos,
 COALESCE(SUM(CASE WHEN t.tipo='transfer' AND t.data>=?1 AND d.tipo='available' AND s.tipo IN('reserve','investment') THEN t.valor_centavos ELSE 0 END),0) resgates,
 COALESCE(SUM(CASE WHEN t.data<?1 THEN (CASE WHEN d.tipo='available' THEN t.valor_centavos ELSE 0 END)-(CASE WHEN s.tipo='available' THEN t.valor_centavos ELSE 0 END) ELSE 0 END),0) saldo_inicial,
 COALESCE(SUM((CASE WHEN d.tipo='available' THEN t.valor_centavos ELSE 0 END)-(CASE WHEN s.tipo='available' THEN t.valor_centavos ELSE 0 END)),0) saldo
 FROM transactions t LEFT JOIN accounts s ON s.id=t.source_account_id LEFT JOIN accounts d ON d.id=t.destination_account_id WHERE t.cancelled_at IS NULL AND t.data<?2`, {
    1: start,
    2: end
  });
  const categories = db.allBig("SELECT c.id category_id,c.nome categoria,SUM(t.valor_centavos) total FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.cancelled_at IS NULL AND t.tipo='expense' AND t.data>=? AND t.data<? GROUP BY c.id,c.nome ORDER BY SUM(t.valor_centavos) DESC", [start, end]).map(c => ({
    ...c,
    category_id: Number(c.category_id),
    total: decimal(c.total)
  }));
  return {
    ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, decimal(v)])),
    categories
  };
}
function closing(month, summary) {
  const data = JSON.stringify(summary);
  const old = db.one('SELECT * FROM monthly_closings WHERE month=?', [month + '-01']);
  if (old?.summary === data) return;
  const row = db.one('INSERT INTO monthly_closings(month,summary) VALUES(?,?) ON CONFLICT(month) DO UPDATE SET summary=excluded.summary,revision=monthly_closings.revision+1,closed_at=? RETURNING id', [month + '-01', data, now()]);
  db.run('DELETE FROM monthly_category_totals WHERE closing_id=?', [row.id]);
  for (const c of summary.categories) db.run('INSERT INTO monthly_category_totals VALUES(?,?,?)', [row.id, c.category_id, require('../services/money.cjs').cents(c.total, {
    zero: true,
    aggregate: true
  })]);
}
function firstMonth() {
  return db.one('SELECT substr(min(data),1,7) month FROM transactions').month;
}
function closings() {
  return db.all('SELECT substr(month,1,7) month,summary,revision,closed_at FROM monthly_closings ORDER BY month DESC').map(r => ({
    ...r,
    summary: JSON.parse(r.summary)
  }));
}
module.exports = {
  categories,
  ensureAccount,
  accounts,
  findAccount,
  insertAccount,
  findMovement,
  valuationForMovement,
  insertMovement,
  updateMovement,
  cancel,
  hasNegativeBalance,
  valuations,
  disableValuationAdjustments,
  balance,
  applyValuation,
  saveValuation,
  statement,
  summary,
  closing,
  firstMonth,
  closings
};
