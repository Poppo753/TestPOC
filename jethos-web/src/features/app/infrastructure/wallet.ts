import type { JsonRpcSigner } from 'ethers';

import { createSigner, type Eip1193Provider } from './contracts';
import { deployment } from './deployment';

export interface WalletSnapshot {
  available: boolean;
  connected: boolean;
  address: string | null;
  chainId: number | null;
  correctChain: boolean;
}

type WalletSubscriber = (snapshot: WalletSnapshot) => void;
type SignerFactory = (provider: Eip1193Provider, address: string) => Promise<JsonRpcSigner>;

const accountsFrom = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const chainFrom = (value: unknown): number | null =>
  typeof value === 'string' && /^0x[\da-f]+$/iu.test(value) ? Number.parseInt(value, 16) : null;

/** Explicit EIP-1193 session. restore() never requests account authorization. */
export class WalletSession {
  signer: JsonRpcSigner | null = null;
  private currentAddress: string | null = null;
  private currentChainId: number | null = null;
  private listenersInstalled = false;
  private readonly subscribers = new Set<WalletSubscriber>();

  constructor(
    private readonly provider: Eip1193Provider | undefined,
    private readonly signerFactory: SignerFactory = createSigner,
  ) {}

  snapshot(): WalletSnapshot {
    return {
      available: Boolean(this.provider),
      connected: Boolean(this.currentAddress),
      address: this.currentAddress,
      chainId: this.currentChainId,
      correctChain: this.currentChainId === deployment.chain.id,
    };
  }

  get address(): string | null {
    return this.currentAddress;
  }

  get chainId(): number | null {
    return this.currentChainId;
  }

  addEventListener(_type: 'change', listener: (event: { detail: WalletSnapshot }) => void) {
    return this.subscribe((detail) => listener({ detail }));
  }

  subscribe(subscriber: WalletSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private emit(): WalletSnapshot {
    const snapshot = this.snapshot();
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
    return snapshot;
  }

  async restore(): Promise<WalletSnapshot> {
    if (!this.provider) return this.emit();
    const [accountsValue, chainValue] = await Promise.all([
      this.provider.request({ method: 'eth_accounts' }),
      this.provider.request({ method: 'eth_chainId' }),
    ]);
    this.currentChainId = chainFrom(chainValue);
    const account = accountsFrom(accountsValue)[0];
    if (account) await this.initialize(account);
    this.installListeners();
    return this.emit();
  }

  async connect(): Promise<WalletSnapshot> {
    if (!this.provider)
      throw new Error('No EIP-1193 wallet was detected. Install or open a compatible wallet.');
    const accounts = accountsFrom(await this.provider.request({ method: 'eth_requestAccounts' }));
    if (!accounts[0]) throw new Error('The wallet did not return an account.');
    this.currentChainId = chainFrom(await this.provider.request({ method: 'eth_chainId' }));
    await this.initialize(accounts[0]);
    this.installListeners();
    return this.emit();
  }

  private async initialize(address: string): Promise<void> {
    this.signer = await this.signerFactory(this.provider!, address);
    this.currentAddress = await this.signer.getAddress();
  }

  async switchToDeploymentChain(): Promise<void> {
    if (!this.provider) throw new Error('Wallet unavailable.');
    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: deployment.chain.hexId }],
      });
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 4902)
        throw error;
      await this.provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: deployment.chain.hexId,
            chainName: deployment.chain.name,
            rpcUrls: [deployment.chain.rpcUrl],
            blockExplorerUrls: [deployment.chain.explorerUrl],
            nativeCurrency: deployment.chain.nativeCurrency,
          },
        ],
      });
    }
  }

  private readonly onAccountsChanged = (...args: unknown[]) => {
    const account = accountsFrom(args[0])[0];
    if (!account) {
      this.disconnect();
      return;
    }
    void this.initialize(account)
      .then(() => this.emit())
      .catch(() => this.disconnect());
  };

  private readonly onChainChanged = (...args: unknown[]) => {
    this.currentChainId = chainFrom(args[0]);
    this.emit();
  };

  private installListeners(): void {
    if (!this.provider?.on || this.listenersInstalled) return;
    this.listenersInstalled = true;
    this.provider.on('accountsChanged', this.onAccountsChanged);
    this.provider.on('chainChanged', this.onChainChanged);
  }

  disconnect(): void {
    this.signer = null;
    this.currentAddress = null;
    this.emit();
  }

  destroy(): void {
    if (this.listenersInstalled) {
      this.provider?.removeListener?.('accountsChanged', this.onAccountsChanged);
      this.provider?.removeListener?.('chainChanged', this.onChainChanged);
    }
    this.listenersInstalled = false;
    this.subscribers.clear();
    this.signer = null;
    this.currentAddress = null;
  }
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export const createBrowserWalletSession = (): WalletSession =>
  new WalletSession(typeof window === 'undefined' ? undefined : window.ethereum);
