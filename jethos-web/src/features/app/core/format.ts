export function formatAddress(address: string | null | undefined, size = 5): string {
  if (!address || address.length < size * 2 + 2) return address || 'Unavailable';
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
