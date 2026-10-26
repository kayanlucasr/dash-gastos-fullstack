// Add historical fixture data only to the isolated installation-test profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const folder=path.resolve(process.argv[2] || '.');
if(path.dirname(folder)!==path.resolve(os.tmpdir()) || !/^financeiro-install-data-[a-f0-9-]+$/.test(path.basename(folder))) throw new Error('Not an isolated upgrade test profile');
const file=path.join(folder,'data/dash-gastos.sqlite');
if(!fs.statSync(file).isFile()) throw new Error('Missing test database');
process.env.SQLITE_PATH=file;
const db=require('../db'),finance=require('../services/finance');
(async()=>{
  try {
    const reserve=await finance.createAccount({nome:'Reserva da atualização',tipo:'reserve'});
    const investment=await finance.createAccount({nome:'Investimento da atualização',tipo:'investment'});
    const movement=(tipo,valor,extra={})=>({tipo,valor,descricao:'Histórico da atualização',data:'2020-01-01',category_id:7,...extra});
    await finance.save(movement('income','100.00'));
    for(const [id,valor] of [[reserve.id,'30.00'],[investment.id,'20.00']]) {
      await finance.save(movement('transfer',valor,{source_account_id:1,destination_account_id:id}));
      await finance.save(movement('transfer',valor,{source_account_id:id,destination_account_id:1}));
    }
    await finance.valuation({account_id:investment.id,data:'2020-01-01',valor:'0.00'});
    await finance.save(movement('expense','100.00'));
    const indicator=db.one("SELECT * FROM market_indicators WHERE code='USD'");
    const market=require('../repositories/market.repository');market.claim('USD');
    market.success(indicator,[{provider:'awesome',price:'5.00',change:null,at:'2020-01-01T12:00:00.000Z'}]);
    console.log('Upgrade fixture: transactions, transfers, reserve, investment, valuation, closings, planning and cached market data.');
  } finally {db.end();}
})().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
