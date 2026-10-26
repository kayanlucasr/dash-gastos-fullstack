const db = require('../db');
const repo = require('../repositories/finance.repository');
const {
  validId,
  validateTransaction
} = require('../validators/transaction');
const {
  cents,
  decimal,
  movement
} = require('./money.cjs');
const error = (message, status = 400) => Object.assign(new Error(message), {
  status
});
const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31' && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
function monthBounds(month = today().slice(0, 7)) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month) || !validDate(month + '-01')) throw error('Mês inválido.');
  const date = new Date(month + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + 1);
  if(!/^\d{4}-/.test(date.toISOString())) throw error('Mês fora do intervalo permitido.');
  return [month + '-01', date.toISOString().slice(0, 10)];
}
async function atomic(fn) {
  return db.transaction(fn);
}
function accounts(_unused, at = today()) {
  return repo.accounts(at);
}
function revalue() {
  repo.disableValuationAdjustments();
  for (const v of repo.valuations()) {
    const delta = BigInt(v.valor_centavos) - repo.balance(v.account_id, v.data);
    if (delta !== 0n) repo.applyValuation(v, delta);
  }
}
function enforceBalance() {
  if (repo.hasNegativeBalance()) throw error('Saldo insuficiente na data da movimentação ou em um período posterior.', 409);
}
async function save(body, id) {
  if (!body || typeof body !== 'object') throw error('Dados inválidos.');
  const tipo = body.tipo;
  const validation = validateTransaction({
    ...body,
    tipo: ['transfer', 'adjustment'].includes(tipo) ? 'expense' : tipo,
    category_id: ['transfer', 'adjustment'].includes(tipo) ? 1 : body.category_id
  });
  if (validation) throw error(validation);
  if (!['income', 'expense', 'transfer', 'adjustment'].includes(tipo)) throw error('Tipo inválido.');
  const data = body.data || today();
  if (!validDate(data) || data > today()) throw error('Informe uma data válida, até hoje.');
  if (id !== undefined && !validId(id)) throw error('ID inválido.');
  const value = cents(body.valor);
  return db.transaction(() => {
    if (id !== undefined && !repo.findMovement(id)) throw error('Transação não encontrada.', 404);
    if (id !== undefined && repo.valuationForMovement(id)) throw error('Edite a avaliação pela área Patrimônio.', 409);
    const defaultId = repo.ensureAccount();
    const source = body.source_account_id ?? (tipo === 'expense' ? defaultId : null),
      dest = body.destination_account_id ?? (tipo === 'income' ? defaultId : null);
    if (tipo === 'income' && source !== null || tipo === 'expense' && dest !== null || tipo === 'transfer' && (!source || !dest) || tipo === 'adjustment' && Boolean(source) === Boolean(dest)) throw error('Origem e destino incompatíveis com o tipo.');
    if (source && dest && Number(source) === Number(dest)) throw error('Origem e destino devem ser diferentes.');
    for (const account of [source, dest].filter(v => v !== null)) {
      if (!validId(account)) throw error('Conta inválida.');
      if (!repo.findAccount(account)) throw error('Conta não encontrada.', 404);
    }
    const category = ['income', 'expense'].includes(tipo) ? body.category_id : null;
    if (category && !repo.categories().some(c => c.id === Number(category))) throw error('Categoria não encontrada.');
    const params = [body.descricao.trim(), value, tipo, data, category === null ? null : Number(category), source === null ? null : Number(source), dest === null ? null : Number(dest)];
    const row = id === undefined ? repo.insertMovement(params) : repo.updateMovement(params, id);
    revalue();
    enforceBalance();
    refreshClosed();
    return row;
  });
}
async function cancel(id) {
  if (!validId(id)) throw error('ID inválido.');
  return db.transaction(() => {
    if (repo.valuationForMovement(id)) throw error('Edite a avaliação pela área Patrimônio.', 409);
    if (!repo.cancel(id)) throw error('Transação não encontrada.', 404);
    revalue();
    enforceBalance();
    refreshClosed();
    return {
      message: 'Transação cancelada com sucesso.'
    };
  });
}
async function statement({
  month,
  tipo
} = {}) {
  if (tipo !== undefined && !['income', 'expense', 'transfer', 'adjustment'].includes(tipo)) throw error('Tipo inválido.');
  const [start, end] = month ? monthBounds(month) : [];
  return repo.statement({
    start,
    end,
    tipo
  });
}
function summary(month, bounds = monthBounds(month)) {
  const [start, end] = bounds;
  return {
    month,
    ...repo.summary(start, end)
  };
}
function refreshClosed() {
  let cursor = repo.firstMonth();
  if (!cursor) return;
  const current = today().slice(0, 7);
  while (cursor < current) {
    repo.closing(cursor, summary(cursor));
    cursor = monthBounds(cursor)[1].slice(0, 7);
  }
}
async function dashboard(month = today().slice(0, 7)) {
  monthBounds(month);
  return db.transaction(() => {
    refreshClosed();
    const date = new Date(month + '-01T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth() - 1);
    return {
      ...summary(month),
      previous: summary(date.toISOString().slice(0, 7), [date.toISOString().slice(0, 10), month + '-01']),
      accounts: accounts(),
      closings: repo.closings()
    };
  });
}
async function createAccount(body = {}) {
  if (!body || typeof body.nome !== 'string' || !body.nome.trim() || body.nome.length > 100 || !['available', 'reserve', 'investment'].includes(body.tipo)) throw error('Informe nome e tipo de conta válidos.');
  return db.transaction(() => repo.insertAccount(body.nome.trim(), body.tipo));
}
async function valuation(body = {}) {
  if (!body || !validId(body.account_id) || !validDate(body.data) || body.data > today()) throw error('Avaliação inválida.');
  const value = cents(body.valor, {
    zero: true
  });
  return db.transaction(() => {
    const a = repo.findAccount(body.account_id);
    if (!a || a.tipo !== 'investment') throw error('Investimento não encontrado.', 404);
    const row = repo.saveValuation(body.account_id, body.data, value);
    revalue();
    enforceBalance();
    refreshClosed();
    return row;
  });
}
async function wealth() {
  const list = accounts(),
    evolution = [],
    current = today().slice(0, 7);
  let cursor = repo.firstMonth() || current;
  while (cursor <= current) {
    const end = monthBounds(cursor)[1],
      at = cursor === current ? today() : new Date(Date.parse(end + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const total = repo.accounts(at).reduce((sum, a) => sum + cents(a.patrimonio, {
      zero: true,
      aggregate: true
    }), 0n);
    evolution.push({
      month: cursor,
      total: decimal(total)
    });
    cursor = end.slice(0, 7);
  }
  return {
    accounts: list,
    evolution,
    valuations: repo.valuations().reverse().map(movement)
  };
}
module.exports = {
  accounts,
  save,
  cancel,
  statement,
  dashboard,
  createAccount,
  valuation,
  wealth,
  refreshClosed,
  atomic,
  today,
  monthBounds,
  error,
  categories: repo.categories
};
