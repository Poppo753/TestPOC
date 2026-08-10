# Fase 5 — runbook policy e selector whitelist

## Prerequisiti

- Node 22;
- `ARBITRUM_RPC_URL` disponibile senza essere salvata nei documenti;
- manifest `scripts/manifests/arbitrum-usdc-poc-1.json`;
- control file observe `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- decisioni economiche approvate dall'utente;
- fork Hardhat fissato;
- nessuna private key reale.

La documentazione può essere preparata prima delle decisioni. Il gate non può
essere PASS finché tutti i valori della policy umana restano aperti.

## Baseline

```powershell
git status --short
git rev-parse HEAD
node --version
npm --version
npm ci
npm run compile
npm run scripts:typecheck
npm run scripts:test
npm run automation:test
```

## Snapshot del control file observe

```powershell
$observeConfig = "scripts/automation/config.arbitrum-usdc-poc-1.json"
Get-FileHash -Algorithm SHA256 $observeConfig
Get-Content -Raw -Encoding UTF8 $observeConfig | ConvertFrom-Json | ConvertTo-Json -Depth 20
```

Registrare l'hash. Non modificare questo file in place.

## Control file candidato

Creare il candidato soltanto dopo l'approvazione della policy umana.

```powershell
$candidateConfig = "scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json"
Copy-Item -LiteralPath $observeConfig -Destination $candidateConfig
```

Nel candidato mantenere:

```json
{
  "mode": "observe",
  "autonomous": {
    "enabled": false,
    "acknowledgement": ""
  },
  "execution": {
    "kind": "disabled"
  }
}
```

Impostare state directory e heartbeat distinti da quelli operativi. Applicare
i valori approvati senza aggiungere `SAFE_ADDRESS`, `SAFE_API_KEY` o signer.

## Validazione del candidato

```powershell
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json
```

Il report deve avere `ready=true`. Il check `EXECUTION_DISABLED` deve restare
PASS.

## Verifica della somma allocazioni

```powershell
$candidate = Get-Content -Raw -Encoding UTF8 "scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json" | ConvertFrom-Json
$targetTotal = [int]$candidate.policy.reserveTargetBps
foreach ($protocol in $candidate.protocols) {
  $targetTotal += [int]$protocol.targetBps
  if ([int]$protocol.targetBps -gt [int]$protocol.maxBps) { throw "Protocol target exceeds maxBps" }
  if (-not $protocol.enabled -and [int]$protocol.targetBps -ne 0) { throw "Disabled protocol has non-zero targetBps" }
}
if ($targetTotal -ne 10000) { throw "Policy targets do not sum to 10000 bps" }
if ([int]$candidate.policy.reserveMinimumBps -gt [int]$candidate.policy.reserveTargetBps) { throw "Reserve minimum exceeds reserve target" }
$targetTotal
```

## Audit selector

Il test tecnico richiesto è
`test/deployment/PolicyWhitelist.fork.test.ts`. Deve ricostruire gli eventi
`SelectorAllowanceChanged`, verificare la mapping `allowedSelectors` e produrre
la matrice finale dei quattro protocolli.

Per il POC `supplyOnly`, il risultato atteso è zero selector generici
autorizzati. I metodi `deposit()` e `withdraw()` di ProtocolManager non fanno
parte di questa mapping.

Calcolare un selector da una firma canonica:

```powershell
$env:FUNCTION_SIGNATURE = "deposit(string,uint256)"
npx --% ts-node -e "import { id } from 'ethers'; const signature = process.env.FUNCTION_SIGNATURE; if (!signature) throw new Error('FUNCTION_SIGNATURE missing'); console.log(JSON.stringify({ signature, selector: id(signature).slice(0, 10) }, null, 2));"
```

La variabile serve solo al calcolo. La firma deve provenire dalla matrice
revisionata, non da input non verificato.

## Generazione calldata selector

Generare soltanto calldata, senza signer e senza invio:

```powershell
npm run scripts:cli -- protocol-selectors --manifest=scripts/manifests/arbitrum-usdc-poc-1.json --protocol=AaveV3 --signatures="$env:FUNCTION_SIGNATURE" --allowed=false --encode-only=true
```

Ripetere per ciascun selector da revocare. Per una whitelist già vuota non
generare chiamate ridondanti.

## Fork fissato

Usare il blocco registrato per la Fase 5.

```powershell
if (-not $env:ARBITRUM_RPC_URL) { throw "ARBITRUM_RPC_URL missing" }
if (-not $env:FORK_BLOCK_NUMBER) { throw "FORK_BLOCK_NUMBER missing" }
$env:FORK_ENABLED = "true"
npx hardhat test test/deployment/PolicyWhitelist.fork.test.ts --network hardhat
npx hardhat test test/deployment/PolicyWhitelist.fork.test.ts --network hardhat
```

Il test deve simulare l'esatto batch e tutti i casi negativi della checklist.
Non usare `--network arbitrum`.

## Regressioni e invarianti

```powershell
npm run compile
npm run scripts:typecheck
npm run scripts:test
npm run automation:test
npm run test:invariants
```

## Verifica finale del file observe

```powershell
Get-FileHash -Algorithm SHA256 "scripts/automation/config.arbitrum-usdc-poc-1.json"
git diff -- "scripts/automation/config.arbitrum-usdc-poc-1.json"
```

L'hash deve coincidere con la baseline e il diff deve essere vuoto.

## Cosa non fare

- non modificare il control file observe;
- non inventare valori economici mancanti;
- non usare la policy POC come approvazione implicita;
- non autorizzare `0xffffffff`;
- non autorizzare selector privi di flow e test;
- non abilitare borrow, leverage o swap nel POC `supplyOnly`;
- non usare `--network arbitrum` per simulazioni mutative;
- non aggiungere private key o mnemonic;
- non applicare il batch reale finché Fasi 3, 4 e 6 non lo consentono.

