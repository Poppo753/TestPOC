// ============================================
// MOLECULE: Card Component
// ============================================

export class Card {
  constructor(config = {}) {
    this.title = config.title || null;
    this.subtitle = config.subtitle || null;
    this.content = config.content || null; // Can be string, HTMLElement, or function that returns HTMLElement
    this.footer = config.footer || null;
    this.variant = config.variant || 'default'; // default, gradient, glass
    this.padding = config.padding !== false; // default true
    this.hover = config.hover || false;
    
    // Grid positioning (for use in grid layout)
    this.colSpan = config.colSpan || 1; // how many columns to span (1-12)
    this.rowSpan = config.rowSpan || 1; // how many rows to span
    
    // Additional classes
    this.className = config.className || '';
  }

  getVariantClasses() {
    const variants = {
      default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
      gradient: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800',
      glass: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50',
    };
    return variants[this.variant] || variants.default;
  }

  getGridClasses() {
    return `col-span-${this.colSpan} row-span-${this.rowSpan}`;
  }

  render() {
    const card = document.createElement('div');
    
    const baseClasses = 'rounded-xl shadow-lg transition-all duration-300';
    const variantClasses = this.getVariantClasses();
    const hoverClass = this.hover ? 'hover:shadow-2xl hover:-translate-y-1' : '';
    const gridClasses = this.getGridClasses();
    
    card.className = `${baseClasses} ${variantClasses} ${hoverClass} ${gridClasses} ${this.className}`.trim();

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = this.padding ? 'p-6' : '';

    // Header
    if (this.title || this.subtitle) {
      const header = document.createElement('div');
      header.className = 'mb-4';

      if (this.title) {
        const title = document.createElement('h3');
        title.className = 'text-xl font-bold text-gray-900 dark:text-white';
        title.textContent = this.title;
        header.appendChild(title);
      }

      if (this.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'text-sm text-gray-600 dark:text-gray-400 mt-1';
        subtitle.textContent = this.subtitle;
        header.appendChild(subtitle);
      }

      wrapper.appendChild(header);
    }

    // Content
    if (this.content) {
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'card-content';
      
      if (typeof this.content === 'string') {
        contentWrapper.innerHTML = this.content;
      } else if (typeof this.content === 'function') {
        const contentElement = this.content();
        if (contentElement) {
          contentWrapper.appendChild(contentElement);
        }
      } else if (this.content instanceof HTMLElement) {
        contentWrapper.appendChild(this.content);
      }
      
      wrapper.appendChild(contentWrapper);
    }

    card.appendChild(wrapper);

    // Footer
    if (this.footer) {
      const footer = document.createElement('div');
      footer.className = 'border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl';
      
      if (typeof this.footer === 'string') {
        footer.innerHTML = this.footer;
      } else if (this.footer instanceof HTMLElement) {
        footer.appendChild(this.footer);
      }
      
      card.appendChild(footer);
    }

    return card;
  }

  // Helper to update content dynamically
  updateContent(newContent) {
    this.content = newContent;
  }
}
