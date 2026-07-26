// ============================================
// MOLECULE: Alert/Toast Component
// ============================================

import { Icon } from '../atoms/Icon.js';

export class Alert {
  constructor(config = {}) {
    this.message = config.message || '';
    this.variant = config.variant || 'info'; // success, error, warning, info
    this.dismissible = config.dismissible !== false;
    this.autoClose = config.autoClose || 0; // milliseconds, 0 = no auto close
    this.onClose = config.onClose || (() => {});
  }

  getVariantConfig() {
    const configs = {
      success: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-800 dark:text-green-200',
        icon: 'check',
        iconColor: 'text-green-600 dark:text-green-400',
      },
      error: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: 'warning',
        iconColor: 'text-red-600 dark:text-red-400',
      },
      warning: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-200',
        icon: 'warning',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
      },
      info: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-200',
        icon: 'info',
        iconColor: 'text-blue-600 dark:text-blue-400',
      },
    };
    return configs[this.variant] || configs.info;
  }

  render() {
    const config = this.getVariantConfig();
    const alert = document.createElement('div');
    
    alert.className = `${config.bg} ${config.border} ${config.text} border rounded-lg p-4 flex items-start space-x-3 animate-slide-in`;

    // Icon
    const iconWrapper = document.createElement('div');
    iconWrapper.className = `flex-shrink-0 ${config.iconColor}`;
    iconWrapper.innerHTML = Icon.get(config.icon);
    alert.appendChild(iconWrapper);

    // Message
    const message = document.createElement('div');
    message.className = 'flex-1 text-sm font-medium';
    message.innerHTML = this.message; // Allow HTML in messages (for links, etc.)
    alert.appendChild(message);

    // Close button
    if (this.dismissible) {
      const closeBtn = document.createElement('button');
      closeBtn.className = `flex-shrink-0 ${config.iconColor} hover:opacity-75 transition-opacity`;
      closeBtn.innerHTML = Icon.get('close');
      closeBtn.onclick = () => {
        alert.classList.add('animate-slide-out');
        setTimeout(() => {
          alert.remove();
          this.onClose();
        }, 300);
      };
      alert.appendChild(closeBtn);
    }

    // Auto close
    if (this.autoClose > 0) {
      setTimeout(() => {
        if (alert.parentElement) {
          alert.classList.add('animate-slide-out');
          setTimeout(() => {
            alert.remove();
            this.onClose();
          }, 300);
        }
      }, this.autoClose);
    }

    return alert;
  }
}

// ============================================
// Toast Manager (for stacking alerts)
// ============================================

export class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'fixed top-4 right-4 z-50 space-y-3 max-w-md';
    document.body.appendChild(this.container);
  }

  show(config) {
    const alert = new Alert({
      ...config,
      dismissible: true,
      autoClose: config.autoClose || 5000,
    });
    
    const element = alert.render();
    this.container.appendChild(element);
    
    return element;
  }

  success(message, autoClose = 5000) {
    return this.show({ message, variant: 'success', autoClose });
  }

  error(message, autoClose = 5000) {
    return this.show({ message, variant: 'error', autoClose });
  }

  warning(message, autoClose = 5000) {
    return this.show({ message, variant: 'warning', autoClose });
  }

  info(message, autoClose = 5000) {
    return this.show({ message, variant: 'info', autoClose });
  }

  clear() {
    this.container.innerHTML = '';
  }
}

// Singleton instance
export const toast = new ToastManager();
