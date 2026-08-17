# Architecture

## Runtime model

Astro is used as a static compiler, not as a client application framework. Every route ships complete HTML. Vanilla TypeScript is loaded only where navigation, a feature, WebGL, the simulated Demo, or the PoC console needs behavior.

The dependency direction is deliberate:

```text
pages/layouts -> components/design-system -> feature controllers -> domain/core
                                      content repository <- local adapter / future CMS adapter
                                      protocol evidence <- versioned technical data only
```

Feature folders own their model, view and controller. Controllers expose a mount/cleanup lifecycle and never rely on hidden cross-feature state. Shared code belongs in `src/core` only after it has more than one genuine consumer.

## UI composition

The design system uses practical levels rather than a ceremonial atomic tree:

- foundations: tokens, typography, motion and reset;
- primitives: Button, Badge, Icon and Eyebrow;
- composition: Container, Stack, Cluster, Grid, Split and Section;
- components: Card, Metric, DataRow and Callout;
- patterns: PageHero, FinalCta, FAQ, tables, timelines and evidence structures;
- page sections: domain-specific Astro compositions.

A component is extracted when it has a stable responsibility or at least two real consumers. Page-specific markup remains local. This avoids both HTML duplication and generic components with dozens of unrelated props.

## Data boundaries

`EditorialContentRepository` is the CMS seam. A future provider implements that interface and maps remote records through the existing strict schemas. `ProtocolEvidenceRepository` is separate by design: deployments, contract addresses and trust evidence remain reviewed, versioned build inputs and must not be editable by a general-purpose CMS.

The migration parity bridge under `src/styles/legacy` and selected legacy feature sources is hash-verified by `npm run check:parity`. It is an explicit compatibility boundary, not an accidental second architecture.

## Client boundaries

- Home: independent feature controllers mounted by one bootstrap.
- WebGL: dynamic import, quality selection and authored static fallback; Three.js is never route-critical.
- Demo: deterministic local domain and schema-versioned browser storage; no wallet or RPC.
- App: public read adapter, explicit wallet session and guarded transaction workflows; ethers is dynamically imported only on `/app.html`.
- Docs: Markdown compiled at build time; dialog behavior enhances complete static document routes.

## Architecture decisions

- Static Astro preserves the existing deployment model while removing repeated shells and runtime HTML generation.
- No SPA router: legacy `.html` URLs, native history, deep links and no-JS content remain intact.
- No React/Svelte runtime: current state complexity is local and does not justify a second rendering model.
- No client password: preview protection belongs at the hosting edge.
- CMS is optional and incremental; the local adapter remains a valid production source.
