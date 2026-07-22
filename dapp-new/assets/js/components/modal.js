/** Accessible confirmation dialog used before every write transaction. */
export class Modal {
  constructor(element) {
    this.element = element;
    this.dialog = element?.querySelector('[role="dialog"]');
    this.lastFocus = null;
    this.onKeydown = this.onKeydown.bind(this);
  }
  open() {
    if (!this.element) return;
    this.lastFocus = document.activeElement;
    this.element.hidden = false;
    document.addEventListener('keydown', this.onKeydown);
    this.dialog?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
  }
  close() {
    if (!this.element) return;
    this.element.hidden = true;
    document.removeEventListener('keydown', this.onKeydown);
    this.lastFocus?.focus?.();
  }
  onKeydown(event) {
    if (event.key === 'Escape') this.close();
    if (event.key !== 'Tab' || !this.dialog) return;
    const focusable = [...this.dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((node) => !node.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}

