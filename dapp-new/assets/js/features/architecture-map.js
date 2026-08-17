/**
 * Interactive architecture map.
 *
 * "Today" and "Product direction" are intentionally separate views so a
 * conceptual multi-chain topology cannot be mistaken for the current PoC.
 * Within the direction view, selecting a risk tier updates every network
 * master and its child vaults while preserving the tier boundary.
 */
const ROUTE_CANDIDATES = Object.freeze({
  arbitrum: {
    usdc: { core: ['Aave V3', 'Compound V3', 'Dolomite'], expanded: ['Pendle PT-USDC', 'Camelot Stable LP'], opportunity: ['GMX GLV', 'Pendle YT-USDC', 'GMX GM Pool'] },
    eth: { core: ['Aave V3', 'Compound V3', 'Dolomite'], expanded: ['Pendle PT-ETH', 'Lido wstETH route'], opportunity: ['GMX ETH Pool', 'Pendle YT-ETH', 'Camelot ETH LP'] },
    btc: { core: ['Aave V3', 'Dolomite', 'Compound V3'], expanded: ['Pendle PT-BTC', 'Camelot BTC LP'], opportunity: ['GMX BTC Pool', 'Pendle YT-BTC', 'GMX GLV'] },
  },
  base: {
    usdc: { core: ['Aave V3', 'Morpho', 'Moonwell'], expanded: ['Aerodrome Stable LP', 'Seamless'], opportunity: ['Extra Finance', 'Aerodrome Volatile LP', 'Moonwell Loop'] },
    eth: { core: ['Aave V3', 'Morpho', 'Moonwell'], expanded: ['Aerodrome WETH LP', 'Seamless Loop'], opportunity: ['Extra Finance', 'Aerodrome Concentrated LP', 'Leveraged Loop'] },
    btc: { core: ['Aave V3', 'Morpho cbBTC', 'Moonwell'], expanded: ['Aerodrome cbBTC LP', 'Seamless'], opportunity: ['Extra Finance', 'Aerodrome Volatile LP', 'Leveraged cbBTC Loop'] },
  },
  ethereum: {
    usdc: { core: ['Aave V3', 'Euler V2', 'Morpho'], expanded: ['Curve Stable Pool', 'Convex'], opportunity: ['Pendle YT-USDe', 'Gearbox', 'Curve Concentrated Route'] },
    eth: { core: ['Aave V3', 'Euler V2', 'Morpho'], expanded: ['Lido stETH', 'Ether.fi eETH'], opportunity: ['Pendle YT-weETH', 'Gearbox', 'Restaking Route'] },
    btc: { core: ['Aave V3', 'Morpho', 'Euler V2'], expanded: ['Curve BTC Pool', 'Convex'], opportunity: ['Pendle BTC Route', 'Gearbox', 'Concentrated BTC LP'] },
  },
});

const RISK_ACCENTS = Object.freeze({
  conservative: '#67e8f9',
  balanced: '#a78bfa',
  opportunity: '#fbbf24',
});

function candidatesFor(chain, asset, risk) {
  const catalog = ROUTE_CANDIDATES[chain]?.[asset];
  if (!catalog) return [];
  if (risk === 'conservative') return catalog.core.map((name) => ({ name, tier: 'Conservative', detail: 'Conservative route candidate' }));
  if (risk === 'balanced') {
    return [
      ...catalog.core.slice(0, 3).map((name) => ({ name, tier: 'Conservative', detail: 'Conservative route available to this vault' })),
      ...catalog.expanded.map((name) => ({ name, tier: 'Balanced', detail: 'Additional balanced route candidate' })),
    ];
  }
  return [
    ...catalog.core.slice(0, 2).map((name) => ({ name, tier: 'Conservative', detail: 'Conservative route available to this vault' })),
    ...catalog.expanded.slice(0, 2).map((name) => ({ name, tier: 'Balanced', detail: 'Balanced route available to this vault' })),
    ...catalog.opportunity.map((name) => ({ name, tier: 'Opportunity', detail: 'Additional opportunity route candidate' })),
  ];
}

function colorForTier(tier) {
  return tier === 'Conservative'
    ? RISK_ACCENTS.conservative
    : tier === 'Balanced'
      ? RISK_ACCENTS.balanced
      : RISK_ACCENTS.opportunity;
}

document.querySelectorAll('[data-architecture-map]').forEach((section) => {
  const modeControls = [...section.querySelectorAll('[data-architecture-mode]')];
  const modePanels = [...section.querySelectorAll('[data-architecture-panel]')];
  const direction = section.querySelector('.architecture-direction');
  const riskControls = [...section.querySelectorAll('[data-architecture-risk]')];
  const chains = [...section.querySelectorAll('[data-architecture-chain]')];
  const assetPopover = section.querySelector('[data-architecture-asset-popover]');
  const assetPopoverList = assetPopover?.querySelector('[data-asset-popover-list]');
  const assetButtons = [...section.querySelectorAll('[data-architecture-asset]')];
  let selectedRisk = 'balanced';
  let activeAssetButton = null;
  let popoverPinned = false;
  let popoverOpenTimer = 0;
  let popoverCloseTimer = 0;

  if (assetPopover) document.body.append(assetPopover);

  const clearPopoverTimers = () => {
    window.clearTimeout(popoverOpenTimer);
    window.clearTimeout(popoverCloseTimer);
  };

  function positionAssetPopover() {
    if (!assetPopover || assetPopover.hidden || !activeAssetButton) return;
    const anchor = activeAssetButton.getBoundingClientRect();
    const width = assetPopover.offsetWidth;
    const height = assetPopover.offsetHeight;
    const margin = 12;
    const viewportPadding = 12;
    const left = Math.min(
      window.innerWidth - width - viewportPadding,
      Math.max(viewportPadding, anchor.left + anchor.width / 2 - width / 2),
    );
    const preferredTop = anchor.top - height - margin;
    const below = preferredTop < 84;
    const top = below ? anchor.bottom + margin : preferredTop;
    const arrowLeft = Math.min(width - 22, Math.max(22, anchor.left + anchor.width / 2 - left));

    assetPopover.style.left = `${left}px`;
    assetPopover.style.top = `${Math.max(viewportPadding, top)}px`;
    assetPopover.style.setProperty('--popover-arrow-left', `${arrowLeft}px`);
    assetPopover.classList.toggle('is-below', below);
  }

  function closeAssetPopover({ restoreFocus = false } = {}) {
    clearPopoverTimers();
    if (!assetPopover) return;
    assetPopover.hidden = true;
    activeAssetButton?.classList.remove('is-active');
    if (restoreFocus) activeAssetButton?.focus();
    activeAssetButton = null;
    popoverPinned = false;
  }

  function showAssetPopover(button, { pinned = false } = {}) {
    if (!assetPopover || !assetPopoverList) return;
    clearPopoverTimers();
    activeAssetButton?.classList.remove('is-active');
    activeAssetButton = button;
    popoverPinned = pinned;
    button.classList.add('is-active');

    const chainId = button.closest('[data-architecture-chain]')?.dataset.architectureChain;
    const assetId = button.dataset.architectureAsset;
    const chainLabel = chainId === 'ethereum' ? 'Ethereum' : chainId.charAt(0).toUpperCase() + chainId.slice(1);
    const assetLabel = assetId.toUpperCase();
    const riskLabel = selectedRisk.charAt(0).toUpperCase() + selectedRisk.slice(1);
    const candidates = candidatesFor(chainId, assetId, selectedRisk);

    const title = assetPopover.querySelector('[data-asset-popover-title]');
    const copy = assetPopover.querySelector('[data-asset-popover-copy]');
    if (title) title.textContent = `${chainLabel} · ${riskLabel} ${assetLabel} Vault`;
    if (copy) copy.textContent = selectedRisk === 'conservative'
      ? 'Illustrative conservative routes for a lower-complexity vault.'
      : `This ${riskLabel.toLowerCase()} vault can use validated routes from lower risk tiers and add ${selectedRisk === 'balanced' ? 'balanced strategies' : 'opportunity strategies'}.`;

    const nodes = candidates.map((candidate) => {
      const row = document.createElement('div');
      row.className = 'architecture-route-candidate';
      const dot = document.createElement('i');
      dot.style.setProperty('--candidate-color', colorForTier(candidate.tier));
      const content = document.createElement('div');
      const name = document.createElement('strong');
      const detail = document.createElement('small');
      name.textContent = candidate.name;
      detail.textContent = candidate.detail;
      content.append(name, detail);
      const tier = document.createElement('em');
      tier.style.setProperty('--candidate-color', colorForTier(candidate.tier));
      tier.textContent = candidate.tier;
      row.append(dot, content, tier);
      return row;
    });
    assetPopoverList.replaceChildren(...nodes);
    assetPopover.style.setProperty('--popover-accent', RISK_ACCENTS[selectedRisk]);
    assetPopover.querySelector('[data-asset-popover-close]')?.toggleAttribute('hidden', !pinned);
    assetPopover.hidden = false;
    window.requestAnimationFrame(positionAssetPopover);
  }

  function selectMode(mode) {
    closeAssetPopover();
    modeControls.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.architectureMode === mode)));
    modePanels.forEach((panel) => {
      panel.hidden = panel.dataset.architecturePanel !== mode;
    });
  }

  function selectRisk(risk) {
    if (!direction) return;
    const label = risk.charAt(0).toUpperCase() + risk.slice(1);
    selectedRisk = risk;
    direction.dataset.risk = risk;
    riskControls.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.architectureRisk === risk)));
    section.querySelectorAll('[data-master-tier]').forEach((target) => { target.textContent = label; });
    section.querySelectorAll('[data-master-name]').forEach((target) => { target.textContent = `${label} Master Vault`; });
    section.querySelectorAll('[data-child-tier]').forEach((target) => { target.textContent = `${label} Vault`; });
    if (activeAssetButton && assetPopover && !assetPopover.hidden) showAssetPopover(activeAssetButton, { pinned: popoverPinned });
  }

  function expandChain(selectedChain) {
    closeAssetPopover();
    chains.forEach((chain) => {
      const expanded = chain === selectedChain;
      chain.classList.toggle('is-expanded', expanded);
      chain.querySelector('.architecture-chain__header')?.setAttribute('aria-expanded', String(expanded));
    });
  }

  modeControls.forEach((control) => control.addEventListener('click', () => selectMode(control.dataset.architectureMode)));
  riskControls.forEach((control) => control.addEventListener('click', () => selectRisk(control.dataset.architectureRisk)));
  chains.forEach((chain) => {
    chain.querySelector('.architecture-chain__header')?.addEventListener('click', () => expandChain(chain));
  });
  assetButtons.forEach((button) => {
    button.addEventListener('mouseenter', () => {
      clearPopoverTimers();
      popoverOpenTimer = window.setTimeout(() => showAssetPopover(button), 220);
    });
    button.addEventListener('mouseleave', () => {
      window.clearTimeout(popoverOpenTimer);
      if (!popoverPinned) popoverCloseTimer = window.setTimeout(() => closeAssetPopover(), 140);
    });
    button.addEventListener('focus', () => showAssetPopover(button));
    button.addEventListener('blur', () => {
      if (!popoverPinned) popoverCloseTimer = window.setTimeout(() => closeAssetPopover(), 140);
    });
    button.addEventListener('click', () => showAssetPopover(button, { pinned: true }));
  });
  assetPopover?.addEventListener('mouseenter', () => window.clearTimeout(popoverCloseTimer));
  assetPopover?.addEventListener('mouseleave', () => {
    if (!popoverPinned) popoverCloseTimer = window.setTimeout(() => closeAssetPopover(), 140);
  });
  assetPopover?.querySelector('[data-asset-popover-close]')?.addEventListener('click', () => closeAssetPopover({ restoreFocus: true }));
  document.addEventListener('click', (event) => {
    if (!assetPopover || assetPopover.hidden) return;
    if (assetPopover.contains(event.target)) return;
    if (event.target.closest('[data-architecture-asset], [data-architecture-risk], [data-architecture-mode]')) return;
    closeAssetPopover();
  });
  window.addEventListener('scroll', () => {
    if (popoverPinned) positionAssetPopover();
    else closeAssetPopover();
  }, { passive: true });
  window.addEventListener('resize', positionAssetPopover, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && assetPopover && !assetPopover.hidden) closeAssetPopover({ restoreFocus: true });
  });

  selectMode('direction');
  selectRisk('balanced');
  if (chains[0]) expandChain(chains[0]);
});
