// ============================================
// ORGANISM: Stats Grid Component
// ============================================

import { Card } from '../molecules/Card.js';
import { StatDisplay } from '../molecules/StatDisplay.js';
import { Skeleton } from '../atoms/Skeleton.js';
import { web3Manager } from '../utils/web3.js';
import { formatEth } from '../utils/formatting.js';

export class StatsGrid {
  constructor(config = {}) {
    this.stats = [
      {
        id: 'lpBalance',
        label: 'Your LP Tokens',
        value: 0,
        suffix: 'LP',
        decimals: 6,
        icon: 'coin',
        variant: 'default',
        animated: true,
      },
      {
        id: 'poolValueUSD',
        label: 'Pool Value',
        value: 0,
        suffix: '$',
        decimals: 2,
        icon: 'dollar',
        variant: 'success',
        animated: true,
      },
      {
        id: 'yourValue',
        label: 'Your Value',
        value: 0,
        suffix: 'ETH',
        decimals: 6,
        icon: 'wallet',
        variant: 'default',
        animated: true,
      },
      {
        id: 'apy',
        label: 'Est. APY',
        value: 8.5,
        suffix: '%',
        decimals: 2,
        icon: 'lightning',
        variant: 'default',
        animated: true,
      },
    ];
    this.loading = true;
    this.statDisplays = {}; // Keep references to StatDisplay instances
  }

  async updateStats() {
    if (!web3Manager.userAddress) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.update();

    try {
      const [lpBalance, poolValue, poolValueUSD] = await Promise.all([
        web3Manager.getLPBalance(),
        web3Manager.getPoolValue(),
        web3Manager.getPoolValueUSD(),
      ]);

      // Calculate new values
      const newLpBalance = parseFloat(lpBalance) || 0;
      const newPoolValue = parseFloat(poolValue) || 0;
      const newPoolValueUSD = poolValueUSD || 0;
      const newUserValue = newLpBalance > 0 ? (newLpBalance * newPoolValue / 100) : 0;

      // Update stats data
      this.stats[0].value = newLpBalance;
      this.stats[1].value = newPoolValueUSD;
      this.stats[2].value = newUserValue;
      this.stats[3].value = 8.5;

      this.loading = false;
      this.update();

    } catch (error) {
      console.error('Error updating stats:', error);
      this.loading = false;
      this.update();
    }
  }

  renderStat(stat) {
    const statDisplay = new StatDisplay({
      label: stat.label,
      value: stat.value,
      suffix: stat.suffix,
      decimals: stat.decimals,
      icon: stat.icon,
      variant: stat.variant,
      loading: this.loading,
      animated: stat.animated,
    });
    
    // Store reference to StatDisplay for updates
    this.statDisplays[stat.id] = statDisplay;

    const card = new Card({
      content: statDisplay.render(),
      variant: 'default',
      padding: true,
      hover: true,
      colSpan: 1,
      rowSpan: 1,
    });

    return card.render();
  }

  render() {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';

    this.stats.forEach(stat => {
      grid.appendChild(this.renderStat(stat));
    });

    grid.setAttribute('data-stats-grid', 'true');
    this.element = grid;
    return grid;
  }

  update() {
    console.log('🔄 Updating StatsGrid');
    const oldElement = document.querySelector('[data-stats-grid="true"]');
    
    if (oldElement && oldElement.parentElement) {
      const newElement = this.render();
      oldElement.replaceWith(newElement);
      console.log('✅ StatsGrid UI updated!');
    }
  }

  startAutoRefresh(interval = 30000) {
    this.refreshInterval = setInterval(() => {
      this.updateStats();
    }, interval);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
