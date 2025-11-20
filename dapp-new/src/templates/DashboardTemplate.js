// ============================================
// TEMPLATE: Dashboard Layout with Grid System
// ============================================

import { WalletConnect } from '../organisms/WalletConnect.js';
import { StatsGrid } from '../organisms/StatsGrid.js';
import { DepositForm } from '../organisms/DepositForm.js';
import { WithdrawForm } from '../organisms/WithdrawForm.js';
import { transactionHistory } from '../organisms/TransactionHistoryPanel.js';
import { web3Manager } from '../utils/web3.js';

export class DashboardTemplate {
  constructor() {
    this.walletConnect = new WalletConnect({
      onConnect: () => this.handleWalletConnected(),
      onDisconnect: () => this.handleWalletDisconnected(),
    });
    
    this.statsGrid = new StatsGrid();
    this.depositForm = new DepositForm({
      onSuccess: () => this.handleTransactionSuccess(),
    });
    this.withdrawForm = new WithdrawForm({
      onSuccess: () => this.handleTransactionSuccess(),
    });

    this.isConnected = false;
  }

  handleWalletConnected() {
    console.log('🎉 Wallet connected event received');
    this.isConnected = true;
    
    // Don't re-render dashboard, just update the stats section
    console.log('🔄 Replacing placeholder with stats grid...');
    const statsSection = document.querySelector('[data-stats-section="true"]');
    
    if (statsSection) {
      // Clear and add stats grid
      statsSection.innerHTML = '';
      statsSection.appendChild(this.statsGrid.render());
      
      // Add transaction history panel below actions
      const mainGrid = document.querySelector('[data-main-grid="true"]');
      if (mainGrid && !document.querySelector('[data-tx-history-panel]')) {
        console.log('📜 Adding transaction history panel...');
        const historySection = document.createElement('div');
        historySection.className = 'lg:col-span-12';
        
        const historyElement = transactionHistory.render();
        historyElement.setAttribute('data-tx-history-panel', 'true');
        historySection.appendChild(historyElement);
        
        mainGrid.appendChild(historySection);
      }
      
      // Load data and update forms
      setTimeout(async () => {
        await this.statsGrid.updateStats();
        await this.withdrawForm.updateMaxAmount();
        
        // Update forms to enable buttons
        this.depositForm.update();
        this.withdrawForm.update();
        
        // Load transaction history
        await this.loadTransactionHistory();
        
        // Start auto-refresh
        this.walletConnect.startAutoRefresh();
        this.statsGrid.startAutoRefresh();
      }, 200);
    } else {
      console.error('❌ Stats section not found!');
    }
  }

  handleWalletDisconnected() {
    this.isConnected = false;
    this.walletConnect.stopAutoRefresh();
    this.statsGrid.stopAutoRefresh();
    this.update();
  }

  handleTransactionSuccess() {
    // Refresh all data after transaction
    this.walletConnect.updateWalletInfo();
    this.statsGrid.updateStats();
    this.withdrawForm.updateMaxAmount();
    
    // Reload transaction history
    this.loadTransactionHistory();
  }

  async loadTransactionHistory() {
    console.log('📜 Loading transaction history...');
    
    try {
      // Fetch from blockchain
      const transactions = await web3Manager.fetchRecentTransactions();
      
      // Store in localStorage
      if (web3Manager.userAddress) {
        localStorage.setItem(
          `tx_history_${web3Manager.userAddress}`,
          JSON.stringify(transactions)
        );
      }
      
      // Load into panel
      await transactionHistory.loadTransactions();
      
      console.log('✅ Transaction history loaded:', transactions.length, 'transactions');
    } catch (error) {
      console.error('❌ Error loading transaction history:', error);
    }
  }

  renderHeader() {
    const header = document.createElement('header');
    header.className = 'mb-8 flex items-center justify-between';

    const titleSection = document.createElement('div');
    
    const title = document.createElement('h1');
    title.className = 'text-4xl font-bold text-white mb-2';
    title.textContent = '🌊 Jethos Protocol';

    const subtitle = document.createElement('p');
    subtitle.className = 'text-lg text-purple-100';
    subtitle.textContent = 'DeFi Strategy • ETH Stablecoin';

    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    header.appendChild(titleSection);
    
    // Portfolio button
    const portfolioBtn = document.createElement('a');
    portfolioBtn.href = 'portfolio.html';
    portfolioBtn.className = 'px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2';
    portfolioBtn.innerHTML = '📊 View Portfolio';
    header.appendChild(portfolioBtn);

    return header;
  }

  renderMainGrid() {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6';
    grid.setAttribute('data-main-grid', 'true');

    // Wallet Connect - Top left, 1 column span
    const walletSection = document.createElement('div');
    walletSection.className = 'lg:col-span-4';
    
    // Force walletConnect to show correct state
    if (this.isConnected && !this.walletConnect.state.connected) {
      console.log('⚠️ Syncing wallet state');
      this.walletConnect.state.connected = true;
      this.walletConnect.state.address = web3Manager.userAddress;
    }
    
    walletSection.appendChild(this.walletConnect.render());
    grid.appendChild(walletSection);

    // Stats Grid - Top right, spans remaining columns
    const statsSection = document.createElement('div');
    statsSection.className = 'lg:col-span-8';
    statsSection.setAttribute('data-stats-section', 'true');
    
    console.log('📊 Rendering stats section, isConnected:', this.isConnected);
    
    if (this.isConnected || web3Manager.userAddress) {
      console.log('✅ User connected, showing stats');
      statsSection.appendChild(this.statsGrid.render());
    } else {
      console.log('❌ No user connected, showing placeholder');
      // Placeholder when not connected
      const placeholder = document.createElement('div');
      placeholder.className = 'h-full flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8';
      placeholder.innerHTML = '<p class="text-white/50 text-center">Connect your wallet to view statistics</p>';
      statsSection.appendChild(placeholder);
    }
    grid.appendChild(statsSection);

    // Actions Grid - Bottom, two columns
    const actionsSection = document.createElement('div');
    actionsSection.className = 'lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6';
    
    actionsSection.appendChild(this.depositForm.render());
    actionsSection.appendChild(this.withdrawForm.render());
    
    grid.appendChild(actionsSection);

    // Transaction History Panel - Full width below actions
    if (this.isConnected || web3Manager.userAddress) {
      const historySection = document.createElement('div');
      historySection.className = 'lg:col-span-12';
      
      const historyElement = transactionHistory.render();
      historyElement.setAttribute('data-tx-history-panel', 'true');
      historySection.appendChild(historyElement);
      
      grid.appendChild(historySection);
    }

    return grid;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'min-h-screen p-6';

    const content = document.createElement('div');
    content.className = 'max-w-7xl mx-auto';

    content.appendChild(this.renderHeader());
    content.appendChild(this.renderMainGrid());

    container.appendChild(content);

    this.element = container;
    return container;
  }

  update() {
    console.log('🔄 Dashboard update, isConnected:', this.isConnected);
    if (this.element && this.element.parentElement) {
      const newElement = this.render();
      this.element.replaceWith(newElement);
      console.log('✅ Dashboard re-rendered');
    }
  }

  mount(targetElement) {
    if (typeof targetElement === 'string') {
      targetElement = document.querySelector(targetElement);
    }
    
    if (targetElement) {
      targetElement.appendChild(this.render());
    }
  }

  destroy() {
    this.walletConnect.stopAutoRefresh();
    this.statsGrid.stopAutoRefresh();
    if (this.element) {
      this.element.remove();
    }
  }
}
