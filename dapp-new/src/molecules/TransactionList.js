// ============================================
// MOLECULE: Transaction List Component
// List of transaction items with empty state
// ============================================

import { TransactionItem } from '../atoms/TransactionItem.js';
import { Skeleton } from '../atoms/Skeleton.js';

export class TransactionList {
  constructor(config = {}) {
    this.transactions = config.transactions || [];
    this.loading = config.loading || false;
    this.emptyMessage = config.emptyMessage || 'No transactions yet';
  }

  render() {
    const container = document.createElement('div');
    container.className = 'space-y-3';

    if (this.loading) {
      // Loading skeletons with shimmer effect
      for (let i = 0; i < 3; i++) {
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
        
        container.appendChild(skeletonRow);
      }
      return container;
    }

    if (this.transactions.length === 0) {
      // Empty state
      const empty = document.createElement('div');
      empty.className = 'flex flex-col items-center justify-center py-8 text-center';
      empty.innerHTML = `
        <svg class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p class="text-sm text-gray-500 dark:text-gray-400">${this.emptyMessage}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Your transactions will appear here</p>
      `;
      container.appendChild(empty);
      return container;
    }

    // Render transactions
    this.transactions.forEach(tx => {
      const item = new TransactionItem(tx);
      container.appendChild(item.render());
    });

    return container;
  }
}
