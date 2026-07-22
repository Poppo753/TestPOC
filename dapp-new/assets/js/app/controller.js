import { loadEthers } from '../web3/ethers-loader.js';
import { walletSession } from '../web3/wallet.js';
import { readVaultSnapshot, readUserSnapshot, readProtocolSnapshot } from '../web3/readers.js';
import { readUserEvents } from '../web3/events.js';
import { explainTransactionError } from '../web3/transactions.js';
import { showToast } from '../components/toast.js';
import { byId, setText } from './dom.js';
import { AppView } from './renderers.js';
import { AppForms } from './forms.js';
import { AppWorkflow } from './workflow.js';

/** Thin lifecycle coordinator; detailed UI and workflows live in dedicated modules. */
class PocAppController {
  async init() {
    try {
      this.publicRefreshToken = 0; this.userRefreshToken = 0;
      this.ethers = await loadEthers(); this.view = new AppView(this.ethers); this.view.initializeStaticLinks();
      this.workflow = new AppWorkflow({ ethers: this.ethers, wallet: walletSession, view: this.view, getVault: () => this.vault, getUser: () => this.user, refresh: () => this.refreshAll() });
      this.forms = new AppForms({ ethers: this.ethers, getVault: () => this.vault, getUser: () => this.user, getAddress: () => walletSession.address, onDeposit: () => this.workflow.prepareDeposit(), onWithdraw: () => this.workflow.prepareWithdraw() });
      this.bind(); this.forms.bind(); this.workflow.bind();
      await Promise.all([this.refreshPublic(), walletSession.restore()]);
      if (walletSession.address) await this.refreshUser();
    } catch (error) { this.view?.renderGlobalError(error); showToast(error.message, { duration: 9000 }); }
  }
  bind() {
    byId('connect-wallet')?.addEventListener('click', () => walletSession.connect().catch((error) => showToast(explainTransactionError(error))));
    byId('switch-network')?.addEventListener('click', () => walletSession.switchToDeploymentChain().catch((error) => showToast(explainTransactionError(error))));
    byId('refresh-data')?.addEventListener('click', () => this.refreshAll());
    walletSession.addEventListener('change', ({ detail }) => {
      this.userRefreshToken += 1;
      this.view.renderWallet(detail);
      if (detail.connected) this.refreshUser();
      else { this.user = null; this.view.clearUser(); }
    });
  }
  async refreshAll() { await this.refreshPublic(); if (walletSession.address) await this.refreshUser(); }
  async refreshPublic() {
    const token = ++this.publicRefreshToken;
    setText('data-status', 'Refreshing public state…');
    this.view.renderRefresh(true);
    try {
      const [vault, protocols] = await Promise.all([readVaultSnapshot(), readProtocolSnapshot()]);
      if (token !== this.publicRefreshToken) return;
      this.vault = vault; this.protocols = protocols;
      this.view.renderVault(vault); this.view.renderProtocols(protocols);
    } catch (error) {
      if (token === this.publicRefreshToken) setText('data-status', `Live reads unavailable · ${error.message}`);
    } finally { if (token === this.publicRefreshToken) this.view.renderRefresh(false); }
  }
  async refreshUser() {
    if (!walletSession.address) return;
    const token = ++this.userRefreshToken; const address = walletSession.address;
    try {
      const user = await readUserSnapshot(address);
      if (token !== this.userRefreshToken || walletSession.address !== address) return;
      this.user = user; this.view.renderUser(user);
      try {
        const events = await readUserEvents(address);
        if (token === this.userRefreshToken && walletSession.address === address) this.view.renderEvents(events);
      } catch (error) { if (token === this.userRefreshToken) this.view.renderEventError(error); }
    }
    catch (error) { showToast(`User data unavailable: ${error.message}`); }
  }
}

new PocAppController().init();
