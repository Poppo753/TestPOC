// ============================================
// ATOM: Transaction Item Component
// Single transaction row with icon, details, status
// ============================================

import { Badge } from './Badge.js';
import { Icon } from './Icon.js';

export class TransactionItem {
  constructor(config = {}) {
    this.type = config.type || 'deposit'; // deposit, withdraw
    this.amount = config.amount || '0';
    this.token = config.token || 'ETH';
    this.timestamp = config.timestamp || Date.now();
    this.hash = config.hash || '';
    this.status = config.status || 'confirmed'; // pending, confirmed, failed
    this.explorerUrl = config.explorerUrl || '#';
  }

  getTypeIcon() {
    const icons = {
      deposit: '💰',
      withdraw: '💸',
    };
    return icons[this.type] || '📄';
  }

  getTypeLabel() {
    const labels = {
      deposit: 'Deposit',
      withdraw: 'Withdraw',
    };
    return labels[this.type] || 'Transaction';
  }

  getStatusBadgeVariant() {
    const variants = {
      pending: 'default',
      confirmed: 'success',
      failed: 'error',
    };
    return variants[this.status] || 'default';
  }

  formatTimestamp() {
    const date = new Date(this.timestamp);
    const now = Date.now();
    const diff = now - this.timestamp;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    // More than 24 hours
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    
    // Format as date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatHash() {
    if (!this.hash || this.hash.length < 10) return this.hash;
    return `${this.hash.slice(0, 6)}...${this.hash.slice(-4)}`;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 cursor-pointer';
    
    // Add click to open in explorer
    if (this.hash && this.explorerUrl !== '#') {
      container.addEventListener('click', () => {
        window.open(this.explorerUrl, '_blank');
      });
    }

    // Left side: Icon + Details
    const leftSide = document.createElement('div');
    leftSide.className = 'flex items-center space-x-3';

    // Icon
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30';
    iconWrapper.innerHTML = `<span class="text-xl">${this.getTypeIcon()}</span>`;
    leftSide.appendChild(iconWrapper);

    // Details
    const details = document.createElement('div');
    details.className = 'flex flex-col';

    const typeRow = document.createElement('div');
    typeRow.className = 'flex items-center space-x-2';
    
    const typeLabel = document.createElement('span');
    typeLabel.className = 'text-sm font-medium text-gray-900 dark:text-white';
    typeLabel.textContent = this.getTypeLabel();
    typeRow.appendChild(typeLabel);

    // Status badge
    if (this.status !== 'confirmed') {
      const statusBadge = new Badge({
        label: this.status.charAt(0).toUpperCase() + this.status.slice(1),
        variant: this.getStatusBadgeVariant(),
        size: 'xs',
      });
      typeRow.appendChild(statusBadge.render());
    }

    details.appendChild(typeRow);

    // Amount + Time
    const amountTime = document.createElement('div');
    amountTime.className = 'flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400';
    
    const amount = document.createElement('span');
    amount.className = 'font-mono';
    amount.textContent = `${parseFloat(this.amount).toFixed(6)} ${this.token}`;
    amountTime.appendChild(amount);

    const separator = document.createElement('span');
    separator.textContent = '•';
    amountTime.appendChild(separator);

    const time = document.createElement('span');
    time.textContent = this.formatTimestamp();
    amountTime.appendChild(time);

    details.appendChild(amountTime);
    leftSide.appendChild(details);
    container.appendChild(leftSide);

    // Right side: Hash + Arrow
    const rightSide = document.createElement('div');
    rightSide.className = 'flex items-center space-x-2';

    // Hash
    if (this.hash) {
      const hash = document.createElement('span');
      hash.className = 'text-xs font-mono text-gray-400 dark:text-gray-500 hidden sm:block';
      hash.textContent = this.formatHash();
      rightSide.appendChild(hash);
    }

    // External link icon
    const arrow = document.createElement('div');
    arrow.className = 'text-gray-400 dark:text-gray-500';
    arrow.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
      </svg>
    `;
    rightSide.appendChild(arrow);

    container.appendChild(rightSide);

    return container;
  }
}
