/** Thousands separated with dots, as written in Argentina: 12345 → "12.345". */
export function formatNumber(v: number): string {
  const sign = v < 0 ? '-' : '';
  const digits = Math.abs(Math.round(v)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatMoney(v: number): string {
  return (v < 0 ? '-$ ' : '$ ') + formatNumber(Math.abs(v));
}

export function settlementType(pop: number): string {
  if (pop < 200) return 'paraje';
  if (pop < 1000) return 'pueblo';
  if (pop < 5000) return 'ciudad';
  if (pop < 25000) return 'gran ciudad';
  return 'metrópolis';
}
