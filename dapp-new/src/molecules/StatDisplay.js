// ============================================
// MOLECULE: StatDisplay Component
// ============================================

import { Badge } from '../atoms/Badge.js';
import { Icon } from '../atoms/Icon.js';
import { AnimatedNumber } from '../atoms/AnimatedNumber.js';

export class StatDisplay {
  constructor(config = {}) {
    this.label = config.label || 'Stat';
    this.value = config.value || '0';
    this.icon = config.icon || null;
    this.trend = config.trend || null; // { value: '+5.2%', direction: 'up' }
    this.variant = config.variant || 'default'; // default, success, warning, error
    this.loading = config.loading || false;
    this.animated = config.animated !== false; // Enable animation by default
    this.decimals = config.decimals ?? 6;
    this.suffix = config.suffix || '';
    
    // Create AnimatedNumber instance if animation is enabled
    if (this.animated) {
      this.animatedNumber = new AnimatedNumber({
        value: this.value,
        decimals: this.decimals,
        suffix: this.suffix,
        className: `text-3xl font-bold ${this.getVariantClasses()}`,
        duration: 800,
      });
    }
  }

  getVariantClasses() {
    const variants = {
      default: 'text-gray-900 dark:text-white',
      success: 'text-green-600 dark:text-green-400',
      warning: 'text-yellow-600 dark:text-yellow-400',
      error: 'text-red-600 dark:text-red-400',
    };
    return variants[this.variant] || variants.default;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'flex flex-col space-y-2';

    // Label with optional icon
    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'flex items-center space-x-2';

    if (this.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'text-gray-400';
      iconSpan.innerHTML = Icon.get(this.icon);
      labelWrapper.appendChild(iconSpan);
    }

    const label = document.createElement('span');
    label.className = 'text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider';
    label.textContent = this.label;
    labelWrapper.appendChild(label);

    container.appendChild(labelWrapper);

    // Value with loading state
    if (this.loading) {
      const skeleton = document.createElement('div');
      skeleton.className = 'h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse';
      container.appendChild(skeleton);
    } else {
      const valueWrapper = document.createElement('div');
      valueWrapper.className = 'flex items-baseline space-x-2';

      // Use AnimatedNumber if enabled, otherwise regular text
      if (this.animated && this.animatedNumber) {
        valueWrapper.appendChild(this.animatedNumber.render());
      } else {
        const value = document.createElement('span');
        value.className = `text-3xl font-bold ${this.getVariantClasses()}`;
        value.textContent = this.suffix ? `${this.value} ${this.suffix}` : this.value;
        valueWrapper.appendChild(value);
      }

      // Trend indicator
      if (this.trend) {
        const trendBadge = new Badge({
          label: this.trend.value,
          variant: this.trend.direction === 'up' ? 'success' : this.trend.direction === 'down' ? 'error' : 'default',
          size: 'sm',
          icon: this.trend.direction === 'up' ? '↑' : this.trend.direction === 'down' ? '↓' : '',
        });
        valueWrapper.appendChild(trendBadge.render());
      }

      container.appendChild(valueWrapper);
    }

    return container;
  }

  // Helper to update value
  setValue(newValue) {
    this.value = newValue;
    
    // Animate the change if AnimatedNumber is enabled
    if (this.animated && this.animatedNumber) {
      this.animatedNumber.setValue(newValue);
    }
  }

  setLoading(isLoading) {
    this.loading = isLoading;
  }
  
  // Cleanup
  destroy() {
    if (this.animatedNumber) {
      this.animatedNumber.destroy();
    }
  }
}
