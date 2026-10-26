import { useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { money, today, dateLabel } from "../services/format";
import HistoryChart from "./HistoryChart";
export default function WealthPanel({
  wealth,
  onSaved,
  disabled
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(e, path) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    try {
      await api.post(path, Object.fromEntries(new FormData(form)));
      form.reset();
      onSaved("Patrimônio atualizado.");
    } catch (err) {
      setError(errorMessage(err, "Não foi possível salvar."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <section>
<h2>Patrimônio</h2>
<p className="hint">Use o Extrato para registrar aportes e resgates. Avaliações registram o valor de mercado ao final da data escolhida, separado dos aportes.</p>{error && <p role="alert">{error}</p>}
 <div className="cards">{wealth.accounts.map(a => <article className="card saldo" key={a.id}>
<h3>{a.nome} · {{
            available: "Disponível",
            reserve: "Reserva",
            investment: "Investimento"
          }[a.tipo]}</h3>
<p>{money(a.patrimonio)}</p>{a.tipo !== "available" && <span>Aportes líquidos: {money(a.aportes_liquidos)}</span>}
</article>)}</div>
 <div className="form-container">
<h3>Criar conta</h3>
<form onSubmit={e => submit(e, "/finance/accounts")}>
<fieldset disabled={busy || disabled}>
<label>Nome<input name="nome" required maxLength={100} />
</label>
<label>Finalidade<select name="tipo">
<option value="reserve">Reserva</option>
<option value="investment">Investimento</option>
<option value="available">Disponível</option>
</select>
</label>
<button type="submit">Criar conta</button>
</fieldset>
</form>
</div>
 <div className="form-container">
<h3>Registrar saldo inicial ou ajuste</h3>
<p className="hint">Use para dinheiro que já existia antes do seu histórico. Esse ajuste aumenta o patrimônio e não conta como receita.</p>
<form onSubmit={e => submit(e, "/transactions")}><fieldset disabled={busy || disabled}>
<input type="hidden" name="tipo" value="adjustment"/>
<input type="hidden" name="descricao" value="Saldo inicial / ajuste patrimonial"/>
<label>Conta<select required name="destination_account_id">{wealth.accounts.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
<label>Valor inicial (R$)<input name="valor" type="number" min="0.01" step="0.01" max="9999999999.99" required/></label>
<label>Data inicial<input name="data" type="date" required defaultValue={today()} max={today()} min="1900-01-01"/></label>
<button type="submit">Registrar ajuste</button>
</fieldset></form>
</div>
<div className="form-container">
<h3>Registrar avaliação de investimento</h3>
<form onSubmit={e => submit(e, "/finance/valuations")}>
<fieldset disabled={busy || disabled || !wealth.accounts.some(a => a.tipo === "investment")}>
<label>Investimento<select name="account_id" required>{wealth.accounts.filter(a => a.tipo === "investment").map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
</label>
<label>Valor total observado (R$)<input name="valor" type="number" min="0" step="0.01" max="9999999999.99" required />
</label>
<label>Data da avaliação<input name="data" type="date" required defaultValue={today()} max={today()} min="1900-01-01" />
</label>
<button type="submit">Salvar avaliação</button>
</fieldset>
</form>
</div>
 <div className="chart-container">
<h3>Evolução patrimonial · fim de mês</h3>
<HistoryChart labels={wealth.evolution.map(x => x.month)} values={wealth.evolution.map(x => Number(x.total))} label="Patrimônio (R$)" />
</div>
 <h3>Avaliações registradas</h3>{wealth.valuations.length ? <ul className="plain-list">{wealth.valuations.map(v => <li key={v.id}>{dateLabel(v.data)} · {wealth.accounts.find(a => a.id === v.account_id)?.nome} · {money(v.valor)}</li>)}</ul> : <p>Nenhuma avaliação registrada.</p>}
 </section>;
}
