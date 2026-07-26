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
const ROUTES = new Set(['overview', 'wallet', 'vaults', 'portfolio', 'activity', 'transparency']);
const view = document.getElementById('demo-view');
const modalBackdrop = document.querySelector('[data-demo-modal]');
const modalContent = document.getElementById('demo-modal-content');
const modalClose = document.querySelector('[data-demo-modal-close]');
const toastRegion = document.querySelector('[data-demo-toasts]');

let state = loadDemoState();
let experience = 'base';
let selectedChain = 'plasma';
let selectedAsset = 'usdc';
let selectedProfile = 'conservative';
let operation = null;
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

function donut(items, total, center) {
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    cursor += total ? (item.value / total) * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(',');
  return el('div', { className: 'demo-donut', attrs: { style: `--donut:${stops || '#243248 0 100%'}` } }, [
    el('span', {}, [el('strong', { text: center }), el('small', { text: 'liquid' })]),
  ]);
}

function renderOverview() {
  const summary = summarize(state);
  return [
    header('Your financial home', 'Everything visible. Every action explicit.', 'The dashboard separates assets still in your wallet from positions that follow transparent vault rules.', [
      button('Explore vaults', 'button button--primary', () => navigate('vaults')),
    ]),
    el('div', { className: 'demo-balance' }, [
      metric('Total simulated value', money(summary.total), 'demo-balance__total'),
      metric('Available in your wallet', money(summary.wallet), 'demo-balance__wallet', () => navigate('wallet')),
      metric('Invested in transparent vaults', money(summary.vaultValue), 'demo-balance__vault', () => navigate('portfolio')),
      metric('Illustrative earnings', signedMoney(summary.earnings)),
    ]),
    el('section', { className: 'demo-boundary', attrs: { 'aria-label': 'Ownership boundary' } }, [
      actionCard('demo-boundary__account demo-boundary__account--wallet', () => navigate('wallet'), 'Open wallet', [
        el('span', { className: 'badge badge--implemented', text: 'You have control' }),
        el('h3', { text: 'Wallet' }),
        el('strong', { className: 'demo-value', text: money(summary.wallet) }),
        el('p', { text: 'See every liquid asset. Nothing enters a vault until you approve a specific action.' }),
      ]),
      el('span', { className: 'demo-boundary__arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
      actionCard('demo-boundary__account demo-boundary__account--vault', () => navigate('portfolio'), 'Open vault positions', [
        el('span', { className: 'badge badge--poc', text: 'You choose the route' }),
        el('h3', { text: 'Vault positions' }),
        el('strong', { className: 'demo-value', text: money(summary.vaultValue) }),
        el('p', { text: 'Inspect allocations, costs, liquidity, policy and the evidence behind every position.' }),
      ]),
    ]),
    el('section', { className: 'demo-onboarding', attrs: { 'aria-label': 'Product model' } }, [
      el('article', {}, [el('strong', { text: '01 · Hold' }), el('p', { text: 'Wallet assets remain directly controlled.' })]),
      el('article', {}, [el('strong', { text: '02 · Invest' }), el('p', { text: 'Only the selected value crosses into a vault.' })]),
      el('article', {}, [el('strong', { text: '03 · Understand' }), el('p', { text: 'Routes become clearer as you open more detail.' })]),
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
        donut(assets, total, money(total)),
      ]),
      el('div', { className: 'demo-asset-list' }, assets.map((asset) => {
        const percent = total ? Math.round((asset.value / total) * 100) : 0;
        return actionCard('demo-asset-row', () => {
          selectedAsset = asset.id;
          experience = 'advanced';
          navigate('vaults');
        }, `${asset.symbol}, ${money(asset.value)}, ${percent}% of wallet`, [
          el('i', { attrs: { style: `--asset-color:${asset.color}` } }),
          el('div', {}, [el('strong', { text: asset.symbol }), el('small', { text: asset.units })]),
          el('div', {}, [el('strong', { text: money(asset.value) }), el('small', { text: `${percent}% of wallet` })]),
        ]);
      })),
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
  return el('article', { className: 'card demo-vault-card', attrs: { 'data-accent': vault.accent } }, [
    el('div', { className: 'demo-vault-card__top' }, [
      el('div', {}, [el('span', { className: 'eyebrow', text: vault.profile }), el('h3', { text: vault.name }), el('p', { text: vault.description })]),
      el('span', { className: 'badge badge--illustrative', text: 'Example' }),
    ]),
    vaultStats(vault),
    allocationBars(vault),
    el('div', { className: 'demo-vault-card__actions' }, [
      button(`Explain ${experience}`, 'button button--secondary', () => { selectedProfile = profile.id; render(); document.getElementById('vault-detail')?.scrollIntoView({ behavior: 'smooth' }); }),
      button('Simulate deposit', 'button button--primary', (event) => openOperation('deposit', vault.id, event.currentTarget)),
    ]),
  ]);
}

function renderVaultDetail() {
  const vault = vaultById(activeVaultId());
  const copy = experience === 'base' ? vault.baseExplanation : experience === 'pro' ? vault.proExplanation : vault.advancedExplanation;
  return el('section', { className: `card demo-vault-detail demo-vault-detail--${experience}`, attrs: { id: 'vault-detail' } }, [
    el('div', { className: 'demo-vault-card__top' }, [
      el('div', {}, [el('p', { className: 'eyebrow', text: `${experience} explanation · ${vault.profile}` }), el('h3', { text: vault.name }), el('p', { className: 'muted', text: copy })]),
      button('Deposit', 'button button--primary', (event) => openOperation('deposit', vault.id, event.currentTarget)),
    ]),
    el('div', { className: 'demo-detail-grid' }, [
      el('div', {}, [el('h3', { text: experience === 'base' ? 'What your money does' : experience === 'pro' ? 'Protocols and contribution' : 'Route records and proof' }), allocationBars(vault)]),
      el('div', {}, [
        el('h3', { text: experience === 'advanced' ? 'Policy and evidence' : 'What to understand' }),
        el('p', { className: 'demo-detail-copy', text: copy }),
        el('ul', { className: 'demo-risk-list' }, vault.risks.map((risk) => el('li', { text: risk }))),
      ]),
    ]),
    el('div', { className: 'callout' }, [
      el('strong', { text: experience === 'advanced' ? 'Illustrative verification package' : 'Same strategy, clearer at every level.' }),
      el('p', { text: experience === 'advanced' ? 'A live position would link contract, transaction, block, timestamp, limits and exit state.' : 'Change Base, Pro or Advanced above: the underlying illustrative strategy stays the same; only choice and explanation depth change.' }),
    ]),
  ]);
}

function renderVaults() {
  return [
    header('Vaults', 'You choose how, when and where to invest.', 'Risk stays visible at every level. More complexity means more choice and more explanation—not a different ownership boundary.'),
    experienceSelector(),
    el('div', { className: 'demo-vault-grid' }, DEMO_VAULTS.map(vaultCard)),
    renderVaultDetail(),
  ];
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
  content.push(el('div', { className: 'demo-position-list' }, entries.map(([id, position]) => {
    const vault = vaultById(id);
    const value = positionValue(position, vault);
    return el('article', { className: 'card demo-position' }, [
      el('div', {}, [el('span', { className: 'badge badge--illustrative', text: vault.profile }), el('h3', { text: vault.name }), el('p', { text: `${position.daysAccrued} simulated days · ${vault.chain.name} · ${vault.asset.symbol}` })]),
      stat('Principal', money(position.principal)), stat('Current value', money(value)), stat('Change', signedMoney(value - position.principal)),
      el('div', { className: 'demo-position__actions' }, [
        button('Inspect receipt', 'button button--ghost', () => { selectedProfile = vault.id.split(':')[0]; selectedChain = vault.chain.id; selectedAsset = vault.asset.id; experience = 'advanced'; navigate('transparency'); }),
        button('Withdraw', 'button button--secondary', (event) => openOperation('withdraw', id, event.currentTarget)),
      ]),
    ]);
  })));
  return content;
}

function renderActivity() {
  const content = [header('Receipts', 'Simulated activity', 'Every local action records what changed without inventing blockchain hashes or live evidence.')];
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

function renderTransparency() {
  const entries = Object.entries(state.positions).filter(([, position]) => position.principal > 0);
  const content = [
    header('Understand', 'Every position should explain itself.', 'Open the route, allocation, APYs, risks, exit state and verification fields behind each simulated position.'),
    el('div', { className: 'callout' }, [el('strong', { text: 'Wallet boundary' }), el('p', { text: `${money(summarize(state).wallet)} remains liquid in the demo wallet. Only explicit deposits appear below.` })]),
  ];
  if (!entries.length) {
    content.push(emptyState('No deployed capital', 'Your entire simulated balance is still in the wallet.', 'Explore vaults', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-transparency-list' }, entries.map(([id, position]) => {
    const vault = vaultById(id);
    return el('article', { className: 'card demo-receipt' }, [
      el('div', { className: 'demo-vault-card__top' }, [
        el('div', {}, [el('span', { className: 'eyebrow', text: `${vault.asset.symbol} ${vault.profile} · example` }), el('h3', { text: 'Vault position receipt' })]),
        el('strong', { className: 'demo-value', text: money(positionValue(position, vault)) }),
      ]),
      el('div', { className: 'demo-receipt-facts' }, [
        stat('Expected net yield', apy(vault.apy)), stat('Exit status', vault.liquidity), stat('Network', vault.chain.name), stat('Evidence', 'Illustrative · not live'),
      ]),
      el('h4', { text: 'Vault current allocations' }),
      allocationBars(vault, 'advanced'),
      el('div', { className: 'demo-receipt-reason' }, [el('span', { className: 'demo-label', text: 'Allocation rationale' }), el('strong', { text: vault.proExplanation })]),
      el('div', { className: 'demo-receipt-proof' }, [
        stat('Why this route?', 'Best eligible result after yield, costs, liquidity and risk limits'),
        stat('What would prove it?', 'Transaction · contract · block · timestamp'),
      ]),
    ]);
  })));
  return content;
}

function render() {
  const route = currentRoute();
  document.querySelectorAll('[data-demo-route]').forEach((link) => {
    if (link.dataset.demoRoute === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const renderers = { overview: renderOverview, wallet: renderWallet, vaults: renderVaults, portfolio: renderPortfolio, activity: renderActivity, transparency: renderTransparency };
  view.replaceChildren(...renderers[route]());
  document.title = `${route[0].toUpperCase()}${route.slice(1)} · Jethos Interactive Demo`;
}

function openOperation(type, id, trigger) {
  const vault = vaultById(id);
  if (!vault) return;
  returnFocus = trigger || document.activeElement;
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
