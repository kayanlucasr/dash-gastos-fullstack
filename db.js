require('dotenv').config({
  quiet: true
});
const {
  openDatabase,
  defaultPath
} = require('./database/sqlite/connection.cjs');
let connection;
function get() {
  if (!connection) connection = openDatabase(process.env.SQLITE_PATH || defaultPath());
  return connection;
}
function all(sql, params = []) {
  return get().prepare(sql).all(...params);
}
function one(sql, params = []) {
  return get().prepare(sql).get(...params);
}
function run(sql, params = []) {
  return get().prepare(sql).run(...params);
}
function integer(sql, params = []) {
  const statement = get().prepare(sql);
  statement.setReadBigInts(true);
  return Array.isArray(params) ? statement.get(...params) : statement.get(params);
}
function allBig(sql, params = []) {
  const statement = get().prepare(sql);
  statement.setReadBigInts(true);
  return statement.all(...params);
}
function transaction(fn) {
  if (fn.constructor.name === "AsyncFunction") throw new Error("Transações SQLite devem ter callback síncrono.");
  const c = get();
  c.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    if (result && typeof result.then === 'function') throw new Error('Transações SQLite devem ter callback síncrono.');
    c.exec('COMMIT');
    return result;
  } catch (error) {
    c.exec('ROLLBACK');
    throw error;
  }
}
function end() {
  if (connection) {
    connection.close();
    connection = undefined;
  }
}
module.exports = {
  get,
  all,
  allBig,
  one,
  run,
  integer,
  transaction,
  end,
  backupTo: target => {
    return require('./database/sqlite/data-management.cjs').createBackup(get(),target);
  }
};
