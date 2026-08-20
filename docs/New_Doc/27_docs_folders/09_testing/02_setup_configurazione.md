# 9.2 Setup e Configurazione

## Prerequisiti

- Node.js ≥ 18
- Hardhat con TypeScript
- `@nomicfoundation/hardhat-toolbox`
- RPC endpoint Arbitrum (per fork tests)

## Variabili d'Ambiente

```bash
# Obbligatorie per fork tests
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc   # RPC provider (Alchemy/Infura consigliato)
FORK_ENABLED=true                                # Abilita fork mode

# Opzionali
FORK_BLOCK_NUMBER=                    # Pin a un blocco specifico (riproducibilità)
REPORT_GAS=true                       # Abilita gas reporting
COINMARKETCAP_API_KEY=               # Per gas cost in USD
ARBITRUM_ETHERSCAN_API_KEY=          # Per verify su Arbiscan
```

## Configurazione Hardhat

La configurazione fork in `hardhat.config.ts`:

```typescript
hardhat: {
  forking: {
    url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    enabled: process.env.FORK_ENABLED === "true",
    blockNumber: process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined,
  },
  chainId: 42161,                    // Arbitrum mainnet chain ID
  timeout: 600000,                   // 10 minuti per fork tests
  allowUnlimitedContractSize: true,  // Per contratti grandi (EulerV2Plugin ~30KB)
}
```

## Comandi di Esecuzione

### Unit Tests (senza fork)
```bash
# Tutti i test unitari
npx hardhat test test/unit/*.test.ts

# Singolo file
npx hardhat test test/unit/Beacon.test.ts

# Skip compilazione (se già compilato)
npx hardhat test test/unit/Beacon.test.ts --no-compile
```

### Integration Tests (senza fork)
```bash
# Tutti i non-fork integration
npx hardhat test test/integration/BeaconModules.integration.test.ts \
  test/integration/Emergency.integration.test.ts \
  test/integration/Deposit.integration.test.ts \
  ... (tutti i *.integration.test.ts)
```

> **Nota:** `npx hardhat test` non supporta glob patterns (es. `*.integration.test.ts`). Elencare i file esplicitamente o usare PowerShell per espandere:
> ```powershell
> $files = Get-ChildItem test/integration/*.integration.test.ts | % { $_.FullName }
> npx hardhat test $files --no-compile
> ```

### Fork Tests (richiede FORK_ENABLED=true)

```powershell
# Impostare variabile ambiente
$env:FORK_ENABLED = "true"

# Singolo fork test
npx hardhat test test/integration/AaveV3Plugin.fork.test.ts --no-compile

# Tutti i fork tests di un protocollo
npx hardhat test test/integration/EulerV2Plugin.fork.test.ts `
  test/integration/EulerV2Plugin.batch.test.ts `
  test/integration/EulerV2Plugin.leverage.test.ts --no-compile
```

### Batch Completo

```powershell
# 1. Compila tutto
npx hardhat compile

# 2. Unit tests
npx hardhat test test/unit/*.test.ts --no-compile

# 3. Integration tests (non-fork)
$intFiles = Get-ChildItem test/integration/*.integration.test.ts | % { $_.FullName }
npx hardhat test $intFiles --no-compile

# 4. Fork tests (cambiare env)
$env:FORK_ENABLED = "true"
npx hardhat test test/integration/AaveV3Plugin.fork.test.ts --no-compile
# ... ripetere per ogni file fork
```

## Timeout e Performance

| Tipo Test | Timeout Config | Tempo Tipico |
|-----------|---------------|--------------|
| Unit | Hardhat default | 2-20s |
| Integration | Hardhat default | 10-30s |
| Fork (singolo) | 600s (10 min) | 30-120s |
| Fork (leverage) | 600s | 60-180s |

**Tip:** I fork tests usano RPC calls reali, quindi la velocità dipende dal provider. Alchemy/Infura premium sono raccomandati per stabilità.
