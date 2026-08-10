import { getEntry } from 'astro:content';
import { z } from 'astro/zod';

import type { EditorialContentRepository, ProtocolEvidenceRepository } from './repository-contract';
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
} from './schemas';

async function requiredEntry<Schema extends z.ZodType>(
  collection: Parameters<typeof getEntry>[0],
  id: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const entry = await getEntry(collection, id);
  if (!entry) throw new Error(`Required content entry missing: ${collection}/${id}`);
  return schema.parse(entry.data);
}

export const editorialContentRepository: EditorialContentRepository = {
  getSiteContent: () => requiredEntry('siteContent', 'site', siteContentSchema),
  getChangelog: () => requiredEntry('changelog', 'changelog', changelogSchema),
  getProductState: () => requiredEntry('productState', 'product-state', productStateSchema),
  getRiskPolicy: () => requiredEntry('riskPolicy', 'risk-policy', riskPolicySchema),
  getRoadmap: () => requiredEntry('roadmap', 'roadmap', roadmapSchema),
  getVaultCatalogue: () => requiredEntry('vaults', 'vaults', vaultsSchema),
  getDocsManifest: () => requiredEntry('docsManifest', 'manifest', docsManifestSchema),
};

export const protocolEvidenceRepository: ProtocolEvidenceRepository = {
  getDeployments: () => requiredEntry('deployments', 'deployments', deploymentsSchema),
  getProtocols: () => requiredEntry('protocols', 'protocols', protocolsSchema),
  getTrustEvidence: () => requiredEntry('trustEvidence', 'trust-evidence', trustEvidenceSchema),
};
