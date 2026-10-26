const validId = (value) => ["string", "number"].includes(typeof value) && /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value));

function validateTransaction(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Informe os dados da transação.";
  const { descricao, valor, tipo, category_id } = body;
  if (typeof descricao !== "string" || !descricao.trim() || descricao.trim().length > 255) {
    return "Descrição obrigatória, com até 255 caracteres.";
  }
  const amount = typeof valor === "number" || typeof valor === "string" ? String(valor) : "";
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 9999999999.99) {
    return "Informe um valor positivo, com até duas casas decimais (máximo 9999999999.99).";
  }
  if (!["income", "expense"].includes(tipo)) return "Tipo deve ser income ou expense.";
  if (!validId(category_id)) return "Categoria inválida.";
  return null;
}

module.exports = { validId, validateTransaction };
