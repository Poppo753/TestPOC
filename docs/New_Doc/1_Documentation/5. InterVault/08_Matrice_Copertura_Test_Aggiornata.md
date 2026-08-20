# Matrice aggiornata della copertura InterVault

## Risultato complessivo

| Livello | File autorevole | Casi | Esito |
|---|---|---:|---:|
| Unit/componente | `test/unit/metavault/InterVault.bundle.test.ts` | 19 | PASS |
| Integration full-core | `test/integration/metavault/InterVault.Core.integration.test.ts` | 2 | PASS |
| E2E locale | `test/e2e/InterVault.AutomaticWithdrawal.local.e2e.test.ts` | 1 | PASS |
| Fork Arbitrum | `test/integration/metavault/InterVault.POCLeaf.fork.test.ts` | 1 | PASS |
| Script operativi complessivi | suite `scripts:test` | 40 | PASS |
| Automation complessiva | suite `automation:test` | 16 | PASS |
| TypeScript | `scripts:typecheck` | — | PASS |
| Solidity | `hardhat compile` | — | PASS |

## Unit/componente

Copertura:

- registrazione canonica e routing token;
- rifiuto di alias diversi che puntano allo stesso token ERC-20 reale;
- duplicato token e child ricorsivo rifiutati;
- nuova validazione dell'integrità del Beacon child a ogni deposito;
- access control ProtocolManager;
- custody LPT nel Plugin;
- deposito/prelievo e allowance zero/esatta/zero;
- cap prospettico;
- share deviation e rollback atomico;
- lifecycle, deprecazione e rimozione solo a saldo zero;
- valorizzazione USDC/WETH e decimali;
- active tracking;
- close con child ID stabile;
- health lookup con lo stesso child ID stabile esposto nelle posizioni;
- emergency fallito, osservabilità e retry;
- emergency contabilizzato sul delta reale di balance, non sul return value del leaf;
- token non censito;
- comportamento core skip-on-Lens-error registrato come gate.

## Integration full-core

La fixture `test/helpers/fixtures/interVaultFullCore.ts` usa implementazioni
reali di Beacon, ProxyGeneral, LiquidityManager, TokenManager, ValueCalculator e
ProtocolManager. Il leaf rimane deterministico per controllare yield e failure.

Le prove dimostrano:

- trasferimento custody → Plugin → leaf;
- LPT detenute dal Plugin;
- `ProtocolManager.getBalance` e `getAllProtocolsValue` coerenti;
- NAV parent invariato durante una riallocazione;
- donation contabilizzata una sola volta;
- assenza della ricorsione Lens/ValueCalculator.

## E2E locale

Il test parte da LP parent reali, investe otto unità nel leaf, aggiunge yield e
fa prelevare all'utente più asset della riserva parent. Il LiquidityManager
chiama il percorso automatico, ProtocolManager chiede liquidità ai plugin e
InterVault riscatta abbastanza leaf share.

La policy del POC reale usa withdrawal fee zero. Con una fixture legacy a fee
non zero è emerso un limite core preesistente: il recupero automatico punta al
netto utente e può non includere anche la fee che ProxyGeneral deve trasferire.
Non è stato modificato il core; prima di abilitare withdrawal fee non zero serve
una correzione separata e una regressione dedicata.

## Fork Arbitrum

Blocco: `483832997`.

Il test:

1. richiede `FORK_ENABLED=true` e `FORK_BLOCK_NUMBER` numerico;
2. verifica bytecode del POC reale;
3. deploya un core parent nuovo soltanto nel fork;
4. deploya i tre moschettieri nel fork;
5. registra il POC USDC reale come leaf L0;
6. usa whale USDC con impersonation e gas locale;
7. deposita 1 USDC nel LiquidityManager POC realmente deployato;
8. verifica LPT e Lens;
9. chiude tramite child ID;
10. verifica share e active list a zero;
11. ripristina lo snapshot.

Non è stata inviata alcuna transazione alla rete Arbitrum.

## Script

Sono testati deploy bundle, checkpoint manifest, alias Beacon, registrazione
ProtocolManager, register child, policy, lifecycle, preflight, posizioni,
dry-run ed execution plan.

## Vault Automation Controller

InterVault è integrato come monitor-only:

- il valore viene letto dalla Lens completa, non dal solo child base asset;
- entra in `managedAssets`, allocation e fingerprint;
- Registry holder, child count e Lens valuation entrano nel preflight;
- una variazione yield cambia la fingerprint;
- il run observe viene persistito;
- `enabled=true` fallisce il preflight e l'observer prima di produrre funding.

Questa limitazione è intenzionale finché il gate skip-on-Lens-error non è
risolto.

## Comandi

```powershell
npm run test:metavault
npm run automation:test
npm run scripts:test
npm run scripts:typecheck
```

Fork fissato:

```powershell
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483832997"
npm run test:metavault:fork
```

La RPC autenticata deve essere disponibile in `ARBITRUM_RPC_URL`; non va mai
scritta nella documentazione o nel manifest.
