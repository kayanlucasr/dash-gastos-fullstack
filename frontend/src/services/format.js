export const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
export function money(value) {
  const text = String(value || '0');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const integer = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(BigInt(whole));
  return (negative ? '-' : '') + integer + ',' + fraction.padEnd(2, '0');
}
export function sumMoney(values) {
  const cents = values.reduce((sum, value) => sum + BigInt(String(value).replace(".", "")), 0n);
  return (cents / 100n).toString() + "." + (cents % 100n).toString().padStart(2, "0");
}
export const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : new Date(value).toLocaleString("pt-BR");
