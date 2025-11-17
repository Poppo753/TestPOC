// ============================================
// MOLECULE: FormGroup Component
// ============================================

import { Input } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';

export class FormGroup {
  constructor(config = {}) {
    this.fields = config.fields || []; // Array of Input configs
    this.buttons = config.buttons || []; // Array of Button configs
    this.title = config.title || null;
    this.description = config.description || null;
    this.onSubmit = config.onSubmit || (() => {});
    this.orientation = config.orientation || 'vertical'; // vertical, horizontal
  }

  render() {
    const form = document.createElement('form');
    form.className = 'space-y-4';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = {};
      this.fields.forEach((fieldConfig, index) => {
        const input = form.querySelectorAll('input')[index];
        formData[fieldConfig.name || `field_${index}`] = input.value;
      });
      this.onSubmit(formData, e);
    });

    // Title and description
    if (this.title || this.description) {
      const header = document.createElement('div');
      header.className = 'mb-4';

      if (this.title) {
        const title = document.createElement('h4');
        title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
        title.textContent = this.title;
        header.appendChild(title);
      }

      if (this.description) {
        const desc = document.createElement('p');
        desc.className = 'text-sm text-gray-600 dark:text-gray-400 mt-1';
        desc.textContent = this.description;
        header.appendChild(desc);
      }

      form.appendChild(header);
    }

    // Fields
    const fieldsWrapper = document.createElement('div');
    fieldsWrapper.className = this.orientation === 'horizontal' 
      ? 'flex space-x-4' 
      : 'space-y-4';

    this.fields.forEach(fieldConfig => {
      const input = new Input(fieldConfig);
      const fieldElement = input.render();
      fieldsWrapper.appendChild(fieldElement);
    });

    form.appendChild(fieldsWrapper);

    // Buttons
    if (this.buttons.length > 0) {
      const buttonsWrapper = document.createElement('div');
      buttonsWrapper.className = 'flex space-x-3 mt-6';

      this.buttons.forEach(buttonConfig => {
        const button = new Button({
          ...buttonConfig,
          onClick: (e) => {
            if (buttonConfig.type === 'submit') {
              // Form submit will handle this
            } else if (buttonConfig.onClick) {
              buttonConfig.onClick(e);
            }
          }
        });
        const buttonElement = button.render();
        if (buttonConfig.type === 'submit') {
          buttonElement.type = 'submit';
        }
        buttonsWrapper.appendChild(buttonElement);
      });

      form.appendChild(buttonsWrapper);
    }

    return form;
  }
}
