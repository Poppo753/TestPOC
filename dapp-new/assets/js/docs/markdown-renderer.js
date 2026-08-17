/**
 * Small, dependency-free Markdown renderer for the authored documentation pack.
 * Raw HTML is always escaped; only explicitly generated markup is returned.
 */
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function slugify(value, used) {
  const base = value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  const count = used.get(base) || 0; used.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function inline(source) {
  const code = [];
  let value = escapeHtml(source).replace(/`([^`]+)`/g, (_, content) => { code.push(`<code>${content}</code>`); return `\u0000${code.length - 1}\u0000`; });
  value = value
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safe = /^(https?:\/\/|#|\.\.?\/)/i.test(href) ? href : '#';
      const external = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(safe)}"${external}>${label}</a>`;
    });
  return value.replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]);
}

const isBoundary = (line, next) => !line.trim() || /^#{1,6}\s|^```|^>|^[-*+]\s|^\d+\.\s|^---+$/.test(line.trim()) || (next && /^\s*\|?\s*:?-{3,}/.test(next));

export function renderMarkdown(markdown) {
  const lines = String(markdown).replaceAll('\r\n', '\n').split('\n');
  const html = []; const toc = []; const used = new Map();
  let index = 0;
  while (index < lines.length) {
    const raw = lines[index]; const line = raw.trim();
    if (!line) { index += 1; continue; }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim(); const buffer = []; index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) { buffer.push(lines[index]); index += 1; }
      index += 1; html.push(`<pre><code data-language="${escapeHtml(language)}">${escapeHtml(buffer.join('\n'))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length; const label = heading[2].replace(/[*_`]/g, ''); const id = slugify(label, used);
      html.push(`<h${level} id="${id}">${inline(heading[2])}<a class="doc-anchor" href="#${id}" aria-label="Link to ${escapeHtml(label)}">#</a></h${level}>`);
      if (level <= 3) toc.push({ id, label, level }); index += 1; continue;
    }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const rows = []; const parseRow = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      rows.push(parseRow(raw)); index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(parseRow(lines[index])); index += 1; }
      html.push('<div class="doc-table-wrap"><table><thead><tr>' + rows[0].map((cell) => `<th>${inline(cell)}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(1).map((row) => '<tr>' + row.map((cell) => `<td>${inline(cell)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    if (/^>/.test(line)) {
      const buffer = [];
      while (index < lines.length && /^>/.test(lines[index].trim())) { buffer.push(lines[index].trim().replace(/^>\s?/, '')); index += 1; }
      html.push(`<blockquote>${buffer.map((part) => inline(part)).join('<br>')}</blockquote>`); continue;
    }
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*+]\s/.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^[-*+]\s/, '')); index += 1; }
      html.push('<ul>' + items.map((item) => `<li>${inline(item)}</li>`).join('') + '</ul>'); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^\d+\.\s/, '')); index += 1; }
      html.push('<ol>' + items.map((item) => `<li>${inline(item)}</li>`).join('') + '</ol>'); continue;
    }
    if (/^---+$/.test(line)) { html.push('<hr>'); index += 1; continue; }
    const paragraph = [line]; index += 1;
    while (index < lines.length && !isBoundary(lines[index], lines[index + 1])) { paragraph.push(lines[index].trim()); index += 1; }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return { html: html.join('\n'), toc };
}

