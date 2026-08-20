import type { DisposableController } from '../../../core/disposable';

export const walletAssets = {
  usdc: { value: '$3,900', label: '42% USDC' },
  usdt: { value: '$1,800', label: '20% USDT' },
  btc: { value: '$2,100', label: '23% BTC' },
  eth: { value: '$1,400', label: '15% ETH' },
} as const;

type AssetId = keyof typeof walletAssets;
type AssetControl = HTMLElement | SVGElement;

const isAssetId = (value: string | undefined): value is AssetId =>
  Boolean(value && Object.hasOwn(walletAssets, value));

export function mountWalletAllocation(preview: HTMLElement): DisposableController {
  const rows = [...preview.querySelectorAll<HTMLButtonElement>('[data-wallet-asset]')];
  const slices = [...preview.querySelectorAll<SVGElement>('[data-wallet-slice]')];
  const value = preview.querySelector<SVGTextElement>('[data-wallet-chart-value]');
  const label = preview.querySelector<SVGTextElement>('[data-wallet-chart-label]');
  const events = new AbortController();
  const timers = new Set<number>();
  let selected: AssetId | null = null;

  if (!value || !label || rows.length === 0 || slices.length === 0) {
    throw new Error('Wallet allocation markup is incomplete.');
  }

  const render = (assetId: AssetId | null = selected) => {
    for (const row of rows) {
      row.classList.toggle('is-active', row.dataset.walletAsset === assetId);
      row.setAttribute('aria-pressed', String(row.dataset.walletAsset === selected));
    }
    for (const slice of slices) {
      slice.classList.toggle('is-active', slice.dataset.walletSlice === assetId);
    }
    value.textContent = assetId ? walletAssets[assetId].value : '$9.2k';
    label.textContent = assetId ? walletAssets[assetId].label : 'liquid';
  };
  const bind = (node: AssetControl, id: AssetId) => {
    node.addEventListener('mouseenter', () => render(id), { signal: events.signal });
    node.addEventListener('focus', () => render(id), { signal: events.signal });
    node.addEventListener(
      'mouseleave',
      () => !preview.matches(':focus-within') && render(selected),
      { signal: events.signal },
    );
    node.addEventListener(
      'blur',
      () => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (!preview.matches(':focus-within')) render(selected);
        });
        timers.add(timer);
      },
      { signal: events.signal },
    );
    node.addEventListener(
      'click',
      () => {
        selected = selected === id ? null : id;
        render(selected);
      },
      { signal: events.signal },
    );
    node.addEventListener(
      'keydown',
      (event) => {
        if (
          node instanceof HTMLButtonElement ||
          !(event instanceof KeyboardEvent) ||
          !['Enter', ' '].includes(event.key)
        )
          return;
        event.preventDefault();
        selected = selected === id ? null : id;
        render(selected);
      },
      { signal: events.signal },
    );
  };

  for (const row of rows)
    if (isAssetId(row.dataset.walletAsset)) bind(row, row.dataset.walletAsset);
  for (const slice of slices)
    if (isAssetId(slice.dataset.walletSlice)) bind(slice, slice.dataset.walletSlice);

  return {
    destroy() {
      events.abort();
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      selected = null;
      render(selected);
    },
  };
}
