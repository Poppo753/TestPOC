# Deployment and rollback

## Build contract

Use Node 22.12 or newer:

```powershell
npm ci
npm audit --audit-level=high
npm run verify
npm run test:e2e
```

Deploy only `dist/`. The build emits exact legacy-compatible `.html` paths, `_headers`, and `release-manifest.json`. The manifest contains the byte size and SHA-256 of every other artifact file and is deterministic for identical source/dependency inputs.

## Hosting requirements

- serve files from the domain root;
- honor `dist/_headers` or translate every directive to the platform header configuration;
- serve `/demo/index.html` exactly;
- do not rewrite all routes to `index.html`;
- protect non-public preview environments with Cloudflare Access, Vercel Deployment Protection or equivalent edge authentication;
- never reintroduce a password or secret in browser JavaScript;
- allow outbound browser reads only to the declared Arbitrum RPC unless configuration is deliberately changed and reviewed.

The `_headers` format is directly understood by Cloudflare Pages and Netlify-style hosts. On another platform, copy the CSP, cache, referrer, permissions and anti-framing policies into its native configuration.

## Release procedure

1. Build and test from the intended commit with a clean install.
2. Archive `dist/` as an immutable artifact and retain its manifest.
3. Deploy to a protected preview URL.
4. Smoke `/index.html`, `/pages/docs.html`, `/demo/index.html` and `/app.html`; verify one nested document and one legacy redirect.
5. Compare the preview manifest with the archived artifact.
6. Promote by switching the hosting alias/domain to that immutable deployment.
7. Monitor static errors, CSP reports if configured, RPC failure rate and wallet-flow client errors.

No database migration or server state is involved. Demo browser data is local, schema-versioned illustrative state; it is not part of deployment.

## Rollback

1. Select the previous known-good immutable artifact/deployment.
2. Verify its stored `release-manifest.json`.
3. switch the domain alias back; do not rebuild the old commit during an incident;
4. smoke the four representative routes and the compatibility redirects;
5. record the failed manifest, symptom and rollback deployment.

Keep at least the previous two production artifacts. Because URLs and output format are stable, rollback is an atomic hosting switch rather than a code/data migration.
