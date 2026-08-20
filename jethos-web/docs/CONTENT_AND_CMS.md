# Content and CMS boundary

## Current source of truth

Editorial JSON and Markdown are validated at build time through Astro content collections and strict schemas. Invalid enums, malformed addresses, missing fields or unexpected fields fail the build. During cutover, synchronized legacy sources are additionally protected by SHA-256 parity checks.

## When a CMS is useful

Add a CMS only when non-developers need scheduled publishing, approvals, previews, localization or frequent editorial changes. A CMS does not improve contract configuration, deployment evidence or live protocol data and must never control them.

## Incremental integration

1. Implement `EditorialContentRepository` in a new provider module.
2. Map the provider response through the existing schemas.
3. Select the adapter at build time, with no provider SDK in the browser.
4. Add contract fixtures, preview-environment tests and webhook-triggered builds.
5. Keep the local adapter as fallback and rollback source.

Sanity, Contentful or a Git-based CMS can all fit this boundary. Choose from editorial workflow and hosting requirements, not component architecture. Store provider tokens only in CI/hosting secrets; expose no write token to the static client.

## Ownership model

- Editorial team: copy, FAQ, roadmap narrative and changelog drafts.
- Engineering/risk review: schemas, allowed statuses and financial wording.
- Protocol operations: deployments, addresses, registries and trust evidence in reviewed Git changes.
- CI: validation and immutable artifact generation.
