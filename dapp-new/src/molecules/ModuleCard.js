// ============================================
// MOLECULE: ModuleCard Component
// Card per visualizzare un modulo con le sue funzioni
// ============================================

import { Card } from './Card.js';
import { FunctionCard } from './FunctionCard.js';

export class ModuleCard {
  constructor(config = {}) {
    this.module = config.module || {};
    this.onFunctionClick = config.onFunctionClick || (() => {});
  }

  render() {
    // Functions list content
    const functionsContent = () => {
      const container = document.createElement('div');
      container.className = 'space-y-2 max-h-96 overflow-y-auto';

      if (this.module.functions && this.module.functions.length > 0) {
        this.module.functions.forEach(func => {
          const functionCard = new FunctionCard({
            func: func,
            onClick: this.onFunctionClick
          });
          container.appendChild(functionCard.render());
        });
      } else {
        // Empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'p-8 text-center text-gray-500 dark:text-gray-400';
        emptyState.textContent = 'No functions available';
        container.appendChild(emptyState);
      }

      return container;
    };

    // Footer stats
    const footerContent = document.createElement('div');
    footerContent.innerHTML = `
      <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>🔵 View: ${this.module.functions?.filter(f => f.color === 'view').length || 0}</span>
        <span>🟠 Write: ${this.module.functions?.filter(f => f.color === 'write').length || 0}</span>
        <span>🔴 Emergency: ${this.module.functions?.filter(f => f.color === 'emergency').length || 0}</span>
      </div>
    `;

    // Use existing Card component
    const card = new Card({
      title: this.module.name,
      subtitle: `${this.module.functions?.length || 0} functions`,
      content: functionsContent,
      footer: footerContent,
      variant: 'gradient',
      hover: true
    });

    return card.render();
  }
}
