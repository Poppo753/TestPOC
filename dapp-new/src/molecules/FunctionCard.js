// ============================================
// MOLECULE: FunctionCard Component
// Card per visualizzare una singola funzione della documentazione
// ============================================

import { Badge } from '../atoms/Badge.js';

export class FunctionCard {
  constructor(config = {}) {
    this.func = config.func || {};
    this.onClick = config.onClick || (() => {});
  }

  getFunctionType() {
    // Determina il tipo in base al colore o all'accesso
    if (this.func.color === 'emergency') return 'emergency';
    if (this.func.color === 'write') return 'write';
    return 'view';
  }

  render() {
    const card = document.createElement('div');
    
    // Add data attribute for dependency graph
    card.setAttribute('data-function-name', this.func.name);
    card.className = 'function-card';
    
    const baseClasses = 'p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-3';
    const hoverClasses = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:translate-x-1';
    const bgClasses = 'bg-gray-100/50 dark:bg-gray-800/30';
    
    const type = this.getFunctionType();
    const borderColorClasses = {
      view: 'border-l-blue-500',
      write: 'border-l-orange-500',
      emergency: 'border-l-red-500'
    };

    card.className += ` ${baseClasses} ${hoverClasses} ${bgClasses} ${borderColorClasses[type]}`.trim();

    // Function name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'flex items-center justify-between mb-2';

    const functionName = document.createElement('span');
    functionName.className = 'font-mono font-semibold text-sm text-gray-900 dark:text-white function-name';
    functionName.textContent = `${this.func.name}()`;
    nameDiv.appendChild(functionName);

    // Type badge
    const typeBadge = new Badge({ 
      variant: type,
      label: type.toUpperCase(),
      size: 'xs'
    });
    nameDiv.appendChild(typeBadge.render());

    card.appendChild(nameDiv);

    // Access info
    if (this.func.access) {
      const accessDiv = document.createElement('div');
      accessDiv.className = 'flex items-center gap-2';
      
      const accessIcon = this.getAccessIcon(this.func.access);
      const accessBadge = new Badge({ 
        variant: 'access',
        label: this.func.access,
        icon: accessIcon,
        size: 'xs'
      });
      accessDiv.appendChild(accessBadge.render());

      card.appendChild(accessDiv);
    }

    // Description preview (se disponibile)
    if (this.func.description) {
      const desc = document.createElement('p');
      desc.className = 'text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2';
      desc.textContent = this.func.description.substring(0, 80) + (this.func.description.length > 80 ? '...' : '');
      card.appendChild(desc);
    }

    // Click handler
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onClick(this.func);
    });

    return card;
  }

  getAccessIcon(access) {
    const lowerAccess = access.toLowerCase();
    if (lowerAccess.includes('owner')) return '🔒';
    if (lowerAccess.includes('emergency')) return '🚨';
    if (lowerAccess.includes('public')) return '🌐';
    return '👤';
  }
}
