export function shortAddress(address: string, leading = 8, trailing = 7): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`Invalid EVM address: ${address}`);
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

export function formatLongDate(dateTime: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateTime));
}
