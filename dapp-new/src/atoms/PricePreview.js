// ============================================
// ATOM: Price Preview Component
// Shows estimated output amount with arrow
// ============================================

export class PricePreview {
  constructor(config = {}) {
    this.inputAmount = config.inputAmount || '0';
    this.inputToken = config.inputToken || 'ETH';
    this.outputAmount = config.outputAmount || '0';
    this.outputToken = config.outputToken || 'LP';
    this.loading = config.loading || false;
    this.variant = config.variant || 'default'; // default, success, warning, error
  }

  getVariantClasses() {
    const variants = {
      default: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    };
    return variants[this.variant] || variants.default;
  }

  getTextColorClasses() {
    const colors = {
      default: 'text-gray-900 dark:text-white',
      success: 'text-green-900 dark:text-green-100',
      warning: 'text-yellow-900 dark:text-yellow-100',
      error: 'text-red-900 dark:text-red-100',
    };
    return colors[this.variant] || colors.default;
  }

  render() {
    const container = document.createElement('div');
    container.className = `rounded-lg border p-4 transition-all duration-300 ${this.getVariantClasses()}`;

    if (this.loading) {
      // Loading skeleton
      const skeleton = document.createElement('div');
      skeleton.className = 'flex items-center justify-between';
      skeleton.innerHTML = `
        <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      `;
      container.appendChild(skeleton);
    } else {
      // Preview content
      const content = document.createElement('div');
      content.className = 'flex items-center justify-between space-x-4';

      // Input amount
      const inputDiv = document.createElement('div');
      inputDiv.className = 'flex flex-col items-start';
      inputDiv.innerHTML = `
        <span class="text-xs text-gray-500 dark:text-gray-400 uppercase">You ${this.inputToken === 'LP' ? 'Withdraw' : 'Deposit'}</span>
        <span class="text-lg font-bold ${this.getTextColorClasses()}">${this.inputAmount} ${this.inputToken}</span>
      `;

      // Arrow
      const arrow = document.createElement('div');
      arrow.className = 'text-gray-400 dark:text-gray-500 flex-shrink-0';
      arrow.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
        </svg>
      `;

      // Output amount
      const outputDiv = document.createElement('div');
      outputDiv.className = 'flex flex-col items-end';
      outputDiv.innerHTML = `
        <span class="text-xs text-gray-500 dark:text-gray-400 uppercase">You ${this.outputToken === 'LP' ? 'Receive' : 'Get Back'}</span>
        <span class="text-lg font-bold ${this.getTextColorClasses()}">${this.outputAmount} ${this.outputToken}</span>
      `;

      content.appendChild(inputDiv);
      content.appendChild(arrow);
      content.appendChild(outputDiv);
      container.appendChild(content);
    }

    return container;
  }

  // Update values
  update(config) {
    if (config.inputAmount !== undefined) this.inputAmount = config.inputAmount;
    if (config.outputAmount !== undefined) this.outputAmount = config.outputAmount;
    if (config.loading !== undefined) this.loading = config.loading;
    if (config.variant !== undefined) this.variant = config.variant;
  }
}
