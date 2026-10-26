import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
import HistoryChart from "./HistoryChart";
export default function MarketPanel() {
  const [code, setCode] = useState("USD"),
    [days, setDays] = useState("30"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const r = await api.get("/market", {
          params: {
            code,
            days
          },
          signal: c.signal
        });
        if (!c.signal.aborted) setData(r.data);
      } catch (err) {
        if (!c.signal.aborted) setError(errorMessage(err, "Mercado indisponível."));
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [code, days, revision]);
  const current = data?.indicators.find(i => i.code === code);
  return <section>
<h2>Mercado financeiro</h2>
<p className="hint">Referências de mercado. A coleta é diária; a data abaixo corresponde à cotação do provedor.</p>
 <div className="toolbar">
<label>Indicador<select value={code} onChange={e => setCode(e.target.value)}>{[{
            code: "USD",
            nome: "Dólar · BRL/USD"
          }, {
            code: "EUR",
            nome: "Euro · BRL/EUR"
          }, {
            code: "BTC",
            nome: "Bitcoin · BRL/BTC"
          }, {
            code: "IBOV",
            nome: "Ibovespa · pontos"
          }, {
            code: "GOLD",
            nome: "Ouro · USD/onça troy"
          }].map(i => <option key={i.code} value={i.code}>{i.nome}</option>)}</select>
</label>
<label>Período<select value={days} onChange={e => setDays(e.target.value)}>
<option value="7">7 dias</option>
<option value="30">30 dias</option>
<option value="180">6 meses</option>
<option value="365">1 ano</option>
</select>
</label>
<button onClick={() => setRevision(v => v + 1)}>Consultar cache</button>
</div>
 {error && <p role="alert">{error}</p>}{loading && <p role="status">Consultando mercado…</p>}
 {current && <article className="card saldo">
<h3>{current.nome} · {current.currency} por {current.unit}</h3>
<p>{current.price ? Number(current.price).toLocaleString("pt-BR", {
          maximumFractionDigits: 4
        }) : "Indisponível"}</p>
<span>Variação do provedor: {current.change_percent !== null ? Number(current.change_percent).toLocaleString("pt-BR", {
          maximumFractionDigits: 2
        }) + "%" : "indisponível"}</span>
<p className="market-meta">Cotação: {current.quoted_at ? new Date(current.quoted_at).toLocaleString("pt-BR") : "aguardando dados"}<br />Coleta: {current.fetched_at ? new Date(current.fetched_at).toLocaleString("pt-BR") : "pendente"}<br />Fonte: {current.provider}</p>{current.error && <p role="alert">{current.error} {current.price && "Exibindo último dado válido."}</p>}{current.stale && <p role="status">Cotação com mais de 24 horas; pode corresponder ao último pregão.</p>}</article>}
 {data && data.code === code && !loading && <div className="chart-container">
<HistoryChart labels={data.history.map(q => new Date(q.quoted_at).toLocaleDateString("pt-BR"))} values={data.history.map(q => Number(q.price))} label={`${current?.nome} (${current?.currency})`} />
</div>}
 <p className="hint">O histórico mostra somente observações disponíveis. Períodos incompletos não são preenchidos artificialmente. Ouro acumula histórico a partir da ativação; os demais dependem do histórico liberado pelo plano.</p>
<p className="hint">
<a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko</a>
</p>
</section>;
}
