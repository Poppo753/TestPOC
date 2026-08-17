import type { DocsManifest } from '../../content/schemas';

export type DocumentRecord = DocsManifest['documents'][number];

export function documentRoute(id: string): string {
  return `/pages/docs/${encodeURIComponent(id)}.html`;
}

export function documentDownload(file: string): string {
  return `/content/docs/${encodeURIComponent(file)}`;
}

export function matchesDocument(document: DocumentRecord, query: string): boolean {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return true;

  return [document.id, document.title, document.subtitle, document.category]
    .join(' ')
    .toLocaleLowerCase()
    .includes(search);
}

export function documentIdFromLocation(url: URL): string | null {
  const id = url.searchParams.get('doc')?.trim();
  return id && /^\d{2}$/u.test(id) ? id : null;
}
