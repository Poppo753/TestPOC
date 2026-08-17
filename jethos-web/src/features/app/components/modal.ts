export class Modal {
  private readonly dialog: HTMLElement | null;
  private lastFocus: HTMLElement | null = null;

  constructor(private readonly element: HTMLElement | null) {
    this.dialog = element?.querySelector('[role="dialog"]') ?? null;
    this.element?.addEventListener('click', this.onBackdropClick);
  }

  open(): void {
    if (!this.element) return;
    this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.element.hidden = false;
    document.addEventListener('keydown', this.onKeydown);
    this.dialog
      ?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();
  }

  close(): void {
    if (!this.element) return;
    this.element.hidden = true;
    document.removeEventListener('keydown', this.onKeydown);
    this.lastFocus?.focus();
  }

  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.close();
    if (event.key !== 'Tab' || !this.dialog) return;
    const focusable = [
      ...this.dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => !('disabled' in node) || !node.disabled);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  private readonly onBackdropClick = (event: MouseEvent) => {
    if (event.target === this.element) this.close();
  };
}
