// Only loaded by the existing isolated --desktop-smoke-test harness.
const path=require('node:path');
function createDialogs(profile) {
  const file=path.join(profile,'ui-backup-'+require('node:crypto').randomUUID()+'.sqlite');
  let choice='cancel';
  return {
    choose(value){choice=value;},
    async showSaveDialog(){return {canceled:false,filePath:file};},
    async showOpenDialog(){return choice==='file-cancel' ? {canceled:true,filePaths:[]} : {canceled:false,filePaths:[file]};},
    async showMessageBox(){return {response:choice==='confirm' ? 1 : 0};}
  };
}
async function run(contents,dialogs) {
  await contents.executeJavaScript(`(async()=>{
    [...document.querySelectorAll('nav button')].find(b=>b.textContent==='Configurações').click();
    const wait=async predicate=>{const deadline=Date.now()+10000;while(!predicate()){if(Date.now()>deadline)throw new Error('Data settings timeout');await new Promise(r=>setTimeout(r,25));}};
    await wait(()=>document.querySelector('section[aria-label="Gerenciamento de dados"]'));
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Criar backup').click();
    await wait(()=>document.querySelector('section[aria-label="Gerenciamento de dados"]').textContent.includes('Backup criado e validado'));
    const status=await window.desktop.data.status();if(!status.ok || !status.lastBackup)throw new Error('Backup metadata missing');
  })()`);
  await contents.executeJavaScript(`(async()=>{
    const response=await fetch('/api/planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Depois do backup',amount:'9.87',planned_date:'2030-01-01'})});
    if(response.status!==201 || (await response.json()).total!=='11.10') throw new Error('Post-backup write failed');
  })()`);
  dialogs.choose('file-cancel');
  let result=await contents.executeJavaScript('window.desktop.data.restore()');
  if(!result.cancelled) throw new Error('File dialog cancellation failed');
  dialogs.choose('cancel');
  result=await contents.executeJavaScript('window.desktop.data.restore()');
  if(!result.cancelled) throw new Error('Restore cancellation failed');
  const unchanged=await contents.executeJavaScript("fetch('/api/planning').then(r=>r.json())");
  if(unchanged.total!=='11.10') throw new Error('Cancellation replaced live data');
  dialogs.choose('confirm');
  result=await contents.executeJavaScript('window.desktop.data.restore()');
  if(!result.ok || !result.restored) throw new Error('Restore failed: '+result.message);
  const restored=await contents.executeJavaScript("fetch('/api/planning').then(r=>r.json())");
  if(restored.total!=='1.23' || restored.count!==1) throw new Error('Restored services did not use the backup');
  // Validate restored services and real renderer reload without losing the test context.
  await contents.reload();
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Reload timeout')),10000);
    contents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});
  });
  const status=await contents.executeJavaScript('window.desktop.data.status()');
  if(!status.lastBackup) throw new Error('Backup metadata lost');
  return {backup:true,cancelled:true,restored:true,reloaded:true};
}
module.exports={createDialogs,run};
