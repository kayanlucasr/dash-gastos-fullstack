const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),path=require('node:path'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dash-planning-test-'));
process.env.SQLITE_PATH=path.join(temp,'planning.sqlite');
const {openDatabase}=require('../database/sqlite/connection.cjs');
let db,server,base;
before(async()=>{
  db=require('../db');db.get();
  server=require('../server').listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server) await new Promise(resolve=>server.close(resolve));db?.end();
  if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir())) throw new Error('Invalid test cleanup');
  fs.rmSync(temp,{recursive:true,force:true});});
async function request(route='',method='GET',body){
  const response=await fetch(base+'/planning'+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
const item=(name='Teste',amount='0.10',planned_date='2030-03-01')=>({name,amount,planned_date});
function financialSnapshot(){
  const tables=['accounts','categories','transactions','investment_valuations','monthly_closings','monthly_category_totals','market_indicators','market_quotes','market_sync_state'];
  return tables.map(table=>[table,db.all('SELECT * FROM '+table)]);
}
test('planning CRUD preserves every financial table and totals exact decimal cents',async()=>{
  db.run("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Saldo preservado',12345,'income','2024-01-01',7,1)");
  const before=financialSnapshot();
  assert.deepEqual((await request()).data,{items:[],count:0,total:'0.00'});
  let r=await request('','POST',item('Later','0.10','2030-03-01'));assert.equal(r.status,201);
  const later=r.data.items[0].id;
  r=await request('','POST',item(' Past ','0.20','2001-01-01'));
  assert.equal(r.data.total,'0.30');assert.equal(r.data.count,2);
  assert.deepEqual(r.data.items.map(row=>row.name),['Past','Later']);
  const past=r.data.items[0].id;
  r=await request('/'+later,'PUT',item("Conta ' ; DROP TABLE accounts; --",'9999999999.99','2000-02-29'));
  assert.equal(r.status,200);assert.equal(r.data.total,'10000000000.19');
  assert.equal(r.data.items[0].id,later);
  assert.equal(r.data.items[0].amount,'9999999999.99');
  assert.ok(r.data.items[0].created_at);assert.ok(r.data.items[0].updated_at);
  db.end();db.get();
  assert.deepEqual((await request()).data,r.data);
  assert.equal((await request('/'+later,'DELETE')).data.total,'0.20');
  assert.deepEqual((await request('/'+past,'DELETE')).data,{items:[],count:0,total:'0.00'});
  assert.equal((await request('/'+past,'DELETE')).status,404);
  assert.equal((await request('/'+past,'PUT',item())).status,404);
  assert.deepEqual(financialSnapshot(),before);
  assert.deepEqual(db.all('PRAGMA foreign_key_list(planning_items)'),[]);
});
test('planning rejects invalid values, dates, names and IDs without modifying data',async()=>{
  const baseline=(await request()).data;
  for(const body of [null,[],{},item(' '),item('x'.repeat(256)),item('Test','0'),item('Test','-1'),item('Test','1.001'),item('Test','1e3'),item('Test','1,23'),item('Test','10000000000.00'),item('Test',true),item('Test','1','2030-02-29'),item('Test','1','2024-02-30'),item('Test','1','2024-13-01'),item('Test','1','0000-01-01'),item('Test','1','tomorrow')]) {
    assert.equal((await request('','POST',body)).status,400,JSON.stringify(body));
  }
  for(const id of ['0','-1','abc','9007199254740992']) {
    assert.equal((await request('/'+id,'PUT',item())).status,400);
    assert.equal((await request('/'+id,'DELETE')).status,400);
  }
  assert.deepEqual((await request()).data,baseline);
  assert.throws(()=>db.run("INSERT INTO planning_items(name,planned_date,amount_cents) VALUES('bad','2030-02-30',100)"));
  assert.throws(()=>db.run("INSERT INTO planning_items(name,planned_date,amount_cents) VALUES('bad','2030-02-28',0)"));
});
test('planning migration upgrades an existing database with backup and preserves financial data',()=>{
  const folder=path.join(temp,'upgrade');fs.mkdirSync(folder);
  const migrations=path.join(folder,'old-migrations');fs.mkdirSync(migrations);
  fs.copyFileSync(path.resolve('database/sqlite/migrations/001_initial.sql'),path.join(migrations,'001_initial.sql'));
  const file=path.join(folder,'existing.sqlite');let connection;
  try {
    connection=openDatabase(file,{migrationsDir:migrations});
    connection.prepare("INSERT INTO transactions(descricao,valor_centavos,tipo,data,category_id,destination_account_id) VALUES('Preservar',12345,'income','2024-01-01',7,1)").run();
    const existing=connection.prepare('SELECT * FROM transactions').all();connection.close();connection=undefined;
    connection=openDatabase(file);
    assert.deepEqual(connection.prepare('SELECT * FROM transactions').all(),existing);
    assert.equal(connection.prepare('SELECT count(*) n FROM planning_items').get().n,0);
    assert.equal(connection.prepare('SELECT count(*) n FROM schema_migrations').get().n,2);
    assert.ok(fs.readdirSync(path.join(folder,'backups')).some(name=>name.endsWith('.sqlite')));
    assert.deepEqual(connection.prepare('PRAGMA foreign_key_check').all(),[]);
    connection.close();connection=openDatabase(file);
    assert.equal(connection.prepare('SELECT count(*) n FROM schema_migrations').get().n,2);
  } finally {connection?.close();}
});

test('persistence failures return an error and preserve the prior planning state',async()=>{
  const created=await request('','POST',item('Preservar','12.34'));
  const baseline=created.data, id=baseline.items[0].id;
  db.get().exec("CREATE TRIGGER planning_test_failure BEFORE UPDATE ON planning_items BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  try {
    const failed=await request('/'+id,'PUT',item('Alterado','98.76'));
    assert.equal(failed.status,500);
    assert.deepEqual((await request()).data,baseline);
  } finally {db.get().exec('DROP TRIGGER planning_test_failure');}
  assert.equal((await request('/'+id,'DELETE')).status,200);
});
