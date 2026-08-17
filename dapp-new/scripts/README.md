# Scripts

| Directory | Purpose |
|---|---|
| `browser/` | Headless runtime smoke tests and visual capture |
| `diagnostics/` | Read-only Arbitrum deployment and protocol reads |
| `documentation/` | Canonical DOCX/Markdown synchronization |
| `validation/` | Static structure, content, product, Demo, Docs and WebGL gates |

Root scripts:

- `release-readiness.mjs`: composes every static and live gate;
- `serve.ps1`: starts a localhost-only static server.

Use package commands instead of direct paths:

```powershell
npm run validate
npm run check:product
npm run check:demo
npm run check:deployment
npm run inspect:protocols
npm run ready
```

Diagnostics never accept a signer or private key.

## Interactive Demo checks

- `validation/validate-demo.mjs` verifies routes, disclaimers, illustrative
  catalog data, allocation totals and strict separation from Web3.
- `validation/test-demo-engine.mjs` exercises deposit, deterministic growth,
  partial/full withdrawal and rejected operations.
- `browser/demo-smoke.mjs` verifies the rendered page in Chromium.

With a local server running, use
`npm run check:demo:browser -- http://127.0.0.1:<port>`.
