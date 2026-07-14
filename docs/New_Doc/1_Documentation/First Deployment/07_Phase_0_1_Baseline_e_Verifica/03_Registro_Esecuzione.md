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

La `.npmrc` aggiunta rende `legacy-peer-deps=true` una policy esplicita e riproducibile. Non aggiorna né risolve diversamente il lockfile.

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

## Source verification pubblica

Non eseguita. La piattaforma ha respinto il primo tentativo perché avrebbe caricato sorgenti privati e constructor arguments su un Explorer pubblico. Serve consenso esplicito dell'utente dopo questa informativa. Nessuna transazione blockchain è necessaria e la private key non viene letta dal verificatore.

## Sicurezza e dipendenze

- `.env`: non tracciato.
- `.automation-state`: non tracciata.
- Credenziale OneInch hardcoded: rimossa da quattro file correnti; già presente nella storia/remoto, quindi da revocare e ruotare.
- Audit production: 17 advisory, nessun critical.
- Audit completo toolchain: 73 advisory, 6 critical.
- Nessun `audit fix --force` applicato.

## Gate

- Fase 0 tecnica: COMPLETA. Branch, tag e draft PR sono pubblicati; archive e checksum sono prodotti localmente.
- Gate copia fisicamente offline: ancora a carico dell'utente; il pacchetto locale non equivale a storage separato.
- Fase 1 tecnica: preflight PASS 22/22; verifica pubblica Explorer aperta.
- Passaggio alla fase 2: non ancora autorizzato da questo registro.

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
