# Guida di riesecuzione — baseline ed Explorer

## Prerequisiti

Usare Node 20 e copiare `.env.example` in `.env`. Non committare `.env`. Per il solo preflight servono `ARBITRUM_RPC_URL`; per Explorer serve anche `ARBITRUM_ETHERSCAN_API_KEY`. La private key non è richiesta.

## Installazione e controlli locali

```powershell
npm ci
npm run compile
npm run scripts:typecheck
npm run scripts:test
npm run automation:test
```

La `.npmrc` applica automaticamente `legacy-peer-deps=true`, necessario per riprodurre il lockfile attuale.

La verifica Arbiscan richiede Hardhat `2.28.6` e `@nomicfoundation/hardhat-verify` `2.1.3` come registrati nel lockfile. Queste versioni usano Etherscan API V2; `ARBITRUM_ETHERSCAN_API_KEY` resta il nome storico della variabile ma la rete selezionata è Arbitrum One e gli URL finali sono Arbiscan.

## Preflight read-only dei 22 contratti

```powershell
$env:VERIFY_PREFLIGHT_ONLY = "true"
npm run verify:poc
Remove-Item Env:VERIFY_PREFLIGHT_ONLY
```

Non firma e non invia transazioni. Il report viene scritto in `reports/verification/arbitrum-usdc-poc-1.json`.

## Verifica pubblica Explorer

Questo comando pubblica sorgenti, compiler settings e constructor arguments sull'Explorer:

```powershell
npm run verify:poc
```

È idempotente: `already verified` vale come successo. Il processo continua sugli altri contratti dopo un errore, ma termina non-zero se resta almeno un failure.

## Manifest alternativo

```powershell
$env:POC_MANIFEST = "scripts/manifests/altro-deployment.json"
npm run verify:poc
```

Il manifest deve mantenere le stesse chiavi della matrice. Per un deployment con contratti o constructor diversi va aggiornata esplicitamente la matrice, non riutilizzato il comando alla cieca.

## Controlli Git finali

```powershell
git diff 8f53e98 -- contracts
git diff --check
git status --short
```

Il primo comando deve essere vuoto per questa baseline. Prima di pubblicare servono inoltre GitHub CLI installata e `gh auth status` riuscito.

## Archivio baseline dopo il tag

```powershell
powershell -ExecutionPolicy Bypass -File scripts/baseline/create-baseline-archive.ps1
```

Lo script rifiuta tag inesistenti o differenze sui file critici, crea ZIP separati per sorgenti e build-info e produce checksum SHA-256. La directory ottenuta non è ancora un backup offline: va copiata su storage fisicamente separato.
