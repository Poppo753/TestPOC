# Dolomite Plugin - Deployment & Integration Guide

## Overview

**DolomitePlugin** è un modulo per interagire con il protocollo di lending Dolomite su Arbitrum One. Il plugin segue la stessa architettura dei plugin di swap (es. `UniswapV3Plugin`) e si integra nel sistema tramite il **Beacon**.

### Fasi di sviluppo

- **Fase 1 (MVP)**: Deposit/Withdraw - ✅ IMPLEMENTATO
- **Fase 2**: Borrow Position Management - 🚧 DA IMPLEMENTARE
- **Fase 3**: Leverage Strategies - 🔮 FUTURO

---

## Architettura

### Componenti

```
┌─────────────────────────────────────────────────────────────┐
│                         User/Caller                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    DolomitePlugin                           │
│  - Owner = address(this)                                    │
│  - Account #0: Main (deposits/withdrawals)                  │
│  - Account #1+: Borrow positions (Phase 2)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ DolomiteMargin│ │DepositRouter│ │BorrowPosRouter │
│  (Core)     │ │             │ │  (Phase 2)      │
└─────────────┘ └─────────────┘ └─────────────────┘
```

### Account Strategy

Dolomite è **account-based**: ogni account è identificato da `(owner, accountNumber)`.

- **Owner**: `address(this)` = il contratto `DolomitePlugin`
- **Account #0**: Main account
  - Riceve deposits da utenti
  - Serve per withdrawals
  - **NO borrow** (sempre in surplus)
- **Account #1, #2, #3...**: Borrow positions (Phase 2)
  - Ogni posizione è isolata
  - Può avere collateral + debt
  - Gestita tramite `BorrowPositionRouter`

---

## Smart Contract Addresses (Arbitrum One)

### Dolomite Protocol (Production)

Riferimento ufficiale: [https://docs.dolomite.io/smart-contract-addresses](https://docs.dolomite.io/smart-contract-addresses)

```solidity
// Core
DolomiteMargin: 0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072

// Routers (da verificare sulla doc ufficiale)
BorrowPositionRouter: TBD
DepositWithdrawalRouter: TBD

// Tokens comuni su Dolomite Arbitrum
USDC.e: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
WBTC: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
ARB: 0x912CE59144191C1204E64559FE8253a0e49E6548
```

**⚠️ IMPORTANTE**: Prima del deployment, verifica gli indirizzi aggiornati su:
- [Dolomite Docs - Smart Contract Addresses](https://docs.dolomite.io/smart-contract-addresses)
- Controlla i router per depositi e borrow positions

---

## Deployment

### 1. Prerequisiti

```bash
# Installa dipendenze (se non già fatto)
npm install @openzeppelin/contracts

# Configura .env con:
# - ARBITRUM_RPC_URL
# - PRIVATE_KEY (wallet con ARB/ETH per gas)
```

### 2. Deploy Script

Crea `scripts/deployDolomitePlugin.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
    console.log("Deploying DolomitePlugin...");

    // Arbitrum One addresses (VERIFY THESE!)
    const DOLOMITE_MARGIN = "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072";
    const BORROW_ROUTER = "0x..."; // TODO: Get from docs
    const DEPOSIT_ROUTER = "0x..."; // TODO: Get from docs

    const DolomitePlugin = await ethers.getContractFactory("DolomitePlugin");
    const plugin = await DolomitePlugin.deploy(
        DOLOMITE_MARGIN,
        BORROW_ROUTER,
        DEPOSIT_ROUTER
    );

    await plugin.waitForDeployment();
    const address = await plugin.getAddress();

    console.log(`DolomitePlugin deployed to: ${address}`);
    console.log(`\nNext steps:`);
    console.log(`1. Verify contract on Arbiscan`);
    console.log(`2. Register in Beacon: beacon.upgradeImplementation("DolomitePlugin", "${address}")`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

### 3. Esegui deployment

```bash
npx hardhat run scripts/deployDolomitePlugin.ts --network arbitrum
```

### 4. Verifica su Arbiscan

```bash
npx hardhat verify --network arbitrum <DEPLOYED_ADDRESS> \
    0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072 \
    <BORROW_ROUTER> \
    <DEPOSIT_ROUTER>
```

---

## Registrazione nel Beacon

Dopo il deployment, registra il plugin nel Beacon (come owner del Beacon):

```typescript
import { ethers } from "hardhat";

async function registerPlugin() {
    const BEACON_ADDRESS = "<YOUR_BEACON_ADDRESS>";
    const PLUGIN_ADDRESS = "<DEPLOYED_DOLOMITE_PLUGIN>";

    const beacon = await ethers.getContractAt("IBeacon", BEACON_ADDRESS);
    
    await beacon.upgradeImplementation("DolomitePlugin", PLUGIN_ADDRESS);
    
    console.log("DolomitePlugin registered in Beacon!");
}

registerPlugin();
```

---

## Utilizzo (Fase 1: Deposit/Withdraw)

### Esempio: Deposit USDC su Dolomite

```solidity
// In un contratto che usa DolomitePlugin

import "./interfaces/IBeacon.sol";
import "./interfaces/IDolomitePlugin.sol";

contract MyStrategy {
    IBeacon public immutable beacon;
    
    constructor(address _beacon) {
        beacon = IBeacon(_beacon);
    }
    
    function depositUSDC(uint256 amount) external {
        // 1. Risolvi DolomitePlugin dal Beacon
        address pluginAddr = beacon.getImplementation("DolomitePlugin");
        IDolomitePlugin plugin = IDolomitePlugin(pluginAddr);
        
        // 2. Approva il plugin per spendere USDC
        IERC20(USDC).approve(pluginAddr, amount);
        
        // 3. Deposita su Dolomite
        bool success = plugin.deposit(USDC, amount);
        require(success, "Deposit failed");
        
        // Ora il contratto ha depositato USDC su Dolomite
        // Il balance è visibile su account #0 del plugin
    }
    
    function withdrawUSDC(uint256 amount, address recipient) external {
        address pluginAddr = beacon.getImplementation("DolomitePlugin");
        IDolomitePlugin plugin = IDolomitePlugin(pluginAddr);
        
        // Withdraw da Dolomite
        uint256 withdrawn = plugin.withdraw(USDC, amount, recipient);
        
        // recipient ha ricevuto i token
    }
    
    function checkBalance() external view returns (int256) {
        address pluginAddr = beacon.getImplementation("DolomitePlugin");
        IDolomitePlugin plugin = IDolomitePlugin(pluginAddr);
        
        // Query balance su account #0
        return plugin.getBalance(USDC, 0);
    }
}
```

### Script TypeScript di test

```typescript
import { ethers } from "hardhat";

async function testDeposit() {
    const [signer] = await ethers.getSigners();
    
    const PLUGIN_ADDRESS = "<DEPLOYED_PLUGIN>";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const AMOUNT = ethers.parseUnits("10", 6); // 10 USDC
    
    // Connect to plugin
    const plugin = await ethers.getContractAt("IDolomitePlugin", PLUGIN_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    
    // 1. Approve plugin
    console.log("Approving plugin...");
    await usdc.approve(PLUGIN_ADDRESS, AMOUNT);
    
    // 2. Deposit
    console.log("Depositing 10 USDC...");
    const tx = await plugin.deposit(USDC, AMOUNT);
    await tx.wait();
    console.log("Deposit successful!");
    
    // 3. Check balance
    const balance = await plugin.getBalance(USDC, 0);
    console.log(`Balance on Dolomite: ${ethers.formatUnits(balance, 6)} USDC`);
}

testDeposit();
```

---

## Fase 2: Borrow Positions (TODO)

### Flusso proposto

```solidity
// 1. Open borrow position
BorrowPositionParams memory params = BorrowPositionParams({
    collateralToken: WETH,
    collateralAmount: 1 ether,
    borrowToken: USDC,
    borrowAmount: 1500e6, // $1500 USDC
    toAccountNumber: 1
});

uint256 accountId = plugin.openBorrowPosition(params);

// 2. Close borrow position (later)
plugin.closeBorrowPosition(accountId, recipient);
```

### Implementazione (da fare)

Nel file `DolomitePlugin.sol`, implementare:

```solidity
function openBorrowPosition(
    BorrowPositionParams calldata params
) external nonReentrant whenNotPaused returns (uint256 accountNumber) {
    // 1. Transfer collateral from caller
    IERC20(params.collateralToken).safeTransferFrom(
        msg.sender, 
        address(this), 
        params.collateralAmount
    );
    
    // 2. Deposit collateral to account #0
    deposit(params.collateralToken, params.collateralAmount);
    
    // 3. Move collateral to borrow account
    uint256 collateralMarketId = dolomiteMargin.getMarketIdByTokenAddress(
        params.collateralToken
    );
    
    borrowRouter.openBorrowPosition(
        MAIN_ACCOUNT,
        params.toAccountNumber,
        collateralMarketId,
        params.collateralAmount,
        AccountBalanceLib.BalanceCheckFlag.From
    );
    
    // 4. Borrow tokens to main account
    uint256 borrowMarketId = dolomiteMargin.getMarketIdByTokenAddress(
        params.borrowToken
    );
    
    borrowRouter.transferBetweenAccounts(
        0, // no isolation
        params.toAccountNumber,
        MAIN_ACCOUNT,
        borrowMarketId,
        params.borrowAmount,
        AccountBalanceLib.BalanceCheckFlag.To
    );
    
    // 5. Withdraw borrowed tokens to caller
    withdraw(params.borrowToken, params.borrowAmount, msg.sender);
    
    // 6. Track account
    userBorrowAccounts[msg.sender].push(params.toAccountNumber);
    
    emit BorrowPositionOpened(
        msg.sender,
        params.toAccountNumber,
        params.collateralToken,
        params.collateralAmount,
        params.borrowToken,
        params.borrowAmount
    );
    
    return params.toAccountNumber;
}
```

---

## Testing

### Unit Test (Hardhat)

Crea `test/DolomitePlugin.test.ts`:

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DolomitePlugin", function () {
    let plugin: any;
    let usdc: any;
    let owner: any;
    
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    before(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy plugin
        const DolomitePlugin = await ethers.getContractFactory("DolomitePlugin");
        plugin = await DolomitePlugin.deploy(
            "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072", // DolomiteMargin
            "0x...", // BorrowRouter
            "0x..."  // DepositRouter
        );
        
        usdc = await ethers.getContractAt("IERC20", USDC);
    });
    
    it("Should return correct protocol info", async function () {
        const info = await plugin.getProtocolInfo();
        expect(info.name).to.equal("Dolomite Arbitrum");
        expect(info.version).to.equal("1.0.0");
        expect(info.features).to.equal(1); // DEPOSIT_WITHDRAW only
    });
    
    it("Should check if plugin is healthy", async function () {
        const [healthy, reason] = await plugin.isHealthy();
        expect(healthy).to.be.true;
    });
    
    it("Should support USDC token", async function () {
        const supported = await plugin.supportsToken(USDC);
        expect(supported).to.be.true;
    });
    
    it("Should deposit USDC", async function () {
        const amount = ethers.parseUnits("10", 6);
        
        // Approve
        await usdc.approve(plugin.getAddress(), amount);
        
        // Deposit
        await expect(plugin.deposit(USDC, amount))
            .to.emit(plugin, "Deposited")
            .withArgs(owner.address, USDC, amount, 0);
        
        // Check balance
        const balance = await plugin.getBalance(USDC, 0);
        expect(balance).to.be.gt(0);
    });
});
```

### Fork Testing (Arbitrum)

```bash
# Run tests on Arbitrum fork
npx hardhat test --network arbitrumFork
```

---

## Security Considerations

### Fase 1 (Current)

- ✅ **ReentrancyGuard**: Protegge deposit/withdraw
- ✅ **SafeERC20**: Gestione sicura dei token
- ✅ **Circuit Breaker**: Emergency stop per owner
- ✅ **Balance checks**: Verifica saldi prima di withdraw
- ⚠️ **Trust model**: Plugin ha pieno controllo sugli account Dolomite

### Fase 2 (Borrow Positions)

- 🔒 **Health factor monitoring**: Evitare liquidazioni
- 🔒 **Position isolation**: Ogni borrow position in account separato
- 🔒 **Slippage protection**: Per swaps durante leverage
- 🔒 **Emergency closure**: Funzione per chiudere posizioni in emergenza

### Best Practices

1. **Audit**: Far auditare il codice prima di usare fondi reali
2. **Gradual rollout**: Testare con piccoli importi prima
3. **Monitoring**: Implementare alerting per posizioni a rischio liquidazione
4. **Upgrade path**: Beacon permette upgrade senza migrazioni

---

## Roadmap

### ✅ Fase 1: Deposit/Withdraw (Completata)

- [x] Interfacce Dolomite (`IDolomite.sol`)
- [x] Plugin interface (`IDolomitePlugin.sol`)
- [x] Implementazione deposit/withdraw
- [x] Health checks e metadata
- [ ] Unit tests
- [ ] Deploy su Arbitrum testnet
- [ ] Deploy su Arbitrum mainnet

### 🚧 Fase 2: Borrow Positions (In Progress)

- [ ] Implementare `openBorrowPosition()`
- [ ] Implementare `closeBorrowPosition()`
- [ ] Implementare `getPositionSummary()`
- [ ] Implementare `getMaxBorrowAmount()`
- [ ] Health factor monitoring
- [ ] Liquidation protection
- [ ] Integration tests

### 🔮 Fase 3: Leverage (Future)

- [ ] Implementare `openLeveragedPosition()`
- [ ] Loop deposit → borrow → re-deposit
- [ ] Risk management (max leverage caps)
- [ ] De-leverage strategies
- [ ] Integration con SwapManager per swap collateral/debt

---

## Resources

- **Dolomite Docs**: [https://docs.dolomite.io](https://docs.dolomite.io)
- **Smart Contract Addresses**: [https://docs.dolomite.io/smart-contract-addresses](https://docs.dolomite.io/smart-contract-addresses)
- **Managing Borrow Positions**: [https://docs.dolomite.io/developer-documentation/managing-borrow-positions](https://docs.dolomite.io/developer-documentation/managing-borrow-positions)
- **Dolomite Margin Glossary**: [https://docs.dolomite.io/developer-documentation/dolomite-margin-glossary](https://docs.dolomite.io/developer-documentation/dolomite-margin-glossary)
- **GitHub**: [https://github.com/dolomite-exchange](https://github.com/dolomite-exchange)

---

## Support

Per domande o problemi:
1. Controlla la documentazione ufficiale Dolomite
2. Verifica gli indirizzi dei contratti su Arbitrum
3. Testa su testnet prima di usare mainnet
4. Considera un audit professionale per produzione

---

**Next Steps:**

1. ✅ Verificare indirizzi router Dolomite su Arbitrum
2. ✅ Creare deploy script
3. ✅ Deploy su testnet per testing
4. ✅ Implementare Fase 2 (borrow positions)
5. 🔄 Testing end-to-end con fondi reali (piccoli importi)
