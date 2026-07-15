# 3 — Guida ai comandi per eseguire i test

## 1. Prerequisiti

Aprire PowerShell nella root del progetto:

```powershell
Set-Location 'E:\Documents\Crypto\Defi\Arbitrum\Coding\Project4\TestSmartContract'
```

Versioni raccomandate:

```powershell
node --version
npm --version
npx hardhat --version
```

Il progetto è stato validato con Node 20 e Hardhat 2. Non aggiornare a Node 22
durante una sessione di verifica senza prima ricertificare la suite.

Installazione pulita delle dipendenze già bloccate in `package-lock.json`:

```powershell
npm ci
```

Se si sta lavorando normalmente su una checkout già installata:

```powershell
npm install
```

## 2. Configurare la RPC

Per un fork serio usare una RPC Arbitrum privata con accesso ai blocchi storici.
Impostazione per la sola sessione PowerShell corrente:

```powershell
$env:ARBITRUM_RPC_URL = 'https://URL_DELLA_TUA_RPC'
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
```

Verifica senza stampare il segreto:

```powershell
if ([string]::IsNullOrWhiteSpace($env:ARBITRUM_RPC_URL)) {
    throw 'ARBITRUM_RPC_URL non configurata'
}
Write-Host 'RPC configurata; fork block:' $env:FORK_BLOCK_NUMBER
```

In alternativa creare un `.env` locale non versionato:

```dotenv
ARBITRUM_RPC_URL=https://URL_DELLA_TUA_RPC
FORK_ENABLED=true
FORK_BLOCK_NUMBER=483105327
```

Non inserire mai una private key nei documenti o nei log. I test Hardhat fork
standard non richiedono fondi reali né `PRIVATE_KEY`.

## 3. Compilazione

```powershell
npx hardhat compile
```

Pulizia degli artifact soltanto quando serve forzare una ricompilazione:

```powershell
npx hardhat clean
npx hardhat compile
```

`hardhat clean` elimina soltanto cache/artifact generati, non sorgenti o test.

## 4. Smoke test rapido

Per controllare subito toolchain e deployment locale:

```powershell
$env:FORK_ENABLED = 'false'
npx hardhat test test/unit/QuickSmokeTest.test.ts
```

Per controllare che il fork sia realmente attivo:

```powershell
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
npx hardhat test test/e2e/ForkCheck.test.ts
```

## 5. Nota importante sui glob in PowerShell/Hardhat

Su Windows, comandi come questo possono non espandere ricorsivamente i file nel
modo atteso:

```powershell
npx hardhat test test/integration/**/*.test.ts
```

Il metodo affidabile è costruire un array PowerShell e passarlo con `@files`:

```powershell
$files = Get-ChildItem test/integration -Recurse -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @files
```

## 6. Test unitari

### Intero inventario unitario storico

Questo comando riproduce i 1.193 unit test e include i 67 casi Dolomite locali
basati su mock. Non esegue Dolomite contro il protocollo reale.

```powershell
$env:FORK_ENABLED = 'false'
$files = Get-ChildItem test/unit -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @files
```

### Modalità stretta: nessun file Dolomite/GMX

```powershell
$env:FORK_ENABLED = 'false'
$files = Get-ChildItem test/unit -Filter '*.test.ts' |
    Where-Object { $_.Name -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }
npx hardhat test @files
```

La modalità stretta contiene 1.126 dichiarazioni di caso.

### Singolo file o singolo test

```powershell
npx hardhat test test/unit/LiquidityManager.test.ts
npx hardhat test test/unit/LiquidityManager.test.ts --grep 'withdraw'
```

`--grep` accetta una regular expression Mocha e filtra per titolo.

## 7. Invarianti e sicurezza

Per riprodurre la certificazione usare il fork fissato, perché
`HealthFactor.accuracy.test.ts` legge protocolli reali:

```powershell
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
$files = @(
    Get-ChildItem test/invariants -Filter '*.test.ts'
    Get-ChildItem test/security -Filter '*.test.ts'
) | ForEach-Object { $_.FullName }
npx hardhat test @files
```

Esecuzione separata:

```powershell
$invariants = Get-ChildItem test/invariants -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @invariants

$security = Get-ChildItem test/security -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @security
```

Risultato certificato combinato: 83 passing.

## 8. Test d'integrazione attivi

Il comando seguente esclude esplicitamente Dolomite e GMX e deve trovare 42
file:

```powershell
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
$files = Get-ChildItem test/integration -Recurse -Filter '*.test.ts' |
    Where-Object { $_.FullName -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }

Write-Host "File integrazione attivi: $($files.Count)"
if ($files.Count -ne 42) {
    throw "Inventario inatteso: trovati $($files.Count) file invece di 42"
}

npx hardhat test @files
```

Risultato certificato: 654 passing, zero failure e zero pending.

### Esempi per protocollo

```powershell
npx hardhat test test/integration/aave/AaveV3Plugin.fork.test.ts
npx hardhat test test/integration/euler/EulerV2Plugin.batch.test.ts
npx hardhat test test/integration/morpho/MorphoPlugin.fork.test.ts
npx hardhat test test/integration/flash-loan/FlashLoanService.e2e.test.ts
```

### Tutti i test di una sottocartella

```powershell
$files = Get-ChildItem test/integration/euler -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @files
```

## 9. Test E2E attivi

```powershell
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
$files = Get-ChildItem test/e2e -Filter '*.test.ts' |
    Where-Object { $_.Name -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }

Write-Host "File E2E attivi: $($files.Count)"
if ($files.Count -ne 28) {
    throw "Inventario inatteso: trovati $($files.Count) file invece di 28"
}

npx hardhat test @files
```

Risultato certificato: 230 casi attivi verificati. Durante il run complessivo
due hook furono interrotti da HTTP 429/timeout della RPC pubblica; i due file
furono poi rilanciati integralmente con 32/32 passing.

### Rerun dei file sensibili alla RPC

```powershell
npx hardhat test `
    test/e2e/Withdraw.deadline.fork.test.ts `
    test/e2e/OracleAdapter.e2e.test.ts
```

### Rerun dei flow principali

```powershell
npx hardhat test test/e2e/Aave.BorrowRepay.e2e.test.ts
npx hardhat test test/e2e/Euler.BorrowRepay.e2e.test.ts
npx hardhat test test/e2e/Morpho.FullCycle.e2e.test.ts
npx hardhat test test/e2e/CrossProtocol.Rebalance.e2e.test.ts
npx hardhat test test/e2e/EmergencyOnLivePosition.e2e.test.ts
npx hardhat test test/e2e/Withdraw.AutomaticSwap.fork.test.ts
```

## 10. Performance e gas

```powershell
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
$files = Get-ChildItem test/performance -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @files
```

Risultato certificato: 29 passing.

Per produrre anche `gas-report.txt`:

```powershell
$env:REPORT_GAS = 'true'
npx hardhat test test/e2e/GasOptimization.benchmark.e2e.test.ts
$env:REPORT_GAS = 'false'
```

Le baseline persistenti sono in `test/gas-snapshots.json`. Non cancellarle o
aggiornarle automaticamente per nascondere una regressione. Prima di accettare
una nuova baseline bisogna motivare il cambiamento di bytecode o comportamento.

## 11. Coverage

Coverage standard dei contratti, con le esclusioni definite in `.solcover.js`:

```powershell
$env:FORK_ENABLED = 'false'
npm run test:coverage
```

Il discovery standard può includere il test unitario Dolomite basato su mock;
non esegue i full-cycle fork quando `FORK_ENABLED=false`. Se si desidera
escludere anche quel file dal report, aggiungerlo temporaneamente alla
configurazione di coverage in una branch dedicata e documentare il perimetro.

Output principale:

```text
coverage/index.html
coverage/lcov.info
```

## 12. Sequenza completa raccomandata

Eseguire per categorie riduce il carico sulla RPC e rende immediata
l'identificazione del file responsabile.

```powershell
Set-Location 'E:\Documents\Crypto\Defi\Arbitrum\Coding\Project4\TestSmartContract'

npx hardhat compile

$env:FORK_ENABLED = 'false'
$unit = Get-ChildItem test/unit -Filter '*.test.ts' |
    Where-Object { $_.Name -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }
npx hardhat test @unit

$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'

$safety = @(
    Get-ChildItem test/invariants -Filter '*.test.ts'
    Get-ChildItem test/security -Filter '*.test.ts'
) | ForEach-Object { $_.FullName }
npx hardhat test @safety

$integration = Get-ChildItem test/integration -Recurse -Filter '*.test.ts' |
    Where-Object { $_.FullName -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }
npx hardhat test @integration

$e2e = Get-ChildItem test/e2e -Filter '*.test.ts' |
    Where-Object { $_.Name -notmatch 'Dolomite|GMX' } |
    ForEach-Object { $_.FullName }
npx hardhat test @e2e

$performance = Get-ChildItem test/performance -Filter '*.test.ts' |
    ForEach-Object { $_.FullName }
npx hardhat test @performance
```

## 13. Salvare i log

```powershell
$logDir = 'test-results'
New-Item -ItemType Directory -Force $logDir | Out-Null

npx hardhat test @integration 2>&1 |
    Tee-Object -FilePath "$logDir/integration-$env:FORK_BLOCK_NUMBER.log"
```

Per ottenere soltanto il riepilogo:

```powershell
Select-String -Path "$logDir/integration-$env:FORK_BLOCK_NUMBER.log" `
    -Pattern 'passing|failing|pending'
```

## 14. Diagnosi dei problemi comuni

### `429 Too Many Requests`

È un rate-limit RPC, non automaticamente un bug del contratto.

1. non cambiare blocco;
2. usare una RPC privata;
3. rilanciare l'intero file interrotto;
4. confrontare stack trace e asserzioni;
5. non dichiarare verde un test che non è arrivato al riepilogo.

### Timeout Mocha

Se il log mostra retry RPC, risolvere prima la qualità dell'endpoint. Se il test
è realmente lento ma continua a progredire, il timeout della suite fork può
essere aumentato senza cambiare le asserzioni.

### `Implementation not found`

Controllare che il Beacon contenga `BASE_ASSET`, token, registry e tutti i
moduli richiesti dal flow.

### `Implementation must be a contract`

Non registrare `owner.address` o altre EOA. Deployare un mock con bytecode.

### `transfer amount exceeds balance`

La whale potrebbe essere stata consumata da una suite precedente. Usare
snapshot/revert, un holder verificato al blocco fissato o `WETH.deposit()`.

### Deadline scaduta in modo intermittente

Calcolare sempre la deadline dal timestamp della rete:

```typescript
const now = (await ethers.provider.getBlock("latest"))!.timestamp;
const deadline = now + 3600;
```

Non usare `Date.now()` per un fork il cui timestamp può differire dall'orologio
locale.

### Warning `Failed to generate N stack traces`

Può essere un limite del decoder con `viaIR`; non è una failure se il processo
termina con exit code 0 e il riepilogo non contiene failing. Va comunque letto
il risultato, non ignorato automaticamente.

## 15. Criteri per dichiarare un run valido

Un run può essere registrato come riuscito soltanto se:

- il processo termina con exit code `0`;
- il riepilogo mostra zero `failing`;
- nelle suite attive non compaiono `pending` inattesi;
- il blocco fork è quello dichiarato;
- Dolomite/GMX sono esclusi esplicitamente dal comando;
- gli eventuali file colpiti da errore RPC vengono rilanciati integralmente;
- `git diff --check` non segnala errori di formattazione.

Controlli Git finali:

```powershell
git diff --check
git diff --diff-filter=D --name-only
git status --short
```

Il secondo comando deve essere vuoto se non si intende eliminare file.

