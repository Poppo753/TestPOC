import type { DisposableController } from '../../../core/disposable';
import { positionSidePopover } from '../../../core/floating-popover';
import {
  baseVaults,
  chainLabels,
  isVaultChain,
  isVaultKey,
  isVaultMode,
  isVaultToken,
  modeCopy,
  scenarioAdjustment,
  tokenLabels,
  type VaultChain,
  type VaultKey,
  type VaultMode,
  type VaultToken,
} from './vault-model';
import { renderVaultPopover } from './vault-view';

export function mountVaultExplorer(journey: HTMLElement): DisposableController {
  const modeTabs = [...journey.querySelectorAll<HTMLButtonElement>('[data-vault-mode]')];
  const chainButtons = [...journey.querySelectorAll<HTMLButtonElement>('[data-chain]')];
  const tokenButtons = [...journey.querySelectorAll<HTMLButtonElement>('[data-token]')];
  const vaultRows = [...journey.querySelectorAll<HTMLButtonElement>('[data-vault-option]')];
  const chainFilter = journey.querySelector<HTMLElement>('[data-chain-filter]');
  const tokenFilter = journey.querySelector<HTMLElement>('[data-token-filter]');
  const copyTarget = journey.querySelector<HTMLElement>('[data-vault-mode-copy]');
  const popover = journey.querySelector<HTMLElement>('[data-vault-popover]');
  const title = popover?.querySelector<HTMLElement>('[data-vault-popover-title]');
  const summary = popover?.querySelector<HTMLElement>('[data-vault-popover-summary]');
  const allocations = popover?.querySelector<HTMLElement>('[data-vault-popover-allocations]');
  const slices = popover?.querySelector<SVGElement>('[data-vault-popover-slices]');
  const chartValue = popover?.querySelector<SVGTextElement>('[data-vault-chart-value]');
  const chartLabel = popover?.querySelector<SVGTextElement>('[data-vault-chart-label]');
  const closeButton = popover?.querySelector<HTMLButtonElement>('[data-vault-popover-close]');
  const events = new AbortController();
  let popoverEvents = new AbortController();
  let selectedMode: VaultMode = 'base';
  let selectedChain: VaultChain = 'plasma';
  let selectedToken: VaultToken = 'usdc';
  let selectedVaultKey: VaultKey | null = null;
  let popoverPinned = false;
  let hoverTimer: number | undefined;

  if (
    !chainFilter ||
    !tokenFilter ||
    !copyTarget ||
    !popover ||
    !title ||
    !summary ||
    !allocations ||
    !slices ||
    !chartValue ||
    !chartLabel
  ) {
    throw new Error('Ownership vault explorer markup is incomplete.');
  }

  const activeRow = () =>
    selectedVaultKey
      ? journey.querySelector<HTMLButtonElement>(`[data-vault-option="${selectedVaultKey}"]`)
      : null;
  const position = () => {
    const row = activeRow();
    if (row && !popover.hidden) positionSidePopover(popover, row);
  };
  const close = (restoreFocus = false) => {
    if (hoverTimer !== undefined) window.clearTimeout(hoverTimer);
    hoverTimer = undefined;
    const row = activeRow();
    selectedVaultKey = null;
    popoverPinned = false;
    popover.hidden = true;
    for (const candidate of vaultRows) candidate.classList.remove('is-active');
    if (restoreFocus) row?.focus();
  };
  const show = () => {
    if (!selectedVaultKey) return;
    const vault = baseVaults.find((candidate) => candidate.key === selectedVaultKey);
    if (!vault) return;
    popoverEvents.abort();
    popoverEvents = new AbortController();
    renderVaultPopover(
      { popover, title, summary, allocations, slices, chartValue, chartLabel },
      vault,
      selectedMode,
      selectedChain,
      selectedToken,
      popoverEvents.signal,
    );
    if (!popover.classList.contains('is-portal')) {
      popover.classList.add('is-portal');
      document.body.append(popover);
    }
    popover.hidden = false;
    position();
    for (const row of vaultRows) {
      row.classList.toggle('is-active', row.dataset.vaultOption === selectedVaultKey);
    }
  };
  const renderExperience = () => {
    for (const tab of modeTabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.vaultMode === selectedMode));
      tab.tabIndex = tab.dataset.vaultMode === selectedMode ? 0 : -1;
    }
    chainFilter.hidden = selectedMode === 'base';
    tokenFilter.hidden = selectedMode !== 'advanced';
    copyTarget.textContent = modeCopy[selectedMode];
    for (const control of chainButtons) {
      control.setAttribute('aria-pressed', String(control.dataset.chain === selectedChain));
    }
    for (const control of tokenButtons) {
      control.setAttribute('aria-pressed', String(control.dataset.token === selectedToken));
    }
    const adjustment = scenarioAdjustment(selectedMode, selectedChain, selectedToken);
    const context =
      selectedMode === 'base'
        ? 'Managed route'
        : `${chainLabels[selectedChain]}${selectedMode === 'advanced' ? ` · ${tokenLabels[selectedToken]}` : ''}`;
    baseVaults.forEach((vault, index) => {
      const row = vaultRows.find((candidate) => candidate.dataset.vaultOption === vault.key);
      if (!row) return;
      const name = row.querySelector<HTMLElement>('[data-vault-name]');
      const detail = row.querySelector<HTMLElement>('[data-vault-detail]');
      const apy = row.querySelector<HTMLElement>('[data-vault-apy]');
      if (name)
        name.textContent = selectedMode === 'base' ? vault.name : `${context} ${vault.name}`;
      if (detail) {
        detail.textContent =
          selectedMode === 'base'
            ? vault.detail
            : `${vault.detail} · ${chainLabels[selectedChain]}${selectedMode === 'advanced' ? ` · ${tokenLabels[selectedToken]}` : ''}`;
      }
      if (apy) {
        apy.textContent = `${(vault.apy + adjustment + index * (selectedMode === 'advanced' ? 0.25 : 0)).toFixed(1)}%`;
      }
    });
    show();
  };

  modeTabs.forEach((tab, index) => {
    tab.addEventListener(
      'click',
      () => {
        if (!isVaultMode(tab.dataset.vaultMode)) return;
        selectedMode = tab.dataset.vaultMode;
        renderExperience();
      },
      { signal: events.signal },
    );
    tab.addEventListener(
      'keydown',
      (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? modeTabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + modeTabs.length) % modeTabs.length;
        modeTabs[nextIndex]?.focus();
        modeTabs[nextIndex]?.click();
      },
      { signal: events.signal },
    );
  });
  for (const control of chainButtons) {
    control.addEventListener(
      'click',
      () => {
        if (!isVaultChain(control.dataset.chain)) return;
        selectedChain = control.dataset.chain;
        renderExperience();
      },
      { signal: events.signal },
    );
  }
  for (const control of tokenButtons) {
    control.addEventListener(
      'click',
      () => {
        if (!isVaultToken(control.dataset.token)) return;
        selectedToken = control.dataset.token;
        renderExperience();
      },
      { signal: events.signal },
    );
  }
  for (const row of vaultRows) {
    row.addEventListener(
      'pointerenter',
      () => {
        if (popoverPinned) return;
        if (hoverTimer !== undefined) window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => {
          hoverTimer = undefined;
          if (!row.matches(':hover') || popoverPinned || !isVaultKey(row.dataset.vaultOption))
            return;
          selectedVaultKey = row.dataset.vaultOption;
          show();
        }, 900);
      },
      { signal: events.signal },
    );
    row.addEventListener(
      'pointerleave',
      () => {
        if (hoverTimer !== undefined) window.clearTimeout(hoverTimer);
        hoverTimer = undefined;
        if (!popoverPinned && selectedVaultKey === row.dataset.vaultOption) close();
      },
      { signal: events.signal },
    );
    row.addEventListener(
      'click',
      () => {
        if (!isVaultKey(row.dataset.vaultOption)) return;
        if (hoverTimer !== undefined) window.clearTimeout(hoverTimer);
        hoverTimer = undefined;
        selectedVaultKey = row.dataset.vaultOption;
        popoverPinned = true;
        show();
      },
      { signal: events.signal },
    );
  }
  closeButton?.addEventListener('click', () => close(true), { signal: events.signal });
  document.addEventListener(
    'click',
    (event) => {
      if (popover.hidden || !(event.target instanceof Element) || popover.contains(event.target))
        return;
      if (
        event.target.closest('[data-vault-option], [data-vault-mode], [data-chain], [data-token]')
      )
        return;
      close();
    },
    { signal: events.signal },
  );
  window.addEventListener('resize', position, { passive: true, signal: events.signal });
  window.addEventListener('scroll', position, { passive: true, signal: events.signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !popover.hidden) close(true);
    },
    { signal: events.signal },
  );

  renderExperience();

  return {
    destroy() {
      popoverEvents.abort();
      events.abort();
      close();
      journey.querySelector('.ownership-vault-preview')?.prepend(popover);
      popover.classList.remove('is-portal');
    },
  };
}
