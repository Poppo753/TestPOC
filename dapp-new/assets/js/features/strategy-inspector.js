/**
 * Progressive strategy inspector.
 *
 * The three cards describe one illustrative position at different depths:
 * Base translates it into familiar amounts, Pro exposes weighted protocol
 * contributions, and Advanced exposes eligibility formulas and evidence.
 * Every card owns its detail panel, so all three explanations can stay open
 * side by side for a direct comparison.
 */
const STRATEGIES = Object.freeze({
  conservative: {
    label: 'Conservative strategy', risk: 'Lower', yield: '3.2%', exit: 'High liquidity',
    network: 'Arbitrum', cost: '0.18%', policyBuffer: 0.18, reserve: '45%', cap: '30%', trigger: 'Utilization > 82%',
    mechanics: { borrowing: 'No', borrowedAsset: 'None', maxLtv: '0%', minHealth: 'Not applicable', maxLeverage: '1.00×', loops: '0', liquidation: 'No borrowing liquidation risk' },
    explanation: 'Keep a large liquid reserve and use a limited set of lower-complexity lending routes.',
    decision: 'Reserve remains elevated while lending utilization is above the illustrative comfort range.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 50, color: '#8b5cf6' },
      { id: 'lending', label: 'Diversified lending', percent: 35, color: '#38bdf8' },
      { id: 'short', label: 'Short-duration routes', percent: 15, color: '#2dd4bf' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 50, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded', operation: 'Held liquid', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'aave', label: 'Aave V3', percent: 25, apy: '6.8%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'morpho', label: 'Morpho', percent: 15, apy: '7.2%', color: '#67e8f9', position: 'ARB-MOR-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'euler', label: 'Euler V2', percent: 10, apy: '7.8%', color: '#2dd4bf', position: 'ARB-EUL-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
    ],
  },
  balanced: {
    label: 'Balanced strategy', risk: 'Moderate', yield: '5.1%', exit: 'Balanced',
    network: 'Arbitrum', cost: '0.34%', policyBuffer: 0.32, reserve: '20%', cap: '35%', trigger: 'Utilization > 78%',
    mechanics: { borrowing: 'No in this example', borrowedAsset: 'None', maxLtv: '0%', minHealth: 'Not applicable', maxLeverage: '1.00×', loops: '0', liquidation: 'No borrowing liquidation risk' },
    explanation: 'Balance available liquidity with several diversified lending and liquidity routes.',
    decision: 'Keep a larger reserve while lending utilization remains elevated.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 25, color: '#8b5cf6' },
      { id: 'lending', label: 'Diversified lending', percent: 45, color: '#38bdf8' },
      { id: 'liquidity', label: 'Additional lending markets', percent: 30, color: '#2dd4bf' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 25, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded', operation: 'Held liquid', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'aave', label: 'Aave V3', percent: 30, apy: '7.2%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'euler', label: 'Euler V2', percent: 25, apy: '8.4%', color: '#2dd4bf', position: 'ARB-EUL-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'morpho', label: 'Morpho', percent: 20, apy: '7.5%', color: '#67e8f9', position: 'ARB-MOR-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
    ],
  },
  opportunity: {
    label: 'Opportunity strategy', risk: 'Higher', yield: '7.8%', exit: 'Variable',
    network: 'Arbitrum', cost: '0.62%', policyBuffer: 0.355, reserve: '10%', cap: '40%', trigger: 'Risk score changes',
    mechanics: { borrowing: 'Yes, on approved loop routes', borrowedAsset: 'USDC', maxLtv: '62%', minHealth: '1.60', maxLeverage: '1.75×', loops: '2', liquidation: 'Present on collateralized routes' },
    explanation: 'Accept more moving parts and variable liquidity in exchange for a wider eligible opportunity set.',
    decision: 'Opportunity routes remain capped so no single position dominates the illustrative strategy.',
    base: [
      { id: 'reserve', label: 'Liquid reserve', percent: 10, color: '#8b5cf6' },
      { id: 'lending', label: 'Lending routes', percent: 40, color: '#38bdf8' },
      { id: 'opportunity', label: 'Opportunity routes', percent: 50, color: '#f59e0b' },
    ],
    pro: [
      { id: 'reserve', label: 'Liquid reserve', percent: 10, apy: '0.0%', color: '#8b5cf6', position: 'ARB-USDC-RES', proof: 'Recorded', operation: 'Held liquid', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'aave', label: 'Aave V3', percent: 25, apy: '8.5%', color: '#60a5fa', position: 'ARB-AAVE-SUP', proof: 'Linked', operation: 'Supply-only lending', supplied: 'USDC', borrowed: 'None', ltv: '0%', health: 'N/A', leverage: '1.00×', loop: 'None' },
      { id: 'euler', label: 'Euler V2 loop', percent: 30, apy: '11.2%', color: '#2dd4bf', position: 'ARB-EUL-LOOP', proof: 'Linked', operation: 'Collateralized lending loop', supplied: 'USDC', borrowed: 'USDC', ltv: '39.4%', health: '2.08', leverage: '1.65×', loop: '2 cycles', yieldMechanics: '(8.0% supply × 1.65 exposure) − (4.4% borrow × 0.65 debt) + 0.86% incentives = 11.20%' },
      { id: 'morpho', label: 'Morpho loop', percent: 35, apy: '9.4%', color: '#f59e0b', position: 'ARB-MOR-LOOP', proof: 'Linked', operation: 'Collateralized lending loop', supplied: 'USDC', borrowed: 'USDC', ltv: '31.0%', health: '2.65', leverage: '1.45×', loop: '1 cycle', yieldMechanics: '(8.0% supply × 1.45 exposure) − (4.5% borrow × 0.45 debt) − 0.175% route costs = 9.40%' },
    ],
  },
});

const STRATEGY_DETAILS = Object.freeze({
  conservative: {
    purpose: 'Prioritizes liquidity, simpler routes and a larger reserve before seeking additional yield.',
    tradeoff: 'A more defensive allocation can produce a lower expected return and may leave more capital unallocated.',
    evidence: 'Reserve level, approved routes, protocol shares, policy limits and every resulting transaction remain separately inspectable.',
  },
  balanced: {
    purpose: 'Combines an available reserve with diversified routes to balance liquidity, return and operational complexity.',
    tradeoff: 'More routes add dependencies. Utilization, withdrawal liquidity and concentration must be monitored continuously.',
    evidence: 'Each route, share, illustrative APY, selection rationale and evidence package remains visible.',
  },
  opportunity: {
    purpose: 'Uses a wider eligible route set and accepts more moving parts in pursuit of a higher expected result.',
    tradeoff: 'Liquidity can be more variable and exposure to protocol, utilization and market conditions is greater.',
    evidence: 'Route caps, risk triggers, allocation records and on-chain references make the additional complexity explicit.',
  },
});

const ROUTE_DETAILS = Object.freeze({
  reserve: [
    'Keeps part of the deposit available instead of placing everything into an external protocol.',
    'It makes withdrawals easier, but money held in reserve normally earns little or no yield.',
  ],
  lending: [
    'Lending means depositing assets into approved markets that make liquidity available to borrowers. Borrowers pay interest; that interest produces the lending yield.',
    'The borrower interacts with the protocol, never with your wallet. Returns and withdrawals still depend on protocol liquidity and market utilization.',
  ],
  short: [
    'Uses simpler lending positions intended to remain easier to exit and to avoid long chains of dependent operations.',
    'Short-duration does not mean risk-free: the protocol can still have limited liquidity, changing utilization or technical failures.',
  ],
  liquidity: [
    'Adds more approved lending markets so the position does not depend on a single protocol or rate.',
    'Diversification reduces concentration, but each additional market introduces another protocol and liquidity dependency.',
  ],
  opportunity: [
    'Includes advanced routes that may borrow against supplied collateral and re-supply the borrowed asset to increase exposure.',
    'A loop can increase expected yield and risk together. Borrow cost, health factor, liquidation thresholds and exit liquidity become essential.',
  ],
  aave: [
    'Aave V3 is a decentralized lending market. In a supply-only route, the vault supplies USDC and receives the variable interest paid by borrowers without taking a loan.',
    'Its APY changes with utilization: when more supplied liquidity is borrowed, rates can rise, while available withdrawal liquidity can fall.',
  ],
  euler: [
    'Euler V2 provides modular lending vaults. Jethos can use a simple supply-only position or, only in an eligible Opportunity route, a collateralized borrow-and-resupply loop.',
    'The exact Euler market, collateral rules, borrow rate, utilization, health factor and adapter limits must all remain within policy.',
  ],
  morpho: [
    'Morpho exposes lending markets and managed vault routes. Jethos can supply assets directly or use a specifically approved collateralized loop in the Opportunity tier.',
    'Market capacity, oracle and collateral configuration, borrow cost, health factor and available liquidity require continuous checks.',
  ],
});

const SVG_NS = 'http://www.w3.org/2000/svg';
const CIRCUMFERENCE = 2 * Math.PI * 36;

function svgNode(name, attributes = {}) {
  const result = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => result.setAttribute(key, value));
  return result;
}

function renderAllocation(component, allocations, depthLabel, onInspect) {
  const chartHost = component.querySelector('[data-inspector-chart]');
  const list = component.querySelector('[data-inspector-list]');
  if (!chartHost || !list) return;

  const svg = svgNode('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': `${depthLabel} allocation` });
  svg.append(svgNode('circle', { class: 'strategy-donut__track', cx: '50', cy: '50', r: '36' }));
  const group = svgNode('g', { transform: 'rotate(-90 50 50)' });
  const slices = [];
  let offset = 0;

  allocations.forEach((allocation) => {
    const slice = svgNode('circle', {
      class: 'strategy-donut__slice', cx: '50', cy: '50', r: '36', tabindex: '0', role: 'button',
      'aria-label': `${allocation.label}: ${allocation.percent}%${allocation.apy ? `, ${allocation.apy} illustrative APY` : ''}`,
      'data-allocation-id': allocation.id,
      'stroke-dasharray': `${CIRCUMFERENCE * allocation.percent / 100} ${CIRCUMFERENCE}`,
      'stroke-dashoffset': `${-CIRCUMFERENCE * offset / 100}`,
      style: `--slice-color:${allocation.color}`,
    });
    offset += allocation.percent;
    slices.push(slice);
    group.append(slice);
  });
  svg.append(group);
  const value = svgNode('text', { x: '50', y: '48', 'text-anchor': 'middle' });
  const label = svgNode('text', { x: '50', y: '59', 'text-anchor': 'middle' });
  value.textContent = '100%';
  label.textContent = depthLabel;
  svg.append(value, label);
  chartHost.replaceChildren(svg);

  const rows = allocations.map((allocation) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'strategy-allocation-row';
    row.dataset.allocationId = allocation.id;
    row.style.setProperty('--row-color', allocation.color);
    const name = document.createElement('span');
    name.append(document.createElement('i'), document.createTextNode(allocation.label));
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

  const highlight = (id = '') => {
    const allocation = allocations.find((entry) => entry.id === id);
    slices.forEach((slice) => slice.classList.toggle('is-active', slice.dataset.allocationId === id));
    rows.forEach((row) => row.classList.toggle('is-active', row.dataset.allocationId === id));
    value.textContent = allocation ? `${allocation.percent}%` : '100%';
    label.textContent = allocation?.label ?? depthLabel;
  };

  [...slices, ...rows].forEach((control) => {
    const id = control.dataset.allocationId;
    control.addEventListener('mouseenter', () => highlight(id));
    control.addEventListener('focus', () => highlight(id));
    control.addEventListener('mouseleave', () => { if (!component.matches(':focus-within')) highlight(); });
    control.addEventListener('blur', () => window.setTimeout(() => { if (!component.matches(':focus-within')) highlight(); }, 0));
    control.addEventListener('click', () => onInspect?.(id));
    control.addEventListener('keydown', (event) => {
      if (control.tagName.toLowerCase() === 'button' || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      onInspect?.(id);
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
  const levels = ['base', 'pro', 'advanced'];
  const panels = Object.fromEntries(levels.map((level) => [level, inspector.querySelector(`[data-view-detail-panel="${level}"]`)]));
  const triggers = Object.fromEntries(levels.map((level) => [level, inspector.querySelector(`[data-view-detail="${level}"]`)]));
  const contexts = { base: null, pro: null, advanced: null };
  let selectedStrategy = 'balanced';

  const setText = (selector, value) => {
    const target = inspector.querySelector(selector);
    if (target) target.textContent = value;
  };
  const element = (tag, className = '', content = '') => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (content !== '') result.textContent = content;
    return result;
  };
  const facts = (entries) => {
    const grid = element('div', 'strategy-detail-facts');
    entries.forEach(([caption, value]) => {
      const item = element('div');
      item.append(element('span', '', caption), element('strong', '', value));
      grid.append(item);
    });
    return grid;
  };
  const section = (caption, copy) => {
    const block = element('section', 'strategy-detail-section');
    block.append(element('span', '', caption), element('p', '', copy));
    return block;
  };
  const formula = (caption, expression) => {
    const block = element('div', 'strategy-detail-formula');
    block.append(element('span', '', caption), element('code', '', expression));
    return block;
  };
  const calculation = (entries) => {
    const block = element('div', 'strategy-detail-calculation');
    entries.forEach(([caption, value]) => {
      const row = element('div');
      row.append(element('span', '', caption), element('strong', '', value));
      block.append(row);
    });
    return block;
  };
  const result = (caption, value) => {
    const block = element('div', 'strategy-detail-result');
    block.append(element('span', '', caption), element('strong', '', value));
    return block;
  };
  const grossYield = (strategy) => strategy.pro.reduce(
    (total, route) => total + (route.percent / 100) * Number.parseFloat(route.apy),
    0,
  );
  const borrowingCopy = (strategy) => strategy.mechanics.borrowing.startsWith('No')
    ? 'No. This illustrative strategy supplies assets to lending markets but does not borrow against them. Leverage remains 1.00×, so there is no loan position to liquidate.'
    : `Yes, but only inside approved collateralized routes. The strategy can borrow ${strategy.mechanics.borrowedAsset}, re-supply it and repeat the operation up to ${strategy.mechanics.loops} times, while respecting a minimum health factor of ${strategy.mechanics.minHealth}.`;

  function strategyContent(level, strategy) {
    const detail = STRATEGY_DETAILS[selectedStrategy];
    const fragment = document.createDocumentFragment();
    const gross = grossYield(strategy);
    const cost = Number.parseFloat(strategy.cost);

    if (level === 'base') {
      fragment.append(
        element('p', 'strategy-detail-lede', `${strategy.label} explained without protocol terminology.`),
        facts([['Example deposit', '$10,000'], ['Risk', strategy.risk], ['Illustrative APY', strategy.yield], ['Exit profile', strategy.exit]]),
        section('Goal', detail.purpose),
        section('What lending means', 'The vault deposits part of the money into approved lending markets. Those markets make liquidity available to borrowers, who pay interest. That interest becomes part of the vault return; borrowers never receive access to your wallet.'),
        section('Does it borrow or use leverage?', borrowingCopy(strategy)),
        calculation(strategy.base.map((entry) => [ `${entry.label} · ${entry.percent}%`, `$${(entry.percent * 100).toLocaleString('en-US')}` ])),
        formula('Simple rule', 'Amount in each category = your deposit × allocation share'),
        section('What you accept', detail.tradeoff),
        result('Base answers', 'What happens to your money'),
      );
    } else if (level === 'pro') {
      fragment.append(
        element('p', 'strategy-detail-lede', 'The same strategy opened into protocol routes and weighted yield contribution.'),
        facts([
          ['Network', strategy.network],
          ['Asset', 'USDC'],
          ['Borrowing', strategy.mechanics.borrowing],
          ['Maximum leverage', strategy.mechanics.maxLeverage],
          ['Gross weighted APY', `${gross.toFixed(2)}%`],
          ['Estimated costs', `− ${strategy.cost}`],
        ]),
        section('How the protocols are used', strategy.pro
          .filter((route) => route.id !== 'reserve')
          .map((route) => `${route.label}: ${route.operation.toLowerCase()}`)
          .join(' · ')),
        section('Borrowing and loops', borrowingCopy(strategy)),
        calculation(strategy.pro.map((route) => [
          `${route.label} · ${route.operation}: ${route.percent}% × ${route.apy}`,
          `${((route.percent / 100) * Number.parseFloat(route.apy)).toFixed(2)} pp`,
        ])),
        formula('Weighted return', 'Gross APY = Σ(route allocation × route APY)'),
        section('Allocation decision', strategy.decision),
        result('After costs and policy buffer', strategy.yield),
      );
    } else {
      const largest = Math.max(...strategy.pro.map((route) => route.percent));
      const reserve = strategy.pro.find((route) => route.id === 'reserve')?.percent ?? 0;
      fragment.append(
        element('p', 'strategy-detail-lede', 'The same calculation with explicit eligibility rules, buffers and verifiable records.'),
        facts([
          ['Reserve test', `${reserve}% ≥ ${strategy.reserve}`],
          ['Concentration test', `${largest}% ≤ ${strategy.cap}`],
          ['Borrowing', strategy.mechanics.borrowing],
          ['Maximum LTV', strategy.mechanics.maxLtv],
          ['Minimum health factor', strategy.mechanics.minHealth],
          ['Maximum leverage', strategy.mechanics.maxLeverage],
          ['Maximum loops', strategy.mechanics.loops],
          ['Liquidation exposure', strategy.mechanics.liquidation],
          ['Gross weighted APY', `${gross.toFixed(3)}%`],
          ['Policy buffer', `− ${strategy.policyBuffer.toFixed(3)}%`],
        ]),
        formula('Eligibility', 'eligible(route) = approved ∧ share ≤ cap ∧ liquidity ≥ floor ∧ utilization ≤ trigger'),
        formula('Loan-to-value', strategy.mechanics.borrowing.startsWith('No') ? 'LTV = 0% because this strategy does not borrow' : 'LTV = borrowed value ÷ collateral value ≤ 62%'),
        formula('Health factor', strategy.mechanics.borrowing.startsWith('No') ? 'Not applicable: debt value = 0' : 'HF = (collateral value × liquidation threshold) ÷ debt value ≥ 1.60'),
        formula('Leverage', strategy.mechanics.borrowing.startsWith('No') ? 'Leverage = supplied exposure ÷ depositor equity = 1.00×' : 'Leverage = total supplied exposure ÷ depositor equity ≤ 1.75×'),
        section('Loop sequence', strategy.mechanics.borrowing.startsWith('No')
          ? 'No loop is allowed: deposit → supply → hold or withdraw.'
          : `Deposit collateral → borrow ${strategy.mechanics.borrowedAsset} → re-supply the borrowed amount → repeat no more than ${strategy.mechanics.loops} times. Every cycle must pass LTV, health-factor, cost and liquidity checks.`),
        formula('Net estimate', `Σ(wᵢ × APYᵢ) − costs − buffer = ${gross.toFixed(3)}% − ${cost.toFixed(2)}% − ${strategy.policyBuffer.toFixed(3)}% ≈ ${strategy.yield}`),
        calculation(strategy.pro.map((route) => [route.position, `${route.percent}% · ${route.operation} · ${route.proof}`])),
        section('Rebalance condition', `${strategy.trigger}. A failed rule excludes or reduces the route before a new allocation is accepted.`),
        section('Evidence', detail.evidence),
        result('Policy result', 'Eligible illustrative allocation'),
      );
    }
    return fragment;
  }

  function routeContent(level, strategy, routeId) {
    const routes = level === 'base' ? strategy.base : strategy.pro;
    const route = routes.find((entry) => entry.id === routeId);
    const copy = ROUTE_DETAILS[routeId];
    if (!route || !copy) return strategyContent(level, strategy);
    const fragment = document.createDocumentFragment();

    if (level === 'base') {
      fragment.append(
        element('p', 'strategy-detail-lede', `${route.label} in plain language.`),
        facts([['Share', `${route.percent}%`], ['Per $10,000', `$${(route.percent * 100).toLocaleString('en-US')}`], ['Detail', 'Grouped category'], ['Risk', strategy.risk]]),
        section('What it does', copy[0]),
        section('Does this strategy take a loan?', borrowingCopy(strategy)),
        section('What to watch', copy[1]),
        formula('Simple calculation', `$10,000 × ${route.percent}% = $${(route.percent * 100).toLocaleString('en-US')}`),
        result('Open Pro for', 'Protocols and individual APYs'),
      );
      return fragment;
    }

    const contribution = (route.percent / 100) * Number.parseFloat(route.apy);
    if (level === 'pro') {
      fragment.append(
        element('p', 'strategy-detail-lede', `${route.label} as an individual protocol route.`),
        facts([
          ['Allocation', `${route.percent}%`],
          ['Route APY', route.apy],
          ['Contribution', `${contribution.toFixed(2)} pp`],
          ['Network', strategy.network],
          ['Operation', route.operation],
          ['Asset supplied', route.supplied],
          ['Asset borrowed', route.borrowed],
          ['Leverage', route.leverage],
        ]),
        section('Role', copy[0]),
        section('What happens step by step', route.borrowed === 'None'
          ? `${route.supplied} is supplied to ${route.label}; the position receives the lending yield and no debt is opened.`
          : `${route.supplied} is supplied as collateral, ${route.borrowed} is borrowed and the borrowed amount is supplied again. This increases both earning exposure and liquidation risk.`),
        formula('Contribution', `${route.percent}% × ${route.apy} = ${contribution.toFixed(2)} percentage points`),
        section('Dependency', copy[1]),
        result('Position record', route.position),
      );
    } else {
      fragment.append(
        element('p', 'strategy-detail-lede', `${route.label} with policy and evidence boundaries exposed.`),
        facts([
          ['Position ID', route.position],
          ['Current share', `${route.percent}%`],
          ['Maximum route', strategy.cap],
          ['Operation', route.operation],
          ['Supplied', route.supplied],
          ['Borrowed', route.borrowed],
          ['LTV', route.ltv],
          ['Health factor', route.health],
          ['Leverage', route.leverage],
          ['Loop depth', route.loop],
          ['Proof', route.proof],
        ]),
        formula('Route eligibility', `${route.percent}% ≤ ${strategy.cap} ∧ approved adapter ∧ liquidity test ∧ ${strategy.trigger}`),
        formula('LTV check', route.borrowed === 'None'
          ? 'borrowed value = 0 → LTV = 0%'
          : `LTV = borrowed value ÷ collateral value = ${route.ltv} ≤ ${strategy.mechanics.maxLtv}`),
        formula('Health-factor check', route.borrowed === 'None'
          ? 'No debt → health factor and liquidation threshold do not apply'
          : `HF = (collateral × liquidation threshold) ÷ debt = ${route.health} ≥ ${strategy.mechanics.minHealth}`),
        formula('Leverage check', `gross supplied exposure ÷ depositor equity = ${route.leverage} ≤ ${strategy.mechanics.maxLeverage}`),
        section('Loop mechanics', route.borrowed === 'None'
          ? 'No recursive position: the route performs one supply operation and opens no loan.'
          : `${route.loop}: supply collateral → borrow ${route.borrowed} → re-supply. A further cycle is blocked if health factor, LTV, borrow cost or available exit liquidity fails policy.`),
        formula('Route APY mechanics', route.yieldMechanics ?? `${route.apy} variable supply APY; borrowed amount = 0, so borrow cost = 0`),
        formula('Yield contribution', `${route.percent}% × ${route.apy} = ${contribution.toFixed(3)} pp before costs and buffers`),
        section('Material dependency', copy[1]),
        section('Verification', `${route.position} would link contract, transaction, block and timestamp in a live deployment.`),
        result('Illustrative rule check', Number.parseFloat(strategy.cap) >= route.percent ? 'Pass' : 'Fail'),
      );
    }
    return fragment;
  }

  function renderPanel(level) {
    const panel = panels[level];
    const context = contexts[level];
    if (!panel || !context) return;
    const strategy = STRATEGIES[selectedStrategy];
    const routes = level === 'base' ? strategy.base : strategy.pro;
    const route = context === 'strategy' ? null : routes.find((entry) => entry.id === context);
    const title = panel.querySelector('[data-view-detail-title]');
    const content = panel.querySelector('[data-view-detail-content]');
    if (title) title.textContent = route ? `${route.label} · ${strategy.label}` : strategy.label;
    content?.replaceChildren(context === 'strategy' ? strategyContent(level, strategy) : routeContent(level, strategy, context));
  }

  function openPanel(level, context = 'strategy') {
    if (!panels[level]) return;
    contexts[level] = context;
    panels[level].hidden = false;
    triggers[level]?.setAttribute('aria-expanded', 'true');
    renderPanel(level);
  }

  function closePanel(level) {
    if (!panels[level]) return;
    panels[level].hidden = true;
    contexts[level] = null;
    triggers[level]?.setAttribute('aria-expanded', 'false');
  }

  function render(strategyId) {
    const strategy = STRATEGIES[strategyId] || STRATEGIES.balanced;
    selectedStrategy = strategyId;
    controls.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.inspectorStrategy === strategyId)));
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

    renderAllocation(baseAllocation, strategy.base, 'summary', (routeId) => openPanel('base', routeId));
    renderAllocation(proAllocation, strategy.pro, 'routes', (routeId) => openPanel('pro', routeId));
    advancedRoutes?.replaceChildren(...strategy.pro.map((route) => {
      const row = element('button', 'strategy-route-row');
      row.type = 'button';
      row.append(element('span', '', route.position), element('span', '', route.label), element('strong', '', `${route.percent}%`), element('em', '', route.proof));
      row.addEventListener('click', () => openPanel('advanced', route.id));
      return row;
    }));

    if (proofNote) proofNote.hidden = true;
    if (proofButton) {
      proofButton.textContent = 'Inspect';
      proofButton.setAttribute('aria-expanded', 'false');
    }
    levels.forEach(renderPanel);
  }

  controls.forEach((control) => control.addEventListener('click', () => render(control.dataset.inspectorStrategy)));
  levels.forEach((level) => {
    triggers[level]?.addEventListener('click', () => {
      if (contexts[level] === 'strategy') closePanel(level);
      else openPanel(level);
    });
    panels[level]?.querySelector('[data-view-detail-close]')?.addEventListener('click', () => closePanel(level));
  });
  proofButton?.addEventListener('click', () => {
    const open = proofNote?.hidden ?? false;
    if (proofNote) proofNote.hidden = !open;
    proofButton.textContent = open ? 'Close' : 'Inspect';
    proofButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!levels.some((level) => panels[level] && !panels[level].hidden)) return;
    if (event.target.closest(
      '[data-view-detail-panel], [data-view-detail], [data-inspector-strategy], '
      + '.strategy-allocation-row, .strategy-donut__slice, .strategy-route-row',
    )) return;
    levels.forEach(closePanel);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') levels.forEach(closePanel);
  });

  render(selectedStrategy);
});
