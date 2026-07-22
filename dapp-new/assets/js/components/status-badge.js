const labels = {
  poc: 'Private PoC', live: 'Live data', implemented: 'Implemented', validation: 'In validation',
  planned: 'Planned', vision: 'Vision', illustrative: 'Illustrative', unavailable: 'Unavailable',
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
}

