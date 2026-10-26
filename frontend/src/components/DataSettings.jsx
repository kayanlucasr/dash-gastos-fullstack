import {useEffect,useRef,useState} from 'react';
export default function DataSettings() {
  const [lastBackup,setLastBackup]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const pending=useRef(false);
  const data=window.desktop?.data;
  useEffect(()=>{
    let active=true;
    data?.status().then(result=>{if(active && result.ok) setLastBackup(result.lastBackup);}).catch(()=>{if(active) setError('Não foi possível consultar a data do backup.');});
    return ()=>{active=false;};
  },[data]);
  async function run(action) {
    if(pending.current) return;
    pending.current=true;setBusy(true);setMessage('');setError('');
    try {
      const result=await data[action]();
      if(!result.ok) setError(result.message);
      else if(result.cancelled) setMessage('Operação cancelada. Os dados foram mantidos.');
      else {
        setMessage(result.message);
        if(result.lastBackup) setLastBackup(result.lastBackup);
        if(result.restored) window.location.reload();
      }
    } catch {setError('Não foi possível comunicar com o aplicativo. Feche e reabra para tentar novamente.');}
    finally {pending.current=false;setBusy(false);}
  }
  return <section aria-label="Gerenciamento de dados">
    <h2>Configurações</h2><h3>Dados e backups</h3>
    <p>O backup inclui todas as finanças, o planejamento e as cotações armazenadas.</p>
    <p>Último backup: {lastBackup ? new Date(lastBackup).toLocaleString('pt-BR') : 'nenhum backup registrado'}</p>
    {!data && <p role="status">Abra o aplicativo Electron para criar e restaurar backups pelos diálogos de arquivos.</p>}
    <div className="toolbar"><button disabled={!data || busy} onClick={()=>run('backup')}>Criar backup</button><button disabled={!data || busy} onClick={()=>run('restore')}>Restaurar backup</button></div>
    <p className="hint">A restauração exige confirmação e substitui os dados atuais. Uma cópia de segurança será guardada antes da troca. Guarde seus backups em um local seguro, de preferência em outro dispositivo.</p>
    {busy && <p role="status">Operação de dados em andamento. Aguarde a conclusão.</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
