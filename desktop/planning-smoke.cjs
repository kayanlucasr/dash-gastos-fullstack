// UI integration test, invoked only by --desktop-smoke-test on an isolated profile.
module.exports = async contents => contents.executeJavaScript(`(async () => {
  const wait = async predicate => {
    const deadline=Date.now()+6000;
    while (!predicate()) {if(Date.now()>deadline) throw new Error('Planning UI timeout');await new Promise(resolve=>setTimeout(resolve,25));}
  };
  const button = (root,text) => [...root.querySelectorAll('button')].find(node=>node.textContent===text);
  const nav=document.querySelector('nav[aria-label="Áreas financeiras"]');
  if(!nav || button(nav,'Dashboard')?.getAttribute('aria-current')!=='page') throw new Error('Direct dashboard startup failed');
  if(document.querySelector('input[type="password"]') || [...document.querySelectorAll('button,a')].some(node=>/^(entrar|sair|login|cadastrar|trocar usuário)$/i.test(node.textContent.trim()))) throw new Error('Authentication UI remains');
  const month=document.querySelector('input[type="month"]'),originalMonth=month.value;
  const selectMonth=value=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(month,value);
    month.dispatchEvent(new Event('input',{bubbles:true}));month.dispatchEvent(new Event('change',{bubbles:true}));
  };
  selectMonth('1900-01');
  await wait(()=>document.querySelector('.comparison h2')?.textContent.includes('1899-12'));
  if(document.querySelector('[role="alert"]')) throw new Error('Earliest month failed in renderer');
  selectMonth(originalMonth);
  await wait(()=>document.querySelector('.comparison h2') && !document.querySelector('.comparison h2').textContent.includes('1899-12'));
  for(const [area,heading] of [['Extrato','Resumo'],['Patrimônio','Patrimônio'],['Mercado','Mercado financeiro'],['Dashboard','Despesas por categoria']]) {
    button(nav,area).click();
    await wait(()=>button(nav,area).getAttribute('aria-current')==='page' && [...document.querySelectorAll('h2')].some(node=>node.textContent.includes(heading)));
  }
  button(document.querySelector('nav'),'Planejamento').click();
  const panel=()=>document.querySelector('section[aria-label="Planejamento financeiro"]');
  await wait(()=>panel()?.querySelector('[aria-label="Resumo do planejamento"]'));
  const summary=()=>panel().querySelector('[aria-label="Resumo do planejamento"]').textContent;
  if(!summary().includes('1 conta cadastrada') || !summary().includes('1,23')) throw new Error('Planning persistence missing');
  const fill=(name,value)=>{
    const input=panel().querySelector('input[name="'+name+'"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const card=()=>[...panel().querySelectorAll('.transaction-card')].find(node=>node.querySelector('h3').textContent==='Conta UI');
  fill('name','Conta UI');fill('planned_date','2031-02-28');fill('amount','0.10');
  panel().querySelector('form').requestSubmit();
  await wait(()=>card() && summary().includes('1,33'));
  button(card(),'Editar').click();
  await wait(()=>panel().querySelector('button[type="submit"]').textContent==='Salvar alterações');
  fill('amount','0.20');
  panel().querySelector('form').requestSubmit();
  await wait(()=>summary().includes('1,43'));
  const originalConfirm=window.confirm;
  try {
    window.confirm=()=>false;
    button(card(),'Excluir').click();
    if(!card()) throw new Error('Deletion cancellation failed');
    window.confirm=()=>true;
    button(card(),'Excluir').click();
    await wait(()=>!card() && summary().includes('1,23'));
  } finally {window.confirm=originalConfirm;}
  if(panel().querySelector('[role="alert"]')) throw new Error('Planning UI error');
  return {created:true,edited:true,deletionCancelled:true,deleted:true,persisted:true,total:'1.23'};
})()`);
