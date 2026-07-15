# Registro di esecuzione — Fasi 0 e 1

Data: 14 luglio 2026. Rete: Arbitrum One, chain ID 42161.

## Baseline

- Commit storico del deployment: `8f53e98`.
- Manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`.
- Albero `contracts/` corrente contro `8f53e98`: identico.
- Tag richiesto: `arbitrum-usdc-poc-1`, da creare sul commit finale certificato.
- GitHub: `gh 2.96.0` autenticato come `Poppo753`; remoto pubblico `Poppo753/TestPOC`, default branch `master`.

## Clean-room

| Controllo | Risultato |
|---|---|
| `npm ci` senza policy | FAIL: peer conflict ethers/chai-matchers |
| `npm ci --legacy-peer-deps` | PASS |
| Compile | PASS, 90 file Solidity / 103 artifact |
| Typecheck script | PASS |
| Suite script | PASS, 39 |
| Suite automation | PASS, 14 |
| `npm ci` dopo upgrade verificatore | PASS, 757 package installati dal lockfile |

La `.npmrc` aggiunta rende `legacy-peer-deps=true` una policy esplicita e riproducibile. Non aggiorna né risolve diversamente il lockfile.

Dopo la migrazione del verificatore Arbiscan il clean-room è stato ripetuto sul nuovo lockfile: installazione, compile, typecheck, 39 test script e 14 test automation sono passati nuovamente.

## Evidenza test preesistente sulla stessa baseline Solidity

Il registro test certificato il 13 luglio 2026 riporta: 1.193 unit, 654 integration, 230 E2E attivi, 83 invariants/security e 29 performance, senza failure/pending nelle suite attive. GMX e Dolomite sono esclusi su richiesta. Il fork è fissato al blocco `483105327`.

## Preflight Arbitrum

Eseguito alle `2026-07-14T18:21:12.229Z` tramite `scripts/verification/verify-poc.ts`:

- totale: 22;
- bytecode presente: 22;
- receipt di deployment status 1: 22;
- contract address coerente con receipt: 22;
- creation bytecode e constructor arguments uguali all'input della transazione reale: 22;
- duplicati: 0;
- failure: 0;
- SwapManager: 24.473 byte.

Report machine-readable: `reports/verification/arbitrum-usdc-poc-1.json`.

## Source verification pubblica — 15 luglio 2026

L'utente ha autorizzato esplicitamente la pubblicazione. Il primo tentativo tecnico, eseguito con la vecchia integrazione locale, ha restituito errore su tutti i contratti perché Etherscan API V1 è stata dismessa. Non era un errore del bytecode, dei constructor arguments o della rete e quel tentativo non ha pubblicato nulla.

Il solo tooling di sviluppo è stato aggiornato a Hardhat `2.28.6` e `@nomicfoundation/hardhat-verify` `2.1.3`, compatibili con Etherscan API V2. Arbitrum One è stata selezionata con chain ID `42161`; la destinazione pubblica è Arbiscan.

Risultato finale:

- preflight: 22/22 PASS;
- sorgenti verificati su Arbiscan: 22/22;
- failure residue: 0;
- input di creazione uguale ad artifact più constructor arguments: 22/22;
- URL Arbiscan unici registrati: 22;
- secondo passaggio idempotente: 22/22 già verificati;
- transazioni inviate: 0;
- private key letta dal verificatore: no.

Il report machine-readable aggiornato è `reports/verification/arbitrum-usdc-poc-1.json`; la matrice completa è in `04_Matrice_Verifica_22_Contratti.md`.

## Sicurezza e dipendenze

- `.env`: non tracciato.
- `.automation-state`: non tracciata.
- Credenziale OneInch hardcoded: rimossa da quattro file correnti; già presente nella storia/remoto, quindi da revocare e ruotare.
- Audit production: 17 advisory, nessun critical.
- Audit completo toolchain dopo l'upgrade del verificatore: 57 advisory, 4 critical.
- Nessun `audit fix --force` applicato.

## Gate

- Fase 0 tecnica: COMPLETA. Branch, tag e draft PR sono pubblicati; archive e checksum sono prodotti localmente.
- Gate copia fisicamente offline: ancora a carico dell'utente; il pacchetto locale non equivale a storage separato.
- Fase 1 tecnica: COMPLETA, preflight PASS 22/22 e Arbiscan VERIFIED 22/22.
- Il gate tecnico per il passaggio alla fase 2 è superato; la fase 2 resta un'attività operativa separata.

## Pubblicazione e archivio — 15 luglio 2026

- Repository: `https://github.com/Poppo753/TestPOC` (pubblico).
- Branch: `dev-26`.
- Commit Prompt: `e9cc57f`.
- Commit baseline certificata: `fc30b25`.
- Tag annotato: `arbitrum-usdc-poc-1` → `fc30b25`.
- Draft PR: `https://github.com/Poppo753/TestPOC/pull/5` verso `master`.
- Source archive: `baseline-archives/arbitrum-usdc-poc-1-source.zip`.
- Build-info archive: `baseline-archives/arbitrum-usdc-poc-1-build-info.zip`.
- SHA-256 source: `af97096cfae4e34172b379ae6c4b44222d15f04f9454fd633c0e32ee382d4cb0`.
- SHA-256 build-info: `5291b986d0398b4a703e5c3b0b35218e34024825860bc4834705df593294eabf`.
- Controllo archive: `.env` assente; `.automation-state` assente.
