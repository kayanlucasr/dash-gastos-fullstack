const fs=require('node:fs');
const {log}=require('../services/diagnostics.cjs');
const messages={
  BACKUP_INVALID:'O arquivo não é um backup SQLite válido e íntegro.',
  BACKUP_INCOMPATIBLE:'O backup usa uma estrutura ou versão diferente deste aplicativo.',
  BACKUP_DESTINATION:'Escolha um nome de arquivo novo. Arquivos existentes não serão substituídos.',
  BACKUP_IS_CURRENT:'Escolha um backup diferente do banco em uso.',
  DATABASE_STILL_OPEN:'Outro processo está usando o banco. Feche outras execuções e tente novamente.',
  RESTORE_RECOVERY_REQUIRED:'A recuperação precisa ser concluída. Feche e reabra o aplicativo. Preserve a pasta de dados e os backups.',
  DATA_BUSY:'Já existe uma operação de dados em andamento.',
  ENOSPC:'Não há espaço suficiente. Libere espaço no destino e tente novamente.',
  EACCES:'Sem permissão para acessar o arquivo selecionado.',
  EPERM:'O arquivo está bloqueado ou sem permissão de acesso.',
  ENOENT:'O arquivo ou a pasta selecionada não está disponível.'
};
function authorized(event,contents,origin) {
  if(!contents || contents.isDestroyed() || event.sender!==contents || event.senderFrame!==contents.mainFrame) return false;
  try {return new URL(event.senderFrame.url).origin===origin;} catch {return false;}
}
function createDataController({dialog,getWindow,request,metadata,unavailable=()=>false}) {
  let active;
  function status() {
    let lastBackup=null;
    try {const saved=JSON.parse(fs.readFileSync(metadata,'utf8'));if(typeof saved.at==='string' && Number.isFinite(Date.parse(saved.at))) lastBackup=saved.at;} catch { /* Optional metadata. */ }
    return {ok:true,lastBackup};
  }
  async function perform(command) {
    if(active || unavailable()) return {ok:false,message:messages.DATA_BUSY};
    active=(async()=>{
      let prepared=false;
      try {
        if(command==='status') return status();
        if(command==='backup') {
          const selection=await dialog.showSaveDialog(getWindow(),{title:'Criar backup',defaultPath:'dash-gastos-backup-'+new Date().toISOString().slice(0,10)+'.sqlite',filters:[{name:'Backup SQLite',extensions:['sqlite']} ]});
          if(selection.canceled || !selection.filePath) return {ok:true,cancelled:true};
          const result=await request('backup',selection.filePath);
          try {
            const temp=metadata+'.tmp';fs.writeFileSync(temp,JSON.stringify({at:result.at}));fs.renameSync(temp,metadata);
          } catch(error) {log('BACKUP_METADATA_ERROR',error);return {ok:true,message:'Backup criado. Não foi possível registrar a data do último backup.'};}
          return {...status(),message:'Backup criado e validado com sucesso.'};
        }
        if(command!=='restore') return {ok:false,message:'Operação inválida.'};
        const selection=await dialog.showOpenDialog(getWindow(),{title:'Restaurar backup',properties:['openFile'],filters:[{name:'Backup SQLite',extensions:['sqlite','db']} ]});
        if(selection.canceled || !selection.filePaths?.[0]) return {ok:true,cancelled:true};
        await request('prepare',selection.filePaths[0]);prepared=true;
        const confirmation=await dialog.showMessageBox(getWindow(),{type:'warning',title:'Confirmar restauração',message:'Substituir todos os dados atuais pelo backup selecionado?',detail:'Receitas, despesas, patrimônio, planejamento e cotações serão substituídos. Uma cópia de segurança dos dados atuais será guardada na pasta de backups do aplicativo.',buttons:['Cancelar','Restaurar dados'],defaultId:0,cancelId:0,noLink:true});
        if(confirmation.response!==1) return {ok:true,cancelled:true};
        await request('restore');prepared=false;
        return {ok:true,restored:true,message:'Backup restaurado. Os dados foram verificados.'};
      } catch(error) {
        log('DATA_CONTROLLER_ERROR',error);
        return {ok:false,message:messages[error.code] || 'Não foi possível concluir a operação. Os dados anteriores foram preservados ou guardados na cópia de segurança. Consulte os logs locais.'};
      } finally {if(prepared) await request('cancel').catch(error=>log('DATA_CANCEL_ERROR',error));}
    })();
    try {return await active;} finally {active=undefined;}
  }
  return {perform,get busy(){return Boolean(active);},wait:()=>active};
}
module.exports={createDataController,authorized};
