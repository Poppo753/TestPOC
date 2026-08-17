# Jethos Web

Production-oriented static rebuild of Jethos. Astro 7 compiles complete HTML; strict TypeScript and small vanilla controllers provide progressive enhancement. There is no client framework, SPA router, runtime CDN, client credential or npm dependency shared with the Hardhat project.

## Requirements and start

- Node.js 22.12 or newer
- npm from the matching Node installation
- Edge/Chromium for browser tests

```powershell
npm ci
npm run dev
```

The app runs at `http://localhost:4321`. Important routes are `/index.html`, `/pages/docs.html`, `/demo/index.html` and `/app.html`.

## Commands

| Command                | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Local Astro development server                            |
| `npm run check`        | Astro and TypeScript diagnostics                          |
| `npm run lint`         | ESLint for Astro, TypeScript and scripts                  |
| `npm run format:check` | Prettier verification                                     |
| `npm run test`         | Vitest unit/integration suite                             |
| `npm run test:e2e`     | Playwright desktop/mobile matrix                          |
| `npm run check:parity` | Read-only SHA-256 check of migration sources              |
| `npm run sync:legacy`  | Explicitly refresh controlled copies from `../dapp-new`   |
| `npm run build`        | Static artifact plus route/security/budget/manifest gates |
| `npm run verify`       | Complete non-browser quality gate                         |

`dist/` is the only deployable directory. The build must finish with 34 required routes, generated security headers, passing performance budgets and `release-manifest.json`.

## Project map

```text
src/
  components/       shared shell, app and Home compositions
  config/           typed navigation, routes and product configuration
  content/          schemas and local/CMS repository contracts
  core/             lifecycle, formatting and reusable browser infrastructure
  design-system/    foundations, primitives, composition, components, patterns
  features/         vertical slices for Home, Docs, WebGL, Demo and App
  layouts/          static page shells
  pages/            URL-compatible Astro entry points
  styles/legacy/    explicit hash-verified visual parity bridge
scripts/            parity, artifact, CSP, budget and release gates
tests/unit/         pure domain and contract tests
tests/e2e/          real-browser behavior, axe and visual review
```

Use the smallest suitable abstraction: foundation → primitive → composition → component → reusable pattern → page section. Feature state remains inside its vertical slice. Protocol/deployment evidence is isolated from editorial content.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing and quality gates](docs/TESTING.md)
- [Content and CMS boundary](docs/CONTENT_AND_CMS.md)
- [Deployment and rollback](docs/DEPLOYMENT.md)
- migration decisions, checklist and implementation log: `../docs/New_Doc/1_Documentation/8. Web Site/8. Enterprise_Astro_02.08.26/`

The legacy implementation in `../dapp-new/` remains available as the visual/source baseline until the production cutover is approved. Do not deploy both roots under the same public origin.
