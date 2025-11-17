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
    this.priceImpact = config.priceImpact || 0; // percentage
    this.fee = config.fee || '0';
    this.loading = config.loading || false;
    
    this.pricePreview = new PricePreview({
      inputAmount: this.inputAmount,
      inputToken: this.inputToken,
      outputAmount: this.outputAmount,
      outputToken: this.outputToken,
      loading: this.loading,
      variant: this.getVariantFromImpact(),
    });
  }

  getVariantFromImpact() {
    const impact = Math.abs(parseFloat(this.priceImpact));
    if (impact < 0.1) return 'success';
    if (impact < 1) return 'default';
    if (impact < 3) return 'warning';
    return 'error';
  }

  getImpactBadgeVariant() {
    const impact = Math.abs(parseFloat(this.priceImpact));
    if (impact < 0.1) return 'success';
    if (impact < 1) return 'default';
    if (impact < 3) return 'warning';
    return 'error';
  }

  render() {
    const container = document.createElement('div');
    container.className = 'space-y-3';

    // Price preview
    container.appendChild(this.pricePreview.render());

    // Details section
    if (!this.loading) {
      const details = document.createElement('div');
      details.className = 'flex items-center justify-between text-sm px-1';

      // Fee info
      const feeDiv = document.createElement('div');
      feeDiv.className = 'text-gray-600 dark:text-gray-400';
      feeDiv.innerHTML = `
        <span>Fee: ${this.fee}%</span>
      `;

      // Price impact badge
      const impact = parseFloat(this.priceImpact);
      const impactBadge = new Badge({
        label: `${impact > 0 ? '+' : ''}${impact.toFixed(2)}% impact`,
        variant: this.getImpactBadgeVariant(),
        size: 'sm',
        icon: impact > 0 ? '↑' : '↓',
      });

      details.appendChild(feeDiv);
      details.appendChild(impactBadge.render());
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
