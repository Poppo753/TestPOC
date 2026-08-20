import { renderMarkdown } from './markdown-renderer.js';

const manifestUrl = new URL('../../../content/docs/manifest.json', import.meta.url);
const catalog = document.querySelector('[data-doc-catalog]');
const search = document.querySelector('[data-doc-search]');
const count = document.querySelector('[data-doc-count]');
const dialog = document.querySelector('[data-doc-dialog]');
const viewerTitle = document.querySelector('[data-doc-title]');
const viewerMeta = document.querySelector('[data-doc-meta]');
const viewerBody = document.querySelector('[data-doc-body]');
const viewerToc = document.querySelector('[data-doc-toc]');
const download = document.querySelector('[data-doc-download]');
const closeButton = document.querySelector('[data-doc-close]');
let manifest; let activeId; let opener;

function documentUrl(file) { return new URL(`../../../content/docs/${file}`, import.meta.url); }

function buttonFor(documentRecord) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'doc-entry';
  button.dataset.docId = documentRecord.id; button.dataset.search = `${documentRecord.id} ${documentRecord.title} ${documentRecord.subtitle} ${documentRecord.category}`.toLowerCase();
  const category = document.createElement('span'); category.className = 'badge badge--planned'; category.textContent = documentRecord.category;
  const copy = document.createElement('span'); copy.className = 'doc-entry__copy';
  const title = document.createElement('strong'); title.textContent = documentRecord.title;
  const description = document.createElement('span'); description.textContent = documentRecord.subtitle;
  copy.append(title, description);
  const number = document.createElement('code'); number.textContent = documentRecord.id;
  button.append(category, copy, number); button.addEventListener('click', () => openDocument(documentRecord.id, { push: true, opener: button })); return button;
}

function renderCatalog(documents) {
  catalog.replaceChildren(...documents.map(buttonFor)); count.textContent = String(documents.length);
}

function renderToc(items) {
  viewerToc.replaceChildren();
  items.filter((item) => item.level > 1).forEach((item) => {
    const link = document.createElement('a'); link.href = `#${item.id}`; link.textContent = item.label; link.className = `doc-toc__level-${item.level}`;
    link.addEventListener('click', (event) => { event.preventDefault(); viewerBody.querySelector(`#${CSS.escape(item.id)}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
    viewerToc.append(link);
  });
}

async function openDocument(id, { push = false, opener: source } = {}) {
  const record = manifest.documents.find((item) => item.id === String(id).padStart(2, '0')); if (!record) return;
  opener = source || document.activeElement; activeId = record.id;
  viewerTitle.textContent = record.title; viewerMeta.textContent = `${record.category} · ${record.sourceType}`;
  viewerBody.innerHTML = '<p class="doc-loading">Loading document…</p>'; viewerToc.replaceChildren();
  download.href = documentUrl(record.file).href; download.download = record.file;
  if (!dialog.open) dialog.showModal();
  if (push) history.pushState({ doc: record.id }, '', `${location.pathname}?doc=${encodeURIComponent(record.id)}`);
  try {
    const response = await fetch(documentUrl(record.file), { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rendered = renderMarkdown(await response.text());
    if (activeId !== record.id) return;
    viewerBody.innerHTML = rendered.html; renderToc(rendered.toc); viewerBody.scrollTop = 0;
  } catch (error) {
    viewerBody.innerHTML = `<div class="callout callout--warning"><strong>Document unavailable.</strong><p>The Markdown source could not be loaded (${String(error.message).replace(/[<>&]/g, '')}). Serve the site over HTTP and run <code>npm run sync:docs</code>.</p></div>`;
  }
}

function closeDocument({ historyBack = true } = {}) {
  if (!dialog.open) return; dialog.close(); activeId = null;
  if (historyBack && new URLSearchParams(location.search).has('doc')) history.back();
  else opener?.focus?.();
}

closeButton.addEventListener('click', () => closeDocument());
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDocument(); });
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDocument(); });
dialog.addEventListener('close', () => { if (!activeId) opener?.focus?.(); });
search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase(); let visible = 0;
  catalog.querySelectorAll('.doc-entry').forEach((entry) => { const match = !query || entry.dataset.search.includes(query); entry.hidden = !match; if (match) visible += 1; }); count.textContent = String(visible);
});
addEventListener('popstate', (event) => {
  const id = event.state?.doc || new URLSearchParams(location.search).get('doc');
  if (id) openDocument(id); else if (dialog.open) { activeId = null; dialog.close(); }
});

try {
  const response = await fetch(manifestUrl, { credentials: 'same-origin' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  manifest = await response.json(); renderCatalog(manifest.documents);
  const requested = new URLSearchParams(location.search).get('doc'); if (requested) openDocument(requested);
} catch (error) {
  catalog.innerHTML = `<div class="callout callout--warning"><strong>Documentation catalog unavailable.</strong><p>Run <code>npm run sync:docs</code> and serve the site over HTTP.</p></div>`;
}

