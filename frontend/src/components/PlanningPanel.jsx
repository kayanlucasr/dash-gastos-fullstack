import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { money, dateLabel } from "../services/format";
const blank = () => ({name:"",planned_date:"",amount:""});
export default function PlanningPanel() {
  const [data,setData] = useState(null);
  const [form,setForm] = useState(blank);
  const [editing,setEditing] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [feedback,setFeedback] = useState("");
  const [revision,setRevision] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    api.get("/planning",{signal:controller.signal}).then(response => {
      if (!controller.signal.aborted) {setData(response.data);setError("");}
    }).catch(err => {
      if (!controller.signal.aborted) setError(errorMessage(err,"Não foi possível carregar o planejamento."));
    }).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  },[revision]);
  const set = (key,value) => setForm(old => ({...old,[key]:value}));
  const reset = () => {setEditing(null);setForm(blank());};
  async function save(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current=true;setBusy(true);setError("");setFeedback("");
    try {
      const response = editing ? await api.put(`/planning/${editing}`,form) : await api.post("/planning",form);
      setData(response.data);reset();setFeedback("Conta salva no planejamento.");
    } catch(err) {setError(errorMessage(err,"Não foi possível salvar a conta."));}
    finally {pending.current=false;setBusy(false);}
  }
  async function remove(item) {
    if (pending.current || !window.confirm(`Excluir "${item.name}" do planejamento?`)) return;
    pending.current=true;setBusy(true);setError("");setFeedback("");
    try {
      const response=await api.delete(`/planning/${item.id}`);
      setData(response.data);if (editing===item.id) reset();setFeedback("Conta excluída do planejamento.");
    } catch(err) {setError(errorMessage(err,"Não foi possível excluir a conta."));}
    finally {pending.current=false;setBusy(false);}
  }
  return <section aria-label="Planejamento financeiro">
    <h2>Planejamento</h2>
    {loading && <p role="status">Carregando planejamento…</p>}
    {error && <p role="alert">{error}{!data && <button disabled={loading} onClick={() => {setLoading(true);setRevision(v=>v+1);}}>Tentar novamente</button>}</p>}
    {feedback && <p role="status">{feedback}</p>}
    {data && <article className="card saldo" aria-label="Resumo do planejamento"><h3>Total planejado</h3><p>{money(data.total)}</p><span>{data.count} {data.count===1 ? "conta cadastrada" : "contas cadastradas"}</span></article>}
    <section className="form-container">
      <h2>{editing ? "Editar conta planejada" : "Nova conta planejada"}</h2>
      <form onSubmit={save}><fieldset disabled={loading || busy || !data}>
        <label>Nome da conta<input name="name" required maxLength={255} value={form.name} onChange={e=>set("name",e.target.value)} /></label>
        <label>Data<input name="planned_date" type="date" min="0001-01-01" max="9999-12-31" required value={form.planned_date} onChange={e=>set("planned_date",e.target.value)} /></label>
        <label>Valor (R$)<input name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" required value={form.amount} onChange={e=>set("amount",e.target.value)} /></label>
        <button type="submit">{busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar conta"}</button>
        {editing && <button type="button" onClick={reset}>Cancelar edição</button>}
      </fieldset></form>
    </section>
    <div className="transactions">{data?.items.map(item=><article key={item.id} className="transaction-card">
      <h3 title={item.name}>{item.name}</h3><p>{dateLabel(item.planned_date)}</p><p>{money(item.amount)}</p>
      <div className="transaction-actions"><button className="edit-btn" disabled={busy} onClick={()=>{setEditing(item.id);setForm({name:item.name,planned_date:item.planned_date,amount:item.amount});setError("");setFeedback("");}}>Editar</button><button className="delete-btn" disabled={busy} onClick={()=>remove(item)}>Excluir</button></div>
    </article>)}{data?.count===0 && <p>Nenhuma conta cadastrada no planejamento.</p>}</div>
  </section>;
}
