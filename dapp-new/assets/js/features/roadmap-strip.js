/**
 * Compact homepage roadmap interaction.
 *
 * The short strip stays scannable; selecting a phase opens one shared,
 * non-modal popover with the fuller explanation and its progression gate.
 */
const PHASES = Object.freeze({
  poc: {
    label: 'Phase 01 · Now',
    title: 'Private USDC PoC',
    description: 'Validate deposits, accounting, withdrawals, reserves and operational controls with one focused USDC vault.',
    gate: 'Move forward only when the foundation has repeatable evidence.',
  },
  'multi-asset': {
    label: 'Phase 02 · Next',
    title: 'Multi-asset vaults',
    description: 'Add carefully authorized stablecoin and crypto vault families, each with its own visible risks and exit conditions.',
    gate: 'Requires asset-specific liquidity, oracle and custody validation.',
  },
  'multi-chain': {
    label: 'Phase 03 · Expand',
    title: 'Multi-chain vaults',
    description: 'Open network-specific opportunities while keeping chain, bridge, cost and liquidity assumptions understandable.',
    gate: 'Each network must pass dedicated technical and operational checks.',
  },
  consumer: {
    label: 'Phase 04 · Product',
    title: 'Consumer app',
    description: 'Turn the validated system into a familiar experience where people choose how much complexity they want to manage.',
    gate: 'The interface expands only after the underlying actions are dependable.',
  },
  vision: {
    label: 'Phase 05 · Vision',
    title: 'Complete financial home',
    description: 'Hold, invest, understand and eventually use digital assets from one self-custodial financial home.',
    gate: 'Partner-enabled services remain conditional on technical and legal readiness.',
  },
});

const section = document.querySelector('.product-horizons');

if (section) {
  const controls = [...section.querySelectorAll('[data-horizon-step]')];
  const popover = section.querySelector('[data-horizon-popover]');
  const label = popover.querySelector('[data-horizon-popover-label]');
  const title = popover.querySelector('[data-horizon-popover-title]');
  const description = popover.querySelector('[data-horizon-popover-description]');
  const gate = popover.querySelector('[data-horizon-popover-gate]');
  let activeControl = null;
  let hoverTimer = null;

  function clearHoverTimer() {
    if (!hoverTimer) return;
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  function positionPopover(control) {
    if (!control || popover.hidden) return;
    const sectionRect = section.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();
    const halfWidth = Math.min(190, window.innerWidth / 2 - 12);
    const relativeCenter = controlRect.left - sectionRect.left + controlRect.width / 2;
    const clampedCenter = Math.max(halfWidth, Math.min(sectionRect.width - halfWidth, relativeCenter));
    popover.style.left = `${clampedCenter}px`;
  }

  function closePopover({ restoreFocus = false } = {}) {
    popover.hidden = true;
    controls.forEach((control) => {
      control.classList.remove('is-active');
      control.setAttribute('aria-expanded', 'false');
    });
    if (restoreFocus) activeControl?.focus();
    activeControl = null;
  }

  function openPopover(control, { toggle = true } = {}) {
    const phase = PHASES[control.dataset.horizonStep];
    if (!phase) return;
    if (activeControl === control && !popover.hidden) {
      if (toggle) closePopover();
      return;
    }
    activeControl = control;
    label.textContent = phase.label;
    title.textContent = phase.title;
    description.textContent = phase.description;
    gate.textContent = phase.gate;
    controls.forEach((candidate) => {
      const selected = candidate === control;
      candidate.classList.toggle('is-active', selected);
      candidate.setAttribute('aria-expanded', String(selected));
    });
    popover.hidden = false;
    positionPopover(control);
  }

  controls.forEach((control) => {
    control.addEventListener('pointerenter', () => {
      clearHoverTimer();
      hoverTimer = window.setTimeout(() => {
        hoverTimer = null;
        if (control.matches(':hover')) openPopover(control, { toggle: false });
      }, 900);
    });
    control.addEventListener('pointerleave', () => {
      clearHoverTimer();
      if (activeControl === control) closePopover();
    });
    control.addEventListener('click', () => {
      clearHoverTimer();
      openPopover(control);
    });
  });
  window.addEventListener('resize', () => positionPopover(activeControl), { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popover.hidden) closePopover({ restoreFocus: true });
  });
  document.addEventListener('click', (event) => {
    if (popover.hidden || section.contains(event.target)) return;
    closePopover();
  });
}
