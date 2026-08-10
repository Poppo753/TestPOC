import { describe, expect, it } from 'vitest';

import {
  documentDownload,
  documentIdFromLocation,
  documentRoute,
  matchesDocument,
  type DocumentRecord,
} from '../../src/features/docs/model';

const document: DocumentRecord = {
  id: '03',
  title: 'Protocol Architecture',
  subtitle: 'Core, plugin, automation and trust boundaries',
  category: 'Architecture',
  file: '03_Jethos_Protocol_Architecture_v0.1.md',
  source: 'architecture.docx',
  sourceType: 'DOCX synchronized',
};

describe('documentation model', () => {
  it('builds stable standalone and download URLs', () => {
    expect(documentRoute(document.id)).toBe('/pages/docs/03.html');
    expect(documentDownload(document.file)).toBe(
      '/content/docs/03_Jethos_Protocol_Architecture_v0.1.md',
    );
  });

  it('searches across user-facing metadata', () => {
    expect(matchesDocument(document, 'architecture')).toBe(true);
    expect(matchesDocument(document, 'TRUST BOUNDARIES')).toBe(true);
    expect(matchesDocument(document, 'liquidity')).toBe(false);
  });

  it('accepts only canonical two-digit deep-link identifiers', () => {
    expect(documentIdFromLocation(new URL('https://jethos.example/pages/docs.html?doc=03'))).toBe(
      '03',
    );
    expect(
      documentIdFromLocation(new URL('https://jethos.example/pages/docs.html?doc=3')),
    ).toBeNull();
    expect(documentIdFromLocation(new URL('https://jethos.example/pages/docs.html'))).toBeNull();
  });
});
