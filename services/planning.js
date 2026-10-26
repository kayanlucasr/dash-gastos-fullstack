const db = require('../db');
const repository = require('../repositories/planning.repository');
const {cents,decimal} = require('./money.cjs');
const {validId} = require('../validators/transaction');
const invalid = message => Object.assign(new Error(message), {status:400});
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Informe os dados do planejamento.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 255) throw invalid('Nome obrigatório, com até 255 caracteres.');
  const date = body.planned_date;
  if (typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || date.slice(0,4) === '0000') throw invalid('Informe uma data válida.');
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw invalid('Informe uma data válida.');
  return {name:body.name.trim(), planned_date:date, amount_cents:cents(body.amount)};
}
function id(value) {
  if (!validId(value)) throw invalid('Identificador inválido.');
  return Number(value);
}
function list() {
  const rows = repository.list();
  const total = rows.reduce((sum,row) => sum + row.amount_cents, 0n);
  return {items:rows.map(({amount_cents,id,...row}) => ({...row,id:Number(id),amount:decimal(amount_cents)})),count:rows.length,total:decimal(total)};
}
function create(body) {
  const item = validate(body);
  return db.transaction(() => {repository.create(item);return list();});
}
function update(value,body) {
  const key=id(value), item=validate(body);
  return db.transaction(() => {
    if (!repository.update(key,item).changes) throw Object.assign(new Error('Planejamento não encontrado.'),{status:404});
    return list();
  });
}
function remove(value) {
  const key=id(value);
  return db.transaction(() => {
    if (!repository.remove(key).changes) throw Object.assign(new Error('Planejamento não encontrado.'),{status:404});
    return list();
  });
}
module.exports = {list,create,update,remove};
