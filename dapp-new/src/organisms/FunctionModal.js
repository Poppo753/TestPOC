// ============================================
// ORGANISM: FunctionModal Component
// Modal per visualizzare i dettagli completi di una funzione
// ============================================

import { Badge } from '../atoms/Badge.js';

export class FunctionModal {
  constructor(config = {}) {
    this.func = config.func || null;
    this.dependencies = config.dependencies || [];
    this.onClose = config.onClose || (() => {});
    this.isVisible = false;
  }

  getFunctionType() {
    if (this.func.color === 'emergency') return 'emergency';
    if (this.func.color === 'write') return 'write';
    return 'view';
  }

  show() {
    this.isVisible = true;
  }

  hide() {
    this.isVisible = false;
    this.onClose();
  }

  render() {
    if (!this.func) return document.createElement('div');

    const overlay = document.createElement('div');
    overlay.className = `fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center transition-all duration-300 ${this.isVisible ? 'opacity-100' : 'opacity-0 invisible'}`;
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    const modal = document.createElement('div');
    modal.className = `bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ${this.isVisible ? 'scale-100' : 'scale-90'}`;
    
    // Prevent click propagation
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.className = 'bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex items-center justify-between';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'flex items-center gap-3';

    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold text-white font-mono';
    title.textContent = `${this.func.name}()`;
    headerLeft.appendChild(title);

    const typeBadge = new Badge({ 
      variant: this.getFunctionType(),
      label: this.getFunctionType().toUpperCase(),
      size: 'md'
    });
    headerLeft.appendChild(typeBadge.render());

    header.appendChild(headerLeft);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-white hover:bg-white/20 rounded-lg p-2 transition-colors';
    closeBtn.innerHTML = '✕';
    closeBtn.style.fontSize = '24px';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6';

    // Badges section
    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'flex items-center gap-3 flex-wrap';
    
    if (this.func.access) {
      const accessIcon = this.getAccessIcon(this.func.access);
      const accessBadge = new Badge({ 
        variant: 'access',
        label: this.func.access,
        icon: accessIcon,
        size: 'md'
      });
      badgesDiv.appendChild(accessBadge.render());
    }

    if (this.func.gas) {
      const gasBadge = new Badge({ 
        variant: 'gas',
        label: this.func.gas,
        icon: '⛽',
        size: 'md'
      });
      badgesDiv.appendChild(gasBadge.render());
    }

    body.appendChild(badgesDiv);

    // Description
    if (this.func.description) {
      const descSection = this.createSection('Description', this.func.description);
      body.appendChild(descSection);
    }

    // Signature
    if (this.func.signature) {
      const sigSection = this.createCodeSection('Signature', this.func.signature);
      body.appendChild(sigSection);
    }

    // Parameters
    if (this.func.parameters && this.func.parameters.length > 0) {
      const paramsSection = this.createTableSection('Parameters', this.func.parameters, ['name', 'type', 'description']);
      body.appendChild(paramsSection);
    }

    // Returns
    if (this.func.returns && this.func.returns.length > 0) {
      const returnsSection = this.createTableSection('Returns', this.func.returns, ['type', 'description']);
      body.appendChild(returnsSection);
    }

    // Validations
    if (this.func.validations && this.func.validations.length > 0) {
      const validationsSection = this.createListSection('Validations', this.func.validations);
      body.appendChild(validationsSection);
    }

    // Events
    if (this.func.events) {
      const eventsSection = this.createSection('Events Emitted', this.func.events, 'bg-blue-50 dark:bg-blue-900/20');
      body.appendChild(eventsSection);
    }

    // Called By
    if (this.func.calledBy) {
      const calledBySection = this.createSection('Called By', this.func.calledBy, 'bg-purple-50 dark:bg-purple-900/20');
      body.appendChild(calledBySection);
    }

    // Security Notes
    if (this.func.securityNotes && this.func.securityNotes.length > 0) {
      const securitySection = this.createListSection('🔒 Security Notes', this.func.securityNotes, 'text-orange-700 dark:text-orange-400');
      body.appendChild(securitySection);
    }

    // Usage Example
    if (this.func.usageExample && this.func.usageExample.trim()) {
      const usageSection = this.createCodeSection('Usage Example', this.func.usageExample.trim());
      body.appendChild(usageSection);
    }

    // Dependencies
    if (this.dependencies && this.dependencies.length > 0 && this.dependencies[0]?.to) {
      const depsSection = this.createListSection('Function Calls', this.dependencies[0].to, 'text-blue-600 dark:text-blue-400 font-mono');
      body.appendChild(depsSection);
    }

    modal.appendChild(body);

    overlay.appendChild(modal);
    return overlay;
  }

  getAccessIcon(access) {
    const lowerAccess = access.toLowerCase();
    if (lowerAccess.includes('owner')) return '🔒';
    if (lowerAccess.includes('emergency')) return '🚨';
    if (lowerAccess.includes('public')) return '🌐';
    return '👤';
  }

  createSection(title, content, bgClass = '') {
    const section = document.createElement('div');
    section.className = 'space-y-2';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const contentEl = document.createElement('div');
    contentEl.className = `p-3 rounded-lg ${bgClass || 'bg-gray-50 dark:bg-gray-900/50'}`;
    contentEl.textContent = content;
    section.appendChild(contentEl);

    return section;
  }

  createCodeSection(title, code) {
    const section = document.createElement('div');
    section.className = 'space-y-2';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const codeEl = document.createElement('pre');
    codeEl.className = 'bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm';
    codeEl.textContent = code;
    section.appendChild(codeEl);

    return section;
  }

  createTableSection(title, data, columns) {
    const section = document.createElement('div');
    section.className = 'space-y-2';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const table = document.createElement('table');
    table.className = 'w-full border-collapse';

    const thead = document.createElement('thead');
    thead.className = 'bg-gray-100 dark:bg-gray-700';
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.className = 'px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600';
      th.textContent = col.charAt(0).toUpperCase() + col.slice(1);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-200 dark:border-gray-700';
      columns.forEach(col => {
        const td = document.createElement('td');
        td.className = 'px-4 py-3 text-sm text-gray-600 dark:text-gray-400';
        if (col === 'name' || col === 'type') {
          td.innerHTML = `<code class="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-400">${row[col]}</code>`;
        } else {
          td.textContent = row[col];
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    section.appendChild(table);
    return section;
  }

  createListSection(title, items, itemClass = '') {
    const section = document.createElement('div');
    section.className = 'space-y-2';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = `pl-6 relative ${itemClass}`;
      li.innerHTML = `<span class="absolute left-0">•</span>${item}`;
      ul.appendChild(li);
    });

    section.appendChild(ul);
    return section;
  }
}
