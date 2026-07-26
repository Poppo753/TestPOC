/**
 * Interactive, illustrative route-selection model.
 *
 * A route can be inspected temporarily with hover/focus or selected persistently
 * with a click. The readout deliberately exposes the decision dimensions
 * instead of collapsing them into an unexplained synthetic score.
 */
const ROUTES = Object.freeze({
  'route-a': {
    name: 'Route A · Liquid lending',
    state: 'Eligible · selected',
    stateClass: 'eligible',
    net: '4.4%',
    liquidity: 'Strong',
    policy: 'Pass',
    reason: 'Selected because it remains the strongest eligible outcome after estimated costs, liquidity and policy limits.',
  },
  'route-b': {
    name: 'Route B · Utilization opportunity',
    state: 'Watch',
    stateClass: 'watch',
    net: '5.0%',
    liquidity: 'Moderate',
    policy: 'Review',
    reason: 'The headline return is higher, but utilization and available liquidity still require review before this route can become eligible.',
  },
  'route-c': {
    name: 'Route C · Capacity-limited market',
    state: 'Excluded',
    stateClass: 'excluded',
    net: '5.2%',
    liquidity: 'Limited',
    policy: 'Outside limit',
    reason: 'The highest headline APY is excluded because capacity and liquidity fall outside the illustrative policy limits.',
  },
});

document.querySelectorAll('[data-decision-runway]').forEach((runway) => {
  const controls = [...runway.querySelectorAll('[data-decision-route]')];
  const state = runway.querySelector('[data-decision-state]');
  const name = runway.querySelector('[data-decision-name]');
  const net = runway.querySelector('[data-decision-net]');
  const liquidity = runway.querySelector('[data-decision-liquidity]');
  const policy = runway.querySelector('[data-decision-policy]');
  const reason = runway.querySelector('[data-decision-reason]');
  if (!controls.length || !state || !name || !net || !liquidity || !policy || !reason) return;

  let pinnedRoute = controls.find((control) => control.getAttribute('aria-pressed') === 'true')?.dataset.decisionRoute || 'route-a';

  function render(routeId) {
    const route = ROUTES[routeId] || ROUTES['route-a'];
    runway.dataset.activeRoute = routeId;
    controls.forEach((control) => control.classList.toggle('is-active', control.dataset.decisionRoute === routeId));

    state.className = `decision-state decision-state--${route.stateClass}`;
    state.textContent = route.state;
    name.textContent = route.name;
    net.textContent = route.net;
    liquidity.textContent = route.liquidity;
    policy.textContent = route.policy;
    reason.textContent = route.reason;
  }

  controls.forEach((control) => {
    const routeId = control.dataset.decisionRoute;
    control.addEventListener('mouseenter', () => render(routeId));
    control.addEventListener('focus', () => render(routeId));
    control.addEventListener('mouseleave', () => {
      if (!control.matches(':focus')) render(pinnedRoute);
    });
    control.addEventListener('blur', () => render(pinnedRoute));
    control.addEventListener('click', () => {
      pinnedRoute = routeId;
      controls.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === control)));
      render(pinnedRoute);
    });
  });

  render(pinnedRoute);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    runway.classList.add('is-evaluating');
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    runway.classList.add('is-evaluating');
    observer.disconnect();
  }, { threshold: 0.35 });

  observer.observe(runway);
});
