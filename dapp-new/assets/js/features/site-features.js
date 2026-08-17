import { hydrateStatusBadges } from '../components/status-badge.js';
import { hydrateStructuredFacts } from './data-hydrator.js';
import { hydrateIcons } from '../components/icon.js';
import { initWebGLExperience } from '../webgl/bootstrap.js';

/** Small, non-essential enhancements shared by editorial pages. */
hydrateStatusBadges();
hydrateIcons();
hydrateStructuredFacts().finally(() => document.dispatchEvent(new CustomEvent('jethos:data-hydrated')));
initWebGLExperience();

document.querySelectorAll('[data-disclosure-button]').forEach((button) => {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  if (!panel) return;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
});
