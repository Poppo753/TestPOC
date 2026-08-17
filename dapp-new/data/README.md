# Structured data

Active JSON is grouped by ownership and update reason.

| Directory | Responsibility | Main consumers |
|---|---|---|
| `editorial/` | Cross-page language and status principles | Editorial validation |
| `product/` | Horizons, vault taxonomy, roadmap, risk policy and changelog | Homepage and product pages |
| `protocol/` | Deployment, integration registry and trust evidence | Trust Center, hydrator and diagnostics |

Rules:

- keep examples explicitly illustrative;
- keep undecided policy in pending fields;
- do not treat registered integrations as current allocation;
- update deployment JSON together with the executable web3 config;
- run `npm run validate` and `npm run check:product` after changes.
