import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";
import { CONFIG, ABIS, GAS_LIMITS } from "../config/contracts.js";
import { MESSAGES } from "../config/constants.js";
import { getTotalPoolValueUSD, getETHPriceUSD } from "./quoter.js";

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

  async getLPDecimals() {
    if (!this.contracts.proxyGeneral) return 18;
    try {
      const decimals = await this.contracts.proxyGeneral.decimals();
      return Number(decimals);
    } catch (e) {
      console.warn('⚠️ LP token decimals() not available, using default 18');
      return 18; // default to 18
    }
  }

  async getTotalLPSupply() {
    if (!this.contracts.proxyGeneral) return "0";
    try {
      const totalSupply = await this.contracts.proxyGeneral.totalSupply();
      const decimals = await this.getLPDecimals();
      return ethers.formatUnits(totalSupply, decimals);
    } catch (e) {
      console.error('Error getting total supply:', e);
      // Fallback: return a reasonable estimate if totalSupply fails
      try {
        const poolValue = await this.getPoolValue();
        return poolValue;
      } catch (e2) {
        console.error('Error getting pool value fallback:', e2);
        return "0";
      }
    }
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

  async getPoolValueUSD() {
    if (!this.contracts.proxyGeneral) return 0;
    
    const KNOWN_TOKENS = [
      { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
      { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.e', decimals: 6 },
      { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
      { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
      { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', decimals: 8 },
      { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    ];
    
    try {
      return await getTotalPoolValueUSD(
        this.provider,
        this.contracts.proxyGeneral.target,
        KNOWN_TOKENS
      );
    } catch (e) {
      console.error('Error getting pool value USD:', e);
      return 0;
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

  // ============================================
  // TRANSACTION HISTORY
  // ============================================

  async fetchRecentTransactions(maxBlocks = 100000) {
    if (!this.contracts.liquidityManager || !this.userAddress) {
      console.log('⚠️ Cannot fetch transactions: not connected');
      return [];
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - maxBlocks);

      console.log('📜 Fetching transactions from block', fromBlock, 'to', currentBlock, 'for user:', this.userAddress);

      const transactions = [];

      try {
        // Fetch deposit events - same approach as withdraw
        console.log('🔍 Querying ALL Deposit events first...');
        const allDepositFilter = this.contracts.liquidityManager.filters.Deposit();
        const allDeposits = await this.contracts.liquidityManager.queryFilter(
          allDepositFilter,
          fromBlock,
          currentBlock
        );
        console.log('📥 Found', allDeposits.length, 'total deposit events in blockchain');
        
        // Filter for this user
        console.log('🔍 Filtering Deposit events for user:', this.userAddress);
        const userDeposits = allDeposits.filter(event => 
          event.args.user && event.args.user.toLowerCase() === this.userAddress.toLowerCase()
        );
        console.log('📥 Found', userDeposits.length, 'deposit events for this user');

        for (const event of userDeposits) {
          try {
            console.log('📦 Processing deposit event:', event);
            const block = await event.getBlock();
            transactions.push({
              type: 'deposit',
              amount: ethers.formatEther(event.args.ethAmount),
              token: 'ETH',
              timestamp: block.timestamp * 1000, // Convert to ms
              hash: event.transactionHash,
              status: 'confirmed',
              explorerUrl: `${CONFIG.BLOCK_EXPLORER}/tx/${event.transactionHash}`,
            });
          } catch (blockError) {
            console.warn('⚠️ Error parsing deposit event:', blockError);
          }
        }
      } catch (depositError) {
        console.warn('⚠️ Error fetching deposit events:', depositError.message);
        console.error('Full deposit error:', depositError);
      }

      try {
        // Fetch withdraw events - same approach
        console.log('🔍 Querying ALL Withdrawn events first...');
        const allWithdrawFilter = this.contracts.liquidityManager.filters.Withdrawn();
        const allWithdraws = await this.contracts.liquidityManager.queryFilter(
          allWithdrawFilter,
          fromBlock,
          currentBlock
        );
        console.log('📤 Found', allWithdraws.length, 'total withdrawn events in blockchain');
        
        // Filter for this user
        console.log('🔍 Filtering Withdrawn events for user:', this.userAddress);
        const userWithdraws = allWithdraws.filter(event => 
          event.args.user && event.args.user.toLowerCase() === this.userAddress.toLowerCase()
        );
        console.log('📤 Found', userWithdraws.length, 'withdrawn events for this user');

        for (const event of userWithdraws) {
          try {
            console.log('📦 Processing withdrawn event:', event);
            const block = await event.getBlock();
            transactions.push({
              type: 'withdraw',
              amount: ethers.formatEther(event.args.shares),
              token: 'LP',
              timestamp: block.timestamp * 1000,
              hash: event.transactionHash,
              status: 'confirmed',
              explorerUrl: `${CONFIG.BLOCK_EXPLORER}/tx/${event.transactionHash}`,
            });
          } catch (blockError) {
            console.warn('⚠️ Error parsing withdrawn event:', blockError);
          }
        }
      } catch (withdrawError) {
        console.warn('⚠️ Error fetching withdrawn events:', withdrawError.message);
        console.error('Full withdraw error:', withdrawError);
      }

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => b.timestamp - a.timestamp);

      console.log('✅ Found', transactions.length, 'transactions');
      return transactions;

    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
      return [];
    }
  }

  async waitForTransaction(txHash, onUpdate) {
    if (!this.provider) {
      throw new Error('Not connected');
    }

    try {
      console.log('⏳ Waiting for transaction:', txHash);
      
      // Wait for transaction to be mined
      const receipt = await this.provider.waitForTransaction(txHash);
      
      console.log('✅ Transaction confirmed:', txHash);
      console.log('📊 Receipt:', receipt);

      // Call update callback if provided
      if (onUpdate) {
        onUpdate(receipt.status === 1 ? 'confirmed' : 'failed');
      }

      return receipt;
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      if (onUpdate) {
        onUpdate('failed');
      }
      throw error;
    }
  }
}

// Singleton instance
export const web3Manager = new Web3Manager();
