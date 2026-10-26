function cents(value, {
  zero = false,
  aggregate = false
} = {}) {
  if (!['string', 'number'].includes(typeof value)) throw Object.assign(new Error('Valor monetário inválido.'), {
    status: 400
  });
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw Object.assign(new Error('Valor monetário inválido.'), {
    status: 400
  });
  const [whole, fraction = ''] = text.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result < 0n || !zero && result === 0n || result > (aggregate ? 9223372036854775807n : 999999999999n)) throw Object.assign(new Error('Valor fora dos limites permitidos.'), {
    status: 400
  });
  return result;
}
function decimal(value) {
  const n = BigInt(value || 0);
  const abs = n < 0n ? -n : n;
  return (n < 0n ? '-' : '') + (abs / 100n).toString() + '.' + (abs % 100n).toString().padStart(2, '0');
}
function movement(row) {
  if (!row) return row;
  const {
    valor_centavos,
    ...rest
  } = row;
  return {
    ...rest,
    valor: decimal(valor_centavos)
  };
}
module.exports = {
  cents,
  decimal,
  movement
};
