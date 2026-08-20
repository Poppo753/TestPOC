import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
} from './content/schemas';

const singleton = (path: string, id: string) =>
  file(path, {
    parser: (text) => ({ [id]: JSON.parse(text) as Record<string, unknown> }),
  });

const siteContent = defineCollection({
  loader: singleton('./src/content/data/editorial/site-content.json', 'site'),
  schema: siteContentSchema,
});
const changelog = defineCollection({
  loader: singleton('./src/content/data/product/changelog.json', 'changelog'),
  schema: changelogSchema,
});
const productState = defineCollection({
  loader: singleton('./src/content/data/product/product-state.json', 'product-state'),
  schema: productStateSchema,
});
const riskPolicy = defineCollection({
  loader: singleton('./src/content/data/product/risk-policy.json', 'risk-policy'),
  schema: riskPolicySchema,
});
const roadmap = defineCollection({
  loader: singleton('./src/content/data/product/roadmap.json', 'roadmap'),
  schema: roadmapSchema,
});
const vaults = defineCollection({
  loader: singleton('./src/content/data/product/vaults.json', 'vaults'),
  schema: vaultsSchema,
});
const deployments = defineCollection({
  loader: singleton('./src/content/data/protocol/deployments.json', 'deployments'),
  schema: deploymentsSchema,
});
const protocols = defineCollection({
  loader: singleton('./src/content/data/protocol/protocols.json', 'protocols'),
  schema: protocolsSchema,
});
const trustEvidence = defineCollection({
  loader: singleton('./src/content/data/protocol/trust-evidence.json', 'trust-evidence'),
  schema: trustEvidenceSchema,
});
const docsManifest = defineCollection({
  loader: singleton('./src/content/docs/manifest.json', 'manifest'),
  schema: docsManifestSchema,
});
const documents = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/docs',
    generateId: ({ entry }) => entry.replace(/\.md$/u, ''),
  }),
  schema: z.object({}).strict(),
});

export const collections = {
  siteContent,
  changelog,
  productState,
  riskPolicy,
  roadmap,
  vaults,
  deployments,
  protocols,
  trustEvidence,
  docsManifest,
  documents,
};
