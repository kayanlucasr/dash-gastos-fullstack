// Runs only in an isolated smoke profile, using the renderer's protected local HTTP.
module.exports=contents=>contents.executeJavaScript(`(async()=>{
  async function request(route,method='GET',body,status=200) {
    const response=await fetch('/api'+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(response.status!==status) throw new Error('Financial smoke HTTP '+response.status);
    return response.json();
  }
  const before=await request('/dashboard');
  const body=(tipo,valor)=>({tipo,valor,descricao:'Movimentação temporária de validação',category_id:7});
  const income=await request('/transactions','POST',body('income','0.10'),201);
  const expense=await request('/transactions','POST',body('expense','0.05'),201);
  await request('/transactions/'+income.id,'PUT',body('income','0.20'));
  const statement=await request('/transactions');
  if(!statement.some(row=>row.id===income.id && row.valor==='0.20') || !statement.some(row=>row.id===expense.id && row.valor==='0.05')) throw new Error('Financial statement failed');
  await request('/transactions/'+expense.id,'DELETE');
  await request('/transactions/'+income.id,'DELETE');
  const after=await request('/dashboard');
  if(before.saldo!==after.saldo || before.receitas!==after.receitas || before.despesas!==after.despesas) throw new Error('Financial balance changed');
  return {income:true,expense:true,edit:true,cancel:true,statement:true,balance:true};
})()`);
