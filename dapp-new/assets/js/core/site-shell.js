import { SITE } from '../config/site-config.js';
import { initNavigation } from './navigation.js';
import { initReveal } from './reveal.js';
import { requireAuthentication } from './auth-gate.js';

await requireAuthentication();

const root = document.documentElement.dataset.root || '.';
const page = document.body.dataset.page || '';
const resolve = (path) => `${root}/${path}`;

function node(tag, { className, text, attributes = {} } = {}) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  Object.entries(attributes).forEach(([name, value]) => result.setAttribute(name, value));
  return result;
}

function brandLink() {
  const brand = node('a', { className: 'brand', attributes: { href: resolve('index.html'), 'aria-label': 'Jethos home' } });
  brand.append(node('img', { className: 'brand-mark', attributes: { src: resolve('assets/brand/jethos-mark.svg'), alt: '' } }), node('span', { text: SITE.name }));
  return brand;
}

function renderHeader() {
  const target = document.querySelector('[data-site-header]');
  if (!target) return;
  const skip = node('a', { className: 'skip-link', text: 'Skip to content', attributes: { href: '#main-content' } });
  const header = node('header', { className: 'site-header' });
  const nav = node('nav', { className: 'site-nav container', attributes: { 'aria-label': 'Primary navigation' } });
  const toggle = node('button', { className: 'nav-toggle', attributes: { type: 'button', 'data-nav-toggle': '', 'aria-expanded': 'false', 'aria-controls': 'primary-links' } });
  toggle.append(node('span', { text: '☰', attributes: { 'aria-hidden': 'true' } }), node('span', { className: 'sr-only', text: 'Open menu' }));
  const links = node('div', { className: 'nav-links', attributes: { id: 'primary-links', 'data-nav-links': '', 'data-open': 'false' } });
  SITE.navigation.forEach(([id, path, label]) => {
    const link = node('a', { text: label, attributes: { href: resolve(path) } });
    if (page === id) link.setAttribute('aria-current', 'page');
    links.append(link);
  });
  const demoLink = node('a', { className: 'button button--primary', text: 'Try demo', attributes: { href: resolve('demo/index.html') } });
  if (page === 'demo') demoLink.setAttribute('aria-current', 'page');
  links.append(demoLink);
  nav.append(brandLink(), toggle, links); header.append(nav); target.replaceChildren(skip, header);
}

function renderFooter() {
  const target = document.querySelector('[data-site-footer]');
  if (!target) return;
  const footer = node('footer', { className: 'site-footer' });
  const grid = node('div', { className: 'container footer-grid' });
  const intro = node('div');
  intro.append(brandLink(), node('p', { className: 'muted footer-positioning', text: 'A self-custodial financial experience built around explicit ownership, visible routes and verifiable DeFi.' }));
  grid.append(intro);
  SITE.footer.forEach(([title, entries]) => {
    const column = node('div');
    const list = node('div', { className: 'footer-links' });
    entries.forEach(([label, path]) => list.append(node('a', { text: label, attributes: { href: resolve(path) } })));
    column.append(node('strong', { text: title }), list); grid.append(column);
  });
  footer.append(grid, node('div', { className: 'container muted footer-disclaimer', text: SITE.disclaimer }));
  target.replaceChildren(footer);
}

renderHeader();
renderFooter();
initNavigation();
initReveal();
