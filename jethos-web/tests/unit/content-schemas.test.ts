import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  changelogSchema,
  deploymentsSchema,
  docsManifestSchema,
  productStateSchema,
  protocolsSchema,
  riskPolicySchema,
  roadmapSchema,
  siteContentSchema,
  trustEvidenceSchema,
  vaultsSchema,
} from '../../src/content/schemas';

const fixtures = [
  ['data/editorial/site-content.json', siteContentSchema],
  ['data/product/changelog.json', changelogSchema],
  ['data/product/product-state.json', productStateSchema],
  ['data/product/risk-policy.json', riskPolicySchema],
  ['data/product/roadmap.json', roadmapSchema],
  ['data/product/vaults.json', vaultsSchema],
  ['data/protocol/deployments.json', deploymentsSchema],
  ['data/protocol/protocols.json', protocolsSchema],
  ['data/protocol/trust-evidence.json', trustEvidenceSchema],
  ['docs/manifest.json', docsManifestSchema],
] as const;

const readJson = async (relativePath: string) => {
  const url = new URL(`../../src/content/${relativePath}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as unknown;
};

describe('content contracts', () => {
  it.each(fixtures)('accepts the synchronized source %s', async (path, schema) => {
    expect(schema.safeParse(await readJson(path)).success).toBe(true);
  });

  it('rejects an incomplete vault catalogue', () => {
    const invalid = {
      version: '1.0.0',
      updatedAt: '2026-07-23',
      vaults: [{ id: 'missing-contract', asset: 'USDC', profile: 'Conservative', status: 'poc' }],
    };

    expect(vaultsSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects malformed deployment addresses', () => {
    const invalid = {
      schemaVersion: 1,
      recordedAt: '2026-07-14T17:29:00.000Z',
      source: 'fixture.json',
      deployments: [
        {
          id: 'invalid',
          status: 'poc',
          network: 'Arbitrum One',
          chainId: 42161,
          baseAsset: { symbol: 'USDC', address: '0x1234', decimals: 6 },
          contracts: { vault: '0x1234' },
        },
      ],
    };

    expect(deploymentsSchema.safeParse(invalid).success).toBe(false);
  });
});
