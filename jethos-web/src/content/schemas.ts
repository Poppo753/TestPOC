import { z } from 'astro/zod';

export const contentStatusSchema = z.enum([
  'poc',
  'implemented',
  'validation',
  'planned',
  'vision',
  'illustrative',
  'live',
  'recorded',
  'unavailable',
]);

const versionSchema = z.string().regex(/^\d+\.\d+(?:\.\d+)?$/);
const dateSchema = z.iso.date();
const dateTimeSchema = z.iso.datetime({ offset: true });
const nonEmptyString = z.string().trim().min(1);
const ethereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const siteContentSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    positioning: nonEmptyString,
    messageSystem: z.array(nonEmptyString).min(1),
    principles: z.array(nonEmptyString).min(1),
    statuses: z.record(nonEmptyString, nonEmptyString),
  })
  .strict();

export const changelogSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    entries: z.array(
      z
        .object({
          date: dateSchema,
          title: nonEmptyString,
          type: z.enum(['website', 'documentation', 'experience', 'deployment']),
          changes: z.array(nonEmptyString).min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const productStateSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    horizons: z.array(
      z
        .object({
          id: nonEmptyString,
          label: nonEmptyString,
          title: nonEmptyString,
          status: contentStatusSchema,
          description: nonEmptyString,
        })
        .strict(),
    ),
  })
  .strict();

const policyRecordSchema = z
  .object({ label: nonEmptyString, value: nonEmptyString, state: contentStatusSchema })
  .strict();

export const riskPolicySchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    vaultId: nonEmptyString,
    recordedRules: z.array(policyRecordSchema),
    pendingDecisions: z.array(nonEmptyString),
    illustrativeScenario: z
      .object({
        notice: nonEmptyString,
        opportunities: z.array(
          z
            .object({
              protocol: nonEmptyString,
              nominalApy: nonEmptyString,
              decision: nonEmptyString,
              reason: nonEmptyString,
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const roadmapSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    horizons: z.array(
      z
        .object({
          id: nonEmptyString,
          title: nonEmptyString,
          status: contentStatusSchema,
          description: nonEmptyString,
          exitCriteria: z.array(nonEmptyString).min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const vaultsSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    vaults: z.array(
      z
        .object({
          id: nonEmptyString,
          asset: nonEmptyString,
          profile: z.enum(['Conservative', 'Balanced', 'Advanced']),
          status: contentStatusSchema,
          chain: nonEmptyString.optional(),
          description: nonEmptyString,
        })
        .strict(),
    ),
  })
  .strict();

export const deploymentsSchema = z
  .object({
    schemaVersion: z.literal(1),
    recordedAt: dateTimeSchema,
    source: nonEmptyString,
    deployments: z.array(
      z
        .object({
          id: nonEmptyString,
          status: contentStatusSchema,
          network: nonEmptyString,
          chainId: z.number().int().positive(),
          baseAsset: z
            .object({
              symbol: nonEmptyString,
              address: ethereumAddressSchema,
              decimals: z.number().int().nonnegative(),
            })
            .strict(),
          contracts: z.record(nonEmptyString, ethereumAddressSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const protocolsSchema = z
  .object({
    version: versionSchema,
    recordedAt: dateTimeSchema,
    source: nonEmptyString,
    notice: nonEmptyString,
    protocols: z.array(
      z
        .object({
          id: nonEmptyString,
          name: nonEmptyString,
          kind: nonEmptyString,
          status: contentStatusSchema,
          role: nonEmptyString,
        })
        .strict(),
    ),
  })
  .strict();

export const trustEvidenceSchema = z
  .object({
    version: versionSchema,
    updatedAt: dateSchema,
    deploymentId: nonEmptyString,
    evidence: z.array(
      z
        .object({
          label: nonEmptyString,
          value: nonEmptyString,
          status: contentStatusSchema,
        })
        .strict(),
    ),
    assuranceGates: z.array(
      z
        .object({ title: nonEmptyString, status: nonEmptyString, evidence: nonEmptyString })
        .strict(),
    ),
  })
  .strict();

export const docsManifestSchema = z
  .object({
    version: versionSchema,
    generatedAt: dateTimeSchema,
    source: nonEmptyString,
    documents: z.array(
      z
        .object({
          id: nonEmptyString,
          title: nonEmptyString,
          subtitle: nonEmptyString,
          category: nonEmptyString,
          file: nonEmptyString,
          source: nonEmptyString,
          sourceType: nonEmptyString,
        })
        .strict(),
    ),
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;
export type Changelog = z.infer<typeof changelogSchema>;
export type ProductState = z.infer<typeof productStateSchema>;
export type RiskPolicy = z.infer<typeof riskPolicySchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;
export type VaultCatalogue = z.infer<typeof vaultsSchema>;
export type Deployments = z.infer<typeof deploymentsSchema>;
export type ProtocolCatalogue = z.infer<typeof protocolsSchema>;
export type TrustEvidence = z.infer<typeof trustEvidenceSchema>;
export type DocsManifest = z.infer<typeof docsManifestSchema>;
