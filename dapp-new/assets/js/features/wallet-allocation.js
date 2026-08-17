/**
 * Reusable interaction for every compact wallet-allocation preview.
 *
 * A list row and its SVG donut segment share one stable asset id. Hover, focus
 * and keyboard interaction therefore always illuminate the same information,
 * without coupling the component to a particular page layout.
 */
const ASSETS = Object.freeze({
  usdc: { value: '$3,900', label: '42% USDC' },
  usdt: { value: '$1,800', label: '20% USDT' },
  btc: { value: '$2,100', label: '23% BTC' },
  eth: { value: '$1,400', label: '15% ETH' },
});

export function initWalletAllocation(root = document) {
  root.querySelectorAll('[data-wallet-allocation]').forEach((preview) => {
    const rows = [...preview.querySelectorAll('[data-wallet-asset]')];
    const slices = [...preview.querySelectorAll('[data-wallet-slice]')];
    const value = preview.querySelector('[data-wallet-chart-value]');
    const label = preview.querySelector('[data-wallet-chart-label]');
    let active = null;

    function render(assetId = null) {
      active = assetId;
      rows.forEach((row) => {
        const selected = row.dataset.walletAsset === assetId;
        row.classList.toggle('is-active', selected);
        row.setAttribute('aria-pressed', String(selected));
      });
      slices.forEach((slice) => slice.classList.toggle('is-active', slice.dataset.walletSlice === assetId));
      if (assetId && ASSETS[assetId]) {
        value.textContent = ASSETS[assetId].value;
        label.textContent = ASSETS[assetId].label;
      } else {
        value.textContent = '$9.2k';
        label.textContent = 'liquid';
      }
    }

    function bind(node, id) {
      node.addEventListener('mouseenter', () => render(id));
      node.addEventListener('focus', () => render(id));
      node.addEventListener('mouseleave', () => { if (!preview.matches(':focus-within')) render(); });
      node.addEventListener('blur', () => window.setTimeout(() => { if (!preview.matches(':focus-within')) render(); }, 0));
      node.addEventListener('click', () => render(active === id ? null : id));
      node.addEventListener('keydown', (event) => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        render(active === id ? null : id);
      });
    }

    rows.forEach((row) => bind(row, row.dataset.walletAsset));
    slices.forEach((slice) => bind(slice, slice.dataset.walletSlice));
  });
}

