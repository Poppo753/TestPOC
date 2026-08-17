// ============================================
// MAIN APPLICATION ENTRY POINT
// ============================================

import { DashboardTemplate } from './src/templates/DashboardTemplate.js';

class App {
  constructor() {
    this.dashboard = null;
  }

  async init() {
    console.log('🚀 Initializing Jethos Protocol DApp...');

    try {
      // Create and mount dashboard
      this.dashboard = new DashboardTemplate();
      this.dashboard.mount('#app');

      console.log('✅ DApp initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing app:', error);
    }
  }

  destroy() {
    if (this.dashboard) {
      this.dashboard.destroy();
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();

  // Make app available globally for debugging
  window.app = app;
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.app) {
    window.app.destroy();
  }
});
