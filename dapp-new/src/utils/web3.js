import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";
import { CONFIG, ABIS, GAS_LIMITS } from "../config/contracts.js";
import { MESSAGES } from "../config/constants.js";

// ============================================
// WEB3 STATE MANAGER
// ============================================

class Web3Manager {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.contracts = {};
    this.listeners = new Set();
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(callback => callback(this.getState()));
  }

  getState() {
    return {
      connected: !!this.userAddress,
      address: this.userAddress,
      provider: this.provider,
      signer: this.signer,
      contracts: this.contracts,
    };
  }

  // ============================================
  // CONNECTION
  // ============================================

  async connect() {
    if (!window.ethereum) {
      throw new Error(MESSAGES.ERRORS.NO_METAMASK);
    }

    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      this.userAddress = accounts[0];

      // Check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== CONFIG.ARBITRUM_CHAIN_ID) {
        await this.switchNetwork();
      }

      // Initialize provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      // Initialize contracts
      this.initContracts();

      // Setup listeners
      this.setupListeners();

      this.notify();
      return this.getState();

    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  }

  async switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CONFIG.ARBITRUM_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CONFIG.ARBITRUM_CHAIN_ID,
            chainName: 'Arbitrum One',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [CONFIG.ARBITRUM_RPC],
            blockExplorerUrls: [CONFIG.BLOCK_EXPLORER],
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  initContracts() {
    this.contracts = {
      liquidityManager: new ethers.Contract(
        CONFIG.CONTRACTS.LIQUIDITY_MANAGER,
        ABIS.LIQUIDITY_MANAGER,
        this.signer
      ),
      proxyGeneral: new ethers.Contract(
        CONFIG.CONTRACTS.PROXY_GENERAL,
        ABIS.PROXY_GENERAL,
        this.provider
      ),
      valueCalculator: new ethers.Contract(
        CONFIG.CONTRACTS.VALUE_CALCULATOR,
        ABIS.VALUE_CALCULATOR,
        this.provider
      ),
    };
  }

  setupListeners() {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        window.location.reload();
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.contracts = {};
    this.notify();
  }

  // ============================================
  // DATA FETCHING
  // ============================================

  async getBalance() {
    if (!this.provider || !this.userAddress) return "0";
    const balance = await this.provider.getBalance(this.userAddress);
    return ethers.formatEther(balance);
  }

  async getLPBalance() {
    if (!this.contracts.proxyGeneral || !this.userAddress) return "0";
    const balance = await this.contracts.proxyGeneral.balanceOf(this.userAddress);
    return ethers.formatEther(balance);
  }

  async getPoolValue() {
    if (!this.contracts.valueCalculator) return "0";
    try {
      const value = await this.contracts.valueCalculator.getTotalPoolValueView();
      return ethers.formatEther(value);
    } catch (e) {
      return "0";
    }
  }

  async getNetwork() {
    if (!this.provider) return null;
    return await this.provider.getNetwork();
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async checkDepositsEnabled() {
    if (!this.contracts.liquidityManager) return false;
    try {
      return await this.contracts.liquidityManager.depositsEnabled();
    } catch (e) {
      console.error('Error checking deposits enabled:', e);
      return true; // Assume enabled if check fails
    }
  }

  async deposit(amount) {
    if (!this.contracts.liquidityManager) {
      throw new Error("Not connected");
    }

    // Check if deposits are enabled
    const depositsEnabled = await this.checkDepositsEnabled();
    if (!depositsEnabled) {
      throw new Error("Deposits are currently disabled in the protocol");
    }

    console.log('💰 Depositing:', amount, 'ETH');
    
    try {
      // Try to estimate gas first
      console.log('📊 Estimating gas...');
      const gasEstimate = await this.contracts.liquidityManager.deposit.estimateGas({
        value: ethers.parseEther(amount)
      });
      console.log('✅ Gas estimate:', gasEstimate.toString());
      
      // Now send with estimated gas + 20% buffer
      const gasLimit = gasEstimate * 12n / 10n;
      console.log('🔧 Using gas limit:', gasLimit.toString());
      
      const tx = await this.contracts.liquidityManager.deposit({
        value: ethers.parseEther(amount),
        gasLimit: gasLimit
      });
      
      console.log('📤 Transaction hash:', tx.hash);
      return tx;
    } catch (estimateError) {
      console.error('❌ Gas estimation failed:', estimateError);
      console.log('🔄 Trying without gas limit...');
      
      // Fallback: try without gas limit
      const tx = await this.contracts.liquidityManager.deposit({
        value: ethers.parseEther(amount)
      });
      
      console.log('📤 Transaction hash:', tx.hash);
      return tx;
    }
  }

  async withdraw(shares) {
    if (!this.contracts.liquidityManager) {
      throw new Error("Not connected");
    }

    const tx = await this.contracts.liquidityManager.withdraw(
      ethers.parseEther(shares),
      { gasLimit: GAS_LIMITS.WITHDRAW }
    );

    return tx;
  }
}

// Singleton instance
export const web3Manager = new Web3Manager();
