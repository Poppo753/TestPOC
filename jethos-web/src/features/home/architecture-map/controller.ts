import type { DisposableController } from '../../../core/disposable';
import { positionFloatingPopover } from '../../../core/floating-popover';
import {
  candidatesFor,
  isAssetId,
  isChainId,
  isRiskId,
  riskAccents,
  riskLabel,
  type RiskId,
} from './model';
import { renderRouteCandidates } from './view';

export function mountArchitectureMap(section: HTMLElement): DisposableController {
  const modeControls = [...section.querySelectorAll<HTMLButtonElement>('[data-architecture-mode]')];
  const modePanels = [...section.querySelectorAll<HTMLElement>('[data-architecture-panel]')];
  const direction = section.querySelector<HTMLElement>('.architecture-direction');
  const riskControls = [...section.querySelectorAll<HTMLButtonElement>('[data-architecture-risk]')];
  const chains = [...section.querySelectorAll<HTMLElement>('[data-architecture-chain]')];
  const popover = section.querySelector<HTMLElement>('[data-architecture-asset-popover]');
  const popoverList = popover?.querySelector<HTMLElement>('[data-asset-popover-list]');
  const assetButtons = [
    ...section.querySelectorAll<HTMLButtonElement>('[data-architecture-asset]'),
  ];
  const events = new AbortController();
  let selectedRisk: RiskId = 'balanced';
  let activeAssetButton: HTMLButtonElement | null = null;
  let popoverPinned = false;
  let openTimer: number | undefined;
  let closeTimer: number | undefined;
  let pointerOpening = false;

  if (!direction || !popover || !popoverList)
    throw new Error('Architecture map markup is incomplete.');
  document.body.append(popover);

  const clearTimers = () => {
    if (openTimer !== undefined) window.clearTimeout(openTimer);
    if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    openTimer = undefined;
    closeTimer = undefined;
  };
  const position = () => {
    if (!popover.hidden && activeAssetButton) positionFloatingPopover(popover, activeAssetButton);
  };
  const close = (restoreFocus = false) => {
    clearTimers();
    popover.hidden = true;
    activeAssetButton?.classList.remove('is-active');
    if (restoreFocus) activeAssetButton?.focus();
    activeAssetButton = null;
    popoverPinned = false;
  };
  const show = (button: HTMLButtonElement, pinned = false) => {
    const chain = button.closest<HTMLElement>('[data-architecture-chain]')?.dataset
      .architectureChain;
    const asset = button.dataset.architectureAsset;
    if (!isChainId(chain) || !isAssetId(asset)) return;
    clearTimers();
    const keepPinned = activeAssetButton === button && popoverPinned;
    activeAssetButton?.classList.remove('is-active');
    activeAssetButton = button;
    popoverPinned = pinned || keepPinned;
    button.classList.add('is-active');

    const chainLabel =
      chain === 'ethereum' ? 'Ethereum' : `${chain.charAt(0).toUpperCase()}${chain.slice(1)}`;
    const tier = riskLabel(selectedRisk);
    const title = popover.querySelector<HTMLElement>('[data-asset-popover-title]');
    const copy = popover.querySelector<HTMLElement>('[data-asset-popover-copy]');
    if (title) title.textContent = `${chainLabel} · ${tier} ${asset.toUpperCase()} Vault`;
    if (copy) {
      copy.textContent =
        selectedRisk === 'conservative'
          ? 'Illustrative conservative routes for a lower-complexity vault.'
          : `This ${tier.toLowerCase()} vault can use validated routes from lower risk tiers and add ${selectedRisk === 'balanced' ? 'balanced strategies' : 'opportunity strategies'}.`;
    }
    renderRouteCandidates(popoverList, candidatesFor(chain, asset, selectedRisk));
    popover.style.setProperty('--popover-accent', riskAccents[selectedRisk]);
    popover
      .querySelector<HTMLElement>('[data-asset-popover-close]')
      ?.toggleAttribute('hidden', !pinned);
    popover.hidden = false;
    window.requestAnimationFrame(position);
  };
  const selectMode = (mode: string | undefined) => {
    if (!mode) return;
    close();
    for (const control of modeControls) {
      control.setAttribute('aria-pressed', String(control.dataset.architectureMode === mode));
    }
    for (const panel of modePanels) panel.hidden = panel.dataset.architecturePanel !== mode;
  };
  const selectRisk = (risk: string | undefined) => {
    if (!isRiskId(risk)) return;
    selectedRisk = risk;
    const label = riskLabel(risk);
    direction.dataset.risk = risk;
    for (const control of riskControls) {
      control.setAttribute('aria-pressed', String(control.dataset.architectureRisk === risk));
    }
    for (const target of section.querySelectorAll<HTMLElement>('[data-master-tier]')) {
      target.textContent = label;
    }
    for (const target of section.querySelectorAll<HTMLElement>('[data-master-name]')) {
      target.textContent = `${label} Master Vault`;
    }
    for (const target of section.querySelectorAll<HTMLElement>('[data-child-tier]')) {
      target.textContent = `${label} Vault`;
    }
    if (activeAssetButton && !popover.hidden) show(activeAssetButton, popoverPinned);
  };
  const expandChain = (selected: HTMLElement) => {
    close();
    for (const chain of chains) {
      const expanded = chain === selected;
      chain.classList.toggle('is-expanded', expanded);
      chain
        .querySelector<HTMLElement>('.architecture-chain__header')
        ?.setAttribute('aria-expanded', String(expanded));
    }
  };

  for (const control of modeControls) {
    control.addEventListener('click', () => selectMode(control.dataset.architectureMode), {
      signal: events.signal,
    });
  }
  for (const control of riskControls) {
    control.addEventListener('click', () => selectRisk(control.dataset.architectureRisk), {
      signal: events.signal,
    });
  }
  for (const chain of chains) {
    chain
      .querySelector<HTMLElement>('.architecture-chain__header')
      ?.addEventListener('click', () => expandChain(chain), { signal: events.signal });
  }
  for (const button of assetButtons) {
    button.addEventListener('pointerdown', () => (pointerOpening = true), {
      signal: events.signal,
    });
    button.addEventListener('pointerup', () => window.setTimeout(() => (pointerOpening = false)), {
      signal: events.signal,
    });
    button.addEventListener('pointercancel', () => (pointerOpening = false), {
      signal: events.signal,
    });
    button.addEventListener(
      'mouseenter',
      () => {
        clearTimers();
        openTimer = window.setTimeout(() => show(button), 220);
      },
      { signal: events.signal },
    );
    button.addEventListener(
      'mouseleave',
      () => {
        if (openTimer !== undefined) window.clearTimeout(openTimer);
        if (!popoverPinned) {
          closeTimer = window.setTimeout(() => {
            if (!popoverPinned) close();
          }, 140);
        }
      },
      { signal: events.signal },
    );
    button.addEventListener(
      'focus',
      () => {
        if (!popoverPinned && !pointerOpening) show(button);
      },
      { signal: events.signal },
    );
    button.addEventListener(
      'blur',
      () => {
        if (!popoverPinned) {
          closeTimer = window.setTimeout(() => {
            if (!popoverPinned) close();
          }, 140);
        }
      },
      { signal: events.signal },
    );
    button.addEventListener(
      'click',
      () => {
        pointerOpening = false;
        show(button, true);
      },
      { signal: events.signal },
    );
  }
  popover.addEventListener('mouseenter', () => closeTimer && window.clearTimeout(closeTimer), {
    signal: events.signal,
  });
  popover.addEventListener(
    'mouseleave',
    () => {
      if (!popoverPinned) {
        closeTimer = window.setTimeout(() => {
          if (!popoverPinned) close();
        }, 140);
      }
    },
    { signal: events.signal },
  );
  popover
    .querySelector<HTMLElement>('[data-asset-popover-close]')
    ?.addEventListener('click', () => close(true), { signal: events.signal });
  document.addEventListener(
    'click',
    (event) => {
      if (popover.hidden || !(event.target instanceof Element) || popover.contains(event.target))
        return;
      if (
        event.target.closest(
          '[data-architecture-asset], [data-architecture-risk], [data-architecture-mode]',
        )
      )
        return;
      close();
    },
    { signal: events.signal },
  );
  window.addEventListener('scroll', () => (popoverPinned ? position() : close()), {
    passive: true,
    signal: events.signal,
  });
  window.addEventListener('resize', position, { passive: true, signal: events.signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !popover.hidden) close(true);
    },
    { signal: events.signal },
  );

  selectMode('direction');
  selectRisk('balanced');
  const firstChain = chains[0];
  if (firstChain) expandChain(firstChain);

  return {
    destroy() {
      clearTimers();
      events.abort();
      close();
      section.append(popover);
    },
  };
}
