# Suite script operativa

La cartella attiva contiene solo codice corrente e riusabile. `legacy/` conserva senza cancellazioni gli script storici; non deve essere usata come sorgente operativa.

Entry point unico:

```powershell
$env:HARDHAT_NETWORK="hardhat"
npx ts-node scripts/cli.ts status --manifest deployments/local.json
```

Le mutazioni sono simulate di default, anche quando viene fornito `--execute=true`. Solo la combinazione esplicita `--execute=true --dry-run=false` invia realmente le transazioni. `--encode-only=true --caller 0x...` produce un `ExecutionPlan` serializzabile senza signer. Importi e valori monetari sono sempre unità intere on-chain, mai numeri decimali JavaScript.

Comandi: `status`, `health`, `positions`, `position`, `deposit`, `withdraw`, `swap`, `protocol-action`, `update-beacon`, `core-policy`, `protocol-register`, `protocol-update`, `protocol-status`, `protocol-selectors`, `token-config`, `token-remove`, `registry-aave`, `registry-euler`, `registry-morpho-market`, `registry-morpho-vault`, `registry-inter-vault-child`, `registry-inter-vault-policy`, `registry-inter-vault-status`, `metavault-positions`, `metavault-preflight`, `registry-transfer-ownership`, `emergency`, `circuit-breaker`, `deploy-core`, `deploy-bundle`.

Il bundle MetaVault locale si installa con `deploy-bundle --kind inter-vault`. La guida completa, inclusa la distinzione fra simulazione, calldata Safe e transazione persistente, è in `docs/New_Doc/1_Documentation/5. InterVault/05_Guida_Operativa_Script_MetaVault.md`.

La documentazione completa, con opzioni ed esempi sicuri, è in `docs/New_Doc/1_Documentation/script documentation`.
