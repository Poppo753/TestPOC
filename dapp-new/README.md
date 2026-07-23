# Jethos website and PoC console

This directory contains the public multi-page Jethos website and a separate,
`noindex` console for the private Arbitrum USDC proof of concept.

## Run locally

From this directory:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. Do not open pages directly with `file://` because
ES modules, JSON and remote dependencies require an HTTP origin.

Every active page currently uses the lightweight private-preview gate. The
username and password are both `Poppo753`; authentication lasts for the current
browser tab. This is client-side access friction, not protection for secret or
confidential files. Production privacy requires authentication at the hosting
or server layer.

## Structure

The local `package.json` declares ES-module semantics and exposes read-only
maintenance commands. It introduces no site-specific dependency installation.

```text
index.html                 public landing
app.html                   private PoC console
pages/                     informational pages
assets/css/                local design system
assets/js/core/            shared shell and utilities
assets/js/config/          cross-page navigation and status taxonomy
assets/js/components/      reusable UI behavior
assets/js/features/        editorial enhancements
assets/js/docs/            safe Markdown renderer and documentation viewer
assets/js/webgl/           optional 3D engine, scenes and accessible bridges
assets/js/app/             PoC console orchestration, forms and renderers
assets/js/web3/            deployment, readers and transaction workflows
data/                      structured editorial/deployment records
content/docs/              synchronized, web-readable documentation pack
scripts/                   validation and read-only operational diagnostics
```

## Validate and inspect

No dependency installation is required for these commands. Node.js 20 or newer
is recommended.

```powershell
npm run validate
npm run check:content
npm run check:webgl
npm run check:docs
npm run check:deployment
npm run inspect:protocols
npm run ready
```

The two diagnostic commands only perform RPC reads against the configured
Arbitrum deployment. Machine-readable output is available with:

```powershell
npm run check:deployment -- --json
npm run inspect:protocols -- --json
```

They never request a signer, private key or token approval. Consumer write
operations remain limited to the browser console and pass through the Jethos
core contracts; plugins are inspected but are not exposed as arbitrary write
targets.

`npm run ready` executes static validation, the editorial contract, the WebGL
manifest, the documentation reader and both live diagnostics as one release gate. Passing it is useful operational
evidence, but is not an audit or authorization to publish a financial product.

## Dynamic documentation

The Docs page builds its searchable catalog from `content/docs/manifest.json`
and opens each Markdown document in an in-site reader with a section index,
deep links and an optional `.md` download. The canonical pack remains in
`docs/New_Doc/1_Documentation/jethos_docs_v0_1/`; it is never edited by the
website.

After changing a source DOCX or Markdown file, synchronize and validate it:

```powershell
npm run sync:docs
npm run check:docs
```

The synchronization requires Microsoft Word for semantic DOCX conversion. With
a local server on port 4173, the runtime smoke test is:

```powershell
npm run check:docs:browser -- http://127.0.0.1:4173
```

## Contained WebGL2 enhancement

Only Home, How it works, Protocol and Roadmap declare a scene and one authored
`data-webgl-host`. Each page has a separate scene factory and renders a fixed,
full-viewport background behind its normal content. Three.js is imported only
for those four pages, from the pinned jsDelivr URL declared by
`assets/js/webgl/scene-manifest.js`. The HTML/CSS experience remains complete
when the CDN, GPU or animation preference disables the enhancement. The PoC and
editorial pages never mount a renderer.

Use `?webgl=off`, `?webgl=low`, `?webgl=medium` or `?webgl=high` for local
fallback and quality testing. Canvas elements are decorative; all controls are
normal HTML elements and remain keyboard accessible.

With a local server running on port 4173, validate the real browser runtime and
capture review frames with:

```bash
npm run check:webgl:browser -- http://127.0.0.1:4173
npm run capture:webgl -- http://127.0.0.1:4173 ./webgl-review
```

Legacy URLs (`landing.html`, `documentation.html`, `config.html` and
`portfolio.html`) are compatibility redirects.

Legacy files such as the former `src/`, root `main.js`, API-reference JSON,
old plugin/roadmap JSON and the background video are retained for historical
comparison but are not referenced by the new entry points.

## Safety model

- Public pages work without a wallet.
- Wallet connection occurs only after a user click.
- The app targets one explicit deployment in
  `assets/js/web3/deployment-config.js`.
- Users interact through LiquidityManager, not directly with plugins.
- Approvals use the exact requested USDC amount and can be revoked.
- Estimates are clearly identified and do not guarantee execution.
- No private key or secret belongs in this directory.

## Updating the deployment

Do not replace addresses individually from memory. Start from a verified
deployment manifest, update `data/deployments.json` and
`assets/js/web3/deployment-config.js`, then validate bytecode, ABI reads and the
complete deposit/withdraw flow on a safe fork before enabling writes.

Full implementation and script guides are stored in:

`docs/New_Doc/1_Documentation/8. Web Site/1. First_23.07.26/`

Second-iteration audit and guides are stored in:

`docs/New_Doc/1_Documentation/8. Web Site/2. Second_23.07.26/`

Third-iteration product audit and guides are stored in:

`docs/New_Doc/1_Documentation/8. Web Site/3. Third_23.07.26/`

WebGL architecture, scene and maintenance guides are stored in:

`docs/New_Doc/1_Documentation/8. Web Site/4. WebGL_23.07.26/`

The corrected contained-WebGL2 implementation, critical review, consolidated
checklist, Blender pipeline and verification evidence are stored in:

`docs/New_Doc/1_Documentation/8. Web Site/5. WebGL2_23.07.26/`
