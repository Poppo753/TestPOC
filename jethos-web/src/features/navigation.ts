import type { DisposableController } from '../core/disposable';

export function mountNavigation(root: HTMLElement): DisposableController {
  const toggle = root.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const links = root.querySelector<HTMLElement>('[data-nav-links]');
  const label = root.querySelector<HTMLElement>('[data-nav-label]');

  if (!toggle || !links || !label) {
    throw new Error('Navigation requires toggle, links and accessible label elements.');
  }

  const setOpen = (isOpen: boolean) => {
    links.dataset.open = String(isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    label.textContent = isOpen ? 'Close menu' : 'Open menu';
  };
  const close = () => setOpen(false);
  const onToggle = () => setOpen(links.dataset.open !== 'true');
  const onLinksClick = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('a')) close();
  };
  const onDocumentClick = (event: MouseEvent) => {
    if (links.dataset.open !== 'true' || !(event.target instanceof Node)) return;
    if (!root.contains(event.target)) close();
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || links.dataset.open !== 'true') return;
    close();
    toggle.focus();
  };
  const desktop = window.matchMedia('(min-width: 1061px)');
  const onViewportChange = (event: MediaQueryListEvent) => {
    if (event.matches) close();
  };

  toggle.addEventListener('click', onToggle);
  links.addEventListener('click', onLinksClick);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
  desktop.addEventListener('change', onViewportChange);

  return {
    destroy() {
      toggle.removeEventListener('click', onToggle);
      links.removeEventListener('click', onLinksClick);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeydown);
      desktop.removeEventListener('change', onViewportChange);
    },
  };
}
