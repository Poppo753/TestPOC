import { documentIdFromLocation } from './model';
import type { DisposableController } from '../../core/disposable';

const isPlainPrimaryClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

export function mountDocs(root: HTMLElement): DisposableController {
  const search = root.querySelector<HTMLInputElement>('[data-doc-search]');
  const count = root.querySelector<HTMLElement>('[data-doc-count]');
  const entries = [...root.querySelectorAll<HTMLAnchorElement>('[data-doc-entry]')];
  const dialog = root.querySelector<HTMLDialogElement>('[data-doc-dialog]');
  const title = dialog?.querySelector<HTMLElement>('[data-doc-title]');
  const meta = dialog?.querySelector<HTMLElement>('[data-doc-meta]');
  const toc = dialog?.querySelector<HTMLElement>('[data-doc-toc]');
  const body = dialog?.querySelector<HTMLElement>('[data-doc-body]');
  const article = dialog?.querySelector<HTMLElement>('.doc-article');
  const download = dialog?.querySelector<HTMLAnchorElement>('[data-doc-download]');
  const close = dialog?.querySelector<HTMLButtonElement>('[data-doc-close]');
  const controller = new AbortController();
  let request: AbortController | undefined;
  let opener: HTMLElement | null = null;
  let activeId: string | null = null;

  if (!search || !count || !dialog || !title || !meta || !toc || !body || !download || !close) {
    return { destroy: () => controller.abort() };
  }

  const setLoading = () => {
    body.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'doc-loading',
        textContent: 'Loading document…',
      }),
    );
    toc.replaceChildren();
  };

  const closeDialog = (restoreFocus = true) => {
    request?.abort();
    if (dialog.open) dialog.close();
    activeId = null;
    if (restoreFocus) opener?.focus();
  };

  const renderDocument = async (entry: HTMLAnchorElement, updateHistory: boolean) => {
    const id = entry.dataset.docId;
    if (!id || activeId === id) return;

    request?.abort();
    request = new AbortController();
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : entry;
    activeId = id;
    title.textContent = entry.dataset.docTitle ?? 'Document';
    meta.textContent = entry.dataset.docMeta ?? '';
    download.href = entry.dataset.docDownload ?? entry.href;
    download.download = entry.dataset.docFile ?? '';
    setLoading();
    if (!dialog.open) dialog.showModal();

    try {
      const response = await fetch(entry.href, { signal: request.signal });
      if (!response.ok) throw new Error(`Document request failed (${response.status})`);
      const source = new DOMParser().parseFromString(await response.text(), 'text/html');
      const sourceBody = source.querySelector<HTMLElement>('[data-document-body]');
      const sourceToc = source.querySelector<HTMLElement>('[data-document-toc]');
      if (!sourceBody || !sourceToc) throw new Error('Document response is incomplete');

      body.replaceChildren(
        ...[...sourceBody.childNodes].map((node) => document.importNode(node, true)),
      );
      toc.replaceChildren(
        ...[...sourceToc.childNodes].map((node) => document.importNode(node, true)),
      );
      article?.scrollTo({ top: 0 });

      if (updateHistory) {
        const url = new URL(window.location.href);
        url.searchParams.set('doc', id);
        url.hash = '';
        history.pushState({ doc: id }, '', url);
      }

      if (window.location.hash) {
        body.querySelector<HTMLElement>(window.location.hash)?.scrollIntoView({ block: 'start' });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      body.replaceChildren(
        Object.assign(document.createElement('p'), {
          className: 'doc-loading',
          textContent: 'The document could not be loaded. Open the standalone page instead.',
        }),
      );
      const fallback = document.createElement('a');
      fallback.className = 'button button--secondary';
      fallback.href = entry.href;
      fallback.textContent = 'Open document';
      body.append(fallback);
    }
  };

  search.addEventListener(
    'input',
    () => {
      const query = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const entry of entries) {
        const matches = (entry.dataset.docSearch ?? '').includes(query);
        entry.hidden = !matches;
        if (matches) visible += 1;
      }
      count.textContent = String(visible);
    },
    { signal: controller.signal },
  );

  for (const entry of entries) {
    entry.addEventListener(
      'click',
      (event) => {
        if (!(event instanceof MouseEvent) || !isPlainPrimaryClick(event)) return;
        event.preventDefault();
        void renderDocument(entry, true);
      },
      { signal: controller.signal },
    );
  }

  close.addEventListener(
    'click',
    () => {
      if (documentIdFromLocation(new URL(window.location.href))) history.back();
      else closeDialog();
    },
    { signal: controller.signal },
  );
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      if (documentIdFromLocation(new URL(window.location.href))) history.back();
      else closeDialog();
    },
    { signal: controller.signal },
  );
  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) {
        if (documentIdFromLocation(new URL(window.location.href))) history.back();
        else closeDialog();
      }
    },
    { signal: controller.signal },
  );
  toc.addEventListener(
    'click',
    (event) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href*="#"]')
          : null;
      if (!link) return;
      const hash = new URL(link.href).hash;
      if (!hash) return;
      event.preventDefault();
      body.querySelector<HTMLElement>(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const url = new URL(window.location.href);
      url.hash = hash;
      history.replaceState(history.state, '', url);
    },
    { signal: controller.signal },
  );
  window.addEventListener(
    'popstate',
    () => {
      const id = documentIdFromLocation(new URL(window.location.href));
      const entry = entries.find((candidate) => candidate.dataset.docId === id);
      if (entry) void renderDocument(entry, false);
      else closeDialog();
    },
    { signal: controller.signal },
  );

  const initialId = documentIdFromLocation(new URL(window.location.href));
  const initialEntry = entries.find((entry) => entry.dataset.docId === initialId);
  if (initialEntry) void renderDocument(initialEntry, false);

  return {
    destroy() {
      request?.abort();
      controller.abort();
      closeDialog(false);
    },
  };
}
