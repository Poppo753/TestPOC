export function initNavigation() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('[data-nav-links]');
  if (!toggle || !links) return;

  const close = () => {
    links.dataset.open = 'false';
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const isOpen = links.dataset.open === 'true';
    links.dataset.open = String(!isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });
  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', (event) => {
    if (links.dataset.open !== 'true') return;
    if (links.contains(event.target) || toggle.contains(event.target)) return;
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      toggle.focus();
    }
  });
  addEventListener('resize', () => {
    if (innerWidth > 1060) close();
  });
}
