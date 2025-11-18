// ============================================
// ORGANISM: ModulesGrid Component
// Griglia responsiva per visualizzare tutti i moduli della documentazione
// ============================================

import { ModuleCard } from '../molecules/ModuleCard.js';

export class ModulesGrid {
  constructor(config = {}) {
    this.modules = config.modules || [];
    this.onFunctionClick = config.onFunctionClick || (() => {});
    this.moduleCards = [];
  }

  render() {
    const container = document.createElement('div');
    
    // Use grid with dense packing
    container.className = 'p-6';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))';
    container.style.gap = '1.5rem';
    container.style.gridAutoRows = 'min-content';
    container.style.gridAutoFlow = 'dense';
    container.style.alignItems = 'start';

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

    // Sort modules by displayOrder (if present), fallback to original order
    const sortedModules = [...this.modules].sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      console.log(`🔢 Sorting: ${a.name}(${orderA}) vs ${b.name}(${orderB})`);
      return orderA - orderB;
    });

    console.log('📋 Final order:', sortedModules.map(m => `${m.name}(${m.displayOrder})`).join(', '));

    this.moduleCards = [];
    sortedModules.forEach(module => {
      const moduleCard = new ModuleCard({
        module: module,
        onFunctionClick: this.onFunctionClick
      });
      
      const cardElement = moduleCard.render();
      
      this.moduleCards.push(moduleCard);
      container.appendChild(cardElement);
    });

    return container;
  }

  // Get module card by name
  getModuleCardByName(moduleName) {
    return this.moduleCards.find(card => card.module.name === moduleName);
  }

  // Method to update modules dynamically
  updateModules(newModules) {
    this.modules = newModules;
  }

  // Collapse all modules
  collapseAll() {
    this.moduleCards.forEach(card => card.collapse());
  }

  // Expand all modules
  expandAll() {
    this.moduleCards.forEach(card => card.expand());
  }
}
