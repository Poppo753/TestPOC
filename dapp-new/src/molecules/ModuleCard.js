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
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    this.update();
  }

  expand() {
    if (!this.isExpanded) {
      this.isExpanded = true;
      this.update();
    }
  }

  collapse() {
    if (this.isExpanded) {
      this.isExpanded = false;
      this.update();
    }
  }

  update() {
    if (!this.cardElement) return;

    const functionsContainer = this.cardElement.querySelector('.functions-container');
    const footerContainer = this.cardElement.querySelector('.footer-container');
    const chevron = this.cardElement.querySelector('.chevron-icon');
    
    if (this.isExpanded) {
      // Expanded state
      this.cardElement.classList.add('expanded', 'z-20');
      this.cardElement.classList.remove('collapsed', 'dimmed');
      this.cardElement.style.transform = 'scale(1)';
      this.cardElement.style.opacity = '1';
      
      if (functionsContainer) {
        functionsContainer.style.maxHeight = functionsContainer.scrollHeight + 'px';
        functionsContainer.style.opacity = '1';
      }
      if (footerContainer) {
        footerContainer.style.maxHeight = footerContainer.scrollHeight + 'px';
        footerContainer.style.opacity = '1';
      }
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
      // Collapsed state
      this.cardElement.classList.remove('expanded', 'z-20');
      this.cardElement.classList.add('collapsed');
      this.cardElement.style.transform = 'scale(1)';
      this.cardElement.style.opacity = '1';
      
      if (functionsContainer) {
        functionsContainer.style.maxHeight = '0';
        functionsContainer.style.opacity = '0';
      }
      if (footerContainer) {
        footerContainer.style.maxHeight = '0';
        footerContainer.style.opacity = '0';
      }
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  }

  dim() {
    if (!this.cardElement) return;
    this.cardElement.classList.add('dimmed');
    this.cardElement.style.opacity = '0.4';
  }

  undim() {
    if (!this.cardElement) return;
    this.cardElement.classList.remove('dimmed');
    this.cardElement.style.opacity = '1';
  }

  getHeaderElement() {
    return this.cardElement?.querySelector('.module-header');
  }

  render() {
    // Main card element
    const card = document.createElement('div');
    card.className = 'module-card collapsed bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 overflow-hidden transition-all duration-300 cursor-pointer hover:border-blue-500';
    card.setAttribute('data-module-name', this.module.name);
    this.cardElement = card;

    // Header (always visible)
    const header = document.createElement('div');
    header.className = 'module-header p-4 flex items-center justify-between';
    header.innerHTML = `
      <div class="flex-1">
        <h3 class="text-xl font-bold text-white mb-1">${this.module.name}</h3>
        <p class="text-sm text-gray-400">${this.module.functions?.length || 0} functions</p>
      </div>
      <div class="chevron-icon transition-transform duration-300">
        <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
    `;

    // Click header to toggle
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    card.appendChild(header);

    // Functions container (collapsible)
    const functionsContainer = document.createElement('div');
    functionsContainer.className = 'functions-container overflow-hidden transition-all duration-300';
    functionsContainer.style.maxHeight = '0';
    functionsContainer.style.opacity = '0';

    const functionsInner = document.createElement('div');
    functionsInner.className = 'p-4 pt-0 space-y-2 max-h-96 overflow-y-auto';

    if (this.module.functions && this.module.functions.length > 0) {
      this.module.functions.forEach(func => {
        const functionCard = new FunctionCard({
          func: func,
          onClick: this.onFunctionClick
        });
        functionsInner.appendChild(functionCard.render());
      });
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-8 text-center text-gray-500 dark:text-gray-400';
      emptyState.textContent = 'No functions available';
      functionsInner.appendChild(emptyState);
    }

    functionsContainer.appendChild(functionsInner);
    card.appendChild(functionsContainer);

    // Footer stats (collapsible)
    const footerContainer = document.createElement('div');
    footerContainer.className = 'footer-container overflow-hidden transition-all duration-300';
    footerContainer.style.maxHeight = '0';
    footerContainer.style.opacity = '0';

    const footer = document.createElement('div');
    footer.className = 'p-4 pt-0';
    footer.innerHTML = `
      <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-800/50 rounded-lg p-2">
        <span>🔵 View: ${this.module.functions?.filter(f => f.color === 'view').length || 0}</span>
        <span>🟠 Write: ${this.module.functions?.filter(f => f.color === 'write').length || 0}</span>
        <span>🔴 Emergency: ${this.module.functions?.filter(f => f.color === 'emergency').length || 0}</span>
      </div>
    `;

    footerContainer.appendChild(footer);
    card.appendChild(footerContainer);

    return card;
  }
}
