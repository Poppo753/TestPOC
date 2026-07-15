# Guida comandi CLI, test e produzione

## Prerequisiti

Da PowerShell, nella root `TestSmartContract`:

```powershell
npm install
$env:HARDHAT_NETWORK = 'hardhat'
```

Per fork riproducibile:

```powershell
$env:ARBITRUM_RPC_URL = 'https://RPC_PRIVATA'
$env:FORK_ENABLED = 'true'
$env:FORK_BLOCK_NUMBER = '483105327'
```

Non inserire la private key nella riga di comando o nel manifest. Per mainnet configurarla nel secret store del processo e preferire l'output encode-only per una Safe.

## Comandi di verifica

```powershell
npm run scripts:typecheck
npx hardhat compile
npx hardhat test test/scripts/Framework.test.ts test/scripts/Operations.test.ts test/scripts/Deployment.test.ts test/integration/scripts/Phase1.Core.test.ts
$env:FORK_ENABLED='true'; $env:FORK_BLOCK_NUMBER='483105327'; npx hardhat test test/scripts/ForkSmoke.test.ts
```

## Sintassi generale

```powershell
npx ts-node scripts/cli.ts <comando> --manifest <file.json> [opzioni]
```

Le opzioni accettano `--chiave valore` e `--chiave=valore`. Senza `--execute=true` una mutazione restituisce soltanto il piano. Per simulare realmente una sequenza su fork usare `--execute=true --dry-run=true`; per inviare definitivamente usare `--execute=true --dry-run=false`.

## Read-only

```powershell
npx ts-node scripts/cli.ts status --manifest deployments/mainnet-latest.json
npx ts-node scripts/cli.ts health --manifest deployments/mainnet-latest.json
npx ts-node scripts/cli.ts positions --manifest deployments/mainnet-latest.json
npx ts-node scripts/cli.ts position --manifest deployments/mainnet-latest.json --protocol Euler --token USDC
```

`status` espone moduli/code/pool/flag/protocolli. `health` restituisce summary e health globale. `positions` ordina per rischio. `position` legge balance, debt e health di un protocollo/token.

## Deposit, withdraw e swap

```powershell
npx ts-node scripts/cli.ts deposit --manifest deployments/v1.json --amount 1000000000000000000 --wrap-native=true
npx ts-node scripts/cli.ts withdraw --manifest deployments/v1.json --shares 500000000000000000 --deadline-seconds 1200
npx ts-node scripts/cli.ts withdraw --manifest deployments/v1.json --percentage-bps 2500
npx ts-node scripts/cli.ts swap --manifest deployments/v1.json --token-in USDC --token-out WBTC --amount 1000000 --slippage-bps 100 --deadline-seconds 1200
```

Gli importi sono unità atomiche. `2500` bps equivale al 25%. Lo swap usa la migliore quote valida e verifica che custody abbia perso esattamente `amountIn` e ricevuto almeno `minAmountOut`.

Encode-only:

```powershell
npx ts-node scripts/cli.ts deposit --manifest deployments/v1.json --amount 1000000 --caller 0x... --encode-only=true
npx ts-node scripts/cli.ts withdraw --manifest deployments/v1.json --shares 1000000 --caller 0x... --encode-only=true
```

## Operazioni protocollo

```powershell
npx ts-node scripts/cli.ts protocol-action --manifest deployments/v1.json --operation deposit --protocol AaveV3 --token USDC --amount 1000000
npx ts-node scripts/cli.ts protocol-action --manifest deployments/v1.json --operation withdraw --protocol EulerV2 --token USDC --amount 1000000
npx ts-node scripts/cli.ts protocol-action --manifest deployments/v1.json --operation borrow --protocol Morpho --token USDC --amount 1000000
npx ts-node scripts/cli.ts protocol-action --manifest deployments/v1.json --operation repay --protocol EulerV2 --token USDC --amount 1000000
npx ts-node scripts/cli.ts protocol-action --manifest deployments/v1.json --operation close --protocol EulerV2 --debt-token USDC --collateral-token WETH
```

## Deploy core

Il primo run crea il manifest; un run successivo lo carica e riprende i checkpoint.

```powershell
npx ts-node scripts/cli.ts deploy-core `
  --manifest deployments/release-v1.json `
  --base-code WETH `
  --base-address 0x82aF... `
  --base-decimals 18 `
  --base-price-feed 0x639F... `
  --feed-decimals 8 `
  --heartbeat 3600 `
  --quote USD `
  --confirmations 2 `
  --execute=true
```

## Bundle supportati

```powershell
npx ts-node scripts/cli.ts deploy-bundle --manifest deployments/release-v1.json --kind uniswap-v3 --router 0x... --quoterV2 0x... --execute=true
npx ts-node scripts/cli.ts deploy-bundle --manifest deployments/release-v1.json --kind aave --pool 0x... --execute=true
npx ts-node scripts/cli.ts deploy-bundle --manifest deployments/release-v1.json --kind euler --evc 0x... --accountLens 0x... --vaultLens 0x... --utilsLens 0x... --execute=true
npx ts-node scripts/cli.ts deploy-bundle --manifest deployments/release-v1.json --kind morpho --morpho 0x... --execute=true
npx ts-node scripts/cli.ts deploy-bundle --manifest deployments/release-v1.json --kind morpho-vault --execute=true
```

`--kind dolomite` e `--kind gmx` falliscono intenzionalmente.

## Amministrazione

```powershell
npx ts-node scripts/cli.ts update-beacon --manifest deployments/v1.json --module ValueCalculator --implementation 0x...
npx ts-node scripts/cli.ts protocol-register --manifest deployments/v1.json --protocol AaveV3 --plugin 0x... --lens 0x... --registry 0x...
npx ts-node scripts/cli.ts protocol-update --manifest deployments/v1.json --protocol AaveV3 --plugin 0x... --lens 0x... --registry 0x...
npx ts-node scripts/cli.ts protocol-status --manifest deployments/v1.json --protocol AaveV3 --active=false
npx ts-node scripts/cli.ts protocol-selectors --manifest deployments/v1.json --protocol EulerV2 --signatures 'deposit(string,uint256),withdraw(string,uint256)' --allowed=true
npx ts-node scripts/cli.ts token-config --manifest deployments/v1.json --token USDC --address 0x... --decimals 6 --heartbeat 86400
npx ts-node scripts/cli.ts token-remove --manifest deployments/v1.json --token USDC
```

La registrazione protocollo aggiorna Beacon prima di ProtocolManager. L'oracolo deve già supportare il token prima di `token-config`.

## Registry

```powershell
npx ts-node scripts/cli.ts registry-aave --manifest deployments/v1.json --token USDC --underlying 0x... --a-token 0x... --debt-token 0x...
npx ts-node scripts/cli.ts registry-euler --manifest deployments/v1.json --token USDC --vault 0x...
npx ts-node scripts/cli.ts registry-morpho-market --manifest deployments/v1.json --collateral WETH --loan USDC --collateral-token 0x... --loan-token 0x... --oracle 0x... --irm 0x... --lltv 860000000000000000
npx ts-node scripts/cli.ts registry-morpho-vault --manifest deployments/v1.json --token USDC --vault 0x... --default=true
npx ts-node scripts/cli.ts registry-transfer-ownership --manifest deployments/v1.json --registry morphoRegistry --new-owner 0xPLUGIN
```

Il trasferimento ownership è sempre l'ultimo comando.

## Policy core

```powershell
npx ts-node scripts/cli.ts core-policy --manifest deployments/v1.json `
 --fee-recipient 0x... --deposit-fee-bps 25 --withdraw-fee-bps 50 `
 --deposits-enabled=true --withdraws-enabled=true --swaps-enabled=true `
 --hourly-withdraw-limit 100000000000000000000 --daily-withdraw-limit 1000000000000000000000 `
 --min-withdraw 1000000000000 --max-withdraw 50000000000000000000 `
 --swap-token USDC --min-swap 1000000 --max-swap 1000000000000 --max-slippage-bps 200 `
 --deposit-rate-user 100000000000000000000 --deposit-rate-global 1000000000000000000000 `
 --withdraw-rate-user 100000000000000000000 --withdraw-rate-global 1000000000000000000000
```

## Emergency

```powershell
npx ts-node scripts/cli.ts emergency --manifest deployments/v1.json --active=true --reason 'oracle incident'
npx ts-node scripts/cli.ts emergency --manifest deployments/v1.json --active=false
npx ts-node scripts/cli.ts circuit-breaker --manifest deployments/v1.json --plugin eulerV2Plugin --active=true
```

Prima produrre il piano, poi simulare su fork, infine passare la calldata alla Safe. Unpause può essere soggetto a timelock contrattuale.

