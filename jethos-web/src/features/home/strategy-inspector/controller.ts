import type { DisposableController } from '../../../core/disposable';
import { isStrategyId, STRATEGIES, type StrategyId, type StrategyLevel } from './model';
import { element, renderAllocation, routeContent, strategyContent } from './view';

const levels = ['base', 'pro', 'advanced'] as const satisfies readonly StrategyLevel[];
type PanelContext = 'strategy' | string | null;

export function mountStrategyInspector(inspector: HTMLElement): DisposableController {
  const controls = [...inspector.querySelectorAll<HTMLButtonElement>('[data-inspector-strategy]')];
  const baseAllocation = inspector.querySelector<HTMLElement>('[data-inspector-allocation="base"]');
  const proAllocation = inspector.querySelector<HTMLElement>('[data-inspector-allocation="pro"]');
  const advancedRoutes = inspector.querySelector<HTMLElement>('[data-advanced-routes]');
  const proofButton = inspector.querySelector<HTMLButtonElement>('[data-inspector-proof]');
  const proofNote = inspector.querySelector<HTMLElement>('[data-inspector-proof-note]');
  const panels = Object.fromEntries(
    levels.map((level) => [
      level,
      inspector.querySelector<HTMLElement>(`[data-view-detail-panel="${level}"]`),
    ]),
  ) as Record<StrategyLevel, HTMLElement | null>;
  const triggers = Object.fromEntries(
    levels.map((level) => [
      level,
      inspector.querySelector<HTMLButtonElement>(`[data-view-detail="${level}"]`),
    ]),
  ) as Record<StrategyLevel, HTMLButtonElement | null>;
  const contexts: Record<StrategyLevel, PanelContext> = {
    base: null,
    pro: null,
    advanced: null,
  };
  const compact = window.matchMedia('(max-width: 700px)');
  const events = new AbortController();
  let renderEvents = new AbortController();
  let selectedStrategy: StrategyId = 'balanced';

  if (!baseAllocation || !proAllocation || !advancedRoutes || controls.length === 0) {
    throw new Error('Strategy inspector markup is incomplete.');
  }

  const setText = (selector: string, value: string) => {
    const target = inspector.querySelector<HTMLElement>(selector);
    if (target) target.textContent = value;
  };
  const renderPanel = (level: StrategyLevel) => {
    const panel = panels[level];
    const context = contexts[level];
    if (!panel || !context) return;
    const strategy = STRATEGIES[selectedStrategy];
    const routes = level === 'base' ? strategy.base : strategy.pro;
    const route = context === 'strategy' ? undefined : routes.find((entry) => entry.id === context);
    const title = panel.querySelector<HTMLElement>('[data-view-detail-title]');
    const content = panel.querySelector<HTMLElement>('[data-view-detail-content]');
    if (title) title.textContent = route ? `${route.label} · ${strategy.label}` : strategy.label;
    content?.replaceChildren(
      context === 'strategy'
        ? strategyContent(level, selectedStrategy)
        : routeContent(level, selectedStrategy, context),
    );
  };
  const closePanel = (level: StrategyLevel, restoreFocus = false) => {
    const panel = panels[level];
    if (!panel) return;
    panel.hidden = true;
    contexts[level] = null;
    triggers[level]?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) triggers[level]?.focus();
  };
  const openPanel = (level: StrategyLevel, context: Exclude<PanelContext, null> = 'strategy') => {
    const panel = panels[level];
    if (!panel) return;
    if (compact.matches) {
      for (const candidate of levels) if (candidate !== level) closePanel(candidate);
    }
    contexts[level] = context;
    panel.hidden = false;
    triggers[level]?.setAttribute('aria-expanded', 'true');
    renderPanel(level);
  };
  const render = (strategyId: StrategyId) => {
    renderEvents.abort();
    renderEvents = new AbortController();
    selectedStrategy = strategyId;
    const strategy = STRATEGIES[strategyId];
    for (const control of controls) {
      control.setAttribute(
        'aria-pressed',
        String(control.dataset.inspectorStrategy === strategyId),
      );
    }
    setText('[data-inspector-selection]', strategy.label);
    setText('[data-base-risk]', strategy.risk);
    setText('[data-base-yield]', strategy.yield);
    setText('[data-base-exit]', strategy.exit);
    setText('[data-base-explanation]', strategy.explanation);
    setText('[data-pro-network]', strategy.network);
    setText('[data-pro-cost]', strategy.cost);
    setText('[data-pro-decision]', strategy.decision);
    setText('[data-advanced-reserve]', strategy.reserve);
    setText('[data-advanced-cap]', strategy.cap);
    setText('[data-advanced-trigger]', strategy.trigger);

    renderAllocation(
      baseAllocation,
      strategy.base,
      'summary',
      (routeId) => openPanel('base', routeId),
      renderEvents.signal,
    );
    renderAllocation(
      proAllocation,
      strategy.pro,
      'routes',
      (routeId) => openPanel('pro', routeId),
      renderEvents.signal,
    );
    const routeRows = strategy.pro.map((route) => {
      const row = element('button', 'strategy-route-row');
      row.type = 'button';
      row.append(
        element('span', '', route.position),
        element('span', '', route.label),
        element('strong', '', `${route.percent}%`),
        element('em', '', route.proof),
      );
      row.addEventListener('click', () => openPanel('advanced', route.id), {
        signal: renderEvents.signal,
      });
      return row;
    });
    advancedRoutes.replaceChildren(...routeRows);

    if (proofNote) proofNote.hidden = true;
    if (proofButton) {
      proofButton.textContent = 'Inspect';
      proofButton.setAttribute('aria-expanded', 'false');
    }
    for (const level of levels) renderPanel(level);
  };

  for (const control of controls) {
    control.addEventListener(
      'click',
      () => {
        if (isStrategyId(control.dataset.inspectorStrategy)) {
          render(control.dataset.inspectorStrategy);
        }
      },
      { signal: events.signal },
    );
  }
  for (const level of levels) {
    triggers[level]?.addEventListener(
      'click',
      () => (contexts[level] === 'strategy' ? closePanel(level) : openPanel(level)),
      { signal: events.signal },
    );
    panels[level]
      ?.querySelector<HTMLButtonElement>('[data-view-detail-close]')
      ?.addEventListener('click', () => closePanel(level, true), { signal: events.signal });
  }
  proofButton?.addEventListener(
    'click',
    () => {
      const open = proofNote?.hidden ?? false;
      if (proofNote) proofNote.hidden = !open;
      proofButton.textContent = open ? 'Close' : 'Inspect';
      proofButton.setAttribute('aria-expanded', String(open));
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!levels.some((level) => panels[level] && !panels[level]?.hidden)) return;
      if (!(event.target instanceof Element)) return;
      if (
        event.target.closest(
          '[data-view-detail-panel], [data-view-detail], [data-inspector-strategy], .strategy-allocation-row, .strategy-donut__slice, .strategy-route-row',
        )
      ) {
        return;
      }
      for (const level of levels) closePanel(level);
    },
    { signal: events.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      for (const level of levels)
        if (panels[level] && !panels[level]?.hidden) closePanel(level, true);
    },
    { signal: events.signal },
  );

  render(selectedStrategy);

  return {
    destroy() {
      renderEvents.abort();
      events.abort();
      for (const level of levels) closePanel(level);
    },
  };
}
