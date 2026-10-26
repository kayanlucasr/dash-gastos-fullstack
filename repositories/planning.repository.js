const db = require('../db');
module.exports = {
  list: () => db.allBig('SELECT * FROM planning_items ORDER BY planned_date, id'),
  create: item => db.run('INSERT INTO planning_items(name,planned_date,amount_cents) VALUES(?,?,?)', [item.name,item.planned_date,item.amount_cents]),
  update: (id,item) => db.run("UPDATE planning_items SET name=?,planned_date=?,amount_cents=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",[item.name,item.planned_date,item.amount_cents,id]),
  remove: id => db.run('DELETE FROM planning_items WHERE id=?',[id])
};
