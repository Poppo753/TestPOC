// ============================================
// MOLECULE: Price Impact Display Component
// Shows price preview + impact percentage
// ============================================

import { PricePreview } from '../atoms/PricePreview.js';
import { Badge } from '../atoms/Badge.js';

export class PriceImpactDisplay {
  constructor(config = {}) {
    this.inputAmount = config.inputAmount || '0';
    this.inputToken = config.inputToken || 'ETH';
    this.outputAmount = config.outputAmount || '0';
    this.outputToken = config.outputToken || 'LP';
    this.priceImpact = config.priceImpact || 0; // percentage (price change)
    this.poolImpact = config.poolImpact || 0; // percentage (pool size change)
    this.preRate = config.preRate || 0; // ETH per LP before
    this.postRate = config.postRate || 0; // ETH per LP after
    this.fee = config.fee || '0';
    this.loading = config.loading || false;
  }

  getVariantFromImpact() {
    const impact = Math.abs(parseFloat(this.poolImpact || this.priceImpact));
    if (impact < 1) return 'success';
    if (impact < 10) return 'default';
    if (impact < 50) return 'warning';
    return 'error';
  }

  getImpactBadgeVariant() {
    const impact = Math.abs(parseFloat(this.poolImpact || this.priceImpact));
    if (impact < 1) return 'success';
    if (impact < 10) return 'default';
    if (impact < 50) return 'warning';
    return 'error';
  }

  render() {
    const container = document.createElement('div');
    container.className = 'space-y-3';

    // Create NEW PricePreview with current values (don't reuse old instance)
    const pricePreview = new PricePreview({
      inputAmount: this.inputAmount,
      inputToken: this.inputToken,
      outputAmount: this.outputAmount,
      outputToken: this.outputToken,
      loading: this.loading,
      variant: this.getVariantFromImpact(),
    });
    
    container.appendChild(pricePreview.render());

    // Details section
    if (!this.loading) {
      const details = document.createElement('div');
      details.className = 'space-y-2 text-xs px-1';

      // Row 1: Fee + Pool Impact
      const row1 = document.createElement('div');
      row1.className = 'flex items-center justify-between';
      
      const feeDiv = document.createElement('div');
      feeDiv.className = 'text-gray-600 dark:text-gray-400';
      feeDiv.innerHTML = `<span>Fee: ${this.fee}%</span>`;
      
      const poolImpactDiv = document.createElement('div');
      poolImpactDiv.className = 'text-gray-700 dark:text-gray-300 font-medium';
      poolImpactDiv.textContent = `Pool: ${parseFloat(this.poolImpact || 0) > 0 ? '+' : ''}${parseFloat(this.poolImpact || 0).toFixed(2)}%`;
      
      row1.appendChild(feeDiv);
      row1.appendChild(poolImpactDiv);
      details.appendChild(row1);

      // Row 2: Rate (ETH per LP) before/after
      if (this.preRate > 0 || this.postRate > 0) {
        const rateRow = document.createElement('div');
        rateRow.className = 'flex items-center justify-between text-gray-600 dark:text-gray-400';
        
        const rateLabel = document.createElement('span');
        rateLabel.textContent = 'Rate (ETH/LP):';
        
        const rateValues = document.createElement('span');
        rateValues.className = 'font-mono';
        rateValues.textContent = `${parseFloat(this.preRate).toFixed(6)} → ${parseFloat(this.postRate).toFixed(6)}`;
        
        rateRow.appendChild(rateLabel);
        rateRow.appendChild(rateValues);
        details.appendChild(rateRow);
      }

      // Row 3: Price impact badge
      const impactRow = document.createElement('div');
      impactRow.className = 'flex items-center justify-between';
      
      const impactLabel = document.createElement('span');
      impactLabel.className = 'text-gray-600 dark:text-gray-400';
      impactLabel.textContent = 'Price Impact:';
      
      const priceImpact = parseFloat(this.priceImpact);
      const impactBadge = new Badge({
        label: `${priceImpact > 0 ? '+' : ''}${priceImpact.toFixed(2)}%`,
        variant: this.getImpactBadgeVariant(),
        size: 'sm',
        icon: priceImpact > 0 ? '↑' : '↓',
      });
      
      impactRow.appendChild(impactLabel);
      impactRow.appendChild(impactBadge.render());
      details.appendChild(impactRow);

      container.appendChild(details);
    }

    return container;
  }

  // Update all values
  update(config) {
    if (config.inputAmount !== undefined) this.inputAmount = config.inputAmount;
    if (config.outputAmount !== undefined) this.outputAmount = config.outputAmount;
    if (config.priceImpact !== undefined) this.priceImpact = config.priceImpact;
    if (config.fee !== undefined) this.fee = config.fee;
    if (config.loading !== undefined) this.loading = config.loading;

    this.pricePreview.update({
      inputAmount: this.inputAmount,
      outputAmount: this.outputAmount,
      loading: this.loading,
      variant: this.getVariantFromImpact(),
    });
  }
}
