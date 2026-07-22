/** Accessible, dependency-free line icons. Text remains the semantic source. */
const paths = {
  wallet: ['M3 7.5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a2.5 2.5 0 0 1 2.5-2.5H18', 'M16 12h5v4h-5a2 2 0 1 1 0-4Z'],
  vault: ['M4 8h16v12H4z', 'M7 8V5h10v3M8 12h8M8 16h5'],
  send: ['M4 12 20 4l-6 16-3-7-7-1Z', 'm11 1 5-5'],
  ledger: ['M5 3h14v18H5z', 'M8 8h8M8 12h8M8 16h5'],
};

export function createIcon(name, label = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const data of paths[name] || paths.ledger) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', data); svg.append(path); }
  return svg;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => { node.replaceChildren(createIcon(node.dataset.icon)); });
}

