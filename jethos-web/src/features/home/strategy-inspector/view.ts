import {
  grossYield,
  ROUTE_DETAILS,
  STRATEGIES,
  STRATEGY_DETAILS,
  type Strategy,
  type StrategyId,
  type StrategyLevel,
} from './model';

interface Allocation {
  id: string;
  label: string;
  percent: number;
  color: string;
  apy?: string;
  position?: string;
  proof?: string;
  operation?: string;
  supplied?: string;
  borrowed?: string;
  ltv?: string;
  health?: string;
  leverage?: string;
  loop?: string;
  yieldMechanics?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const CIRCUMFERENCE = 2 * Math.PI * 36;

const svgNode = (name: string, attributes: Record<string, string> = {}): SVGElement => {
  const result = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value);
  return result;
};

export const element = <Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className = '',
  content = '',
): HTMLElementTagNameMap[Tag] => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content) result.textContent = content;
  return result;
};

const facts = (entries: ReadonlyArray<readonly [string, string]>): HTMLElement => {
  const grid = element('div', 'strategy-detail-facts');
  for (const [caption, value] of entries) {
    const item = element('div');
    item.append(element('span', '', caption), element('strong', '', value));
    grid.append(item);
  }
  return grid;
};

const copySection = (caption: string, copy: string): HTMLElement => {
  const block = element('section', 'strategy-detail-section');
  block.append(element('span', '', caption), element('p', '', copy));
  return block;
};

const formula = (caption: string, expression: string): HTMLElement => {
  const block = element('div', 'strategy-detail-formula');
  block.append(element('span', '', caption), element('code', '', expression));
  return block;
};

const calculation = (entries: ReadonlyArray<readonly [string, string]>): HTMLElement => {
  const block = element('div', 'strategy-detail-calculation');
  for (const [caption, value] of entries) {
    const row = element('div');
    row.append(element('span', '', caption), element('strong', '', value));
    block.append(row);
  }
  return block;
};

const result = (caption: string, value: string): HTMLElement => {
  const block = element('div', 'strategy-detail-result');
  block.append(element('span', '', caption), element('strong', '', value));
  return block;
};

const borrowingCopy = (strategy: Strategy): string =>
  strategy.mechanics.borrowing.startsWith('No')
    ? 'No. This illustrative strategy supplies assets to lending markets but does not borrow against them. Leverage remains 1.00×, so there is no loan position to liquidate.'
    : `Yes, but only inside approved collateralized routes. The strategy can borrow ${strategy.mechanics.borrowedAsset}, re-supply it and repeat the operation up to ${strategy.mechanics.loops} times, while respecting a minimum health factor of ${strategy.mechanics.minHealth}.`;

export function renderAllocation(
  component: HTMLElement,
  allocations: readonly Allocation[],
  depthLabel: string,
  onInspect: (id: string) => void,
  signal: AbortSignal,
): void {
  const chartHost = component.querySelector<HTMLElement>('[data-inspector-chart]');
  const list = component.querySelector<HTMLElement>('[data-inspector-list]');
  if (!chartHost || !list) throw new Error(`Strategy ${depthLabel} allocation host is incomplete.`);
  chartHost.setAttribute('role', 'group');

  const svg = svgNode('svg', {
    viewBox: '0 0 100 100',
    role: 'group',
    'aria-label': `${depthLabel} allocation`,
  });
  svg.append(svgNode('circle', { class: 'strategy-donut__track', cx: '50', cy: '50', r: '36' }));
  const group = svgNode('g', { transform: 'rotate(-90 50 50)' });
  const slices: SVGElement[] = [];
  let offset = 0;
  for (const allocation of allocations) {
    const slice = svgNode('circle', {
      class: 'strategy-donut__slice',
      cx: '50',
      cy: '50',
      r: '36',
      tabindex: '0',
      role: 'button',
      'aria-label': `${allocation.label}: ${allocation.percent}%${allocation.apy ? `, ${allocation.apy} illustrative APY` : ''}`,
      'data-allocation-id': allocation.id,
      'stroke-dasharray': `${(CIRCUMFERENCE * allocation.percent) / 100} ${CIRCUMFERENCE}`,
      'stroke-dashoffset': `${(-CIRCUMFERENCE * offset) / 100}`,
      style: `--slice-color:${allocation.color}`,
    });
    offset += allocation.percent;
    slices.push(slice);
    group.append(slice);
  }
  svg.append(group);
  const value = svgNode('text', { x: '50', y: '48', 'text-anchor': 'middle' });
  const label = svgNode('text', { x: '50', y: '59', 'text-anchor': 'middle' });
  value.textContent = '100%';
  label.textContent = depthLabel;
  svg.append(value, label);
  chartHost.replaceChildren(svg);

  const rows = allocations.map((allocation) => {
    const row = element('button', 'strategy-allocation-row');
    row.type = 'button';
    row.dataset.allocationId = allocation.id;
    row.style.setProperty('--row-color', allocation.color);
    const name = element('span');
    name.append(element('i'), document.createTextNode(allocation.label));
    const metric = element('div');
    metric.append(element('strong', '', `${allocation.percent}%`));
    if (allocation.apy) metric.append(element('small', '', `${allocation.apy} APY`));
    row.append(name, metric);
    return row;
  });
  list.replaceChildren(...rows);

  const highlight = (id = '') => {
    const allocation = allocations.find((entry) => entry.id === id);
    for (const slice of slices)
      slice.classList.toggle('is-active', slice.dataset.allocationId === id);
    for (const row of rows) row.classList.toggle('is-active', row.dataset.allocationId === id);
    value.textContent = allocation ? `${allocation.percent}%` : '100%';
    label.textContent = allocation?.label ?? depthLabel;
  };
  for (const control of [...slices, ...rows]) {
    const id = control.dataset.allocationId ?? '';
    control.addEventListener('mouseenter', () => highlight(id), { signal });
    control.addEventListener('focus', () => highlight(id), { signal });
    control.addEventListener(
      'mouseleave',
      () => {
        if (!component.matches(':focus-within')) highlight();
      },
      { signal },
    );
    control.addEventListener(
      'blur',
      () => window.setTimeout(() => !component.matches(':focus-within') && highlight()),
      { signal },
    );
    control.addEventListener('click', () => onInspect(id), { signal });
    control.addEventListener(
      'keydown',
      (event) => {
        if (
          control instanceof HTMLButtonElement ||
          !(event instanceof KeyboardEvent) ||
          !['Enter', ' '].includes(event.key)
        )
          return;
        event.preventDefault();
        onInspect(id);
      },
      { signal },
    );
  }
}

export function strategyContent(level: StrategyLevel, strategyId: StrategyId): DocumentFragment {
  const strategy = STRATEGIES[strategyId];
  const detail = STRATEGY_DETAILS[strategyId];
  const fragment = document.createDocumentFragment();
  const gross = grossYield(strategy);
  const cost = Number.parseFloat(strategy.cost);

  if (level === 'base') {
    fragment.append(
      element(
        'p',
        'strategy-detail-lede',
        `${strategy.label} explained without protocol terminology.`,
      ),
      facts([
        ['Example deposit', '$10,000'],
        ['Risk', strategy.risk],
        ['Illustrative APY', strategy.yield],
        ['Exit profile', strategy.exit],
      ]),
      copySection('Goal', detail.purpose),
      copySection(
        'What lending means',
        'The vault deposits part of the money into approved lending markets. Those markets make liquidity available to borrowers, who pay interest. That interest becomes part of the vault return; borrowers never receive access to your wallet.',
      ),
      copySection('Does it borrow or use leverage?', borrowingCopy(strategy)),
      calculation(
        strategy.base.map((entry) => [
          `${entry.label} · ${entry.percent}%`,
          `$${(entry.percent * 100).toLocaleString('en-US')}`,
        ]),
      ),
      formula('Simple rule', 'Amount in each category = your deposit × allocation share'),
      copySection('What you accept', detail.tradeoff),
      result('Base answers', 'What happens to your money'),
    );
  } else if (level === 'pro') {
    fragment.append(
      element(
        'p',
        'strategy-detail-lede',
        'The same strategy opened into protocol routes and weighted yield contribution.',
      ),
      facts([
        ['Network', strategy.network],
        ['Asset', 'USDC'],
        ['Borrowing', strategy.mechanics.borrowing],
        ['Maximum leverage', strategy.mechanics.maxLeverage],
        ['Gross weighted APY', `${gross.toFixed(2)}%`],
        ['Estimated costs', `− ${strategy.cost}`],
      ]),
      copySection(
        'How the protocols are used',
        strategy.pro
          .filter((route) => route.id !== 'reserve')
          .map((route) => `${route.label}: ${route.operation.toLowerCase()}`)
          .join(' · '),
      ),
      copySection('Borrowing and loops', borrowingCopy(strategy)),
      calculation(
        strategy.pro.map((route) => [
          `${route.label} · ${route.operation}: ${route.percent}% × ${route.apy}`,
          `${((route.percent / 100) * Number.parseFloat(route.apy)).toFixed(2)} pp`,
        ]),
      ),
      formula('Weighted return', 'Gross APY = Σ(route allocation × route APY)'),
      copySection('Allocation decision', strategy.decision),
      result('After costs and policy buffer', strategy.yield),
    );
  } else {
    const largest = Math.max(...strategy.pro.map((route) => route.percent));
    const reserve = strategy.pro.find((route) => route.id === 'reserve')?.percent ?? 0;
    fragment.append(
      element(
        'p',
        'strategy-detail-lede',
        'The same calculation with explicit eligibility rules, buffers and verifiable records.',
      ),
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
      formula(
        'Eligibility',
        'eligible(route) = approved ∧ share ≤ cap ∧ liquidity ≥ floor ∧ utilization ≤ trigger',
      ),
      formula(
        'Loan-to-value',
        strategy.mechanics.borrowing.startsWith('No')
          ? 'LTV = 0% because this strategy does not borrow'
          : 'LTV = borrowed value ÷ collateral value ≤ 62%',
      ),
      formula(
        'Health factor',
        strategy.mechanics.borrowing.startsWith('No')
          ? 'Not applicable: debt value = 0'
          : 'HF = (collateral value × liquidation threshold) ÷ debt value ≥ 1.60',
      ),
      formula(
        'Leverage',
        strategy.mechanics.borrowing.startsWith('No')
          ? 'Leverage = supplied exposure ÷ depositor equity = 1.00×'
          : 'Leverage = total supplied exposure ÷ depositor equity ≤ 1.75×',
      ),
      copySection(
        'Loop sequence',
        strategy.mechanics.borrowing.startsWith('No')
          ? 'No loop is allowed: deposit → supply → hold or withdraw.'
          : `Deposit collateral → borrow ${strategy.mechanics.borrowedAsset} → re-supply the borrowed amount → repeat no more than ${strategy.mechanics.loops} times. Every cycle must pass LTV, health-factor, cost and liquidity checks.`,
      ),
      formula(
        'Net estimate',
        `Σ(wᵢ × APYᵢ) − costs − buffer = ${gross.toFixed(3)}% − ${cost.toFixed(2)}% − ${strategy.policyBuffer.toFixed(3)}% ≈ ${strategy.yield}`,
      ),
      calculation(
        strategy.pro.map((route) => [
          route.position,
          `${route.percent}% · ${route.operation} · ${route.proof}`,
        ]),
      ),
      copySection(
        'Rebalance condition',
        `${strategy.trigger}. A failed rule excludes or reduces the route before a new allocation is accepted.`,
      ),
      copySection('Evidence', detail.evidence),
      result('Policy result', 'Eligible illustrative allocation'),
    );
  }
  return fragment;
}

export function routeContent(
  level: StrategyLevel,
  strategyId: StrategyId,
  routeId: string,
): DocumentFragment {
  const strategy = STRATEGIES[strategyId];
  const routes: readonly Allocation[] = level === 'base' ? strategy.base : strategy.pro;
  const route = routes.find((entry) => entry.id === routeId);
  const copy = ROUTE_DETAILS[routeId as keyof typeof ROUTE_DETAILS];
  if (!route || !copy) return strategyContent(level, strategyId);
  const [primaryCopy = '', secondaryCopy = ''] = copy;
  const fragment = document.createDocumentFragment();

  if (level === 'base') {
    fragment.append(
      element('p', 'strategy-detail-lede', `${route.label} in plain language.`),
      facts([
        ['Share', `${route.percent}%`],
        ['Per $10,000', `$${(route.percent * 100).toLocaleString('en-US')}`],
        ['Detail', 'Grouped category'],
        ['Risk', strategy.risk],
      ]),
      copySection('What it does', primaryCopy),
      copySection('Does this strategy take a loan?', borrowingCopy(strategy)),
      copySection('What to watch', secondaryCopy),
      formula(
        'Simple calculation',
        `$10,000 × ${route.percent}% = $${(route.percent * 100).toLocaleString('en-US')}`,
      ),
      result('Open Pro for', 'Protocols and individual APYs'),
    );
    return fragment;
  }

  const apy = route.apy ?? '0%';
  const contribution = (route.percent / 100) * Number.parseFloat(apy);
  if (level === 'pro') {
    fragment.append(
      element('p', 'strategy-detail-lede', `${route.label} as an individual protocol route.`),
      facts([
        ['Allocation', `${route.percent}%`],
        ['Route APY', apy],
        ['Contribution', `${contribution.toFixed(2)} pp`],
        ['Network', strategy.network],
        ['Operation', route.operation ?? 'Grouped route'],
        ['Asset supplied', route.supplied ?? 'USDC'],
        ['Asset borrowed', route.borrowed ?? 'None'],
        ['Leverage', route.leverage ?? '1.00×'],
      ]),
      copySection('Role', primaryCopy),
      copySection(
        'What happens step by step',
        route.borrowed === 'None'
          ? `${route.supplied} is supplied to ${route.label}; the position receives the lending yield and no debt is opened.`
          : `${route.supplied} is supplied as collateral, ${route.borrowed} is borrowed and the borrowed amount is supplied again. This increases both earning exposure and liquidation risk.`,
      ),
      formula(
        'Contribution',
        `${route.percent}% × ${apy} = ${contribution.toFixed(2)} percentage points`,
      ),
      copySection('Dependency', secondaryCopy),
      result('Position record', route.position ?? 'Illustrative grouped route'),
    );
  } else {
    const capPasses = Number.parseFloat(strategy.cap) >= route.percent;
    fragment.append(
      element(
        'p',
        'strategy-detail-lede',
        `${route.label} with policy and evidence boundaries exposed.`,
      ),
      facts([
        ['Position ID', route.position ?? 'Illustrative'],
        ['Current share', `${route.percent}%`],
        ['Maximum route', strategy.cap],
        ['Operation', route.operation ?? 'Grouped route'],
        ['Supplied', route.supplied ?? 'USDC'],
        ['Borrowed', route.borrowed ?? 'None'],
        ['LTV', route.ltv ?? '0%'],
        ['Health factor', route.health ?? 'N/A'],
        ['Leverage', route.leverage ?? '1.00×'],
        ['Loop depth', route.loop ?? 'None'],
        ['Proof', route.proof ?? 'Illustrative'],
      ]),
      formula(
        'Route eligibility',
        `${route.percent}% ≤ ${strategy.cap} ∧ approved adapter ∧ liquidity test ∧ ${strategy.trigger}`,
      ),
      formula(
        'LTV check',
        route.borrowed === 'None'
          ? 'borrowed value = 0 → LTV = 0%'
          : `LTV = borrowed value ÷ collateral value = ${route.ltv} ≤ ${strategy.mechanics.maxLtv}`,
      ),
      formula(
        'Health-factor check',
        route.borrowed === 'None'
          ? 'No debt → health factor and liquidation threshold do not apply'
          : `HF = (collateral × liquidation threshold) ÷ debt = ${route.health} ≥ ${strategy.mechanics.minHealth}`,
      ),
      formula(
        'Leverage check',
        `gross supplied exposure ÷ depositor equity = ${route.leverage} ≤ ${strategy.mechanics.maxLeverage}`,
      ),
      copySection(
        'Loop mechanics',
        route.borrowed === 'None'
          ? 'No recursive position: the route performs one supply operation and opens no loan.'
          : `${route.loop}: supply collateral → borrow ${route.borrowed} → re-supply. A further cycle is blocked if health factor, LTV, borrow cost or available exit liquidity fails policy.`,
      ),
      formula(
        'Route APY mechanics',
        route.yieldMechanics ??
          `${apy} variable supply APY; borrowed amount = 0, so borrow cost = 0`,
      ),
      formula(
        'Yield contribution',
        `${route.percent}% × ${apy} = ${contribution.toFixed(3)} pp before costs and buffers`,
      ),
      copySection('Material dependency', secondaryCopy),
      copySection(
        'Verification',
        `${route.position} would link contract, transaction, block and timestamp in a live deployment.`,
      ),
      result('Illustrative rule check', capPasses ? 'Pass' : 'Fail'),
    );
  }
  return fragment;
}
