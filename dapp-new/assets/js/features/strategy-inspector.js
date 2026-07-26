/**
 * Progressive strategy inspector.
 *
 * Base, Pro and Advanced always describe the same illustrative strategy.
 * Selecting another strategy updates all three views together so the visitor
 * can see that complexity changes presentation depth—not the underlying truth.
 */
const STRATEGIES = Object.freeze({
  conservative: {
    label: 'Conservative strategy',
    risk: 'Lower',
    yield: '3.2%',
    exit: 'High liquidity',
    network: 'Arbitrum',
    cost: '0.18%',
    reserve: '45%',
    cap: '30%',
    trigger: 'Utilization > 82%',
    explanation: 'Keep a large liquid reserve and use a limited set of lower-complexity lending routes.',
    decision: 'Reserve remains elevated while lending utilization is above the illustrative comfort range.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 50, color: '#8b5cf6' },
      { id: 'lending', label: 'Diversified lending', percent: 35, color: '#38bdf8' },
      { id: 'short', label: 'Short-duration routes', percent: 15, color: '#2dd4bf' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 50, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded' },
      { id: 'aave', label: 'Aave V3', percent: 25, apy: '4.1%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked' },
      { id: 'morpho', label: 'Morpho', percent: 15, apy: '4.8%', color: '#67e8f9', position: 'ARB-MOR-SUP', proof: 'Linked' },
      { id: 'euler', label: 'Euler V2', percent: 10, apy: '5.3%', color: '#2dd4bf', position: 'ARB-EUL-SUP', proof: 'Linked' },
    ],
  },
  balanced: {
    label: 'Balanced strategy',
    risk: 'Moderate',
    yield: '5.1%',
    exit: 'Balanced',
    network: 'Arbitrum',
    cost: '0.34%',
    reserve: '20%',
    cap: '35%',
    trigger: 'Utilization > 78%',
    explanation: 'Balance available liquidity with several diversified lending and liquidity routes.',
    decision: 'Keep a larger reserve while lending utilization remains elevated.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 25, color: '#8b5cf6' },
      { id: 'lending', label: 'Diversified lending', percent: 45, color: '#38bdf8' },
      { id: 'liquidity', label: 'Liquidity routes', percent: 30, color: '#2dd4bf' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 25, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded' },
      { id: 'aave', label: 'Aave V3', percent: 30, apy: '4.7%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked' },
      { id: 'euler', label: 'Euler V2', percent: 25, apy: '6.4%', color: '#2dd4bf', position: 'ARB-EUL-SUP', proof: 'Linked' },
      { id: 'morpho', label: 'Morpho', percent: 20, apy: '5.8%', color: '#67e8f9', position: 'ARB-MOR-SUP', proof: 'Linked' },
    ],
  },
  opportunity: {
    label: 'Opportunity strategy',
    risk: 'Higher',
    yield: '7.8%',
    exit: 'Variable',
    network: 'Arbitrum',
    cost: '0.62%',
    reserve: '10%',
    cap: '40%',
    trigger: 'Risk score changes',
    explanation: 'Accept more moving parts and variable liquidity in exchange for a wider eligible opportunity set.',
    decision: 'Opportunity routes remain capped so no single position dominates the illustrative strategy.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 10, color: '#8b5cf6' },
      { id: 'lending', label: 'Lending routes', percent: 40, color: '#38bdf8' },
      { id: 'opportunity', label: 'Opportunity routes', percent: 50, color: '#f59e0b' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 10, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded' },
      { id: 'aave', label: 'Aave V3', percent: 25, apy: '5.0%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked' },
      { id: 'euler', label: 'Euler V2', percent: 30, apy: '8.2%', color: '#2dd4bf', position: 'ARB-EUL-OPP', proof: 'Linked' },
      { id: 'morpho', label: 'Morpho', percent: 35, apy: '9.1%', color: '#f59e0b', position: 'ARB-MOR-OPP', proof: 'Linked' },
    ],
  },
});

const SVG_NS = 'http://www.w3.org/2000/svg';
const CIRCUMFERENCE = 2 * Math.PI * 36;

function svgNode(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function renderAllocation(component, allocations, depthLabel) {
  const chartHost = component.querySelector('[data-inspector-chart]');
  const list = component.querySelector('[data-inspector-list]');
  if (!chartHost || !list) return;

  const svg = svgNode('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': `${depthLabel} allocation` });
  svg.append(svgNode('circle', { class: 'strategy-donut__track', cx: '50', cy: '50', r: '36' }));
  const slices = [];
  let offset = 0;

  allocations.forEach((allocation) => {
    const slice = svgNode('circle', {
      class: 'strategy-donut__slice',
      cx: '50',
      cy: '50',
      r: '36',
      tabindex: '0',
      'aria-label': `${allocation.label}: ${allocation.percent}%${allocation.apy ? `, ${allocation.apy} illustrative APY` : ''}`,
      'data-allocation-id': allocation.id,
      'stroke-dasharray': `${CIRCUMFERENCE * allocation.percent / 100} ${CIRCUMFERENCE}`,
      'stroke-dashoffset': `${-CIRCUMFERENCE * offset / 100}`,
      transform: 'rotate(-90 50 50)',
      style: `--slice-color:${allocation.color}`,
    });
    offset += allocation.percent;
    slices.push(slice);
    svg.append(slice);
  });

  const value = svgNode('text', { x: '50', y: '48', 'text-anchor': 'middle' });
  value.textContent = '100%';
  const label = svgNode('text', { x: '50', y: '59', 'text-anchor': 'middle' });
  label.textContent = depthLabel;
  svg.append(value, label);
  chartHost.replaceChildren(svg);

  const rows = allocations.map((allocation) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'strategy-allocation-row';
    row.dataset.allocationId = allocation.id;
    row.style.setProperty('--row-color', allocation.color);
    row.setAttribute('aria-label', `${allocation.label}: ${allocation.percent}%`);

    const name = document.createElement('span');
    const dot = document.createElement('i');
    name.append(dot, document.createTextNode(allocation.label));
    const metric = document.createElement('div');
    const share = document.createElement('strong');
    share.textContent = `${allocation.percent}%`;
    metric.append(share);
    if (allocation.apy) {
      const apy = document.createElement('small');
      apy.textContent = `${allocation.apy} APY`;
      metric.append(apy);
    }
    row.append(name, metric);
    return row;
  });
  list.replaceChildren(...rows);

  const renderActive = (allocationId = '') => {
    const allocation = allocations.find((item) => item.id === allocationId);
    slices.forEach((slice) => slice.classList.toggle('is-active', slice.dataset.allocationId === allocationId));
    rows.forEach((row) => row.classList.toggle('is-active', row.dataset.allocationId === allocationId));
    value.textContent = allocation ? `${allocation.percent}%` : '100%';
    label.textContent = allocation?.label ?? depthLabel;
  };

  [...slices, ...rows].forEach((control) => {
    const allocationId = control.dataset.allocationId;
    control.addEventListener('mouseenter', () => renderActive(allocationId));
    control.addEventListener('focus', () => renderActive(allocationId));
    control.addEventListener('mouseleave', () => {
      if (!component.matches(':focus-within')) renderActive();
    });
    control.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!component.matches(':focus-within')) renderActive();
      }, 0);
    });
  });
}

document.querySelectorAll('[data-strategy-inspector]').forEach((inspector) => {
  const controls = [...inspector.querySelectorAll('[data-inspector-strategy]')];
  const baseAllocation = inspector.querySelector('[data-inspector-allocation="base"]');
  const proAllocation = inspector.querySelector('[data-inspector-allocation="pro"]');
  const advancedRoutes = inspector.querySelector('[data-advanced-routes]');
  const proofButton = inspector.querySelector('[data-inspector-proof]');
  const proofNote = inspector.querySelector('[data-inspector-proof-note]');
  let selectedStrategy = 'balanced';

  function text(selector, value) {
    const target = inspector.querySelector(selector);
    if (target) target.textContent = value;
  }

  function render(strategyId) {
    const strategy = STRATEGIES[strategyId] || STRATEGIES.balanced;
    selectedStrategy = strategyId;
    controls.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.inspectorStrategy === strategyId)));

    text('[data-inspector-selection]', strategy.label);
    text('[data-base-risk]', strategy.risk);
    text('[data-base-yield]', strategy.yield);
    text('[data-base-exit]', strategy.exit);
    text('[data-base-explanation]', strategy.explanation);
    text('[data-pro-network]', strategy.network);
    text('[data-pro-cost]', strategy.cost);
    text('[data-pro-decision]', strategy.decision);
    text('[data-advanced-reserve]', strategy.reserve);
    text('[data-advanced-cap]', strategy.cap);
    text('[data-advanced-trigger]', strategy.trigger);

    if (baseAllocation) renderAllocation(baseAllocation, strategy.base, 'summary');
    if (proAllocation) renderAllocation(proAllocation, strategy.pro, 'routes');

    const routeRows = strategy.pro.map((route) => {
      const row = document.createElement('div');
      row.className = 'strategy-route-row';
      const position = document.createElement('span');
      position.textContent = route.position;
      const routeName = document.createElement('span');
      routeName.textContent = route.label;
      const share = document.createElement('strong');
      share.textContent = `${route.percent}%`;
      const proof = document.createElement('em');
      proof.textContent = route.proof;
      row.append(position, routeName, share, proof);
      return row;
    });
    advancedRoutes?.replaceChildren(...routeRows);

    if (proofNote) proofNote.hidden = true;
    if (proofButton) {
      proofButton.textContent = 'Inspect';
      proofButton.setAttribute('aria-expanded', 'false');
    }
  }

  controls.forEach((control) => control.addEventListener('click', () => render(control.dataset.inspectorStrategy)));
  proofButton?.addEventListener('click', () => {
    const willOpen = proofNote?.hidden ?? false;
    if (proofNote) proofNote.hidden = !willOpen;
    proofButton.textContent = willOpen ? 'Close' : 'Inspect';
    proofButton.setAttribute('aria-expanded', String(willOpen));
  });

  render(selectedStrategy);
});
