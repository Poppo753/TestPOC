// ============================================
// ORGANISM: DocumentationStats Component
// Pannello statistiche per la documentazione
// ============================================

export class DocumentationStats {
  constructor(config = {}) {
    this.stats = config.stats || {};
    this.position = config.position || 'bottom-left'; // bottom-left, bottom-right, top-left, top-right
  }

  updateStats(newStats) {
    this.stats = newStats;
  }

  getPositionClasses() {
    const positions = {
      'bottom-left': 'bottom-6 left-6',
      'bottom-right': 'bottom-6 right-6',
      'top-left': 'top-6 left-6',
      'top-right': 'top-6 right-6'
    };
    return positions[this.position] || positions['bottom-left'];
  }

  render() {
    const panel = document.createElement('div');
    panel.className = `fixed ${this.getPositionClasses()} z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 min-w-[280px]`;

    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2';
    title.innerHTML = '📊 <span>System Statistics</span>';
    panel.appendChild(title);

    const stats = [
      { label: 'Total Modules', value: this.stats.totalModules || 0, color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Total Functions', value: this.stats.totalFunctions || 0, color: 'text-green-600 dark:text-green-400' },
      { label: 'View Functions', value: this.stats.viewFunctions || 0, color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Write Functions', value: this.stats.writeFunctions || 0, color: 'text-orange-600 dark:text-orange-400' },
      { label: 'Emergency Functions', value: this.stats.emergencyFunctions || 0, color: 'text-red-600 dark:text-red-400' },
    ];

    const statsContainer = document.createElement('div');
    statsContainer.className = 'space-y-3';

    stats.forEach(stat => {
      const statItem = document.createElement('div');
      statItem.className = 'flex items-center justify-between text-sm';

      const label = document.createElement('span');
      label.className = 'text-gray-600 dark:text-gray-400';
      label.textContent = stat.label + ':';
      statItem.appendChild(label);

      const value = document.createElement('span');
      value.className = `font-bold ${stat.color}`;
      value.textContent = stat.value;
      statItem.appendChild(value);

      statsContainer.appendChild(statItem);
    });

    panel.appendChild(statsContainer);

    return panel;
  }
}
