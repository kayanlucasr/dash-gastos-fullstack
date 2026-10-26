const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('all financial modules work over local HTTP while every external request fails',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-offline-test-'));
  process.env.SQLITE_PATH=path.join(folder,'offline.sqlite');
  const db=require('../db');let server;
  const originalFetch=globalThis.fetch;
  let blocked=0;
  globalThis.fetch=async(url,options)=>{
    if(new URL(url).hostname==='127.0.0.1') return originalFetch(url,options);
    blocked++;throw Object.assign(new Error('No internet'),{code:'ENETUNREACH'});
  };
  try {
    db.get();
    const repo=require('../repositories/market.repository');
    const usd=repo.indicators().find(row=>row.code==='USD');
    repo.claim('USD');repo.success(usd,[{price:'5.00',at:'2020-01-01T12:00:00.000Z',change:null}]);
    db.run("UPDATE market_sync_state SET next_attempt_at='2000-01-01' WHERE indicator_code='USD'");
    await require('../services/market').syncAll();assert.ok(blocked>0);
    server=require('../server').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    async function request(route,method='GET',body,status=200) {
      const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      assert.equal(response.status,status,route);return response.json();
    }
    const reserve=await request('/finance/accounts','POST',{nome:'Reserva offline',tipo:'reserve'},201);
    const investment=await request('/finance/accounts','POST',{nome:'Investimento offline',tipo:'investment'},201);
    const movement=(tipo,valor,extra={})=>({tipo,valor,descricao:'Teste offline',data:'2024-01-01',category_id:7,...extra});
    await request('/transactions','POST',movement('income','1000.00'),201);
    await request('/transactions','POST',movement('expense','10.00'),201);
    await request('/transactions','POST',movement('transfer','100.00',{source_account_id:1,destination_account_id:reserve.id}),201);
    await request('/transactions','POST',movement('transfer','200.00',{source_account_id:1,destination_account_id:investment.id}),201);
    await request('/finance/valuations','POST',{account_id:investment.id,data:'2024-01-01',valor:'210.00'},201);
    await request('/transactions','POST',movement('transfer','20.00',{source_account_id:investment.id,destination_account_id:1,data:'2024-01-02'}),201);
    const summary=await request('/dashboard?month=2024-01');
    assert.equal(summary.receitas,'1000.00');assert.equal(summary.despesas,'10.00');assert.equal(summary.saldo,'710.00');
    assert.ok(summary.closings.length>0);assert.ok(summary.categories.length>0);
    assert.ok((await request('/transactions?month=2024-01')).length>=5);
    assert.ok((await request('/finance/wealth')).evolution.length>0);
    await request('/planning','POST',{name:'Planejamento offline',planned_date:'2000-01-01',amount:'12.34'},201);
    assert.equal((await request('/planning')).total,'12.34');
    const quotes=await request('/market?code=USD&days=7');const cached=quotes.indicators.find(row=>row.code==='USD');
    assert.equal(cached.price,'5.00');assert.equal(cached.stale,true);assert.ok(cached.error);assert.ok(cached.fetched_at);
    db.end();db.get();assert.equal((await request('/planning')).total,'12.34');
    assert.equal((await request('/dashboard?month=2024-01')).saldo,'710.00');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await require('../services/market').stop();db.end();globalThis.fetch=originalFetch;
    assert.equal(path.dirname(folder),os.tmpdir());fs.rmSync(folder,{recursive:true,force:true});
  }
});
