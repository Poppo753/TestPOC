// ============================================
// TEMPLATE: Grid Layout System
// ============================================

/**
 * Flexible Grid Layout System
 * 
 * Usage:
 * const layout = new GridLayout({
 *   columns: 12,
 *   gap: 6,
 *   responsive: {
 *     sm: 1,  // 1 column on small screens
 *     md: 2,  // 2 columns on medium
 *     lg: 12  // 12 columns on large
 *   }
 * });
 * 
 * layout.addItem(component, { colSpan: 2, rowSpan: 3 });
 */

export class GridLayout {
  constructor(config = {}) {
    this.columns = config.columns || 12;
    this.gap = config.gap || 4; // Tailwind gap scale
    this.responsive = config.responsive || {
      sm: 1,
      md: 2,
      lg: this.columns,
    };
    this.items = [];
    this.className = config.className || '';
  }

  addItem(component, gridConfig = {}) {
    this.items.push({
      component,
      colSpan: gridConfig.colSpan || 1,
      rowSpan: gridConfig.rowSpan || 1,
      colStart: gridConfig.colStart || null,
      rowStart: gridConfig.rowStart || null,
    });
  }

  clearItems() {
    this.items = [];
  }

  getResponsiveClasses() {
    const { sm, md, lg } = this.responsive;
    return `grid-cols-${sm} md:grid-cols-${md} lg:grid-cols-${lg}`;
  }

  render() {
    const grid = document.createElement('div');
    grid.className = `grid ${this.getResponsiveClasses()} gap-${this.gap} ${this.className}`.trim();

    this.items.forEach(({ component, colSpan, rowSpan, colStart, rowStart }) => {
      const wrapper = document.createElement('div');
      
      let classes = [];
      if (colSpan > 1) classes.push(`lg:col-span-${colSpan}`);
      if (rowSpan > 1) classes.push(`lg:row-span-${rowSpan}`);
      if (colStart) classes.push(`lg:col-start-${colStart}`);
      if (rowStart) classes.push(`lg:row-start-${rowStart}`);
      
      wrapper.className = classes.join(' ');

      // Handle different component types
      if (typeof component === 'function') {
        wrapper.appendChild(component());
      } else if (component instanceof HTMLElement) {
        wrapper.appendChild(component);
      } else if (component.render) {
        wrapper.appendChild(component.render());
      }

      grid.appendChild(wrapper);
    });

    return grid;
  }
}

// ============================================
// Pre-defined Layout Patterns
// ============================================

export const LayoutPatterns = {
  // Sidebar + Main content
  sidebarLayout: (sidebar, main) => {
    const layout = new GridLayout({ columns: 12, gap: 6 });
    layout.addItem(sidebar, { colSpan: 3, rowSpan: 1 });
    layout.addItem(main, { colSpan: 9, rowSpan: 1 });
    return layout;
  },

  // Dashboard with stats cards
  dashboardLayout: (cards) => {
    const layout = new GridLayout({ 
      columns: 12, 
      gap: 4,
      responsive: { sm: 1, md: 2, lg: 4 }
    });
    cards.forEach(card => layout.addItem(card, { colSpan: 1 }));
    return layout;
  },

  // Hero + Content
  heroLayout: (hero, content) => {
    const layout = new GridLayout({ columns: 1, gap: 8 });
    layout.addItem(hero, { colSpan: 1 });
    layout.addItem(content, { colSpan: 1 });
    return layout;
  },

  // Two column equal
  twoColumnLayout: (left, right) => {
    const layout = new GridLayout({ columns: 2, gap: 6 });
    layout.addItem(left, { colSpan: 1 });
    layout.addItem(right, { colSpan: 1 });
    return layout;
  },

  // Masonry-style (varying heights)
  masonryLayout: (items) => {
    const layout = new GridLayout({ 
      columns: 12, 
      gap: 4,
      responsive: { sm: 1, md: 6, lg: 12 }
    });
    
    items.forEach((item, index) => {
      // Example pattern: alternating sizes
      const colSpan = index % 3 === 0 ? 2 : 1;
      const rowSpan = index % 4 === 0 ? 2 : 1;
      layout.addItem(item, { colSpan, rowSpan });
    });
    
    return layout;
  },
};
