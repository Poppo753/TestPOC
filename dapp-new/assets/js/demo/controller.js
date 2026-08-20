import {
  DEMO_ASSETS, DEMO_NETWORKS, DEMO_VAULTS, assetById, vaultById, vaultId,
} from './data.js';
import { createInitialState, loadDemoState, saveDemoState, clearDemoState } from './storage.js';
import { advanceDays, deposit, positionValue, summarize, withdraw } from './engine.js';

/**
 * Browser-only product simulation.
 *
 * Homepage concepts map to explicit screens:
 * dashboard -> Wallet / Portfolio; Base-Pro-Advanced -> progressively greater
 * choice and explanation; position -> transparency receipt and withdrawal.
 * This module never imports the real Web3 transaction layer.
 */
const ROUTES = new Set(['overview', 'wallet', 'vaults', 'portfolio', 'activity', 'transparency', 'receipts']);
const view = document.getElementById('demo-view');
const modalBackdrop = document.querySelector('[data-demo-modal]');
const modalContent = document.getElementById('demo-modal-content');
const modalClose = document.querySelector('[data-demo-modal-close]');
const modalPanel = document.querySelector('.demo-modal');
const toastRegion = document.querySelector('[data-demo-toasts]');

let state = loadDemoState();
let experience = 'base';
let selectedChain = 'plasma';
let selectedAsset = 'usdc';
let selectedProfile = 'conservative';
let operation = null;
let dialog = null;
let returnFocus = null;

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const signedMoney = (value) => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
const apy = (value) => `${(value * 100).toFixed(1)}%`;
const date = (value) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function el(tag, { className, text, attrs = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  node.append(...children.filter(Boolean));
  return node;
}

function button(label, className, action, attrs = {}) {
  const node = el('button', { className, text: label, attrs: { type: 'button', ...attrs } });
  node.addEventListener('click', action);
  return node;
}
function actionCard(className, action, label, children) {
  const node = button('', className, action, { 'aria-label': label });
  node.append(...children.filter(Boolean));
  return node;
}

const activeChain = () => experience === 'base' ? 'plasma' : selectedChain;
const activeAsset = () => experience === 'advanced' ? selectedAsset : 'usdc';
const activeVaultId = (profileId = selectedProfile) => vaultId(profileId, activeChain(), activeAsset());

function navigate(route) {
  window.location.hash = route;
  if (currentRoute() === route) render();
}
function currentRoute() {
  const route = window.location.hash.slice(1).split('?')[0];
  return ROUTES.has(route) ? route : 'overview';
}
function saveAndRender(route) {
  saveDemoState(state);
  if (route) navigate(route);
  else render();
}
function toast(message) {
  const item = el('div', { className: 'toast', text: message, attrs: { role: 'status' } });
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4200);
}
function header(eyebrow, title, description, actions = []) {
  return el('header', { className: 'demo-view-header' }, [
    el('div', {}, [el('p', { className: 'eyebrow', text: eyebrow }), el('h2', { text: title }), el('p', { text: description })]),
    actions.length ? el('div', { className: 'cluster' }, actions) : null,
  ]);
}
function metric(label, value, className = '', action = null) {
  const content = [el('span', { className: 'demo-label', text: label }), el('strong', { className: 'demo-value', text: value })];
  if (!action) return el('article', { className: `card ${className}`.trim() }, content);
  return actionCard(`card demo-metric-button ${className}`.trim(), action, `${label}: ${value}`, content);
}
function stat(label, value) {
  return el('div', {}, [el('span', { className: 'demo-label', text: label }), el('strong', { text: value })]);
}
function emptyState(title, description, actionLabel, action) {
  return el('div', { className: 'demo-empty' }, [
    el('h3', { text: title }), el('p', { text: description }), button(actionLabel, 'button button--primary', action),
  ]);
}

/**
 * Shared wallet/vault allocation explorer.
 *
 * Hovering or focusing a row highlights its chart segment and vice versa.
 * Reusing one factory prevents the Wallet, Vault and Receipt screens from
 * drifting into three subtly different interaction models.
 */
function allocationExplorer(items, {
  center = '100%', centerLabel = 'mapped', valueKey = 'value', total = null,
  onSelect = null, valueLabel = (item, percent) => `${percent}%`,
} = {}) {
  const sum = total ?? items.reduce((value, item) => value + Number(item[valueKey] || 0), 0);
  const wrapper = el('div', { className: 'demo-allocation-explorer' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'demo-allocation-chart');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Interactive allocation chart');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  Object.entries({ cx: 60, cy: 60, r: 42, pathLength: 100 }).forEach(([name, value]) => track.setAttribute(name, value));
  track.setAttribute('class', 'demo-allocation-chart__track');
  svg.append(track);
  const slices = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  slices.setAttribute('transform', 'rotate(-90 60 60)');
  svg.append(slices);

  const rows = el('div', { className: 'demo-allocation-list' });
  const pairs = [];
  let cursor = 0;
  const clear = () => pairs.forEach(({ row, slice }) => {
    row.classList.remove('is-active');
    slice.classList.remove('is-active');
  });
  const activate = (pair) => {
    clear();
    pair.row.classList.add('is-active');
    pair.slice.classList.add('is-active');
  };

  items.forEach((item, index) => {
    const raw = Number(item[valueKey] || 0);
    const percent = sum ? (raw / sum) * 100 : 0;
    const color = item.color || `var(--allocation-color-${index + 1})`;
    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    Object.entries({ cx: 60, cy: 60, r: 42, pathLength: 100 }).forEach(([name, value]) => slice.setAttribute(name, value));
    slice.setAttribute('class', 'demo-allocation-chart__slice');
    slice.setAttribute('stroke', color);
    slice.setAttribute('stroke-dasharray', `${percent} ${100 - percent}`);
    slice.setAttribute('stroke-dashoffset', `${-cursor}`);
    slice.setAttribute('tabindex', '0');
    slice.setAttribute('role', onSelect ? 'button' : 'img');
    slice.setAttribute('aria-label', `${item.label || item.symbol || item.name}: ${valueLabel(item, Math.round(percent))}`);
    cursor += percent;
    slices.append(slice);

    const row = actionCard('demo-allocation-row', () => onSelect?.(item), `${item.label || item.symbol || item.name}: ${valueLabel(item, Math.round(percent))}`, [
      el('i', { attrs: { style: `--allocation-color:${color}` } }),
      el('span', {}, [
        el('strong', { text: item.label || item.symbol || item.name }),
        el('small', { text: item.subtitle || item.protocol || item.category || '' }),
      ]),
      el('span', {}, [
        el('strong', { text: valueLabel(item, Math.round(percent)) }),
        item.apy !== undefined ? el('small', { text: `${apy(item.apy)} APY` }) : null,
      ]),
    ]);
    const pair = { row, slice };
    pairs.push(pair);
    [row, slice].forEach((target) => {
      target.addEventListener('pointerenter', () => activate(pair));
      target.addEventListener('focus', () => activate(pair));
      target.addEventListener('pointerleave', clear);
      target.addEventListener('blur', clear);
      if (target === slice && onSelect) target.addEventListener('click', () => onSelect(item));
    });
    rows.append(row);
  });

  const centerValue = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  centerValue.setAttribute('x', '60'); centerValue.setAttribute('y', '57'); centerValue.setAttribute('text-anchor', 'middle');
  centerValue.setAttribute('class', 'demo-allocation-chart__value'); centerValue.textContent = center;
  const centerCaption = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  centerCaption.setAttribute('x', '60'); centerCaption.setAttribute('y', '70'); centerCaption.setAttribute('text-anchor', 'middle');
  centerCaption.setAttribute('class', 'demo-allocation-chart__label'); centerCaption.textContent = centerLabel;
  svg.append(centerValue, centerCaption);
  wrapper.append(svg, rows);
  return wrapper;
}

function renderOverview() {
  const summary = summarize(state);
  return [
    header('Your financial home', 'One balance. Two clear sides.', 'The same financial-home dashboard shown on the landing page, now fully navigable.', [
      button('Explore vaults', 'button button--primary', () => navigate('vaults')),
    ]),
    el('section', { className: 'demo-home-dashboard', attrs: { 'aria-label': 'Jethos financial home dashboard' } }, [
      el('div', { className: 'demo-home-dashboard__top' }, [
        el('span', { className: 'eyebrow', text: 'Your financial home' }),
        el('span', { className: 'badge badge--illustrative', text: 'Illustrative' }),
      ]),
      el('span', { className: 'demo-home-dashboard__label', text: 'Assets visible through Jethos' }),
      el('strong', { className: 'demo-home-dashboard__total', text: money(summary.total) }),
      el('div', { className: 'demo-home-dashboard__split' }, [
        actionCard('demo-home-balance demo-home-balance--wallet', () => navigate('wallet'), 'Open your wallet', [
          el('span', { className: 'badge badge--implemented', text: 'Available' }),
          el('span', { className: 'demo-label', text: 'In your wallet' }),
          el('strong', { text: money(summary.wallet) }),
          el('small', { text: 'Under your direct control' }),
        ]),
        actionCard('demo-home-balance demo-home-balance--vault', () => navigate('portfolio'), 'Open transparent vault positions', [
          el('span', { className: 'badge badge--illustrative', text: 'Invested' }),
          el('span', { className: 'demo-label', text: 'In transparent vaults' }),
          el('strong', { text: money(summary.vaultValue) }),
          el('small', { text: 'Route, rules and risk visible' }),
        ]),
      ]),
      el('div', { className: 'demo-home-dashboard__boundary' }, [
        el('span', { text: 'Exact authorization' }), el('i'), el('span', { text: 'Transparent vault' }),
      ]),
      el('div', { className: 'demo-home-dashboard__route' }, [
        el('span', { text: 'Hold' }), el('i'), el('span', { text: 'Invest · understand · exit' }),
      ]),
      el('div', { className: 'demo-home-dashboard__footer' }, [
        el('span', { text: 'Example interface—not live account data' }),
        el('strong', { text: `Illustrative earnings ${signedMoney(summary.earnings)}` }),
      ]),
    ]),
  ];
}

function renderWallet() {
  const assets = DEMO_ASSETS.map((asset) => ({ ...asset, value: state.walletAssets[asset.id] || 0 }));
  const total = assets.reduce((sum, asset) => sum + asset.value, 0);
  return [
    header('Wallet', 'Your liquid assets', 'This is the side you control directly. Choose an asset to see its share of the wallet or use it in an Advanced vault.', [
      button('Choose a vault', 'button button--primary', () => navigate('vaults')),
    ]),
    el('section', { className: 'card demo-wallet-panel' }, [
      el('div', { className: 'demo-wallet-total' }, [
        el('div', {}, [el('span', { className: 'demo-label', text: 'Total liquid value' }), el('strong', { className: 'demo-value', text: money(total) })]),
        allocationExplorer(assets.map((asset) => ({ ...asset, label: asset.symbol, subtitle: asset.units })), {
          total,
          center: money(total),
          centerLabel: 'liquid',
          onSelect: (asset) => { selectedAsset = asset.id; experience = 'advanced'; navigate('vaults'); },
          valueLabel: (asset, percent) => `${money(asset.value)} · ${percent}%`,
        }),
      ]),
      el('div', { className: 'demo-wallet-guidance' }, [
        el('span', { className: 'eyebrow', text: 'Your account' }),
        el('h3', { text: 'You have control. You have custody.' }),
        el('p', { text: 'Your money stays here until you approve an action. Select an asset to explore vaults that could accept it in the Advanced view.' }),
        el('p', { className: 'muted', text: 'The intended self-custodial account uses a 24-word recovery phrase created for you and never stored by Jethos.' }),
      ]),
    ]),
    el('div', { className: 'callout callout--warning' }, [
      el('strong', { text: 'Keep your recovery phrase private.' }),
      el('p', { text: 'In the intended self-custodial account model, Jethos never stores it and cannot recover it for you.' }),
    ]),
  ];
}

function allocationBars(vault, level = experience) {
  let routes = vault.allocations;
  if (level === 'base') {
    const groups = new Map();
    routes.forEach((route) => groups.set(route.category, (groups.get(route.category) || 0) + route.percent));
    routes = [...groups].map(([name, percent]) => ({ name, percent }));
  }
  return el('div', { className: 'demo-vault-card__allocations' }, routes.map((route) =>
    el('div', { className: 'demo-bar' }, [
      el('div', { className: 'demo-bar__label' }, [
        el('span', { text: level === 'advanced' ? `${route.protocol} · ${route.proof}` : level === 'pro' ? route.protocol : route.name }),
        el('strong', { text: `${route.percent}%${level !== 'base' && route.apy !== undefined ? ` · ${apy(route.apy)}` : ''}` }),
      ]),
      el('div', { className: 'demo-bar__track' }, [el('span', { className: 'demo-bar__fill', attrs: { style: `--allocation:${route.percent}%` } })]),
    ])));
}

function experienceSelector() {
  const descriptions = {
    base: 'Choose amount and risk. Network and protocol complexity stay out of the way.',
    pro: 'Also choose the network and inspect protocols, allocations and individual APYs.',
    advanced: 'Also choose the asset and inspect limits, route proofs and strategy mechanics.',
  };
  return el('section', { className: 'card demo-experience' }, [
    el('div', { className: 'demo-experience__head' }, [
      el('div', {}, [el('span', { className: 'demo-label', text: 'Choose your view' }), el('h3', { text: 'How much complexity do you want to manage?' })]),
      el('div', { className: 'demo-segmented' }, ['base', 'pro', 'advanced'].map((mode) =>
        button(mode[0].toUpperCase() + mode.slice(1), '', () => { experience = mode; render(); }, { 'aria-pressed': experience === mode }))),
    ]),
    el('p', { text: descriptions[experience] }),
    experience !== 'base' ? filter('Network', DEMO_NETWORKS, selectedChain, (id) => { selectedChain = id; render(); }) : null,
    experience === 'advanced' ? filter('Asset', DEMO_ASSETS, selectedAsset, (id) => { selectedAsset = id; render(); }, 'symbol') : null,
  ]);
}

function filter(label, items, selected, change, labelKey = 'name') {
  return el('div', { className: 'demo-filter' }, [
    el('span', { className: 'demo-label', text: label }),
    el('div', {}, items.map((item) => button(item[labelKey], '', () => change(item.id), { 'aria-pressed': item.id === selected }))),
  ]);
}

function vaultStats(vault) {
  return el('div', { className: 'demo-vault-card__stats' }, [
    stat('Illustrative APY', apy(vault.apy)), stat('Risk', vault.risk), stat('Exit profile', vault.liquidity),
  ]);
}
function vaultCard(profile) {
  const vault = vaultById(activeVaultId(profile.id));
  return el('article', { className: 'demo-vault-row', attrs: { 'data-accent': vault.accent } }, [
    actionCard('demo-vault-row__main', (event) => openStrategyDialog(vault.id, event.currentTarget), `Explain ${vault.name}`, [
      el('div', {}, [
        el('span', { className: `demo-risk demo-risk--${vault.id.split(':')[0]}`, text: `${vault.risk} risk` }),
        el('strong', { text: vault.name }),
        el('small', { text: vault.description }),
      ]),
      el('span', {}, [
        el('small', { text: 'Illustrative APY' }),
        el('strong', { text: apy(vault.apy) }),
        el('em', { text: `Explain ${experience}` }),
      ]),
    ]),
    button('Deposit', 'button button--primary demo-vault-row__deposit', (event) => openOperation('deposit', vault.id, event.currentTarget)),
  ]);
}

function renderVaults() {
  return [
    header('Vaults', 'You choose how, when and where to invest.', 'This is the navigable version of the vault window shown on Home. Select a strategy to open its explanation at the current depth.'),
    el('section', { className: 'demo-vault-window' }, [
      el('div', { className: 'demo-vault-window__bar' }, [
        el('strong', { text: 'Vaults' }),
        el('span', { text: 'Choose your view' }),
      ]),
      experienceSelector(),
      el('div', { className: 'demo-vault-window__intro' }, [
        el('span', { className: 'badge badge--illustrative', text: 'Example' }),
        el('p', { text: experience === 'base'
          ? 'Choose how much to invest and the level of risk that feels right.'
          : experience === 'pro'
            ? 'Choose the amount, risk level and network, then inspect each protocol route.'
            : 'Choose amount, risk, network and authorized asset, then inspect policy and evidence.' }),
      ]),
      el('div', { className: 'demo-vault-list' }, DEMO_VAULTS.map(vaultCard)),
    ]),
  ];
}

function openPositionInspector(id, trigger) {
  const vault = vaultById(id);
  if (!vault) return;
  selectedProfile = vault.id.split(':')[0];
  selectedChain = vault.chain.id;
  selectedAsset = vault.asset.id;
  experience = 'advanced';
  openStrategyDialog(id, trigger);
}

function renderPortfolioOverview(entries, cards) {
  const items = entries.map(([id, position], index) => {
    const vault = vaultById(id);
    return { id, vault, value: positionValue(position, vault), color: ({ conservative: '#45d7d0', balanced: '#a78bfa', opportunity: '#f2be4c' })[vault.profile.toLowerCase()] || '#57c8ef', index };
  });
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const averageApy = total ? items.reduce((sum, item) => sum + item.value * item.vault.apy, 0) / total : 0;
  const networks = new Set(items.map((item) => item.vault.chain.id)).size;
  const cardById = new Map(cards.map((card) => [card.dataset.positionId, card]));
  const wrapper = el('section', { className: 'card demo-portfolio-overview', attrs: { 'aria-label': 'Interactive portfolio allocation overview' } });
  const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chart.setAttribute('class', 'demo-portfolio-chart'); chart.setAttribute('viewBox', '0 0 160 160'); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Portfolio allocation by position');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  Object.entries({ cx: 80, cy: 80, r: 54, pathLength: 100 }).forEach(([key, value]) => track.setAttribute(key, value)); track.setAttribute('class', 'demo-portfolio-chart__track'); chart.append(track);
  const slices = document.createElementNS('http://www.w3.org/2000/svg', 'g'); slices.setAttribute('transform', 'rotate(-90 80 80)'); chart.append(slices);
  const pairs = []; let cursor = 0;
  const clear = () => pairs.forEach(({ slice, card }) => { slice.classList.remove('is-active'); card?.classList.remove('is-highlighted'); });
  const activate = (pair) => { clear(); pair.slice.classList.add('is-active'); pair.card?.classList.add('is-highlighted'); };
  items.forEach((item) => {
    const percent = total ? item.value / total * 100 : 0;
    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    Object.entries({ cx: 80, cy: 80, r: 54, pathLength: 100 }).forEach(([key, value]) => slice.setAttribute(key, value));
    slice.setAttribute('class', 'demo-portfolio-chart__slice'); slice.setAttribute('stroke', item.color); slice.setAttribute('stroke-dasharray', `${percent} ${100 - percent}`); slice.setAttribute('stroke-dashoffset', String(-cursor)); slice.setAttribute('tabindex', '0'); slice.setAttribute('role', 'button'); slice.setAttribute('aria-label', `${item.vault.name}: ${money(item.value)}, ${percent.toFixed(1)} percent of portfolio`); cursor += percent; slices.append(slice);
    const pair = { slice, card: cardById.get(item.id), item }; pairs.push(pair);
    [slice, pair.card].filter(Boolean).forEach((target) => { target.addEventListener('pointerenter', () => activate(pair)); target.addEventListener('pointerleave', clear); target.addEventListener('focus', () => activate(pair)); target.addEventListener('blur', clear); });
    slice.addEventListener('click', () => openPositionInspector(item.id, slice));
  });
  const centerValue = document.createElementNS('http://www.w3.org/2000/svg', 'text'); centerValue.setAttribute('x', '80'); centerValue.setAttribute('y', '76'); centerValue.setAttribute('text-anchor', 'middle'); centerValue.setAttribute('class', 'demo-portfolio-chart__value'); centerValue.textContent = money(total);
  const centerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text'); centerLabel.setAttribute('x', '80'); centerLabel.setAttribute('y', '91'); centerLabel.setAttribute('text-anchor', 'middle'); centerLabel.setAttribute('class', 'demo-portfolio-chart__label'); centerLabel.textContent = 'invested'; chart.append(centerValue, centerLabel);
  wrapper.append(
    el('div', { className: 'demo-portfolio-overview__intro' }, [el('p', { className: 'eyebrow', text: 'Portfolio map' }), el('h3', { text: 'Your positions at a glance.' }), el('p', { text: 'Hover a segment or a position to connect them. Click a segment to open its Advanced route record.' })]),
    chart,
    el('div', { className: 'demo-portfolio-overview__metrics' }, [stat('Invested value', money(total)), stat('Open positions', String(items.length)), stat('Networks used', String(networks)), stat('Weighted illustrative APY', apy(averageApy))]),
  );
  return wrapper;
}

function renderPortfolio() {
  const entries = Object.entries(state.positions).filter(([, position]) => position.principal > 0);
  const actions = entries.length ? [
    button('Simulate 30 days', 'button button--secondary', () => {
      try { advanceDays(state, 30); saveAndRender(); toast('Thirty illustrative days were added.'); } catch (error) { toast(error.message); }
    }),
    button('Add deposit', 'button button--primary', () => navigate('vaults')),
  ] : [];
  const content = [header('Portfolio', 'Your vault positions', 'Each receipt separates principal, current value, route, liquidity and the explanation behind the allocation.', actions)];
  if (!entries.length) {
    content.push(emptyState('No vault positions yet', 'Choose a risk profile and simulate your first explicit deposit.', 'Explore vaults', () => navigate('vaults')));
    return content;
  }
  const cards = entries.map(([id, position]) => {
    const vault = vaultById(id);
    const value = positionValue(position, vault);
    return el('article', { className: 'card demo-position', attrs: { 'data-position-id': id, tabindex: '0' } }, [
      el('div', {}, [el('span', { className: 'badge badge--illustrative', text: vault.profile }), el('h3', { text: vault.name }), el('p', { text: `${position.daysAccrued} simulated days · ${vault.chain.name} · ${vault.asset.symbol}` })]),
      stat('Principal', money(position.principal)), stat('Current value', money(value)), stat('Change', signedMoney(value - position.principal)),
      el('div', { className: 'demo-position__actions' }, [
        button('Inspect position', 'button button--ghost', (event) => openPositionInspector(id, event.currentTarget)),
        button('Withdraw', 'button button--secondary', (event) => openOperation('withdraw', id, event.currentTarget)),
      ]),
    ]);
  });
  content.push(renderPortfolioOverview(entries, cards));
  content.push(el('div', { className: 'demo-position-list' }, cards));
  return content;
}

function renderActivity() {
  const content = [header('Activity', 'Your simulated history', 'Deposits, withdrawals and time changes are recorded here. Position receipts are kept separately as historical-style records.', [button('Open position receipts', 'button button--ghost', () => navigate('receipts'))])];
  if (!state.activity.length) {
    content.push(emptyState('No activity recorded', 'Deposits, withdrawals and time simulation appear here.', 'Start a deposit', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-activity' }, state.activity.map((item) =>
    el('article', { className: 'demo-activity__row' }, [
      el('div', {}, [el('strong', { text: item.type }), el('small', { text: item.id })]),
      el('div', {}, [el('span', { className: 'demo-label', text: 'Route' }), el('strong', { text: item.vaultName })]),
      el('div', {}, [el('span', { className: 'demo-label', text: 'Value' }), el('strong', { text: item.amount ? money(item.amount) : '—' })]),
      el('div', {}, [el('span', { className: 'badge badge--illustrative', text: item.status }), el('small', { text: date(item.timestamp) })]),
    ]))));
  return content;
}

function renderReceipts() {
  const entries = Object.entries(state.positions).filter(([, position]) => position.principal > 0);
  const content = [
    header('Activity', 'Position receipts', 'A historical-style record of the current simulated positions, their allocation snapshot and their explanatory fields.', [button('Back to activity', 'button button--ghost', () => navigate('activity'))]),
    el('div', { className: 'callout' }, [el('strong', { text: 'Wallet boundary' }), el('p', { text: `${money(summarize(state).wallet)} remains liquid in the demo wallet. Only explicit deposits appear below.` })]),
  ];
  if (!entries.length) {
    content.push(emptyState('No deployed capital', 'Your entire simulated balance is still in the wallet.', 'Explore vaults', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-transparency-list' }, entries.map(([id, position]) => {
    const vault = vaultById(id);
    const estimatedCosts = Math.max(.18, position.principal * (.0012 + vault.riskScore * .00015));
    const routes = routesForLevel(vault, 'advanced');
    return el('article', { className: 'card demo-receipt' }, [
      el('div', { className: 'demo-vault-card__top' }, [
        el('div', {}, [el('span', { className: 'eyebrow', text: `${vault.asset.symbol} ${vault.profile} · example` }), el('h3', { text: 'Vault position receipt' })]),
        el('strong', { className: 'demo-value', text: money(positionValue(position, vault)) }),
      ]),
      el('div', { className: 'demo-receipt-facts' }, [
        stat('Expected net yield', apy(vault.apy)),
        el('div', { className: 'demo-receipt-cost' }, [
          el('span', { className: 'demo-label', text: 'Estimated costs' }),
          el('strong', { text: money(estimatedCosts) }),
          button('?', 'demo-receipt-help', (event) => openCostDialog(vault.id, estimatedCosts, event.currentTarget), { 'aria-label': 'Explain estimated costs' }),
        ]),
        stat('Exit status', vault.liquidity),
        stat('Evidence snapshot', 'Illustrative · not live'),
      ]),
      el('h4', { text: 'Vault current allocations' }),
      allocationExplorer(routes, {
        valueKey: 'value',
        total: 100,
        center: '100%',
        centerLabel: 'mapped',
        valueLabel: (route) => `${route.percent}%`,
      }),
      el('div', { className: 'demo-receipt-reason' }, [el('span', { className: 'demo-label', text: 'Allocation rationale' }), el('strong', { text: vault.proExplanation })]),
      el('div', { className: 'demo-receipt-proof' }, [
        stat('Allocation rationale', 'Best eligible result after yield, costs, liquidity and risk limits'),
        stat('Verification evidence', 'Transaction · contract · block · timestamp'),
      ]),
    ]);
  })));
  return content;
}

function renderUnderstand() {
  const concepts = [
    ['Base', 'Choose an amount and a risk profile.', 'You see the purpose, broad allocation and illustrative outcome without protocol-level detail.'],
    ['Pro', 'See the market and protocol context.', 'You can inspect where an allocation goes, the asset in and receipt out, plus the route-level illustrative APY.'],
    ['Advanced', 'Audit the route record.', 'Select a route to see active, available and disabled components, limits, tokens, market, exit conditions and verification fields.'],
  ];
  const terms = [
    ['Allocation', 'How much of one vault position is assigned to each route.'],
    ['Illustrative APY', 'A simulated annualized rate, not a quote, promise or live rate.'],
    ['Costs and exit', 'Entry, maintenance and exit costs plus the liquidity conditions needed to leave a route.'],
    ['Evidence', 'The contract, adapter, transaction, block, timestamp and policy result a live product would expose.'],
  ];
  return [
    header('Understand', 'Understand before you act.', 'This is the product guide: it explains what the dashboard labels, route details and risk terms mean. It is not a duplicate portfolio screen.'),
    el('section', { className: 'demo-understand-journey' }, concepts.map(([level, title, description], index) =>
      el('article', { className: `card demo-understand-level demo-understand-level--${level.toLowerCase()}` }, [
        el('span', { className: 'eyebrow', text: `0${index + 1} · ${level}` }),
        el('h3', { text: title }), el('p', { text: description }),
        level === 'Advanced'
          ? button('Open an Advanced vault view', 'button button--ghost', () => { experience = 'advanced'; navigate('vaults'); })
          : null,
      ]))),
    el('section', { className: 'demo-understand-terms' }, [
      el('div', {}, [el('p', { className: 'eyebrow', text: 'Read the interface' }), el('h3', { text: 'The terms behind the numbers.' })]),
      el('div', { className: 'demo-understand-terms__grid' }, terms.map(([term, description]) => el('article', { className: 'card' }, [el('h4', { text: term }), el('p', { text: description })]))),
    ]),
    el('section', { className: 'callout' }, [
      el('strong', { text: 'Where to find each thing' }),
      el('p', { text: 'Wallet shows assets still under your direct control. Vaults lets you choose a strategy. Positions shows what you currently hold. Activity keeps simulated actions and position receipts.' }),
    ]),
  ];
}

function render() {
  const route = currentRoute();
  document.querySelectorAll('[data-demo-route]').forEach((link) => {
    if (link.dataset.demoRoute === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const renderers = { overview: renderOverview, wallet: renderWallet, vaults: renderVaults, portfolio: renderPortfolio, activity: renderActivity, transparency: renderUnderstand, receipts: renderReceipts };
  view.replaceChildren(...renderers[route]());
  document.title = `${route[0].toUpperCase()}${route.slice(1)} · Jethos Interactive Demo`;
}

const ROUTE_COLORS = ['#9b87b8', '#4eb7e8', '#57c7a3', '#d7a94c'];
const PROTOCOL_COPY = Object.freeze({
  'Vault reserve': 'Capital kept inside the vault so ordinary withdrawals do not always require unwinding an external position.',
  'Aave V3': 'A lending market. This illustrative route supplies assets so borrowers can use them and pay interest; it does not borrow in the Conservative strategy.',
  Morpho: 'A lending layer that can match or route supply through eligible markets. Yield still depends on utilization, liquidity and market configuration.',
  'Euler V2': 'A modular lending protocol. Jethos would only use a reviewed market through an approved adapter and within the selected risk policy.',
  'Ether.fi / Lido': 'Liquid-staking routes exchange ordinary liquidity for staking exposure and introduce validator, wrapper and exit dependencies.',
  'Euler / Morpho': 'A diversified lending allocation across approved markets, limited by protocol, liquidity and concentration rules.',
  Pendle: 'A tokenized-yield market that separates principal and future yield. Returns and exits can be more sensitive to maturity and market depth.',
  GMX: 'A liquidity-market route exposed to trading activity, market movement and pool composition. It is therefore reserved for the Opportunity profile.',
});

/*
 * Advanced detail is deliberately route-specific. The demo never invents live
 * on-chain state, but it does show the complete explanatory record a user
 * would expect before authorizing a strategy: market, operation, policy,
 * allocation, contribution, exit dependency and the proof fields.
 */
const ROUTE_DETAILS = Object.freeze({
  'Vault reserve': Object.freeze({
    market: 'Vault-held approved asset reserve',
    operation: 'Held in the vault; no external protocol interaction',
    mechanics: 'Keeps a portion of capital available so an ordinary exit does not always need to unwind an external route.',
    exit: 'Available subject to vault reserve accounting',
    dependency: 'Vault accounting and approved asset custody',
  }),
  'Aave V3': Object.freeze({
    market: 'Aave V3 approved supply market',
    operation: 'Supply approved asset; borrowing is disabled for this Conservative route',
    mechanics: 'The vault supplies liquidity. Borrowers pay interest; the position earns the supply-side rate while utilization and liquidity remain within policy.',
    exit: 'Redeemable while market liquidity is available',
    dependency: 'Aave market liquidity, reserve configuration and approved adapter',
  }),
  Morpho: Object.freeze({
    market: 'Morpho approved lending market',
    operation: 'Supply approved asset through the reviewed Morpho route',
    mechanics: 'Capital is supplied to an eligible lending market. The adapter exposes the route, but yield and exit depend on the underlying market state.',
    exit: 'Subject to underlying market liquidity',
    dependency: 'Morpho market state, underlying collateral market and adapter',
  }),
  'Euler V2': Object.freeze({
    market: 'Euler V2 approved lending vault',
    operation: 'Supply approved asset through the reviewed Euler adapter',
    mechanics: 'The vault contributes liquidity to a configured lending market. It remains a supply route, not a borrowing or leverage loop in the Conservative profile.',
    exit: 'Subject to Euler vault liquidity and market utilization',
    dependency: 'Euler vault configuration, liquidity and approved adapter',
  }),
  'Ether.fi / Lido': Object.freeze({
    market: 'Approved liquid-staking route',
    operation: 'Convert approved exposure into a liquid-staking position',
    mechanics: 'The route gains staking exposure while keeping a transferable receipt. Its yield, redemption and peg behavior add different dependencies from lending.',
    exit: 'Subject to secondary-market depth and redemption conditions',
    dependency: 'Liquid-staking protocol, validator performance and receipt liquidity',
  }),
  'Euler / Morpho': Object.freeze({
    market: 'Diversified approved lending markets',
    operation: 'Split supply across eligible Euler and Morpho routes',
    mechanics: 'The route diversifies lending exposure. Allocation remains capped so no single market dominates the Opportunity strategy.',
    exit: 'Depends on the liquidity of each selected market',
    dependency: 'Both lending markets, their adapters and concentration policy',
  }),
  Pendle: Object.freeze({
    market: 'Approved Pendle yield market',
    operation: 'Acquire or manage tokenized yield exposure within policy',
    mechanics: 'The position separates future yield from principal exposure. Market price, maturity and available depth all influence the result and exit.',
    exit: 'Subject to maturity, pool depth and market price',
    dependency: 'Pendle market maturity, liquidity and underlying yield source',
  }),
  GMX: Object.freeze({
    market: 'Approved GMX liquidity market',
    operation: 'Provide approved liquidity under Opportunity limits',
    mechanics: 'The route earns from trading activity while accepting exposure to pool composition, market movement and utilization of the liquidity venue.',
    exit: 'Subject to market conditions, pool composition and available liquidity',
    dependency: 'GMX pool state, market exposure and approved adapter',
  }),
});

/*
 * Illustrative execution records for the Advanced view.  They intentionally
 * describe every hop, receipt and policy boundary rather than presenting a
 * single opaque APY.  In production these would be populated from contracts,
 * adapters and indexed transactions; here they are clearly labelled examples.
 */
const ROUTE_EXECUTIONS = Object.freeze({
  'Vault reserve': Object.freeze({
    market: 'Jethos vault reserve · no external market',
    input: 'Approved vault asset', output: 'Recorded vault balance',
    borrowing: 'Disabled', leverage: '1.00x', health: 'Not applicable',
    steps: ['Keep approved asset in the vault reserve', 'Record the balance against vault shares', 'Make it available for ordinary exits'],
    strategies: [{ name: 'Immediate withdrawal reserve', status: 'Active', share: 100, apy: 0, tokens: 'USDC held in vault', description: 'Not supplied, swapped or borrowed. This portion stays under vault accounting.' }],
  }),
  'Aave V3': Object.freeze({
    market: 'Aave V3 · USDC supply reserve',
    input: 'USDC', output: 'aUSDC receipt token', borrowing: 'Disabled for this route', leverage: '1.00x', health: 'Not applicable',
    steps: ['Supply USDC to the approved Aave V3 USDC reserve', 'Receive aUSDC, which tracks the supplied balance', 'Accrue the variable supply rate while utilization remains eligible'],
    strategies: [{ name: 'USDC supply', status: 'Active', share: 100, apy: .041, tokens: 'USDC → aUSDC', description: 'Lend USDC to the reserve. Borrowers pay interest; this route does not borrow ETH or open a loop.' }, { name: 'Borrow / leverage loop', status: 'Disabled', share: 0, apy: 0, tokens: 'No debt token', description: 'Explicitly disabled in the Conservative policy.' }],
  }),
  Morpho: Object.freeze({
    market: 'Morpho · curated USDC lending market',
    input: 'USDC', output: 'Morpho supply shares', borrowing: 'Disabled for this route', leverage: '1.00x', health: 'Not applicable',
    steps: ['Supply USDC through the approved Morpho adapter', 'Receive market supply shares', 'Earn the market supply rate while liquidity remains available'],
    strategies: [{ name: 'Curated USDC supply', status: 'Active', share: 100, apy: .048, tokens: 'USDC → Morpho supply shares', description: 'A supply-only lending position. The underlying borrower collateral configuration remains a market dependency.' }, { name: 'Reallocation to unapproved market', status: 'Disabled', share: 0, apy: 0, tokens: 'No external move', description: 'Only the listed approved market is eligible.' }],
  }),
  'Euler V2': Object.freeze({
    market: 'Euler V2 · approved USDC vault',
    input: 'USDC', output: 'Euler vault shares', borrowing: 'Disabled for this route', leverage: '1.00x', health: 'Not applicable',
    steps: ['Supply USDC to the reviewed Euler V2 vault', 'Receive vault shares representing the supply position', 'Accrue the supply-side rate subject to utilization and liquidity'],
    strategies: [{ name: 'USDC supply vault', status: 'Active', share: 100, apy: .053, tokens: 'USDC → Euler vault shares', description: 'A lower-complexity supply position. No borrowed asset is created.' }],
  }),
  'Ether.fi / Lido': Object.freeze({
    market: 'Approved ETH liquid-staking route',
    input: 'USDC → ETH', output: 'eETH or stETH receipt', borrowing: 'Disabled in the example route', leverage: '1.00x', health: 'Not applicable',
    steps: ['Swap the approved amount of USDC into ETH through an approved route', 'Stake ETH with the eligible liquid-staking provider', 'Hold the liquid receipt token while tracking staking yield and its market price'],
    strategies: [{ name: 'ETH liquid staking', status: 'Active', share: 70, apy: .064, tokens: 'USDC → ETH → eETH / stETH', description: 'The route holds a liquid staking receipt rather than lending USDC directly.' }, { name: 'Liquid exit buffer', status: 'Active', share: 30, apy: .018, tokens: 'ETH / receipt liquidity', description: 'Keeps an exit path through eligible receipt liquidity; it is not a guaranteed redemption window.' }, { name: 'Borrowed ETH loop', status: 'Disabled', share: 0, apy: 0, tokens: 'No debt token', description: 'The illustrated balanced route does not borrow ETH to increase staking exposure.' }],
  }),
  'Euler / Morpho': Object.freeze({
    market: 'Euler + Morpho · approved USDC markets',
    input: 'USDC', output: 'Euler shares + Morpho supply shares', borrowing: 'Policy-gated · currently disabled in this example', leverage: '1.00x in current allocation', health: 'Not applicable while no debt is open',
    steps: ['Split USDC across the approved Euler and Morpho supply markets', 'Receive each market’s supply receipt', 'Keep a separate policy gate before any borrow-and-loop strategy can be enabled'],
    strategies: [{ name: 'Euler USDC supply', status: 'Active', share: 55, apy: .069, tokens: 'USDC → Euler supply shares', description: 'Supply-only allocation to the approved Euler market.' }, { name: 'Morpho USDC supply', status: 'Active', share: 45, apy: .076, tokens: 'USDC → Morpho supply shares', description: 'Supply-only allocation to the approved Morpho market.' }, { name: 'USDC collateral → borrow ETH → restake ETH', status: 'Available, not active', share: 0, apy: .092, tokens: 'USDC collateral → borrowed ETH → liquid-staking receipt', description: 'Requires an explicit policy activation, maximum leverage, health-factor check and independently visible debt record.' }],
  }),
  Pendle: Object.freeze({
    market: 'Pendle · approved fixed-maturity USDe yield market',
    input: 'USDC → USDe / SY-USDe', output: 'PT-USDe + yield-market position', borrowing: 'Policy-gated · no borrow active in this example', leverage: '1.00x in current allocation', health: 'Not applicable while no debt is open',
    steps: ['Swap USDC into the approved yield-bearing underlying', 'Enter the approved Pendle market at its recorded maturity', 'Hold principal-token and/or yield exposure according to the route mix', 'Exit by market swap or maturity settlement, subject to available depth'],
    strategies: [{ name: 'Fixed principal leg', status: 'Active', share: 60, apy: .078, tokens: 'USDC → PT-USDe (maturity example)', description: 'Buys the principal token: the route targets the underlying redemption at maturity, while the market price can move before then.' }, { name: 'Yield-token / liquidity leg', status: 'Active', share: 30, apy: .118, tokens: 'USDC → SY-USDe → Pendle liquidity / yield exposure', description: 'Receives variable yield-market exposure. Result depends on yield, maturity and pool depth.' }, { name: 'Exit liquidity buffer', status: 'Active', share: 10, apy: .022, tokens: 'USDC / approved swap liquidity', description: 'Reserved for fees and controlled exits; it does not eliminate slippage risk.' }, { name: 'Borrowed collateral loop', status: 'Available, not active', share: 0, apy: .134, tokens: 'USDC collateral → borrowed asset → Pendle position', description: 'Only available after a separate leverage policy, health factor and liquidation threshold are enabled.' }],
  }),
  GMX: Object.freeze({
    market: 'GMX · approved liquidity market',
    input: 'USDC', output: 'GM liquidity receipt', borrowing: 'Policy-gated · no borrow active in this example', leverage: '1.00x in current allocation', health: 'Not applicable while no debt is open',
    steps: ['Supply USDC to the approved GM liquidity market', 'Receive the liquidity receipt that represents pool exposure', 'Earn eligible fees while accepting pool-composition and market exposure'],
    strategies: [{ name: 'Stablecoin liquidity tranche', status: 'Active', share: 65, apy: .091, tokens: 'USDC → GM liquidity receipt', description: 'The primary liquidity allocation; return depends on fees, utilization and pool composition.' }, { name: 'Market-neutral buffer', status: 'Active', share: 20, apy: .054, tokens: 'USDC reserve / hedge buffer', description: 'A policy buffer, not a guarantee against market movement or imbalance.' }, { name: 'Higher-volatility liquidity tranche', status: 'Active', share: 15, apy: .143, tokens: 'USDC → approved higher-volatility GM market', description: 'Smaller capped allocation with greater variability in value and exit conditions.' }, { name: 'Borrowed liquidity loop', status: 'Disabled', share: 0, apy: 0, tokens: 'No debt token', description: 'Not active in this illustrative position.' }],
  }),
});

function routeExecution(vault, route) {
  const base = ROUTE_EXECUTIONS[route.protocol] || ROUTE_EXECUTIONS['Vault reserve'];
  // The demo lets Advanced users choose USDT/BTC/ETH too. Preserve that choice
  // in the record rather than silently claiming every route starts with USDC.
  const source = vault.asset.symbol;
  const replaceSource = (value) => String(value).replaceAll('USDC', source);
  return {
    ...base,
    input: replaceSource(base.input), output: replaceSource(base.output), market: replaceSource(base.market),
    steps: base.steps.map(replaceSource),
    strategies: base.strategies.map((strategy) => ({ ...strategy, tokens: replaceSource(strategy.tokens), description: replaceSource(strategy.description) })),
  };
}

function routesForLevel(vault, level) {
  if (level !== 'base') {
    return vault.allocations.map((route, index) => ({
      ...route,
      routeIndex: index,
      value: route.percent,
      color: ROUTE_COLORS[index],
      label: level === 'advanced' ? route.protocol : route.name,
      subtitle: level === 'advanced' ? `${route.proof} · ${route.category}` : route.protocol,
    }));
  }
  const grouped = new Map();
  vault.allocations.forEach((route) => grouped.set(route.category, (grouped.get(route.category) || 0) + route.percent));
  return [...grouped].map(([name, percent], index) => ({
    name,
    label: name,
    subtitle: name === 'Reserve'
      ? 'Immediately available inside the vault'
      : name === 'Lending'
        ? 'Supplied to borrowers through reviewed markets'
        : 'Grouped strategy category',
    value: percent,
    percent,
    color: ROUTE_COLORS[index],
  }));
}

function strategyFacts(vault, level) {
  if (level === 'base') return [
    stat('Risk', vault.risk),
    stat('Illustrative APY', apy(vault.apy)),
    stat('Exit profile', vault.liquidity),
  ];
  if (level === 'pro') return [
    stat('Network', vault.chain.name),
    stat('Asset', vault.asset.symbol),
    stat('Estimated costs', `${(Math.max(.001, vault.riskScore * .0012) * 100).toFixed(2)}%`),
  ];
  return [
    stat('Borrowing', vault.policy.borrowing),
    stat('Maximum leverage', vault.policy.leverage),
    stat('Minimum health', vault.policy.minimumHealth),
  ];
}

function openStrategyDialog(id, trigger) {
  const vault = vaultById(id);
  if (!vault) return;
  returnFocus = trigger || document.activeElement;
  operation = null;
  dialog = { type: 'strategy', vaultId: id, level: experience, routeIndex: 0 };
  renderModal();
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => modalContent.querySelector('button')?.focus(), 0);
}

function openCostDialog(id, estimatedCosts, trigger) {
  const vault = vaultById(id);
  if (!vault) return;
  returnFocus = trigger || document.activeElement;
  operation = null;
  dialog = { type: 'costs', vaultId: id, estimatedCosts };
  renderModal();
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => modalContent.querySelector('button')?.focus(), 0);
}

function renderCostDialog() {
  const vault = vaultById(dialog.vaultId);
  const total = dialog.estimatedCosts;
  const entries = [
    ['Network execution', total * .16],
    ['Vault entry and exit', total * .22],
    ['Underlying route estimate', total * .62],
  ];
  modalPanel.classList.remove('demo-modal--strategy');
  modalContent.replaceChildren(
    el('p', { className: 'eyebrow', text: 'Illustrative cost explanation' }),
    el('h2', { text: 'What the estimate includes', attrs: { id: 'demo-modal-title' } }),
    el('p', { className: 'muted', text: `A transparent ${vault.profile} position should separate expected return from the costs required to enter, maintain and exit its route.` }),
    el('div', { className: 'demo-cost-list' }, entries.map(([label, value]) => summaryRow(label, money(value)))),
    el('div', { className: 'demo-cost-list__total' }, [el('span', { text: 'Total illustrative estimate' }), el('strong', { text: money(total) })]),
    el('p', { className: 'form-help', text: 'These are explanatory demo values, not a quote. Live costs would depend on network conditions, route state and the requested action.' }),
    el('div', { className: 'demo-modal__actions' }, [button('Close', 'button button--primary', closeModal)]),
  );
}

function routePositionId(vault, route, index) {
  const chain = vault.chain.id.slice(0, 3).toUpperCase();
  const protocol = route.protocol.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase();
  return `${chain}-${vault.asset.symbol}-${protocol}-${String(index + 1).padStart(2, '0')}`;
}

function strategyStatusClass(status) {
  if (status === 'Active') return 'is-active';
  if (status.includes('Available')) return 'is-available';
  return 'is-disabled';
}

function renderExecutionStrategies(execution, allocatedValue) {
  return el('section', { className: 'demo-route-execution' }, [
    el('div', { className: 'demo-route-execution__heading' }, [
      el('div', {}, [el('h4', { text: 'Strategy components' }), el('p', { text: 'Every component in this selected route. Active means included in this illustrative allocation; available and disabled are not funded.' })]),
      el('span', { className: 'demo-label', text: 'Selected route breakdown' }),
    ]),
    el('div', { className: 'demo-route-flow', attrs: { 'aria-label': 'Illustrative execution path' } }, [
      el('span', { text: execution.input }), el('i', { text: '→', attrs: { 'aria-hidden': 'true' } }), el('span', { text: execution.market }), el('i', { text: '→', attrs: { 'aria-hidden': 'true' } }), el('span', { text: execution.output }),
    ]),
    el('ol', { className: 'demo-route-steps' }, execution.steps.map((step, index) => el('li', {}, [el('b', { text: String(index + 1).padStart(2, '0') }), el('span', { text: step })]))),
    el('div', { className: 'demo-route-components' }, execution.strategies.map((strategy) => {
      const funded = strategy.status === 'Active';
      const value = funded ? allocatedValue * (strategy.share / 100) : 0;
      const contribution = funded ? strategy.share / 100 * strategy.apy * 100 : 0;
      return el('article', { className: `demo-route-component ${strategyStatusClass(strategy.status)}` }, [
        el('div', { className: 'demo-route-component__top' }, [
          el('div', {}, [el('span', { className: 'demo-route-status', text: strategy.status }), el('strong', { text: strategy.name })]),
          el('span', { className: 'demo-route-component__share', text: funded ? `${strategy.share}% · ${money(value)}` : '0% funded' }),
        ]),
        el('p', { text: strategy.description }),
        el('div', { className: 'demo-route-component__facts' }, [
          el('span', { text: strategy.tokens }),
          el('span', { text: funded ? `${apy(strategy.apy)} illustrative APY · ${contribution.toFixed(2)} pp contribution` : 'Not included in current route' }),
        ]),
      ]);
    })),
  ]);
}

function renderRouteInspector(vault, routeIndex = 0) {
  const route = vault.allocations[Math.max(0, Math.min(routeIndex, vault.allocations.length - 1))];
  const detail = ROUTE_DETAILS[route.protocol] || ROUTE_DETAILS['Vault reserve'];
  const execution = routeExecution(vault, route);
  const position = state.positions[vault.id];
  const positionValue = position ? positionValueForInspector(position, vault) : 10000;
  const allocatedValue = positionValue * (route.percent / 100);
  const contribution = (route.percent / 100) * route.apy;
  const policy = vault.policy;
  return el('section', { className: 'demo-route-inspector', attrs: { 'aria-live': 'polite' } }, [
    el('header', {}, [
      el('div', {}, [
        el('span', { className: 'eyebrow', text: 'Selected route · advanced inspector' }),
        el('h3', { text: `${route.protocol} · ${route.percent}% allocation` }),
        el('p', { text: detail.mechanics }),
      ]),
      el('span', { className: 'badge badge--illustrative', text: position ? 'Your simulated position' : '10,000 USDC example' }),
    ]),
    el('div', { className: 'demo-route-inspector__grid' }, [
      el('div', { className: 'demo-route-inspector__section' }, [
        el('h4', { text: 'Position and allocation' }),
        stat('Position ID', routePositionId(vault, route, routeIndex)),
        stat('Underlying route', `${vault.asset.symbol} → ${detail.market}`),
        stat('Operation', detail.operation),
        stat('Route allocation', `${route.percent}% · ${money(allocatedValue)}`),
        stat('Illustrative route APY', apy(route.apy)),
        stat('Estimated contribution', `${(contribution * 100).toFixed(2)} percentage points`),
      ]),
      el('div', { className: 'demo-route-inspector__section' }, [
        el('h4', { text: 'Limits, exit and evidence' }),
        stat('Borrowing / leverage', `${policy.borrowing} · ${policy.leverage}`),
        stat('Execution borrowing', `${execution.borrowing} · ${execution.leverage}`),
        stat('Minimum health factor', execution.health),
        stat('Route cap / reserve', `${policy.maximumRoute} / ${policy.minimumReserve}`),
        stat('Exit condition', detail.exit),
        stat('Material dependency', detail.dependency),
        stat('Route proof', route.proof),
        stat('Verification fields', 'Contract · adapter · transaction · block · timestamp · policy result'),
      ]),
    ]),
    renderExecutionStrategies(execution, allocatedValue),
    el('footer', {}, [
      el('span', { text: 'Selection updates when you choose another row or chart segment.' }),
      el('strong', { text: 'Illustrative route data — not live on-chain state' }),
    ]),
  ]);
}

/* Kept separate to make it impossible to confuse this display calculation
   with the engine function that mutates portfolio state. */
function positionValueForInspector(position, vault) {
  return positionValue(position, vault);
}

function revealRouteInspector() {
  requestAnimationFrame(() => {
    modalPanel.querySelector('.demo-route-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function renderStrategyDialog() {
  const vault = vaultById(dialog.vaultId);
  const level = dialog.level;
  const copy = level === 'base' ? vault.baseExplanation : level === 'pro' ? vault.proExplanation : vault.advancedExplanation;
  const routes = routesForLevel(vault, level);
  modalPanel.classList.add('demo-modal--strategy');
  // `replaceChildren()` does not discard null values (unlike `el()` above): it
  // coerces them to the visible text "null". Build the modal nodes first so
  // the optional Advanced-only inspector is genuinely omitted in Base and Pro.
  const dialogNodes = [
    el('div', { className: 'demo-strategy-dialog__heading' }, [
      el('div', {}, [
        el('p', { className: 'eyebrow', text: `${level} explanation · ${vault.profile}` }),
        el('h2', { text: vault.name, attrs: { id: 'demo-modal-title' } }),
        el('p', { className: 'muted', text: copy }),
      ]),
      el('div', { className: 'demo-segmented', attrs: { 'aria-label': 'Explanation depth' } }, ['base', 'pro', 'advanced'].map((mode) =>
        button(mode[0].toUpperCase() + mode.slice(1), '', () => { dialog.level = mode; renderModal(); }, { 'aria-pressed': level === mode }))),
    ]),
    el('div', { className: 'demo-strategy-dialog__facts' }, strategyFacts(vault, level)),
    el('section', { className: 'demo-strategy-dialog__body' }, [
      el('div', {}, [
        el('h3', { text: level === 'base' ? 'What your money does' : level === 'pro' ? 'Where it goes' : 'Select a route to inspect it' }),
        allocationExplorer(routes, {
          valueKey: 'value',
          total: 100,
          center: '100%',
          centerLabel: level === 'base' ? 'summary' : 'routes',
          valueLabel: (route) => `${route.percent}%`,
          onSelect: level === 'advanced'
            ? (route) => {
              dialog.routeIndex = route.routeIndex;
              renderModal();
              revealRouteInspector();
            }
            : null,
        }),
      ]),
      el('div', { className: 'demo-strategy-dialog__explanation' }, [
        el('h3', { text: level === 'base' ? 'In plain English' : level === 'pro' ? 'Protocol context' : 'Policy and evidence' }),
        level === 'base'
          ? el('div', { className: 'demo-explain-stack' }, [
            el('article', {}, [el('strong', { text: 'What lending means' }), el('p', { text: 'A lending route supplies an asset to a market. Borrowers pay to use that liquidity and part of that interest becomes yield for suppliers.' })]),
            el('article', {}, [el('strong', { text: 'What this strategy does' }), el('p', { text: copy })]),
            el('article', {}, [el('strong', { text: 'What can change' }), el('p', { text: 'APY, liquidity and withdrawal timing can change. The displayed result is illustrative, never guaranteed.' })]),
          ])
          : level === 'pro'
            ? el('div', { className: 'demo-explain-stack' }, vault.allocations.map((route) =>
              el('article', {}, [
                el('strong', { text: route.protocol }),
                el('p', { text: PROTOCOL_COPY[route.protocol] || 'An eligible route that remains subject to adapter, liquidity and risk-policy checks.' }),
                el('span', { className: 'demo-pro-route', text: `${routeExecution(vault, route).input} → ${routeExecution(vault, route).output} · ${routeExecution(vault, route).market}` }),
                el('small', { text: `${route.percent}% allocation · ${apy(route.apy)} illustrative APY · contribution ${((route.percent / 100) * route.apy * 100).toFixed(2)} pp` }),
              ])))
            : el('div', { className: 'demo-policy-grid' }, [
              stat('Borrowing', vault.policy.borrowing),
              stat('Leverage', vault.policy.leverage),
              stat('Minimum reserve', vault.policy.minimumReserve),
              stat('Maximum route', vault.policy.maximumRoute),
              stat('Minimum health factor', vault.policy.minimumHealth),
              stat('Rebalance trigger', vault.policy.rebalance),
              el('div', { className: 'demo-policy-grid__wide' }, [
                el('span', { className: 'demo-label', text: 'Illustrative verification package' }),
                el('strong', { text: 'Contract · transaction · block · timestamp · policy result' }),
                el('small', { text: 'These fields would link the displayed route to independently verifiable evidence in a live deployment.' }),
              ]),
            ]),
      ]),
    ]),
    ...(level === 'advanced' ? [renderRouteInspector(vault, dialog.routeIndex)] : []),
    el('div', { className: 'demo-modal__actions' }, [
      button('Close', 'button button--ghost', closeModal),
      button('Simulate deposit', 'button button--primary', (event) => openOperation('deposit', vault.id, event.currentTarget)),
    ]),
  ];
  modalContent.replaceChildren(...dialogNodes);
}

function openOperation(type, id, trigger) {
  const vault = vaultById(id);
  if (!vault) return;
  returnFocus = trigger || document.activeElement;
  dialog = null;
  operation = { type, vaultId: id, phase: 'input', amount: '' };
  renderModal();
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => modalContent.querySelector('input,button')?.focus(), 0);
}
function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = '';
  operation = null;
  dialog = null;
  modalPanel.classList.remove('demo-modal--strategy');
  returnFocus?.focus?.();
  returnFocus = null;
}
function operationAvailable() {
  const vault = vaultById(operation.vaultId);
  return operation.type === 'deposit'
    ? state.walletAssets[vault.asset.id] || 0
    : positionValue(state.positions[operation.vaultId], vault);
}
function parseOperationAmount() {
  const value = Number(operation.amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
  if (value - operationAvailable() > .000001) throw new Error('The amount exceeds the available simulated balance.');
  return value;
}
function summaryRow(label, value) {
  return el('div', {}, [el('span', { text: label }), el('strong', { text: value })]);
}
function renderModal() {
  if (dialog?.type === 'strategy') {
    renderStrategyDialog();
    return;
  }
  if (dialog?.type === 'costs') {
    renderCostDialog();
    return;
  }
  modalPanel.classList.remove('demo-modal--strategy');
  const vault = vaultById(operation.vaultId);
  const isDeposit = operation.type === 'deposit';
  modalContent.replaceChildren(
    el('p', { className: 'eyebrow', text: 'Interactive demo · no real funds' }),
    el('h2', { text: operation.phase === 'review' ? `Review ${operation.type}` : `${isDeposit ? 'Deposit into' : 'Withdraw from'} ${vault.name}`, attrs: { id: 'demo-modal-title' } }),
  );
  if (operation.phase === 'review') {
    const amount = parseOperationAmount();
    modalContent.append(
      el('p', { className: 'muted', text: 'Confirming only updates this browser. A real product would request explicit wallet authorization.' }),
      el('div', { className: 'demo-modal__summary' }, [
        summaryRow('Action', isDeposit ? 'Simulated deposit' : 'Simulated withdrawal'),
        summaryRow(isDeposit ? 'Destination' : 'From', vault.name),
        summaryRow('Asset / network', `${vault.asset.symbol} · ${vault.chain.name}`),
        summaryRow('Value', money(amount)),
        summaryRow('Remaining', money(operationAvailable() - amount)),
        summaryRow('Risk / APY', `${vault.risk} · ${apy(vault.apy)}`),
      ]),
      el('div', { className: 'callout callout--warning' }, [
        el('strong', { text: isDeposit ? 'Only this selected value crosses the boundary.' : 'Exit conditions are simplified here.' }),
        el('p', { text: isDeposit ? 'Once deposited, the value follows the visible illustrative vault rules and risks.' : 'A live withdrawal can depend on contract state, reserve and route liquidity.' }),
      ]),
      el('div', { className: 'demo-modal__actions' }, [
        button('Back', 'button button--ghost', () => { operation.phase = 'input'; renderModal(); }),
        button(`Confirm simulated ${operation.type}`, 'button button--primary', confirmOperation),
      ]),
    );
    return;
  }
  const input = el('input', { attrs: { id: 'demo-operation-amount', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00', value: operation.amount } });
  const error = el('p', { className: 'form-error', attrs: { role: 'alert', id: 'demo-operation-error' } });
  const preview = el('p', { className: 'form-help', text: `Available ${vault.asset.symbol} value: ${money(operationAvailable())}` });
  input.addEventListener('input', () => { operation.amount = input.value; error.textContent = ''; });
  modalContent.append(
    el('p', { className: 'muted', text: `Enter an illustrative USD-equivalent value of ${vault.asset.symbol}.` }),
    el('div', { className: 'form-field' }, [
      el('label', { text: `${vault.asset.symbol} value`, attrs: { for: 'demo-operation-amount' } }), input,
      el('div', { className: 'demo-quick-amounts' }, [[.25, '25%'], [.5, '50%'], [1, 'Max']].map(([ratio, label]) =>
        button(label, '', () => { operation.amount = (operationAvailable() * ratio).toFixed(2); renderModal(); }))),
      preview, error,
    ]),
    el('div', { className: 'demo-modal__actions' }, [
      button('Cancel', 'button button--ghost', closeModal),
      button('Review', 'button button--primary', () => {
        try { parseOperationAmount(); operation.phase = 'review'; renderModal(); } catch (reason) { error.textContent = reason.message; }
      }),
    ]),
  );
}
function confirmOperation() {
  try {
    const amount = parseOperationAmount();
    if (operation.type === 'deposit') deposit(state, operation.vaultId, amount);
    else withdraw(state, operation.vaultId, amount);
    const message = operation.type === 'deposit' ? 'Deposit added to your illustrative portfolio.' : 'Withdrawal returned to the matching wallet asset.';
    closeModal();
    saveAndRender('portfolio');
    toast(message);
  } catch (error) {
    operation.phase = 'input';
    renderModal();
    document.getElementById('demo-operation-error').textContent = error.message;
  }
}

modalBackdrop.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...modalBackdrop.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')];
  if (!focusable.length) return;
  const [first] = focusable;
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
modalBackdrop.addEventListener('click', (event) => { if (event.target === modalBackdrop) closeModal(); });
modalClose.addEventListener('click', closeModal);
window.addEventListener('hashchange', render);
document.querySelector('[data-demo-reset]')?.addEventListener('click', () => {
  if (!window.confirm('Reset the browser-only demo and remove all simulated activity?')) return;
  state = clearDemoState();
  experience = 'base';
  selectedChain = 'plasma';
  selectedAsset = 'usdc';
  selectedProfile = 'conservative';
  navigate('overview');
  render();
  toast('The interactive demo was reset.');
});

if (!window.location.hash || !ROUTES.has(currentRoute())) window.location.hash = 'overview';
render();
window.JethosDemo = Object.freeze({
  reset: () => { state = createInitialState(); saveAndRender('overview'); },
  snapshot: () => structuredClone(state),
});
