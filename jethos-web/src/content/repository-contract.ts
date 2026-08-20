import type {
  Changelog,
  Deployments,
  DocsManifest,
  ProductState,
  ProtocolCatalogue,
  RiskPolicy,
  Roadmap,
  SiteContent,
  TrustEvidence,
  VaultCatalogue,
} from './schemas';

export interface EditorialContentRepository {
  getSiteContent(): Promise<SiteContent>;
  getChangelog(): Promise<Changelog>;
  getProductState(): Promise<ProductState>;
  getRiskPolicy(): Promise<RiskPolicy>;
  getRoadmap(): Promise<Roadmap>;
  getVaultCatalogue(): Promise<VaultCatalogue>;
  getDocsManifest(): Promise<DocsManifest>;
}

export interface ProtocolEvidenceRepository {
  getDeployments(): Promise<Deployments>;
  getProtocols(): Promise<ProtocolCatalogue>;
  getTrustEvidence(): Promise<TrustEvidence>;
}
