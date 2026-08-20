# Fase 4 — runbook rehearsal ownership su fork

## Prerequisiti

- workstation locale fidata;
- Node 22;
- dipendenze installabili con `npm ci`;
- `ARBITRUM_RPC_URL` disponibile come variabile d'ambiente;
- nessuna private key reale richiesta;
- manifest `scripts/manifests/arbitrum-usdc-poc-1.json`;
- test `test/deployment/OwnershipTransfer.fork.test.ts` implementato e revisionato.

La mancanza del test dedicato è un gate bloccante. Non sostituirlo con una
sequenza manuale non riproducibile.

## Baseline

Eseguire dalla root `TestSmartContract`.

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

Registrare commit, versioni e conteggi nel registro.

## Verifica del manifest

```powershell
$manifest = Get-Content -Raw -Encoding UTF8 "scripts/manifests/arbitrum-usdc-poc-1.json" | ConvertFrom-Json
$contractNames = @($manifest.contracts.PSObject.Properties.Name)
[pscustomobject]@{
  ChainId = $manifest.chainId
  ContractCount = $contractNames.Count
  Deployer = $manifest.deployer
  LastCompletedBlock = $manifest.metadata.lastCompletedBlock
}
$contractNames
```

Il risultato richiesto è chain ID `42161` e `ContractCount=22`.

## Fissare il blocco fork

Il comando legge l'ultimo blocco senza stampare l'RPC URL.

```powershell
if (-not $env:ARBITRUM_RPC_URL) { throw "ARBITRUM_RPC_URL missing" }
$rpcBody = @{ jsonrpc = "2.0"; method = "eth_blockNumber"; params = @(); id = 1 } | ConvertTo-Json -Compress
$rpcResult = Invoke-RestMethod -Uri $env:ARBITRUM_RPC_URL -Method Post -ContentType "application/json" -Body $rpcBody
$env:FORK_BLOCK_NUMBER = [Convert]::ToInt64($rpcResult.result.Substring(2), 16).ToString()
$env:FORK_BLOCK_NUMBER
if ([int64]$env:FORK_BLOCK_NUMBER -le [int64]$manifest.metadata.lastCompletedBlock) { throw "FORK_BLOCK_NUMBER is not after the last completed configuration block" }
```

Registrare il numero. Non aggiornarlo tra la prima e la seconda esecuzione.

## Requisiti del test dedicato

`test/deployment/OwnershipTransfer.fork.test.ts` deve:

1. accettare soltanto rete `hardhat`, `FORK_ENABLED=true` e blocco fissato;
2. usare il manifest reale e verificare 22 indirizzi con bytecode;
3. creare una Safe effimera `2-of-3` con account Hardhat locali;
4. produrre una matrice di 22 righe;
5. trasferire 20 Ownable a uno step e la Beacon a due step;
6. mantenere `flashLoanService` come eccezione non Ownable;
7. verificare 21 owner Safe e 21 dinieghi al vecchio deployer;
8. eseguire amministrazione, rollback, pause e unpause tramite la Safe;
9. eseguire deposit, withdraw e health dopo il trasferimento;
10. chiudere impersonation e ripristinare lo snapshot anche in caso di errore.

Gli owner Safe locali non devono derivare da variabili d'ambiente o chiavi reali.

## Prima esecuzione

```powershell
$env:FORK_ENABLED = "true"
npx hardhat test test/deployment/OwnershipTransfer.fork.test.ts --network hardhat
```

Il comando è mutativo soltanto nel fork in-process. Non aggiungere
`--network arbitrum`.

## Seconda esecuzione deterministica

Senza cambiare `FORK_BLOCK_NUMBER`:

```powershell
npx hardhat test test/deployment/OwnershipTransfer.fork.test.ts --network hardhat
```

Confrontare numero test, matrice, owner finali, revert e risultati funzionali.
Gli hash locali possono differire se il test usa timestamp non fissati; gli
stati e i conteggi del gate devono coincidere.

## Regressione generale

```powershell
npm run compile
npm run scripts:typecheck
npm run scripts:test
npm run automation:test
```

Ogni regressione introdotta dal nuovo harness blocca il gate.

## Verifica observer reale

Questa raccolta è read-only e non è necessaria per eseguire il fork.

```powershell
ssh -i "$env:USERPROFILE\.ssh\vault_observer_hetzner_ed25519" root@46.225.133.37
```

Eseguire sulla VPS:

```bash
systemctl is-active vault-automation-observe.service
cd /opt/vault-automation/TestSmartContract
sudo -u vaultops node -e 'const c=require("./scripts/automation/config.arbitrum-usdc-poc-1.json"); console.log(JSON.stringify({mode:c.mode,execution:c.execution,autonomous:c.autonomous},null,2))'
```

Il risultato atteso è servizio `active`, mode `observe`, execution `disabled`
e autonomous `false`.

## Cosa non fare

- non usare `--network arbitrum` per il test ownership;
- non impostare `PRIVATE_KEY` per la rehearsal;
- non usare una Safe reale come destinazione del fork;
- non usare un blocco fork mobile;
- non modificare il manifest operativo durante il test;
- non omettere contratti senza `owner()` dalla matrice;
- non disabilitare il cleanup per analizzare un fallimento;
- non dichiarare PASS da una sola esecuzione;
- non trasferire ownership reali prima della Fase 6.

