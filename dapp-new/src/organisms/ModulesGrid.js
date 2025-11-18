// ============================================
// ORGANISM: ModulesGrid Component
// Griglia responsiva per visualizzare tutti i moduli della documentazione
// ============================================

import { ModuleCard } from '../molecules/ModuleCard.js';

export class ModulesGrid {
  constructor(config = {}) {
    this.modules = config.modules || [];
    this.onFunctionClick = config.onFunctionClick || (() => {});
  }

  render() {
    const container = document.createElement('div');
    
    const gridClasses = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6';
    container.className = gridClasses;

    if (this.modules.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'col-span-full text-center py-20';
      emptyState.innerHTML = `
        <div class="text-gray-400 dark:text-gray-600">
          <div class="text-6xl mb-4">📚</div>
          <h3 class="text-xl font-semibold mb-2">No Modules Found</h3>
          <p class="text-sm">No documentation modules are available at this time.</p>
        </div>
      `;
      container.appendChild(emptyState);
      return container;
    }

    this.modules.forEach(module => {
      const moduleCard = new ModuleCard({
        module: module,
        onFunctionClick: this.onFunctionClick
      });
      container.appendChild(moduleCard.render());
    });

    return container;
  }

  // Method to update modules dynamically
  updateModules(newModules) {
    this.modules = newModules;
  }
}
