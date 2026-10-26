import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import ExpensesChart from "../components/ExpensesChart";
import TransactionForm from "../components/TransactionForm";
import WealthPanel from "../components/WealthPanel";
import PlanningPanel from "../components/PlanningPanel";
import MarketPanel from "../components/MarketPanel";
import DataSettings from "../components/DataSettings";
import { money, sumMoney, today, dateLabel } from "../services/format";
import "../styles/Dashboard.css";
export default function Dashboard() {
  const [area, setArea] = useState("Dashboard"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [filter, setFilter] = useState(""),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [summary, statement, wealth, categories] = await Promise.all([api.get("/dashboard", {
          params: {
            month
          },
          signal: c.signal
        }), api.get("/transactions", {
          params: {
            month
          },
          signal: c.signal
        }), api.get("/finance/wealth", {
          signal: c.signal
        }), api.get("/finance/categories", {
          signal: c.signal
        })]);
        if (!c.signal.aborted) setData({
          summary: summary.data,
          statement: statement.data,
          wealth: wealth.data,
          categories: categories.data
        });
      } catch (err) {
        if (!c.signal.aborted) setError(errorMessage(err, "Não foi possível atualizar. Os valores anteriores podem estar desatualizados."));
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => c.abort();
  }, [month, revision]);
  const reload = message => {
    setFeedback(message);
    setEditing(null);
    setRevision(v => v + 1);
  };
  async function cancel(id) {
    if (pending.current || !window.confirm("Cancelar esta movimentação? O registro será preservado para auditoria.")) return;
    pending.current = true;
    setBusy(true);
    try {
      await api.delete(`/transactions/${id}`);
      reload("Movimentação cancelada.");
    } catch (err) {
      setFeedback(errorMessage(err, "Não foi possível cancelar."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const current = data?.summary;
  const blocked = loading || busy || Boolean(error);
  const totals = type => sumMoney((data?.wealth.accounts || []).filter(a => a.tipo === type).map(a => a.patrimonio));
  const labels = {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferência",
    adjustment: "Ajuste patrimonial"
  };
  return <main className="dashboard-container">
<header className="header">
<h1>💰 Dashboard financeiro</h1>

</header>
<div className="header">
<h2>💻 By Kayan Lucas</h2>
</div>
 <nav className="area-nav" aria-label="Áreas financeiras">{["Dashboard", "Extrato", "Patrimônio", "Mercado", "Planejamento", "Configurações"].map(name => <button key={name} aria-current={area === name ? "page" : undefined} onClick={() => setArea(name)}>{name}</button>)}</nav>
 {!["Mercado", "Planejamento", "Configurações"].includes(area) && <>
<div className="toolbar">
<label>Mês de referência<input type="month" value={month} min="1900-01" max={today().slice(0, 7)} onChange={e => {
            if (e.target.value) {
              setMonth(e.target.value);
              setEditing(null);
            }
          }} />
</label>
<span>Indicadores mensais · saldos transportados entre meses</span>
</div>{loading && <p role="status">Carregando…</p>}{error && <p role="alert">{error}<button onClick={() => setRevision(v => v + 1)}>Tentar novamente</button>
</p>}{feedback && <p role="status">{feedback}</p>}</>}
 {area === "Dashboard" && current && <>
<div className="cards">{[["Receitas do mês", current.receitas, "receitas"], ["Despesas do mês", current.despesas, "despesas"], ["Disponível no fim do período", current.saldo, "saldo"], ["Reserva atual", totals("reserve"), "saldo"], ["Investimento atual", totals("investment"), "saldo"], ["Aportes do mês em investimentos", current.investimentos, "saldo"]].map(([title, value, style]) => <article key={title} className={`card ${style}`}>
<h3>{title}</h3>
<p>{money(value)}</p>
</article>)}</div>
<div className="chart-container">
<h2>Despesas por categoria · {current.month}</h2>
<ExpensesChart categories={current.categories} />
</div>
<section className="comparison">
<h2>Comparação com {current.previous.month}</h2>
<p>Receitas: {money(current.previous.receitas)} → {money(current.receitas)}</p>
<p>Despesas: {money(current.previous.despesas)} → {money(current.despesas)}</p>
<p className="hint">O mês atual pode estar incompleto; o período anterior representa o mês inteiro.</p>
</section>
</>}
 {area === "Extrato" && data && <>
<section className="comparison">
<h2>Resumo · {current.month}</h2>
<p>Saldo inicial {money(current.saldo_inicial)} · Entradas {money(current.receitas)} · Despesas {money(current.despesas)}</p>
<p>Para reserva {money(current.reservas)} · Para investimentos {money(current.investimentos)} · Resgates {money(current.resgates)}</p>
<p>Disponível ao final: {money(current.saldo)}</p>
</section>
 <TransactionForm key={editing?.id || revision} transaction={editing} accounts={data.wealth.accounts} categories={data.categories} disabled={blocked} onSaved={reload} onCancel={() => setEditing(null)} />
 <div className="toolbar">
<h2>Movimentações · {current.month}</h2>
<label>Filtrar por natureza<select value={filter} onChange={e => setFilter(e.target.value)}>
<option value="">Todas</option>{Object.entries(labels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
</label>
</div>
 <div className="transactions">{data.statement.filter(t => !filter || t.tipo === filter).map(t => <article key={t.id} className="transaction-card">
<h3>{t.descricao}</h3>
<p>{money(t.valor)} · {labels[t.tipo]}</p>
<p>{dateLabel(t.data)} · {t.categoria || "Patrimônio"}</p>
<p>{t.origem || "Entrada externa"} → {t.destino || "Saída externa"}</p>{!t.valuation_id && <div className="transaction-actions">
{t.tipo !== "adjustment" && <button className="edit-btn" disabled={blocked} onClick={() => {
              setEditing(t);
              window.scrollTo({
                top: 0,
                behavior: "smooth"
              });
            }}>Editar</button>}
<button className="delete-btn" disabled={blocked} onClick={() => cancel(t.id)}>Cancelar</button>
</div>}</article>)}{!data.statement.some(t => !filter || t.tipo === filter) && <p>Nenhuma movimentação neste período e filtro.</p>}</div>
 <section className="comparison">
<h2>Fechamentos anteriores</h2>{current.closings.length ? <ul className="plain-list">{current.closings.map(c => <li key={c.month}>
<button onClick={() => setMonth(c.month)}>{c.month}</button> · Entradas {money(c.summary.receitas)} · Despesas {money(c.summary.despesas)} · Disponível {money(c.summary.saldo)} · Revisão {c.revision}</li>)}</ul> : <p>Os fechamentos serão gerados quando houver meses anteriores com movimentações.</p>}</section>
</>}
 {area === "Patrimônio" && data && <WealthPanel wealth={data.wealth} disabled={blocked} onSaved={reload} />}
 {area === "Mercado" && <MarketPanel />}
 {area === "Planejamento" && <PlanningPanel />}
 {area === "Configurações" && <DataSettings />}
 {!data && !loading && !error && !["Mercado", "Planejamento", "Configurações"].includes(area) && <p>Nenhum dado disponível.</p>}
 </main>;
}
