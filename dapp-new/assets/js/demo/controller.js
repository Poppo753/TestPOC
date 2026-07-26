import { DEMO_VAULTS, vaultById } from './data.js';
import { createInitialState, loadDemoState, saveDemoState, clearDemoState } from './storage.js';
import { advanceDays, deposit, positionValue, summarize, withdraw } from './engine.js';

/**
 * Interactive Demo controller.
 *
 * This module owns UI orchestration only. Financial-looking calculations live
 * in engine.js and the illustrative catalog lives in data.js. Dynamic values
 * are inserted through textContent and explicit nodes so input is never parsed
 * as markup.
 */
const ROUTES = new Set(['overview', 'vaults', 'portfolio', 'activity', 'transparency']);
const view = document.getElementById('demo-view');
const modalBackdrop = document.querySelector('[data-demo-modal]');
const modalContent = document.getElementById('demo-modal-content');
const modalClose = document.querySelector('[data-demo-modal-close]');
const toastRegion = document.querySelector('[data-demo-toasts]');

let state = loadDemoState();
let selectedVaultId = 'reserve';
let operation = null;
let returnFocus = null;

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value).replace('$', '') + ' USDC';
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
    el('div', {}, [
      el('p', { className: 'eyebrow', text: eyebrow }),
      el('h2', { text: title }),
      el('p', { text: description }),
    ]),
    actions.length ? el('div', { className: 'cluster' }, actions) : null,
  ]);
}

function metric(label, value, className = '') {
  return el('article', { className: `card ${className}`.trim() }, [
    el('span', { className: 'demo-label', text: label }),
    el('strong', { className: 'demo-value', text: value }),
  ]);
}

function allocationBars(vault) {
  return el('div', { className: 'demo-vault-card__allocations' }, vault.allocations.map((allocation) =>
    el('div', { className: 'demo-bar' }, [
      el('div', { className: 'demo-bar__label' }, [
        el('span', { text: allocation.name }),
        el('strong', { text: `${allocation.percent}%` }),
      ]),
      el('div', { className: 'demo-bar__track' }, [
        el('span', { className: 'demo-bar__fill', attrs: { style: `--allocation:${allocation.percent}%` } }),
      ]),
    ])));
}

function emptyState(title, description, actionLabel, action) {
  return el('div', { className: 'demo-empty' }, [
    el('h3', { text: title }),
    el('p', { text: description }),
    button(actionLabel, 'button button--primary', action),
  ]);
}

function renderOverview() {
  const summary = summarize(state);
  const actions = [button('Explore vaults', 'button button--primary', () => navigate('vaults'))];
  const content = [
    header('Experience the model', 'Your simulated financial home', 'See what remains in your wallet, what you explicitly placed into vaults, and how every route can be inspected.', actions),
    el('div', { className: 'demo-balance' }, [
      metric('Total simulated value', money(summary.total), 'demo-balance__total'),
      metric('In your demo wallet', money(summary.wallet)),
      metric('Deposited in vaults', money(summary.vaultValue)),
      metric('Illustrative earnings', signedMoney(summary.earnings)),
    ]),
    el('section', { className: 'demo-boundary', attrs: { 'aria-label': 'Ownership boundary' } }, [
      el('article', { className: 'demo-boundary__account demo-boundary__account--wallet' }, [
        el('span', { className: 'badge badge--implemented', text: 'Direct control' }),
        el('h3', { text: 'Demo wallet' }),
        el('strong', { className: 'demo-value', text: money(summary.wallet) }),
        el('p', { text: 'This balance has not entered a vault. In the product model, only an explicit action can move the selected amount across this boundary.' }),
      ]),
      el('span', { className: 'demo-boundary__arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
      el('article', { className: 'demo-boundary__account demo-boundary__account--vault' }, [
        el('span', { className: 'badge badge--poc', text: 'Explicitly deposited' }),
        el('h3', { text: 'Transparent vault routes' }),
        el('strong', { className: 'demo-value', text: money(summary.vaultValue) }),
        el('p', { text: 'Deposited capital is exposed to the risks of its visible illustrative route. Self-custody does not remove smart-contract, protocol or liquidity risk.' }),
      ]),
    ]),
  ];

  if (!state.onboardingComplete) {
    content.push(el('section', { className: 'demo-onboarding', attrs: { 'aria-label': 'Three demo principles' } }, [
      principle('01 · Simulated', 'No wallet, chain or real funds are connected.'),
      principle('02 · Explicit', 'Only the amount you choose crosses into a vault.'),
      principle('03 · Inspectable', 'Allocation and risk remain visible after deposit.'),
    ]));
    state.onboardingComplete = true;
    saveDemoState(state);
  }
  return content;
}

function principle(title, description) {
  return el('article', {}, [el('strong', { text: title }), el('p', { text: description })]);
}

function vaultStats(vault) {
  return el('div', { className: 'demo-vault-card__stats' }, [
    stat('Illustrative APY', apy(vault.apy)),
    stat('Risk', vault.risk),
    stat('Liquidity', vault.liquidity),
  ]);
}

function stat(label, value) {
  return el('div', {}, [el('span', { className: 'demo-label', text: label }), el('strong', { text: value })]);
}

function vaultCard(vault) {
  return el('article', { className: 'card demo-vault-card', attrs: { 'data-accent': vault.accent } }, [
    el('div', { className: 'demo-vault-card__top' }, [
      el('div', {}, [el('span', { className: 'eyebrow', text: vault.profile }), el('h3', { text: vault.name }), el('p', { text: vault.description })]),
      el('span', { className: 'badge badge--illustrative', text: 'Illustrative' }),
    ]),
    vaultStats(vault),
    allocationBars(vault),
    el('div', { className: 'demo-vault-card__actions' }, [
      button('View details', 'button button--secondary', () => {
        selectedVaultId = vault.id;
        render();
        document.getElementById('vault-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
      button('Simulate deposit', 'button button--primary', (event) => openOperation('deposit', vault.id, event.currentTarget)),
    ]),
  ]);
}

function renderVaultDetail() {
  const vault = vaultById(selectedVaultId);
  return el('section', { className: 'card demo-vault-detail', attrs: { id: 'vault-detail' } }, [
    el('div', { className: 'demo-vault-card__top' }, [
      el('div', {}, [el('p', { className: 'eyebrow', text: `${vault.profile} profile · illustrative` }), el('h3', { text: `${vault.name} details` }), el('p', { className: 'muted', text: vault.description })]),
      button('Simulate deposit', 'button button--primary', (event) => openOperation('deposit', vault.id, event.currentTarget)),
    ]),
    el('div', { className: 'demo-detail-grid' }, [
      el('div', {}, [el('h3', { text: 'Illustrative capital route' }), allocationBars(vault)]),
      el('div', {}, [
        el('h3', { text: 'What remains at risk' }),
        el('ul', { className: 'demo-risk-list' }, vault.risks.map((risk) => el('li', { text: risk }))),
      ]),
    ]),
    el('div', { className: 'callout callout--warning' }, [
      el('strong', { text: 'Model, not availability.' }),
      el('p', { text: 'APY, liquidity targets and allocations explain the intended experience; they are not current product terms or guarantees.' }),
    ]),
  ]);
}

function renderVaults() {
  return [
    header('Explore', 'Choose by route and risk', 'Compare illustrative profiles. Yield is shown beside risk, liquidity and capital allocation—not as a standalone promise.'),
    el('div', { className: 'demo-vault-grid' }, DEMO_VAULTS.map(vaultCard)),
    renderVaultDetail(),
  ];
}

function renderPortfolio() {
  const entries = Object.entries(state.positions).filter(([, position]) => position.principal > 0);
  const actions = entries.length ? [
    button('Simulate 30 days', 'button button--secondary', () => {
      try {
        advanceDays(state, 30);
        saveAndRender();
        toast('Thirty illustrative days were added.');
      } catch (error) { toast(error.message); }
    }),
    button('Add deposit', 'button button--primary', () => navigate('vaults')),
  ] : [];
  const content = [header('Portfolio', 'Your illustrative positions', 'Principal, simulated value and availability remain distinct.', actions)];
  if (!entries.length) {
    content.push(emptyState('No vault positions yet', 'Choose a transparent illustrative route and simulate your first deposit.', 'Explore vaults', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-position-list' }, entries.map(([vaultId, position]) => {
    const vault = vaultById(vaultId);
    const value = positionValue(position, vault);
    return el('article', { className: 'card demo-position' }, [
      el('div', {}, [el('span', { className: 'badge badge--illustrative', text: vault.profile }), el('h3', { text: vault.name }), el('p', { text: `${position.daysAccrued} simulated days accrued` })]),
      stat('Principal', money(position.principal)),
      stat('Current value', money(value)),
      stat('Change', signedMoney(value - position.principal)),
      el('div', { className: 'demo-position__actions' }, [
        button('Withdraw', 'button button--secondary', (event) => openOperation('withdraw', vault.id, event.currentTarget)),
      ]),
    ]);
  })));
  return content;
}

function renderActivity() {
  const content = [header('Receipts', 'Simulated activity', 'Local records explain what changed. They are not blockchain transactions and contain no invented hashes.')];
  if (!state.activity.length) {
    content.push(emptyState('No activity recorded', 'Deposits, withdrawals and time simulation will appear here.', 'Start a deposit', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-activity' }, state.activity.map((item) =>
    el('article', { className: 'demo-activity__row' }, [
      el('div', {}, [el('strong', { text: item.type }), el('small', { text: item.id })]),
      el('div', {}, [el('span', { className: 'demo-label', text: 'Destination' }), el('strong', { text: item.vaultName })]),
      el('div', {}, [el('span', { className: 'demo-label', text: 'Amount' }), el('strong', { text: item.amount ? money(item.amount) : '—' })]),
      el('div', {}, [el('span', { className: 'badge badge--illustrative', text: item.status }), el('small', { text: date(item.timestamp) })]),
    ]))));
  return content;
}

function renderTransparency() {
  const entries = Object.entries(state.positions).filter(([, position]) => position.principal > 0);
  const content = [
    header('Transparency', 'Where is my simulated money?', 'The route is visible after deposit. Transparency helps inspection; it does not remove the risks carried by each component.'),
    el('div', { className: 'callout' }, [
      el('strong', { text: 'Ownership boundary' }),
      el('p', { text: `${money(state.walletBalance)} remains in the demo wallet. Only amounts you explicitly deposited appear in the routes below.` }),
    ]),
  ];
  if (!entries.length) {
    content.push(emptyState('No deployed capital', 'Your entire simulated balance is still in the demo wallet.', 'Explore vaults', () => navigate('vaults')));
    return content;
  }
  content.push(el('div', { className: 'demo-transparency-list' }, entries.map(([vaultId, position]) => {
    const vault = vaultById(vaultId);
    return el('article', { className: 'card' }, [
      el('span', { className: 'badge badge--illustrative', text: 'Illustrative route' }),
      el('h3', { text: vault.name }),
      el('div', { className: 'demo-route' }, [
        el('div', { className: 'demo-route__node' }, [el('strong', { text: 'Demo wallet' }), el('p', { text: 'You explicitly selected the amount.' })]),
        el('span', { className: 'demo-route__arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
        el('div', { className: 'demo-route__node' }, [el('strong', { text: `${money(positionValue(position, vault))} in ${vault.name}` }), allocationBars(vault)]),
      ]),
      el('h4', { text: 'Risk ledger' }),
      el('ul', { className: 'demo-risk-list' }, vault.risks.map((risk) => el('li', { text: risk }))),
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
  const renderers = { overview: renderOverview, vaults: renderVaults, portfolio: renderPortfolio, activity: renderActivity, transparency: renderTransparency };
  view.replaceChildren(...renderers[route]());
  document.title = `${route[0].toUpperCase()}${route.slice(1)} · Jethos Interactive Demo`;
}

function openOperation(type, vaultId, trigger) {
  const vault = vaultById(vaultId);
  if (!vault) return;
  returnFocus = trigger || document.activeElement;
  operation = { type, vaultId, phase: 'input', amount: '' };
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
  if (operation.type === 'deposit') return state.walletBalance;
  return positionValue(state.positions[operation.vaultId], vaultById(operation.vaultId));
}

function parseOperationAmount() {
  const value = Number(operation.amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
  if (value - operationAvailable() > 0.000001) throw new Error('The amount exceeds the available simulated balance.');
  return value;
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
    const remaining = operationAvailable() - amount;
    modalContent.append(
      el('p', { className: 'muted', text: 'Nothing is sent to a wallet or blockchain. Confirming only updates this browser demo.' }),
      el('div', { className: 'demo-modal__summary' }, [
        summaryRow('Action', isDeposit ? 'Simulated deposit' : 'Simulated withdrawal'),
        summaryRow(isDeposit ? 'Destination' : 'From', vault.name),
        summaryRow('Amount', money(amount)),
        summaryRow(isDeposit ? 'Wallet remaining' : 'Position remaining', money(remaining)),
        summaryRow('Risk profile', vault.risk),
        summaryRow('Illustrative APY', apy(vault.apy)),
      ]),
      el('div', { className: 'callout callout--warning' }, [
        el('strong', { text: isDeposit ? 'Deposited capital carries vault risk.' : 'Liquidity is only simulated here.' }),
        el('p', { text: isDeposit ? 'Self-custody does not make deposited capital risk-free. Review the visible route and risks.' : 'A real withdrawal can depend on contract state, protocol liquidity and operational conditions.' }),
      ]),
      el('div', { className: 'demo-modal__actions' }, [
        button('Back', 'button button--ghost', () => { operation.phase = 'input'; renderModal(); }),
        button(`Confirm simulated ${operation.type}`, 'button button--primary', () => confirmOperation()),
      ]),
    );
    return;
  }

  const input = el('input', { attrs: { id: 'demo-operation-amount', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00', value: operation.amount } });
  const error = el('p', { className: 'form-error', attrs: { role: 'alert', id: 'demo-operation-error' } });
  const preview = el('p', { className: 'form-help', text: `Available: ${money(operationAvailable())}`, attrs: { id: 'demo-operation-preview' } });
  input.addEventListener('input', () => {
    operation.amount = input.value;
    error.textContent = '';
    const amount = Number(input.value);
    preview.textContent = Number.isFinite(amount) && amount >= 0
      ? `${isDeposit ? 'Wallet' : 'Position'} remaining: ${money(Math.max(0, operationAvailable() - amount))}`
      : `Available: ${money(operationAvailable())}`;
  });
  const quick = isDeposit ? [[.25, '25%'], [.5, '50%'], [1, 'Max']] : [[.5, '50%'], [1, 'Max']];
  modalContent.append(
    el('p', { className: 'muted', text: isDeposit ? 'Choose how much demo USDC crosses from your wallet into this illustrative route.' : 'Choose how much simulated value returns to the demo wallet.' }),
    el('div', { className: 'form-field' }, [
      el('label', { text: 'Demo USDC amount', attrs: { for: 'demo-operation-amount' } }),
      input,
      el('div', { className: 'demo-quick-amounts' }, quick.map(([ratio, label]) =>
        button(label, '', () => {
          operation.amount = (operationAvailable() * ratio).toFixed(2);
          renderModal();
          document.getElementById('demo-operation-amount')?.focus();
        }))),
      preview,
      error,
    ]),
    el('div', { className: 'demo-modal__actions' }, [
      button('Cancel', 'button button--ghost', closeModal),
      button('Review', 'button button--primary', () => {
        try {
          parseOperationAmount();
          operation.phase = 'review';
          renderModal();
          modalContent.querySelector('button')?.focus();
        } catch (reason) { error.textContent = reason.message; }
      }),
    ]),
  );
}

function summaryRow(label, value) {
  return el('div', {}, [el('span', { text: label }), el('strong', { text: value })]);
}

function confirmOperation() {
  try {
    const amount = parseOperationAmount();
    if (operation.type === 'deposit') deposit(state, operation.vaultId, amount);
    else withdraw(state, operation.vaultId, amount);
    const label = operation.type === 'deposit' ? 'Deposit added to your illustrative portfolio.' : 'Withdrawal returned to the demo wallet.';
    closeModal();
    saveAndRender('portfolio');
    toast(label);
  } catch (error) {
    operation.phase = 'input';
    renderModal();
    const target = document.getElementById('demo-operation-error');
    if (target) target.textContent = error.message;
  }
}

// Keep focus inside the operation window and provide the expected Escape exit.
modalBackdrop.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...modalBackdrop.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
modalBackdrop.addEventListener('click', (event) => { if (event.target === modalBackdrop) closeModal(); });
modalClose.addEventListener('click', closeModal);
window.addEventListener('hashchange', render);

document.querySelector('[data-demo-reset]')?.addEventListener('click', () => {
  if (!window.confirm('Reset the browser-only demo to 10,000 USDC and remove all simulated activity?')) return;
  state = clearDemoState();
  selectedVaultId = 'reserve';
  navigate('overview');
  render();
  toast('The interactive demo was reset.');
});

if (!window.location.hash || !ROUTES.has(currentRoute())) window.location.hash = 'overview';
render();

// Export a narrow test hook for manual browser diagnostics without exposing
// internal mutation functions to normal page controls.
window.JethosDemo = Object.freeze({
  reset: () => {
    state = createInitialState();
    saveAndRender('overview');
  },
  snapshot: () => structuredClone(state),
});

