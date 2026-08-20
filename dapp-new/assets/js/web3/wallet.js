import { DEPLOYMENT } from './deployment-config.js';
import { loadEthers } from './ethers-loader.js';

/**
 * Small EIP-1193 session manager. It never requests accounts on page load:
 * restore() uses eth_accounts, while connect() is called only from a user click.
 */
class WalletSession extends EventTarget {
  constructor() {
    super();
    this.browserProvider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.listenersInstalled = false;
  }
  get injected() { return typeof window !== 'undefined' ? window.ethereum : undefined; }
  snapshot() { return { available: Boolean(this.injected), connected: Boolean(this.address), address: this.address, chainId: this.chainId, correctChain: this.chainId === DEPLOYMENT.chain.id }; }
  emit() { this.dispatchEvent(new CustomEvent('change', { detail: this.snapshot() })); }
  async restore() {
    if (!this.injected) { this.emit(); return this.snapshot(); }
    const accounts = await this.injected.request({ method: 'eth_accounts' });
    const chainHex = await this.injected.request({ method: 'eth_chainId' });
    this.chainId = Number.parseInt(chainHex, 16);
    if (accounts[0]) await this.initialize(accounts[0]);
    this.installListeners(); this.emit(); return this.snapshot();
  }
  async connect() {
    if (!this.injected) throw new Error('No EIP-1193 wallet was detected. Install or open a compatible wallet.');
    const accounts = await this.injected.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw new Error('The wallet did not return an account.');
    const chainHex = await this.injected.request({ method: 'eth_chainId' });
    this.chainId = Number.parseInt(chainHex, 16);
    await this.initialize(accounts[0]); this.installListeners(); this.emit(); return this.snapshot();
  }
  async initialize(address) {
    const ethers = await loadEthers();
    this.browserProvider = new ethers.BrowserProvider(this.injected);
    this.signer = await this.browserProvider.getSigner(address);
    this.address = await this.signer.getAddress();
  }
  async switchToDeploymentChain() {
    if (!this.injected) throw new Error('Wallet unavailable.');
    try {
      await this.injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: DEPLOYMENT.chain.hexId }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await this.injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId: DEPLOYMENT.chain.hexId, chainName: DEPLOYMENT.chain.name, rpcUrls: [DEPLOYMENT.chain.rpcUrl], blockExplorerUrls: [DEPLOYMENT.chain.explorerUrl], nativeCurrency: DEPLOYMENT.chain.nativeCurrency }] });
    }
  }
  installListeners() {
    if (!this.injected || this.listenersInstalled) return;
    this.listenersInstalled = true;
    this.injected.on?.('accountsChanged', async (accounts) => {
      if (!accounts[0]) this.disconnect(); else await this.initialize(accounts[0]);
      this.emit();
    });
    this.injected.on?.('chainChanged', async (chainHex) => {
      this.chainId = Number.parseInt(chainHex, 16);
      if (this.address) await this.initialize(this.address);
      this.emit();
    });
  }
  disconnect() { this.browserProvider = null; this.signer = null; this.address = null; this.emit(); }
}

export const walletSession = new WalletSession();

