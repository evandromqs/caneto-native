const MAX_CENT_DIGITS = 11;

/** O teclado guarda centavos; cada novo dígito desloca o valor uma casa. */
export function applyPriceKey(current: string, key: string): string {
  const digits = current.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (key === '⌫') return digits.slice(0, -1);
  if (key === 'C') return '';
  if (key !== '00' && !/^\d$/.test(key)) return digits;
  return `${digits}${key}`.replace(/^0+(?=\d)/, '').slice(0, MAX_CENT_DIGITS);
}

export function formatPriceEntry(rawDigits: string): string {
  const cents = Number(rawDigits.replace(/\D/g, '')) || 0;
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte o preço salvo no produto para os dígitos do teclado de centavos. */
export function priceToDigits(price: string): string {
  const amount = Number(price.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? String(Math.round(amount * 100)) : '';
}

export function finalizePriceEntry(rawDigits: string): string {
  const cents = Number(rawDigits.replace(/\D/g, '')) || 0;
  if (cents <= 0) return '';
  const reais = Math.floor(cents / 100);
  return `${reais},${String(cents % 100).padStart(2, '0')}`;
}

/** EAN checksum validation para EAN-8 e EAN-13. */
export function validEan(value: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}
