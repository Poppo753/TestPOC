/**
 * Presentation-only helpers. On-chain quantities must remain bigint until they
 * reach these formatting boundaries; never use Number for transaction inputs.
 */
export function formatCompact(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return new Intl.NumberFormat('en', {
    notation: options.compact === false ? 'standard' : 'compact',
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(number);
}

export function formatAddress(address, size = 5) {
  if (!address || address.length < size * 2 + 2) return address || 'Unavailable';
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

