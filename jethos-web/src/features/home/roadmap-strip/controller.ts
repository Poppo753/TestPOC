import type { DisposableController } from '../../../core/disposable';

export const phases = {
  poc: {
    label: 'Phase 01 · Now',
    title: 'Private USDC PoC',
    description:
      'Validate deposits, accounting, withdrawals, reserves and operational controls with one focused USDC vault.',
    gate: 'Move forward only when the foundation has repeatable evidence.',
  },
  'multi-asset': {
    label: 'Phase 02 · Next',
    title: 'Multi-asset vaults',
    description:
      'Add carefully authorized stablecoin and crypto vault families, each with its own visible risks and exit conditions.',
    gate: 'Requires asset-specific liquidity, oracle and custody validation.',
  },
  'multi-chain': {
    label: 'Phase 03 · Expand',
    title: 'Multi-chain vaults',
    description:
      'Open network-specific opportunities while keeping chain, bridge, cost and liquidity assumptions understandable.',
    gate: 'Each network must pass dedicated technical and operational checks.',
  },
  consumer: {
    label: 'Phase 04 · Product',
    title: 'Consumer app',
    description:
      'Turn the validated system into a familiar experience where people choose how much complexity they want to manage.',
    gate: 'The interface expands only after the underlying actions are dependable.',
  },
  vision: {
    label: 'Phase 05 · Vision',
    title: 'Complete financial home',
    description:
      'Hold, invest, understand and eventually use digital assets from one self-custodial financial home.',
    gate: 'Partner-enabled services remain conditional on technical and legal readiness.',
  },
} as const;

type PhaseId = keyof typeof phases;

export function isPhaseId(value: string | undefined): value is PhaseId {
  return Boolean(value && Object.hasOwn(phases, value));
}

export function mountRoadmapStrip(section: HTMLElement): DisposableController {
  const controls = [...section.querySelectorAll<HTMLButtonElement>('[data-horizon-step]')];
  const popover = section.querySelector<HTMLElement>('[data-horizon-popover]');
  const label = popover?.querySelector<HTMLElement>('[data-horizon-popover-label]');
  const title = popover?.querySelector<HTMLElement>('[data-horizon-popover-title]');
  const description = popover?.querySelector<HTMLElement>('[data-horizon-popover-description]');
  const gate = popover?.querySelector<HTMLElement>('[data-horizon-popover-gate]');
  const events = new AbortController();
  let activeControl: HTMLButtonElement | null = null;
  let hoverTimer: number | undefined;

  if (!popover || !label || !title || !description || !gate || controls.length === 0) {
    throw new Error('Roadmap strip markup is incomplete.');
  }

  const clearHoverTimer = () => {
    if (hoverTimer === undefined) return;
    window.clearTimeout(hoverTimer);
    hoverTimer = undefined;
  };
  const positionPopover = (control: HTMLButtonElement | null) => {
    if (!control || popover.hidden) return;
    const sectionRect = section.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();
    const halfWidth = Math.min(190, window.innerWidth / 2 - 12);
    const center = controlRect.left - sectionRect.left + controlRect.width / 2;
    popover.style.left = `${Math.max(halfWidth, Math.min(sectionRect.width - halfWidth, center))}px`;
  };
  const close = (restoreFocus = false) => {
    popover.hidden = true;
    for (const control of controls) {
      control.classList.remove('is-active');
      control.setAttribute('aria-expanded', 'false');
    }
    if (restoreFocus) activeControl?.focus();
    activeControl = null;
  };
  const open = (control: HTMLButtonElement, toggle = true) => {
    const phaseId = control.dataset.horizonStep;
    if (!isPhaseId(phaseId)) return;
    if (activeControl === control && !popover.hidden) {
      if (toggle) close();
      return;
    }
    const phase = phases[phaseId];
    activeControl = control;
    label.textContent = phase.label;
    title.textContent = phase.title;
    description.textContent = phase.description;
    gate.textContent = phase.gate;
    for (const candidate of controls) {
      const selected = candidate === control;
      candidate.classList.toggle('is-active', selected);
      candidate.setAttribute('aria-expanded', String(selected));
    }
    popover.hidden = false;
    positionPopover(control);
  };

  for (const control of controls) {
    control.addEventListener(
      'pointerenter',
      () => {
        clearHoverTimer();
        hoverTimer = window.setTimeout(() => {
          hoverTimer = undefined;
          if (control.matches(':hover')) open(control, false);
        }, 900);
      },
      { signal: events.signal },
    );
    control.addEventListener(
      'pointerleave',
      () => {
        clearHoverTimer();
        if (activeControl === control) close();
      },
      { signal: events.signal },
    );
    control.addEventListener(
      'click',
      () => {
        clearHoverTimer();
        open(control);
      },
      { signal: events.signal },
    );
  }
  window.addEventListener('resize', () => positionPopover(activeControl), {
    passive: true,
    signal: events.signal,
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !popover.hidden) close(true);
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      if (
        popover.hidden ||
        popover.contains(event.target) ||
        event.target.closest('[data-horizon-step]')
      )
        return;
      close();
    },
    { signal: events.signal },
  );

  return {
    destroy() {
      clearHoverTimer();
      events.abort();
      close();
    },
  };
}
