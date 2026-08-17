import { STATUS_TAXONOMY } from '../config/site-config.js';

const labels = {
  poc: 'Private PoC', live: 'Live data', implemented: 'Implemented', validation: 'In validation',
  planned: 'Planned', vision: 'Vision', illustrative: 'Illustrative', recorded: 'Recorded', unavailable: 'Unavailable',
};

export function statusBadge(status, label = labels[status] || status) {
  const safeStatus = Object.hasOwn(labels, status) ? status : 'unavailable';
  const element = document.createElement('span');
  element.className = `badge badge--${safeStatus}`;
  element.textContent = label;
  return element;
}

export function hydrateStatusBadges(root = document) {
  root.querySelectorAll('[data-status]').forEach((node) => {
    const badge = statusBadge(node.dataset.status, node.textContent.trim() || undefined);
    node.replaceWith(badge);
  });
  root.querySelectorAll('.badge').forEach((badge) => {
    const status = Object.keys(STATUS_TAXONOMY).find((key) => badge.classList.contains(`badge--${key}`));
    if (!status) return;
    badge.title = STATUS_TAXONOMY[status];
    if (!badge.hasAttribute('aria-label')) badge.setAttribute('aria-label', `${badge.textContent.trim()}: ${STATUS_TAXONOMY[status]}`);
  });
}
