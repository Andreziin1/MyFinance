// Aceita valores brasileiros e ponto decimal sem multiplicar o valor por engano.
export function parseAmountCents(input: string): number | null {
  const value = input.trim();
  let normalized: string;
  if (/^\d+(?:,\d{1,2})?$/.test(value)) {
    normalized = value.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(value)) {
    normalized = value;
  } else {
    return null;
  }
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
