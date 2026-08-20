// ============================================
// ATOM: Button Component
// ============================================

export class Button {
  constructor(config = {}) {
    this.label = config.label || 'Button';
    this.variant = config.variant || 'primary'; // primary, secondary, outline, ghost, danger
    this.size = config.size || 'md'; // sm, md, lg
    this.fullWidth = config.fullWidth || false;
    this.disabled = config.disabled || false;
    this.loading = config.loading || false;
    this.icon = config.icon || null;
    this.onClick = config.onClick || (() => {});
  }

  getVariantClasses() {
    const variants = {
      primary: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl',
      secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white',
      outline: 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20',
      ghost: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl',
    };
    return variants[this.variant] || variants.primary;
  }

  getSizeClasses() {
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };
    return sizes[this.size] || sizes.md;
  }

  render() {
    const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none';
    const variantClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    const widthClass = this.fullWidth ? 'w-full' : '';
    const hoverTransform = !this.disabled && !this.loading ? 'hover:-translate-y-0.5' : '';

    const button = document.createElement('button');
    button.className = `${baseClasses} ${variantClasses} ${sizeClasses} ${widthClass} ${hoverTransform}`.trim();
    button.disabled = this.disabled || this.loading;
    
    if (this.loading) {
      button.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${this.label}</span>
      `;
    } else {
      if (this.icon) {
        button.innerHTML = `<span class="mr-2">${this.icon}</span><span>${this.label}</span>`;
      } else {
        button.textContent = this.label;
      }
    }

    button.addEventListener('click', (e) => {
      if (!this.disabled && !this.loading) {
        this.onClick(e);
      }
    });

    return button;
  }

  // Helper to update button state
  setLoading(isLoading) {
    this.loading = isLoading;
  }

  setDisabled(isDisabled) {
    this.disabled = isDisabled;
  }
}
