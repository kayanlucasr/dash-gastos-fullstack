const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dash-market-live-'));
process.env.SQLITE_PATH=path.join(folder,'market.sqlite');
const db=require('../db');
const market=require('../services/market');
// Exercise public providers only; never use personal credentials in this check.
for(const key of ['AWESOME_API_KEY','COINGECKO_API_KEY','BRAPI_TOKEN','GOLDAPI_KEY']) delete process.env[key];
(async()=>{
  const results=[];
  try {
    db.get();
    for(const code of ['USD','EUR','BTC']) {
      const indicator=db.one('SELECT * FROM market_indicators WHERE code=?',[code]);
      await market.syncOne(indicator);
      const result=await market.read(code,'365'),current=result.indicators.find(row=>row.code===code);
      results.push({code,status:current.price ? 'available' : 'unavailable',lastQuoteAt:current.quoted_at,historyPoints:result.history.length,stale:current.stale,error:current.error});
    }
    results.push({code:'IBOV/GOLD/CoinGecko',status:'not_tested',reason:'Requires optional credentials; no personal keys used'});
    const report={at:new Date().toISOString(),results};
    const destination=path.resolve(__dirname,'../backups/phase8/market-live.json');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    await market.stop();db.end();
    if(path.dirname(folder)!==path.resolve(os.tmpdir())) throw new Error('Invalid market fixture cleanup');
    fs.rmSync(folder,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error.code||'LIVE_CHECK_FAILED');process.exitCode=1;});
