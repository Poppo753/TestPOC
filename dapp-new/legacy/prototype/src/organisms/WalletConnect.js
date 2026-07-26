// ============================================
// ORGANISM: WalletConnect Component
// ============================================

import { Card } from '../molecules/Card.js';
import { Button } from '../atoms/Button.js';
import { Badge } from '../atoms/Badge.js';
import { Icon } from '../atoms/Icon.js';
import { web3Manager } from '../utils/web3.js';
import { formatAddress, formatEth } from '../utils/formatting.js';
import { toast } from '../molecules/Alert.js';
import { MESSAGES } from '../config/constants.js';

export class WalletConnect {
  constructor(config = {}) {
    this.onConnect = config.onConnect || (() => {});
    this.onDisconnect = config.onDisconnect || (() => {});
    this.state = {
      connected: false,
      connecting: false,
      address: null,
      network: null,
      ethBalance: '0',
    };
  }

  async connect() {
    if (this.state.connecting) return;

    this.state.connecting = true;
    this.update();

    try {
      console.log('🔌 Connecting wallet...');
      await web3Manager.connect();
      this.state.connected = true;
      this.state.address = web3Manager.userAddress;
      console.log('✅ Wallet connected:', this.state.address);
      
      await this.updateWalletInfo();
      
      toast.success(MESSAGES.SUCCESS.CONNECTED);
      this.onConnect(this.state);

    } catch (error) {
      console.error('❌ Connection error:', error);
      toast.error(error.message || MESSAGES.ERRORS.CONNECTION_FAILED);
    } finally {
      this.state.connecting = false;
      this.update();
    }
  }

  async updateWalletInfo() {
    if (!this.state.connected) return;

    try {
      console.log('📊 Updating wallet info...');
      const [balance, network] = await Promise.all([
        web3Manager.getBalance(),
        web3Manager.getNetwork(),
      ]);

      console.log('💰 Balance:', balance, 'ETH');
      console.log('🌐 Network:', network?.chainId);

      this.state.ethBalance = balance;
      this.state.network = network;
      this.update();

    } catch (error) {
      console.error('❌ Error updating wallet info:', error);
    }
  }

  disconnect() {
    web3Manager.disconnect();
    this.state = {
      connected: false,
      connecting: false,
      address: null,
      network: null,
      ethBalance: '0',
    };
    this.update();
    this.onDisconnect();
  }

  renderConnectedView() {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Network Badge
    const networkWrapper = document.createElement('div');
    networkWrapper.className = 'flex items-center justify-between';

    const networkLabel = document.createElement('span');
    networkLabel.className = 'text-sm font-medium text-gray-600 dark:text-gray-400';
    networkLabel.textContent = 'Network';

    const networkBadge = new Badge({
      label: this.state.network?.chainId === 42161n ? 'Arbitrum One' : 'Wrong Network',
      variant: this.state.network?.chainId === 42161n ? 'success' : 'error',
      icon: Icon.get('network'),
      pill: true,
    });

    networkWrapper.appendChild(networkLabel);
    networkWrapper.appendChild(networkBadge.render());
    container.appendChild(networkWrapper);

    // Address
    const addressWrapper = document.createElement('div');
    addressWrapper.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg';

    const addressLabel = document.createElement('span');
    addressLabel.className = 'text-sm font-medium text-gray-600 dark:text-gray-400';
    addressLabel.textContent = 'Address';

    const addressValue = document.createElement('span');
    addressValue.className = 'text-sm font-mono font-semibold text-gray-900 dark:text-white';
    addressValue.textContent = formatAddress(this.state.address);

    addressWrapper.appendChild(addressLabel);
    addressWrapper.appendChild(addressValue);
    container.appendChild(addressWrapper);

    // ETH Balance
    const balanceWrapper = document.createElement('div');
    balanceWrapper.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg';

    const balanceLabel = document.createElement('span');
    balanceLabel.className = 'text-sm font-medium text-gray-600 dark:text-gray-400';
    balanceLabel.textContent = 'ETH Balance';

    const balanceValue = document.createElement('span');
    balanceValue.className = 'text-sm font-bold text-gray-900 dark:text-white';
    balanceValue.textContent = `${formatEth(this.state.ethBalance)} ETH`;

    balanceWrapper.appendChild(balanceLabel);
    balanceWrapper.appendChild(balanceValue);
    container.appendChild(balanceWrapper);

    // Disconnect Button
    const disconnectBtn = new Button({
      label: 'Disconnect',
      variant: 'outline',
      size: 'sm',
      fullWidth: true,
      onClick: () => this.disconnect(),
    });
    container.appendChild(disconnectBtn.render());

    return container;
  }

  renderDisconnectedView() {
    const container = document.createElement('div');
    container.className = 'text-center space-y-4';

    const icon = document.createElement('div');
    icon.className = 'text-6xl mb-4';
    icon.textContent = '🦊';
    container.appendChild(icon);

    const text = document.createElement('p');
    text.className = 'text-gray-600 dark:text-gray-400 mb-4';
    text.textContent = 'Connect your wallet to start using the protocol';
    container.appendChild(text);

    const connectBtn = new Button({
      label: this.state.connecting ? 'Connecting...' : 'Connect MetaMask',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      loading: this.state.connecting,
      icon: Icon.get('wallet'),
      onClick: () => this.connect(),
    });
    container.appendChild(connectBtn.render());

    return container;
  }

  render() {
    const card = new Card({
      title: '💼 Wallet',
      content: () => this.state.connected 
        ? this.renderConnectedView() 
        : this.renderDisconnectedView(),
      variant: 'gradient',
      colSpan: 1,
      rowSpan: 1,
    });

    const element = card.render();
    
    // Store reference with unique ID
    element.setAttribute('data-wallet-component', 'true');
    this.element = element;
    
    return element;
  }

  update() {
    console.log('🔄 Updating WalletConnect, connected:', this.state.connected);
    
    // Find the element in DOM by attribute instead of reference
    const oldElement = document.querySelector('[data-wallet-component="true"]');
    
    if (oldElement && oldElement.parentElement) {
      const newElement = this.render();
      oldElement.replaceWith(newElement);
      console.log('✅ WalletConnect UI updated!');
    } else {
      console.warn('⚠️ Could not find wallet element in DOM');
    }
  }

  // Auto-refresh wallet info
  startAutoRefresh(interval = 30000) {
    this.refreshInterval = setInterval(() => {
      if (this.state.connected) {
        this.updateWalletInfo();
      }
    }, interval);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
