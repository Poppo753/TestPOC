import { DEPLOYMENT, explorerAddress, explorerTransaction } from '../web3/deployment-config.js';
import { formatAddress, formatDate } from '../core/format.js';
import { byId, element, replaceMessage, setActionAvailability, setLink, setText } from './dom.js';

/**
 * All visual projections of App state live here. The renderer knows nothing
 * about transaction construction or wallet connection side effects.
 */
export class AppView {
  constructor(ethers) {
    this.ethers = ethers;
    this.busy = false;
    this.vault = null;
  }

  initializeStaticLinks() {
    setLink('contract-liquidity', explorerAddress(DEPLOYMENT.contracts.liquidityManager), formatAddress(DEPLOYMENT.contracts.liquidityManager));
  }

  renderRefresh(busy) {
    const button = byId('refresh-data');
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.textContent = busy ? 'Refreshing…' : 'Refresh';
  }

  formatUnits(result, decimals, suffix = '') {
    if (!result?.ok) return 'Unavailable';
    try { return `${this.ethers.formatUnits(result.value, decimals)}${suffix}`; }
    catch { return 'Unavailable'; }
  }

  renderWallet(state) {
    const connect = byId('connect-wallet');
    const switchButton = byId('switch-network');
    if (connect) connect.textContent = state.connected ? formatAddress(state.address) : 'Connect wallet';
    if (switchButton) switchButton.hidden = !state.connected || state.correctChain;
    setActionAvailability({ connected: state.connected, correctChain: state.correctChain, busy: this.busy });
    setText('wallet-network', state.connected ? (state.correctChain ? DEPLOYMENT.chain.name : `Wrong network (${state.chainId})`) : 'Not connected');
  }

  renderVault(vault) {
    this.vault = vault;
    setText('pool-value', this.formatUnits(vault.poolValue, 6, ' USDC'));
    setText('pool-reserve', this.formatUnits(vault.reserve, 6, ' USDC'));
    setText('share-supply-raw', vault.totalSupply.ok ? vault.totalSupply.value.toString() : 'Unavailable');
    setText('deposit-fee', vault.depositFee.ok ? `${(Number(vault.depositFee.value) / 100).toFixed(2)}%` : 'Unavailable');
    setText('withdraw-fee', vault.withdrawFee.ok ? `${(Number(vault.withdrawFee.value) / 100).toFixed(2)}%` : 'Unavailable');
    setText('deposit-state', vault.depositsEnabled.ok ? (vault.depositsEnabled.value ? 'Enabled' : 'Disabled') : 'Unavailable');
    setText('withdraw-state', vault.withdrawsEnabled.ok ? (vault.withdrawsEnabled.value ? 'Enabled' : 'Disabled') : 'Unavailable');
    const paused = (vault.proxyPaused.ok && vault.proxyPaused.value) || (vault.liquidityPaused.ok && vault.liquidityPaused.value);
    setText('pause-state', paused ? 'Paused' : 'No pause reported');
    setText('data-status', `Live reads · ${formatDate(vault.timestamp)}`);
  }

  renderUser(user) {
    const shareDecimals = this.vault?.shareMeta?.ok ? this.vault.shareMeta.value.decimals : 18;
    setText('user-eth', this.formatUnits(user.nativeBalance, 18, ' ETH'));
    setText('user-usdc', this.formatUnits(user.baseBalance, 6, ' USDC'));
    setText('user-shares', this.formatUnits(user.shareBalance, shareDecimals, ` ${this.vault?.shareMeta?.value?.symbol || 'shares'}`));
    setText('user-position', this.formatUnits(user.estimatedRedeem, 6, ' USDC est.'));
    setText('user-allowance', this.formatUnits(user.allowance, 6, ' USDC'));
  }

  clearUser() {
    ['user-eth', 'user-usdc', 'user-shares', 'user-position', 'user-allowance'].forEach((id) => setText(id, 'Connect wallet'));
    this.renderEvents([]);
  }

  renderProtocols(snapshot) {
    const target = byId('protocol-list');
    if (!target) return;
    target.replaceChildren();
    snapshot.protocols.forEach((protocol) => {
      const active = protocol.info.ok ? Boolean(protocol.info.value.isActive) : null;
      const net = protocol.breakdown.ok ? this.ethers.formatUnits(protocol.breakdown.value.netValue, 6) : null;
      const item = element('article', { className: 'protocol-item' });
      const head = element('div', { className: 'protocol-item__head' });
      head.append(
        element('strong', { text: protocol.name }),
        element('span', { className: `badge ${active === true ? 'badge--implemented' : active === false ? 'badge--planned' : 'badge--poc'}`, text: active === true ? 'Registered active' : active === false ? 'Registered inactive' : 'Record / read failed' }),
      );
      item.append(head, element('p', { className: 'muted', text: net === null ? `${protocol.provenance}; allocation unavailable` : `Net position accounting value: ${net} USDC units` }));
      target.append(item);
    });
  }

  renderEvents(events) {
    const target = byId('event-list');
    if (!target) return;
    target.replaceChildren();
    if (!events.length) { replaceMessage(target, 'No recent events found in the bounded query window.'); return; }
    events.forEach((event) => {
      const row = element('div', { className: 'data-row' });
      const link = element('a', { text: formatAddress(event.transactionHash), attributes: { href: event.explorerUrl, target: '_blank', rel: 'noopener noreferrer' } });
      row.append(element('span', { text: `${event.type} · block ${event.blockNumber}` }), link);
      target.append(row);
    });
  }

  renderEventError(error) { replaceMessage(byId('event-list'), `Event history unavailable: ${String(error.message || error)}`); }

  renderTransaction(update) {
    const target = byId('tx-status');
    if (!target) return;
    target.replaceChildren(document.createTextNode(`${update.state}: ${update.label}`));
    if (update.hash) {
      target.append(document.createTextNode(' · '), element('a', { text: 'View transaction ↗', attributes: { href: explorerTransaction(update.hash), target: '_blank', rel: 'noopener noreferrer' } }));
    }
  }

  renderGlobalError(error) { setText('data-status', `Initialization failed: ${error.message}`); }
}
