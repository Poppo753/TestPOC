import type { DisposableController } from '../../../core/disposable';

export const decisionRoutes = {
  'route-a': {
    name: 'Route A · Liquid lending',
    state: 'Eligible · selected',
    stateClass: 'eligible',
    net: '4.4%',
    liquidity: 'Strong',
    policy: 'Pass',
    reason:
      'Selected because it remains the strongest eligible outcome after estimated costs, liquidity and policy limits.',
  },
  'route-b': {
    name: 'Route B · Utilization opportunity',
    state: 'Watch',
    stateClass: 'watch',
    net: '5.0%',
    liquidity: 'Moderate',
    policy: 'Review',
    reason:
      'The headline return is higher, but utilization and available liquidity still require review before this route can become eligible.',
  },
  'route-c': {
    name: 'Route C · Capacity-limited market',
    state: 'Excluded',
    stateClass: 'excluded',
    net: '5.2%',
    liquidity: 'Limited',
    policy: 'Outside limit',
    reason:
      'The highest headline APY is excluded because capacity and liquidity fall outside the illustrative policy limits.',
  },
} as const;

export type DecisionRouteId = keyof typeof decisionRoutes;

export function isDecisionRouteId(value: string | undefined): value is DecisionRouteId {
  return Boolean(value && Object.hasOwn(decisionRoutes, value));
}

export function mountDecisionRunway(runway: HTMLElement): DisposableController {
  const controls = [...runway.querySelectorAll<HTMLButtonElement>('[data-decision-route]')];
  const state = runway.querySelector<HTMLElement>('[data-decision-state]');
  const name = runway.querySelector<HTMLElement>('[data-decision-name]');
  const net = runway.querySelector<HTMLElement>('[data-decision-net]');
  const liquidity = runway.querySelector<HTMLElement>('[data-decision-liquidity]');
  const policy = runway.querySelector<HTMLElement>('[data-decision-policy]');
  const reason = runway.querySelector<HTMLElement>('[data-decision-reason]');
  const events = new AbortController();
  let observer: IntersectionObserver | undefined;

  if (!state || !name || !net || !liquidity || !policy || !reason || controls.length === 0) {
    throw new Error('Decision runway markup is incomplete.');
  }

  const initial = controls.find((control) => control.getAttribute('aria-pressed') === 'true')
    ?.dataset.decisionRoute;
  let pinnedRoute: DecisionRouteId = isDecisionRouteId(initial) ? initial : 'route-a';
  const render = (routeId: DecisionRouteId) => {
    const route = decisionRoutes[routeId];
    runway.dataset.activeRoute = routeId;
    for (const control of controls) {
      control.classList.toggle('is-active', control.dataset.decisionRoute === routeId);
    }
    state.className = `decision-state decision-state--${route.stateClass}`;
    state.textContent = route.state;
    name.textContent = route.name;
    net.textContent = route.net;
    liquidity.textContent = route.liquidity;
    policy.textContent = route.policy;
    reason.textContent = route.reason;
  };

  for (const control of controls) {
    const routeId = control.dataset.decisionRoute;
    if (!isDecisionRouteId(routeId)) continue;
    control.addEventListener('mouseenter', () => render(routeId), { signal: events.signal });
    control.addEventListener('focus', () => render(routeId), { signal: events.signal });
    control.addEventListener(
      'mouseleave',
      () => {
        if (!control.matches(':focus')) render(pinnedRoute);
      },
      { signal: events.signal },
    );
    control.addEventListener('blur', () => render(pinnedRoute), { signal: events.signal });
    control.addEventListener(
      'click',
      () => {
        pinnedRoute = routeId;
        for (const candidate of controls) {
          candidate.setAttribute('aria-pressed', String(candidate === control));
        }
        render(pinnedRoute);
      },
      { signal: events.signal },
    );
  }
  render(pinnedRoute);

  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window)
  ) {
    runway.classList.add('is-evaluating');
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        runway.classList.add('is-evaluating');
        observer?.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(runway);
  }

  return {
    destroy() {
      observer?.disconnect();
      events.abort();
    },
  };
}
