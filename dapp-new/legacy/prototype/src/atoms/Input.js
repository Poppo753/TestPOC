// ============================================
// ATOM: Input Component
// ============================================

export class Input {
  constructor(config = {}) {
    this.type = config.type || 'text'; // text, number, email, password
    this.placeholder = config.placeholder || '';
    this.value = config.value || '';
    this.label = config.label || null;
    this.error = config.error || null;
    this.disabled = config.disabled || false;
    this.required = config.required || false;
    this.icon = config.icon || null;
    this.suffix = config.suffix || null; // e.g., "ETH", "USD"
    this.onChange = config.onChange || (() => {});
    this.onFocus = config.onFocus || (() => {});
    this.onBlur = config.onBlur || (() => {});
    
    // Number specific
    this.min = config.min;
    this.max = config.max;
    this.step = config.step;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'w-full';

    // Label
    if (this.label) {
      const label = document.createElement('label');
      label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
      label.textContent = this.label;
      if (this.required) {
        const required = document.createElement('span');
        required.className = 'text-red-500 ml-1';
        required.textContent = '*';
        label.appendChild(required);
      }
      container.appendChild(label);
    }

    // Input wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';

    // Icon (left)
    if (this.icon) {
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400';
      iconWrapper.innerHTML = this.icon;
      wrapper.appendChild(iconWrapper);
    }

    // Input
    const input = document.createElement('input');
    input.type = this.type;
    input.placeholder = this.placeholder;
    input.value = this.value;
    input.disabled = this.disabled;
    input.required = this.required;
    
    if (this.type === 'number') {
      if (this.min !== undefined) input.min = this.min;
      if (this.max !== undefined) input.max = this.max;
      if (this.step !== undefined) input.step = this.step;
    }

    const baseClasses = 'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition-all duration-200 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed';
    const iconPadding = this.icon ? 'pl-10' : '';
    const suffixPadding = this.suffix ? 'pr-16' : '';
    const errorClass = this.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '';

    input.className = `${baseClasses} ${iconPadding} ${suffixPadding} ${errorClass}`.trim();

    input.addEventListener('input', (e) => this.onChange(e.target.value, e));
    input.addEventListener('focus', (e) => this.onFocus(e));
    input.addEventListener('blur', (e) => this.onBlur(e));

    wrapper.appendChild(input);

    // Suffix (right)
    if (this.suffix) {
      const suffixWrapper = document.createElement('div');
      suffixWrapper.className = 'absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 dark:text-gray-400 font-medium';
      suffixWrapper.textContent = this.suffix;
      wrapper.appendChild(suffixWrapper);
    }

    container.appendChild(wrapper);

    // Error message
    if (this.error) {
      const error = document.createElement('p');
      error.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
      error.textContent = this.error;
      container.appendChild(error);
    }

    return container;
  }

  // Helper methods
  getValue() {
    return this.value;
  }

  setValue(value) {
    this.value = value;
  }

  setError(error) {
    this.error = error;
  }

  clearError() {
    this.error = null;
  }
}
