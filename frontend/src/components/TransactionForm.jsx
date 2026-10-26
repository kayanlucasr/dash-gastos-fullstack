import { useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { today } from "../services/format";
export default function TransactionForm({
  transaction,
  accounts,
  categories,
  onSaved,
  onCancel,
  disabled
}) {
  const initial = transaction || {};
  const [form, setForm] = useState({
    descricao: initial.descricao || "",
    valor: initial.valor || "",
    tipo: initial.tipo || "expense",
    data: initial.data || today(),
    category_id: initial.category_id || categories[0]?.id || 7,
    source_account_id: initial.source_account_id || accounts.find(a => a.tipo === "available")?.id || "",
    destination_account_id: initial.destination_account_id || accounts.find(a => a.tipo === "available")?.id || accounts[0]?.id || ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const set = (key, value) => setForm(old => ({
    ...old,
    [key]: value
  }));
  async function submit(e) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        category_id: ["income", "expense"].includes(form.tipo) ? Number(form.category_id) : null,
        source_account_id: form.tipo === "income" ? null : Number(form.source_account_id),
        destination_account_id: form.tipo === "expense" ? null : Number(form.destination_account_id)
      };
      if (transaction) await api.put(`/transactions/${transaction.id}`, payload);else await api.post("/transactions", payload);
      onSaved("Movimentação salva com sucesso.");
    } catch (err) {
      setError(errorMessage(err, "Não foi possível salvar."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <section className="form-container">
<h2>{transaction ? "Editar movimentação" : "Nova movimentação"}</h2>
 {error && <p role="alert">{error}</p>}<form onSubmit={submit}>
<fieldset disabled={busy || disabled}>
 <label>Descrição<input required maxLength={255} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
</label>
 <label>Valor (R$)<input type="number" min="0.01" max="9999999999.99" step="0.01" required value={form.valor} onChange={e => set("valor", e.target.value)} />
</label>
 <label>Natureza<select value={form.tipo} onChange={e => {
        const tipo = e.target.value;
        setForm(old => ({ ...old, tipo, destination_account_id: accounts.find(a => tipo === "transfer" ? a.tipo !== "available" : a.tipo === "available")?.id || accounts[0]?.id || "" }));
      }}>
<option value="expense">Despesa de consumo</option>
<option value="income">Receita</option>
<option value="transfer">Transferência / aporte / resgate</option>
</select>
</label>
 <label>Data efetiva<input type="date" required max={today()} min="1900-01-01" value={form.data} onChange={e => set("data", e.target.value)} />
</label>
 {["income", "expense"].includes(form.tipo) && <label>Categoria<select value={form.category_id} onChange={e => set("category_id", e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
</label>}
 {form.tipo !== "income" && <label>Conta de origem<select required value={form.source_account_id} onChange={e => set("source_account_id", e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
</label>}
 {form.tipo !== "expense" && <label>Conta de destino<select required value={form.destination_account_id} onChange={e => set("destination_account_id", e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
</label>}
 <button type="submit">{busy ? "Salvando…" : transaction ? "Atualizar" : "Salvar"}</button>{transaction && <button type="button" onClick={onCancel}>Cancelar edição</button>}
 </fieldset>
</form>
<p className="hint">Aportes e resgates são transferências entre suas contas. Eles não geram receita ou despesa de consumo.</p>
</section>;
}
