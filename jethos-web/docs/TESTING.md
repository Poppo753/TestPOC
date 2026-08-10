# Testing and quality gates

## Local gates

Run `npm run verify` before opening a pull request. It checks legacy source parity, Astro/TypeScript, ESLint, formatting, 50 unit/integration tests, the static build, 34 required routes, security headers, performance budgets and the SHA-256 release manifest.

Run `npm run test:e2e` after installing Edge through Playwright. The 108-case matrix covers desktop and mobile routing, shell, accessibility, keyboard/focus behavior, reduced motion, all Home features, Docs, Demo, WebGL fallback/ready states and App wallet/RPC failure paths. Four mobile visual-artifact cases are intentionally skipped because the review artifact is fixed to a deterministic desktop viewport.

## Visual review

Baselines are under `../dapp-new/artifacts/enterprise-baseline/`; target captures are under `artifacts/enterprise-final/`. The review pages are Home, Docs, Demo and App at 1395 px with reduced motion. WebGL correctness is tested as deterministic static/fallback state; GPU pixels are not used as a release oracle.

Visual parity means same information architecture, content, states, spacing system and responsive behavior. Font rasterization, RPC timestamps and GPU frames are environment-dependent and are reviewed, not blindly accepted by pixel threshold.

## Budgets

`scripts/check-performance-budgets.mjs` enforces:

- largest JS chunk: 768 KiB raw;
- all JS: 1,400 KiB raw;
- largest CSS file: 128 KiB raw;
- all CSS: 180 KiB raw;
- largest HTML document: 64 KiB raw.

The current largest chunk is the lazy Three.js runtime. Editorial pages are checked not to reference the optional Three.js or Demo controller chunks.

## CI

`.github/workflows/jethos-web-ci.yml` runs install, audit, verify and the browser matrix on relevant changes, then retains build/review artifacts for 14 days. CI has read-only repository permissions and cancels superseded runs on the same ref.
