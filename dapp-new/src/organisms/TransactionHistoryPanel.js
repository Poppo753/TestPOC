// ============================================
// ORGANISM: Transaction History Panel Component
// Complete panel with transactions, filters, refresh
// ============================================

import { Card } from '../molecules/Card.js';
import { TransactionList } from '../molecules/TransactionList.js';
import { Button } from '../atoms/Button.js';
import { Skeleton } from '../atoms/Skeleton.js';
import { web3Manager } from '../utils/web3.js';
import { CONFIG } from '../config/contracts.js';

export class TransactionHistoryPanel {
  constructor(config = {}) {
    this.maxTransactions = config.maxTransactions || 50;
    this.transactions = [];
    this.loading = false;
    this.loadingMore = false;
    this.filterType = 'all'; // all, deposit, withdraw
    // Start from 100M blocks and keep doubling
    this.currentBlockRange = 100000000; // 100M blocks (~2 days on Arbitrum)
    this.hasMoreToLoad = true;
  }

  async loadTransactions() {
    if (!web3Manager.userAddress) {
      this.transactions = [];
      return;
    }

    this.loading = true;
    this.currentBlockRange = 100000000; // Reset to 100M blocks
    this.update();

    try {
      // Fetch from current block range
      console.log(`📜 Loading transactions from ${this.currentBlockRange.toLocaleString()} blocks...`);
      const newTxs = await web3Manager.fetchRecentTransactions(this.currentBlockRange);
      
      // Save to localStorage
      if (web3Manager.userAddress) {
        localStorage.setItem(
          `tx_history_${web3Manager.userAddress}`,
          JSON.stringify(newTxs)
        );
      }
      
      // Set transactions
      this.transactions = newTxs;
      
      // Always have more to load (can go infinite)
      this.hasMoreToLoad = true;

      // Apply filter (without reloading from localStorage)
      this.filterTransactions();

    } catch (error) {
      console.error('Error loading transactions:', error);
      this.transactions = [];
    }

    this.loading = false;
    this.update();
  }

  async loadMoreTransactions() {
    if (!web3Manager.userAddress || this.loadingMore) {
      return;
    }

    this.loadingMore = true;
    this.update();

    try {
      // Double the block range each time (100M -> 200M -> 400M -> 800M -> ...)
      this.currentBlockRange *= 2;
      
      console.log(`📜 Loading more transactions from ${this.currentBlockRange.toLocaleString()} blocks...`);
      
      const newTxs = await web3Manager.fetchRecentTransactions(this.currentBlockRange);
      
      // Merge with existing in localStorage
      const stored = localStorage.getItem(`tx_history_${web3Manager.userAddress}`);
      const existingTxs = stored ? JSON.parse(stored) : [];
      const merged = this.mergeTxs(existingTxs, newTxs);
      
      // Update localStorage with merged transactions
      if (web3Manager.userAddress) {
        localStorage.setItem(
          `tx_history_${web3Manager.userAddress}`,
          JSON.stringify(merged)
        );
      }
      
      // Set transactions
      this.transactions = merged;
      
      // Always have more to load
      this.hasMoreToLoad = true;

      // Apply current filter
      this.filterTransactions();

    } catch (error) {
      console.error('Error loading more transactions:', error);
    }

    this.loadingMore = false;
    this.update();
  }

  mergeTxs(existing, newTxs) {
    // Create a map of existing transactions by hash
    const txMap = new Map();
    existing.forEach(tx => txMap.set(tx.hash, tx));
    
    // Add new transactions (avoiding duplicates)
    newTxs.forEach(tx => {
      if (!txMap.has(tx.hash)) {
        txMap.set(tx.hash, tx);
      }
    });
    
    // Convert back to array and sort by timestamp
    const merged = Array.from(txMap.values());
    merged.sort((a, b) => b.timestamp - a.timestamp);
    
    return merged;
  }

  applyFilter() {
    // This method is called from DashboardTemplate after saving to localStorage
    // Load all transactions from localStorage
    const stored = localStorage.getItem(`tx_history_${web3Manager.userAddress}`);
    if (stored) {
      const allTxs = JSON.parse(stored);
      
      // Filter by type if needed
      if (this.filterType !== 'all') {
        this.transactions = allTxs.filter(tx => tx.type === this.filterType);
      } else {
        this.transactions = allTxs;
      }

      // Sort by timestamp (newest first)
      this.transactions.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  filterTransactions() {
    // Filter current transactions without reloading from localStorage
    if (this.filterType !== 'all') {
      const stored = localStorage.getItem(`tx_history_${web3Manager.userAddress}`);
      if (stored) {
        const allTxs = JSON.parse(stored);
        this.transactions = allTxs.filter(tx => tx.type === this.filterType);
      }
    }
    // Sort by timestamp (newest first)
    this.transactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  addTransaction(tx) {
    // Add new transaction to history
    const newTx = {
      type: tx.type,
      amount: tx.amount,
      token: tx.token,
      timestamp: tx.timestamp || Date.now(),
      hash: tx.hash,
      status: tx.status || 'pending',
      explorerUrl: `${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}`,
    };

    this.transactions.unshift(newTx);

    // Save to localStorage
    try {
      const stored = localStorage.getItem(`tx_history_${web3Manager.userAddress}`) || '[]';
      const allTx = JSON.parse(stored);
      allTx.unshift(newTx);
      // Keep only last 50 transactions
      const limited = allTx.slice(0, 50);
      localStorage.setItem(`tx_history_${web3Manager.userAddress}`, JSON.stringify(limited));
    } catch (e) {
      console.error('Error saving transaction:', e);
    }

    this.update();
  }

  updateTransactionStatus(hash, status) {
    // Update transaction status (e.g., pending -> confirmed)
    const tx = this.transactions.find(t => t.hash === hash);
    if (tx) {
      tx.status = status;
      
      // Update in localStorage
      try {
        const stored = localStorage.getItem(`tx_history_${web3Manager.userAddress}`) || '[]';
        const allTx = JSON.parse(stored);
        const storedTx = allTx.find(t => t.hash === hash);
        if (storedTx) {
          storedTx.status = status;
          localStorage.setItem(`tx_history_${web3Manager.userAddress}`, JSON.stringify(allTx));
        }
      } catch (e) {
        console.error('Error updating transaction:', e);
      }

      this.update();
    }
  }

  clearHistory() {
    if (confirm('Are you sure you want to clear all transaction history?')) {
      this.transactions = [];
      try {
        localStorage.removeItem(`tx_history_${web3Manager.userAddress}`);
      } catch (e) {
        console.error('Error clearing history:', e);
      }
      this.update();
    }
  }

  renderContent() {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Header with filters and refresh
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';

    // Filters
    const filters = document.createElement('div');
    filters.className = 'flex items-center space-x-2';

    const filterButtons = [
      { label: 'All', value: 'all' },
      { label: 'Deposits', value: 'deposit' },
      { label: 'Withdrawals', value: 'withdraw' },
    ];

    filterButtons.forEach(filter => {
      const btn = new Button({
        label: filter.label,
        variant: this.filterType === filter.value ? 'primary' : 'outline',
        size: 'xs',
        onClick: () => {
          this.filterType = filter.value;
          this.filterTransactions();
          this.update();
        },
      });
      filters.appendChild(btn.render());
    });

    header.appendChild(filters);

    // Refresh + Clear buttons
    const actions = document.createElement('div');
    actions.className = 'flex items-center space-x-2';

    const refreshBtn = new Button({
      label: '🔄',
      variant: 'outline',
      size: 'xs',
      onClick: () => this.loadTransactions(),
    });
    actions.appendChild(refreshBtn.render());

    if (this.transactions.length > 0) {
      const clearBtn = new Button({
        label: '🗑️',
        variant: 'outline',
        size: 'xs',
        onClick: () => this.clearHistory(),
      });
      actions.appendChild(clearBtn.render());
    }

    header.appendChild(actions);
    container.appendChild(header);

    // Transaction list
    const list = new TransactionList({
      transactions: this.transactions,
      loading: this.loading,
    });
    container.appendChild(list.render());

    // Loading More skeleton
    if (this.loadingMore) {
      const loadingMoreSkeleton = document.createElement('div');
      loadingMoreSkeleton.className = 'mt-4 space-y-3';
      loadingMoreSkeleton.style.minHeight = '180px'; // Ensure visibility
      
      for (let i = 0; i < 2; i++) {
        const skeletonRow = document.createElement('div');
        skeletonRow.className = 'flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10';
        
        const left = document.createElement('div');
        left.className = 'flex items-center space-x-3';
        
        // Icon skeleton
        const iconSkeleton = new Skeleton({ width: '40px', height: '40px', variant: 'circular' });
        left.appendChild(iconSkeleton.render());
        
        // Text skeletons
        const textContainer = document.createElement('div');
        textContainer.className = 'space-y-2';
        
        const titleSkeleton = new Skeleton({ width: '100px', height: '16px' });
        const subtitleSkeleton = new Skeleton({ width: '140px', height: '12px' });
        
        textContainer.appendChild(titleSkeleton.render());
        textContainer.appendChild(subtitleSkeleton.render());
        left.appendChild(textContainer);
        
        skeletonRow.appendChild(left);
        
        // Right side skeleton
        const hashSkeleton = new Skeleton({ width: '80px', height: '16px' });
        skeletonRow.appendChild(hashSkeleton.render());
        
        loadingMoreSkeleton.appendChild(skeletonRow);
      }
      
      container.appendChild(loadingMoreSkeleton);
    }

    // Load More button
    if (!this.loading && this.hasMoreToLoad && this.transactions.length > 0) {
      const loadMoreContainer = document.createElement('div');
      loadMoreContainer.className = 'flex justify-center pt-4';
      
      const nextRange = this.currentBlockRange * 2;
      
      const loadMoreBtn = new Button({
        label: this.loadingMore 
          ? '⏳ Loading...' 
          : '📥 Load More',
        variant: 'outline',
        size: 'sm',
        onClick: () => this.loadMoreTransactions(),
      });
      
      loadMoreContainer.appendChild(loadMoreBtn.render());
      container.appendChild(loadMoreContainer);
    }

    // Info text about current range
    if (!this.loading && this.transactions.length > 0) {
      const infoText = document.createElement('p');
      infoText.className = 'text-xs text-white/50 text-center mt-2';
      infoText.textContent = `Searched last ${this.currentBlockRange.toLocaleString()} blocks • ${this.transactions.length} transactions found`;
      container.appendChild(infoText);
    }

    return container;
  }

  render() {
    const card = new Card({
      title: '📜 Transaction History',
      content: this.renderContent(),
      variant: 'default',
      padding: true,
    });

    return card.render();
  }

  update() {
    const oldElement = document.querySelector('[data-tx-history-panel]');
    if (oldElement && oldElement.parentElement) {
      const newElement = this.render();
      newElement.setAttribute('data-tx-history-panel', 'true');
      oldElement.replaceWith(newElement);
    }
  }
}

// Export singleton instance
export const transactionHistory = new TransactionHistoryPanel();
