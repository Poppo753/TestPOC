// ============================================
// ATOM: Badge Component
// ============================================

export class Badge {
  constructor(config = {}) {
    this.label = config.label || '';
    this.variant = config.variant || 'default'; // default, success, warning, error, info, purple
    this.size = config.size || 'md'; // sm, md, lg
    this.icon = config.icon || null;
    this.pill = config.pill || false; // rounded-full vs rounded
  }

  getVariantClasses() {
    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return variants[this.variant] || variants.default;
  }

  getSizeClasses() {
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };
    return sizes[this.size] || sizes.md;
  }

  render() {
    const badge = document.createElement('span');
    
    const baseClasses = 'inline-flex items-center font-semibold';
    const variantClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    const shapeClass = this.pill ? 'rounded-full' : 'rounded-md';

    badge.className = `${baseClasses} ${variantClasses} ${sizeClasses} ${shapeClass}`.trim();

    if (this.icon) {
      badge.innerHTML = `<span class="mr-1">${this.icon}</span><span>${this.label}</span>`;
    } else {
      badge.textContent = this.label;
    }

    return badge;
  }
}
