const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-release-boundaries-'));
process.env.SQLITE_PATH=path.join(folder,'test.sqlite');
const finance=require('../services/finance');
const db=require('../db');
after(()=>{db.end();assert.equal(path.dirname(folder),os.tmpdir());fs.rmSync(folder,{recursive:true,force:true});});
test('the earliest selectable month has a valid previous-month comparison',async()=>{
  const summary=await finance.dashboard('1900-01');
  assert.equal(summary.month,'1900-01');assert.equal(summary.saldo,'0.00');
  assert.equal(summary.previous.month,'1899-12');assert.equal(summary.previous.receitas,'0.00');
});
test('unrepresentable month upper bound is rejected instead of returning a malformed date',()=>{
  assert.throws(()=>finance.monthBounds('9999-12'),error=>error.status===400);
  assert.deepEqual(finance.monthBounds('2024-12'),['2024-12-01','2025-01-01']);
  assert.deepEqual(finance.monthBounds('2024-02'),['2024-02-01','2024-03-01']);
});
