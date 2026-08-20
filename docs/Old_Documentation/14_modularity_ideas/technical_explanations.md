# 🔧 SPIEGAZIONI TECNICHE - Modularity Ideas

## 💡 **Spiegazioni Dettagliate per Ogni Implementazione**

---

## **1. 🔌 Plugin Factory System**

### **Che Cosa È**
Un sistema che ti permette di creare nuovi "plugin" (moduli aggiuntivi) senza modificare i contratti esistenti.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE: 
// Per aggiungere Uniswap router devi modificare SwapManager.sol

// CON PLUGIN FACTORY:
// 1. Crei un nuovo contratto UniswapPlugin.sol
// 2. Chiami pluginFactory.deployPlugin("UniswapV3", initData)
// 3. Il factory lo deploya e registra automaticamente
// 4. SwapManager ora può usare il nuovo plugin senza modifiche
```

### **Esempio Concreto**
```solidity
// Plugin per Uniswap V3
contract UniswapV3Plugin {
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256) {
        // Logica specifica Uniswap V3
        IUniswapV3Router(UNISWAP_ROUTER).exactInputSingle(params);
    }
}

// Il factory lo deploya e registra
pluginFactory.deployPlugin("UniswapV3", encodedParams);

// SwapManager ora può usarlo
swapManager.swapViaPlugin("UniswapV3", tokenIn, tokenOut, amount);
```

### **Benefici**
- ✅ Aggiungi nuovi DEX senza toccare codice esistente
- ✅ Disabilita/abilita plugin senza redeploy
- ✅ Ogni plugin è isolato (se uno ha bug, non rompe gli altri)

---

## **2. 🎯 Strategy Pattern per Everything**

### **Che Cosa È**
Invece di avere logica hardcoded, ogni funzione importante usa una "strategia" intercambiabile.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
function deposit() external payable {
    // Logica deposit hardcoded qui dentro
}

// CON STRATEGY PATTERN:
function deposit() external payable {
    return depositStrategy.execute(msg.value, msg.sender);
}
```

### **Esempio Concreto - Depositi**
```solidity
// Strategia per depositi ETH
contract ETHDepositStrategy {
    function execute(uint256 amount, address user) external returns (uint256 shares) {
        // Wrap ETH -> WETH
        weth.deposit{value: amount}();
        // Calcola shares
        shares = calculateShares(amount);
        // Minta LP tokens
        proxyGeneral.mint(user, shares);
    }
}

// Strategia per depositi USDC
contract USDCDepositStrategy {
    function execute(uint256 amount, address user) external returns (uint256 shares) {
        // Transfer USDC from user
        usdc.transferFrom(user, address(this), amount);
        // Calcola shares (diversa logica per decimali)
        shares = calculateShares(amount * 1e12); // Scale 6->18 decimals
        // Minta LP tokens
        proxyGeneral.mint(user, shares);
    }
}

// LiquidityManager può switchare strategia
liquidityManager.setDepositStrategy(address(usdcDepositStrategy));
```

### **Benefici**
- ✅ Cambi come funzionano depositi/withdraw senza redeploy
- ✅ Test strategie diverse in produzione
- ✅ Rollback istantaneo se strategia ha problemi

---

## **3. 🧩 Composable Module System**

### **Che Cosa È**
Un "app store" per moduli DeFi. Installi/disinstalli moduli come app sul telefono.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Tutti i moduli sono deployati insieme, hardcoded

// CON MODULE SYSTEM:
moduleRegistry.installModule("YieldOptimizer", address(yieldOptimizerImpl));
moduleRegistry.installModule("FlashLoanProvider", address(flashLoanImpl));
moduleRegistry.uninstallModule("OldModule"); // Rimuovi se non serve più
```

### **Esempio Concreto**
```solidity
// Nuovo modulo: Flash Loan Provider
contract FlashLoanModule {
    function requestFlashLoan(uint256 amount) external {
        // Logica flash loan
    }
}

// Lo installi
moduleRegistry.installModule("FlashLoan", address(flashLoanModule));

// Ora tutti i contratti possono usarlo
address flashLoanModule = moduleRegistry.getModule("FlashLoan");
IFlashLoan(flashLoanModule).requestFlashLoan(1000 ether);
```

### **Benefici**
- ✅ Aggiungi funzionalità senza modificare contratti base
- ✅ Moduli hanno dipendenze (es: FlashLoan dipende da LiquidityManager)
- ✅ Versioning automatico

---

## **4. 🎛️ Configuration Templates**

### **Che Cosa È**
Template preconfigurati per deployare nuovi ecosistemi velocemente.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Per deployare USDC ecosystem devi:
// 1. Deploy manualmente tutti i contratti
// 2. Configurare parametri uno per uno
// 3. Setup autorizzazioni
// 4. Test tutto

// CON CONFIGURATION TEMPLATES:
// 1. configManager.deployFromTemplate("StablecoinEcosystem", usdcAddress)
// 2. Fatto! ✅
```

### **Esempio Concreto**
```solidity
// Template per stablecoin ecosystem
EcosystemConfig memory stablecoinTemplate = EcosystemConfig({
    baseToken: USDC_ADDRESS,
    decimals: 6,
    minDeposit: 1e6,        // 1 USDC
    maxDeposit: 1000000e6,  // 1M USDC
    rebalanceThreshold: 500, // 5%
    supportedTokens: [USDC_ADDRESS, WETH_ADDRESS, WBTC_ADDRESS],
    activePlugins: ["UniswapV3", "Curve", "Aave"]
});

// Deploy completo ecosystem in 1 transazione
address[] memory deployed = configManager.createEcosystem("USDC-Pool", stablecoinTemplate);
```

### **Benefici**
- ✅ Deploy nuovo ecosistema in minuti invece di ore
- ✅ Configurazioni testate e ottimizzate
- ✅ Zero errori di configurazione

---

## **5. 🔄 Hot-Swappable Components**

### **Che Cosa È**
Cambi componenti del sistema "a caldo" senza pause o downtime.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Per aggiornare ValueCalculator devi:
// 1. Pause tutto il sistema
// 2. Deploy nuovo contratto
// 3. Update Beacon
// 4. Unpause
// 5. Sperare che non ci siano bug

// CON HOT-SWAP:
// 1. Deploy nuovo ValueCalculator in "standby"
// 2. Test in modalità shadow (riceve stessi input, ma output non usato)
// 3. Se tutto OK, swap atomico
// 4. Zero downtime
```

### **Esempio Concreto**
```solidity
// Prepara nuovo component
hotSwapManager.prepareSwap("ValueCalculator", address(newValueCalculator));

// Test in background per 1 ora
// newValueCalculator riceve stessi input del vecchio
// ma output non viene usato (shadow mode)

// Se test OK, swap atomico
hotSwapManager.executeSwap("ValueCalculator");
// Da questo momento il nuovo ValueCalculator è attivo

// Se problemi, rollback istantaneo
hotSwapManager.rollbackSwap("ValueCalculator");
```

### **Benefici**
- ✅ Zero downtime per upgrade
- ✅ Test in produzione senza rischi
- ✅ Rollback istantaneo se problemi

---

## **6. 📦 Package Manager per DeFi**

### **Che Cosa È**
Come npm per Node.js, ma per contratti DeFi. Installi "pacchetti" di funzionalità.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Vuoi aggiungere yield farming? Devi:
// 1. Scrivere tutto da zero
// 2. Integrare manualmente
// 3. Test tutto

// CON PACKAGE MANAGER:
// 1. packageManager.installPackage("@aave/lending-integration")
// 2. packageManager.installPackage("@compound/yield-farming") 
// 3. Tutto configurato e pronto ✅
```

### **Esempio Concreto**
```solidity
// Pacchetto Aave Integration
Package memory aavePackage = Package({
    name: "@aave/lending-integration",
    version: "1.2.0",
    contracts: [aaveLendingModule, aaveInterestModule],
    initData: [aaveInitData, interestInitData],
    dependencies: ["@openzeppelin/safe-math"]
});

// Installa
packageManager.installPackage("@aave/lending-integration");

// Ora puoi usare
IAaveLending aave = IAaveLending(packageManager.getContract("AaveLending"));
aave.supply(USDC_ADDRESS, 1000e6);
```

### **Benefici**
- ✅ Riusa codice testato dalla community
- ✅ Update automatici per security fixes
- ✅ Dependency management automatico

---

## **7. 🤖 Auto-Discovery System**

### **Che Cosa È**
I contratti si "presentano" automaticamente e dicono cosa sanno fare.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Per integrare nuovo contratto devi:
// 1. Leggere documentazione
// 2. Capire che funzioni ha
// 3. Scrivere integrazione manualmente

// CON AUTO-DISCOVERY:
// 1. discovery.discoverContract(newContractAddress)
// 2. Sistema scopre automaticamente: "Ah, questo fa swap!"
// 3. Lo integra automaticamente nell'architettura
```

### **Esempio Concreto**
```solidity
// Nuovo contratto si presenta
contract NewDEXRouter is IDiscoverable {
    function getCapabilities() external view returns (string[] memory) {
        return ["swap", "quote", "liquidity"];
    }
    
    function getInterfaces() external view returns (bytes4[] memory) {
        return [type(ISwapRouter).interfaceId, type(ILiquidityProvider).interfaceId];
    }
}

// Sistema lo scopre automaticamente
discovery.discoverContract(address(newDEXRouter));

// Ora SwapManager può usarlo automaticamente
address[] memory routers = discovery.findCompatibleContracts("swap");
// newDEXRouter è incluso nella lista!
```

### **Benefici**
- ✅ Integrazione automatica di nuovi protocolli
- ✅ Zero configurazione manuale
- ✅ Scopre automaticamente nuove funzionalità

---

## **8. 🎨 Template-Based Deployment**

### **Che Cosa È**
Template già pronti per deploy completo di sistemi DeFi.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Deploy completo ecosystem = 20+ transazioni manuali

// CON TEMPLATE:
// deploymentTemplate.deployFromTemplate("YieldFarm", customData);
// 1 transazione = sistema completo ✅
```

### **Esempio Concreto**
```solidity
// Template "Yield Farm"
Template memory yieldFarmTemplate = Template({
    name: "YieldFarm",
    requiredContracts: ["StakingPool", "RewardDistributor", "LPToken"],
    constructorArgs: [farmInitData, rewardInitData, tokenInitData],
    initializationCalls: ["setupRewards", "addLiquidity", "startFarming"]
});

// Deploy tutto in 1 transazione
address[] memory deployed = template.deployFromTemplate("YieldFarm", myCustomData);
// deployed[0] = StakingPool
// deployed[1] = RewardDistributor  
// deployed[2] = LPToken
// Tutto configurato e pronto! ✅
```

### **Benefici**
- ✅ Deploy sistemi complessi in 1 click
- ✅ Template testati e ottimizzati
- ✅ Zero errori di configurazione

---

## **9. 🔮 Future-Proof Interface Registry**

### **Che Cosa È**
Registry centrale di tutte le interfacce. Contratti si registrano automaticamente.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Nuovo standard EIP viene rilasciato
// Devi modificare manualmente tutti i contratti per supportarlo

// CON INTERFACE REGISTRY:
// 1. Registry si aggiorna automaticamente
// 2. Contratti implementano nuovo standard
// 3. Sistema li riconosce automaticamente
```

### **Esempio Concreto**
```solidity
// Registro nuova interfaccia EIP-9999
interfaceRegistry.registerInterface("EIP9999", 0x12345678);

// Contratto implementa nuovo standard
contract MyContract is IEIP9999 {
    // Implementazione EIP-9999
}

// Sistema lo riconosce automaticamente
bool supportsNew = interfaceRegistry.implementsInterface(
    address(myContract), 
    0x12345678
);
// true! ✅

// Trova tutti i contratti che supportano EIP-9999
address[] memory compatible = interfaceRegistry.findByInterface(0x12345678);
```

### **Benefici**
- ✅ Compatibilità automatica con nuovi standard
- ✅ Discovery automatico delle funzionalità
- ✅ Future-proof per nuovi EIP

---

## **10. 🎯 Event-Driven Architecture**

### **Che Cosa È**
Sistema di messaggi. Contratti si parlano tramite eventi invece di chiamate dirette.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// LiquidityManager chiama direttamente ValueCalculator
valueCalculator.updateTotalValue();

// CON EVENT-DRIVEN:
// LiquidityManager pubblica evento
eventBus.publish("PoolValueChanged", data);

// ValueCalculator è in ascolto e si aggiorna automaticamente
// Benefit: se aggiungi nuovo modulo, si sottoscrive automaticamente
```

### **Esempio Concreto**
```solidity
// LiquidityManager pubblica evento
function deposit() external payable {
    // ... logica deposit
    
    eventBus.publish("NewDeposit", abi.encode(msg.sender, msg.value));
}

// ValueCalculator si sottoscrive
eventBus.subscribe("NewDeposit", address(valueCalculator));

// Analytics Module si sottoscrive allo stesso evento
eventBus.subscribe("NewDeposit", address(analyticsModule));

// Entrambi si aggiornano automaticamente quando arriva evento!
```

### **Benefici**
- ✅ Accoppiamento zero tra moduli
- ✅ Aggiungi listener senza modificare publisher
- ✅ Architettura scalabile

---

## **🚀 ECOSYSTEM FACTORY - La Più Potente**

### **Che Cosa È**
Un "cloner" di ecosistemi. Prendi l'ecosystem ETH esistente e lo cloni per USDC/WBTC automaticamente.

### **Come Funziona Praticamente**
```solidity
// SITUAZIONE ATTUALE:
// Creare USDC ecosystem = settimane di lavoro

// CON ECOSYSTEM FACTORY:
ecosystemFactory.cloneEcosystem(ethEcosystemAddress, USDC_ADDRESS);
// 1 transazione = USDC ecosystem identico a ETH ecosystem ✅
```

### **Esempio Concreto**
```solidity
// Clone ETH ecosystem per WBTC
address[] memory wbtcContracts = ecosystemFactory.cloneEcosystem(
    ethEcosystemBeacon,    // Ecosystem da clonare
    WBTC_ADDRESS           // Nuovo base token
);

// Risultato:
// wbtcContracts[0] = BeaconWBTC
// wbtcContracts[1] = ProxyGeneralWBTC  
// wbtcContracts[2] = LiquidityManagerWBTC
// wbtcContracts[3] = ValueCalculatorWBTC
// ... tutti i contratti, già configurati per WBTC!

// Deploy blueprint personalizzato
EcosystemBlueprint memory custom = EcosystemBlueprint({
    name: "Super-USDC-Pool",
    baseToken: USDC_ADDRESS,
    decimals: 6,
    requiredModules: ["LiquidityManager", "SwapManager", "YieldOptimizer"],
    optionalPlugins: ["UniswapV3", "Curve", "Balancer"],
    configData: customConfigBytes
});

address[] memory customEcosystem = ecosystemFactory.deployEcosystem(custom);
```

### **Benefici**
- ✅ Deploy ecosistemi in secondi
- ✅ Zero configurazione manuale
- ✅ Blueprint personalizzabili
- ✅ Consistency garantita tra ecosistemi

---

## 🎯 **RIASSUNTO: Perché Ogni Idea è Figata**

| Idea | Benefit Principale | Caso d'Uso |
|------|-------------------|-------------|
| **Plugin Factory** | Aggiungi DEX senza modifiche | Nuovo Uniswap V4 released → deploy plugin |
| **Strategy Pattern** | Cambi logica senza redeploy | Vuoi testare nuova formula fee |
| **Module System** | App store per DeFi | Installi yield farming in 1 click |
| **Config Templates** | Deploy rapido ecosistemi | USDT ecosystem in 5 minuti |
| **Hot Swap** | Zero downtime upgrade | Upgrade critico senza pause |
| **Package Manager** | Riusa codice community | Installi Aave integration |
| **Auto Discovery** | Integrazione automatica | Nuovo protocollo si integra da solo |
| **Templates** | Deploy sistemi complessi | Yield farm completo in 1 tx |
| **Interface Registry** | Future-proof per EIP | Supporto automatico EIP-4626 |
| **Event-Driven** | Architettura scalabile | Analytics si aggiorna da solo |
| **Ecosystem Factory** | Clone ecosistemi | 3 ecosistemi in 3 transazioni |

Tutte queste idee ti rendono il sistema **infinitamente espandibile** senza mai dover modificare il core! 🚀

---

## 🎯 **STRATEGIA IMPLEMENTATA: Opzione 3 - Hybrid Modular Architecture**

### **📋 Decisione Finale**

Dopo analisi approfondita, abbiamo scelto **Opzione 3** che combina:
- **Strategy Pattern** per modularità del codice
- **3 Deploy Separati** per isolamento architetturale

### **🔍 Analisi Comparativa delle 3 Opzioni**

#### **Opzione 1: Copy & Paste (❌ Scartata)**
```
Approccio: Copiare contratti 3 volte manualmente

Architettura:
- ETH_Ecosystem/ (tutti i contratti)
- USDC_Ecosystem/ (tutti i contratti duplicati)  
- WBTC_Ecosystem/ (tutti i contratti duplicati)

Pro:
✅ Semplice concettualmente
✅ Isolamento totale garantito

Contro:
❌ 3x codice da mantenere
❌ Bug fix richiede modificare 3 posti
❌ Aggiungere DAI = 1-2 settimane lavoro
❌ Zero modularità
❌ Nessun riuso codice

Verdict: ❌ Scartata per mancanza di scalabilità
```

#### **Opzione 2: 1 Pool Misto (❌ Scartata)**
```
Approccio: 1 solo deploy, gestisce tutti i token

Architettura:
├── 1 Beacon (condiviso)
├── 1 ProxyGeneral (contiene ETH + USDC + WBTC)
├── 1 LiquidityManager (gestisce deposit multi-token)
├── 1 ValueCalculator (calcola valore cross-asset)
└── 1 LP Token (rappresenta quota pool misto)

Flusso Utente:
User deposita 100 USDC
↓
Riceve LP tokens (es: 100 LP)
↓
LP tokens rappresentano:
- 33% quota pool ETH (0.02 ETH)
- 33% quota pool USDC (33 USDC)  
- 33% quota pool WBTC (0.001 WBTC)

Withdraw:
- Utente può ricevere ETH, USDC, o WBTC
- Sistema decide mix ottimale
- Rebalancing automatico cross-asset

Pro:
✅ Massima modularità codice
✅ 1 solo deploy (~$10 gas)
✅ Facilissimo aggiungere nuovi token
✅ Liquidity sharing tra asset

Contro:
❌ RISCHIO CONTAGIO: Bug in USDC strategy → TUTTO il pool a rischio
❌ CONFUSIONE UTENTE: "Ho depositato USDC, perché ricevo WBTC?"
❌ COMPLESSITÀ: Value calculation cross-asset molto complessa
❌ REBALANCING: Necessita oracle multi-asset complessi
❌ COMPLIANCE: Regolamentazione mista stablecoin/crypto problematica
❌ SLIPPAGE: Withdraw cross-asset introduce slippage
❌ UX: Utente non sa cosa riceverà indietro

Verdict: ❌ Scartata per rischi sicurezza e UX confusa
```

#### **Opzione 3: 3 Pool Separati + Strategy Pattern (✅ SCELTA)**
```
Approccio: Codice modulare + 3 deploy separati

Architettura:
CODEBASE (Template Modulare - scritto 1 volta):
├── LiquidityManager.sol (strategy-based)
├── ValueCalculator.sol (strategy-based)
├── SwapManager.sol (strategy-based)
└── Strategies/
    ├── ETHDepositStrategy.sol
    ├── USDCDepositStrategy.sol
    ├── WBTCDepositStrategy.sol
    ├── ETHValueStrategy.sol
    ├── USDCValueStrategy.sol
    └── WBTCValueStrategy.sol

DEPLOYMENT 1 - ETH ECOSYSTEM:
├── Beacon-ETH
├── ProxyGeneral-ETH (custody SOLO ETH/WETH)
├── LiquidityManager-ETH (→ usa ETHDepositStrategy)
├── ValueCalculator-ETH (→ usa ETHValueStrategy)
└── Altri moduli...
→ LP Token: LP-ETH (backed 100% da ETH)

DEPLOYMENT 2 - USDC ECOSYSTEM:
├── Beacon-USDC
├── ProxyGeneral-USDC (custody SOLO USDC)
├── LiquidityManager-USDC (→ usa USDCDepositStrategy)
├── ValueCalculator-USDC (→ usa USDCValueStrategy)
└── Altri moduli...
→ LP Token: LP-USDC (backed 100% da USDC)

DEPLOYMENT 3 - WBTC ECOSYSTEM:
├── Beacon-WBTC
├── ProxyGeneral-WBTC (custody SOLO WBTC)
├── LiquidityManager-WBTC (→ usa WBTCDepositStrategy)
├── ValueCalculator-WBTC (→ usa WBTCValueStrategy)
└── Altri moduli...
→ LP Token: LP-WBTC (backed 100% da WBTC)

Flusso Utente ETH:
User deposita 1 ETH → Pool ETH
↓
Riceve 1 LP-ETH
↓
LP-ETH rappresenta: 100% quota del SOLO pool ETH
↓
Withdraw: Riceve ETH (o swap ETH→altri nel pool ETH)

Flusso Utente USDC:
User deposita 100 USDC → Pool USDC
↓
Riceve 100 LP-USDC
↓
LP-USDC rappresenta: 100% quota del SOLO pool USDC
↓
Withdraw: Riceve USDC (o swap USDC→altri nel pool USDC)

Pro:
✅ ISOLAMENTO: Bug in USDC → solo pool USDC affetto
✅ CHIAREZZA: Utente sceglie "Pool ETH" o "Pool USDC"
✅ MODULARITÀ: Codice base strategy-ready, scritto 1 volta
✅ SICUREZZA: Failure isolation completo tra pool
✅ COMPLIANCE: Regolamentazione separata per tipo asset
✅ SCALABILITÀ: Aggiungere DAI = 1-2 giorni (vs 1-2 settimane)
✅ MARKETING: "ETH Yield Pool", "USDC Stable Pool", "WBTC Bitcoin Pool"
✅ UX: Utente sa esattamente cosa riceverà
✅ TESTING: Test isolato per ogni ecosystem
✅ MAINTENANCE: Bug fix in 1 posto, propagato a tutti

Contro:
❌ 3x deploy cost (~$30 vs $10)
❌ Refactoring iniziale (+1 settimana)
❌ Più gas per operazioni cross-pool

Verdict: ✅ SCELTA VINCENTE - Combina modularità + sicurezza + UX
```

### **💰 ROI Analysis Dettagliata**

#### **Investimento Iniziale**
```
COSTI:
- Refactoring codice (Strategy Pattern): 1 settimana dev
- Deploy 3 ecosistemi: ~$30 gas (Arbitrum)
- Testing completo: 3-5 giorni
- Frontend integration: 1 settimana

TOTALE: 2.5-3 settimane + $30
```

#### **Return on Investment**
```
SCENARIO SENZA Strategy Pattern (Copy 3x):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aggiungere DAI ecosystem:
- Copiare tutti i contratti: 2 giorni
- Modificare per DAI: 3-4 giorni
- Testing: 2-3 giorni
- Bug fix in 4 codebase: 1-2 settimane
TOTALE: 1-2 settimane per nuovo token

SCENARIO CON Strategy Pattern (Opzione 3):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aggiungere DAI ecosystem:
- Creare DAIDepositStrategy: 1-2 ore
- Creare DAIValueStrategy: 1 ora
- Deploy ecosystem: 30 minuti
- Testing: 2-3 ore
- Frontend update: 1 ora
TOTALE: 1-2 giorni per nuovo token ✅

RISPARMIO: 1-2 settimane → 1-2 giorni = 80-90% riduzione tempo
```

#### **Long-Term Value (3 anni)**
```
ANNO 1 (2025):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Deploy iniziale: ETH, USDC, WBTC
- Investimento: 3 settimane + $30
- Risparmio: 0 settimane (ancora in investimento)

ANNO 2 (2026):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Aggiunta: DAI ecosystem
  * SENZA strategy: 1-2 settimane
  * CON strategy: 1-2 giorni
  * Risparmio: 1-2 settimane

- Aggiunta: USDT ecosystem
  * SENZA strategy: 1-2 settimane
  * CON strategy: 1-2 giorni
  * Risparmio: 1-2 settimane

TOTALE ANNO 2: Risparmio 2-4 settimane

ANNO 3 (2027):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Aggiunta: FRAX, LUSD, BUSD ecosystems
  * SENZA strategy: 3-6 settimane
  * CON strategy: 3-6 giorni
  * Risparmio: 3-6 settimane

TOTALE ANNO 3: Risparmio 3-6 settimane

RISPARMIO CUMULATIVO 3 ANNI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tempo: 5-10 settimane sviluppo
Costi: $50,000-$100,000 (stimato a $10k/settimana dev)
ROI: 1500%-3000% dopo 3 anni

BREAK-EVEN: Dopo 2° nuovo token (fine anno 2)
```

### **🔧 Implementazione: Roadmap Tecnica Completa**

#### **Fase 1: Refactoring (1 settimana)**

**Step 1.1: Creare Interfacce Strategy (2 giorni)**
```solidity
// contracts/interfaces/strategies/IDepositStrategy.sol
pragma solidity ^0.8.19;

interface IDepositStrategy {
    /// @notice Execute deposit logic
    /// @param amount Amount to deposit (in base token decimals)
    /// @param user User address
    /// @return shares LP tokens minted (always 18 decimals)
    function execute(
        uint256 amount, 
        address user
    ) external returns (uint256 shares);
    
    /// @notice Get tokens that require approval before deposit
    /// @dev Empty array for native token deposits (ETH)
    function getRequiredApprovals() external view returns (address[] memory);
    
    /// @notice Get base token decimals
    function getTokenDecimals() external pure returns (uint8);
    
    /// @notice Get minimum deposit amount
    function getMinDeposit() external view returns (uint256);
}

// contracts/interfaces/strategies/IValueStrategy.sol
pragma solidity ^0.8.19;

interface IValueStrategy {
    /// @notice Calculate total pool value in base token
    /// @return Total value in base token decimals
    function calculateTotalValue() external view returns (uint256);
    
    /// @notice Convert any token amount to base token
    /// @param token Token address to convert
    /// @param amount Amount in token decimals
    /// @return Amount in base token decimals
    function convertToBaseToken(
        address token, 
        uint256 amount
    ) external view returns (uint256);
    
    /// @notice Get base token address
    function getBaseToken() external view returns (address);
}

// contracts/interfaces/strategies/IWithdrawStrategy.sol
pragma solidity ^0.8.19;

interface IWithdrawStrategy {
    /// @notice Execute withdraw logic
    /// @param shares LP tokens to burn (18 decimals)
    /// @param user User address
    /// @return amount Base token returned (in base token decimals)
    function execute(
        uint256 shares,
        address user
    ) external returns (uint256 amount);
    
    /// @notice Preview withdraw amount
    /// @param shares LP tokens amount
    /// @return amount Expected base token return
    function previewWithdraw(uint256 shares) external view returns (uint256);
    
    /// @notice Get withdraw fee percentage (basis points)
    function getWithdrawFee() external view returns (uint256);
}
```

**Step 1.2: Modificare LiquidityManager (2 giorni)**
```solidity
// contracts/Liquiditymanager.sol
pragma solidity ^0.8.19;

import "./interfaces/strategies/IDepositStrategy.sol";
import "./interfaces/strategies/IWithdrawStrategy.sol";

contract LiquidityManager {
    // Strategy storage
    IDepositStrategy public depositStrategy;
    IWithdrawStrategy public withdrawStrategy;
    
    // Events
    event DepositStrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    event WithdrawStrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    
    // Modifica deposit function
    function deposit(uint256 amount) external payable returns (uint256) {
        require(address(depositStrategy) != address(0), "Deposit strategy not set");
        
        // Validate input
        uint256 actualAmount = msg.value > 0 ? msg.value : amount;
        require(actualAmount > 0, "Invalid amount");
        require(actualAmount >= depositStrategy.getMinDeposit(), "Below minimum deposit");
        
        // Delega a strategy
        uint256 shares = depositStrategy.execute(actualAmount, msg.sender);
        
        emit Deposit(msg.sender, actualAmount, shares);
        return shares;
    }
    
    // Modifica withdraw function  
    function withdraw(uint256 shares) external returns (uint256) {
        require(address(withdrawStrategy) != address(0), "Withdraw strategy not set");
        require(shares > 0, "Invalid shares");
        
        // Delega a strategy
        uint256 amount = withdrawStrategy.execute(shares, msg.sender);
        
        emit Withdraw(msg.sender, shares, amount);
        return amount;
    }
    
    // Admin functions per settare strategie
    function setDepositStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy");
        address oldStrategy = address(depositStrategy);
        depositStrategy = IDepositStrategy(_strategy);
        emit DepositStrategyUpdated(oldStrategy, _strategy);
    }
    
    function setWithdrawStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy");
        address oldStrategy = address(withdrawStrategy);
        withdrawStrategy = IWithdrawStrategy(_strategy);
        emit WithdrawStrategyUpdated(oldStrategy, _strategy);
    }
    
    // View functions
    function getRequiredApprovals() external view returns (address[] memory) {
        return depositStrategy.getRequiredApprovals();
    }
    
    function previewWithdraw(uint256 shares) external view returns (uint256) {
        return withdrawStrategy.previewWithdraw(shares);
    }
}
```

**Step 1.3: Modificare ValueCalculator (1 giorno)**
```solidity
// contracts/ValueCalculator.sol
pragma solidity ^0.8.19;

import "./interfaces/strategies/IValueStrategy.sol";

contract ValueCalculator {
    // Strategy storage
    IValueStrategy public valueStrategy;
    
    event ValueStrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    
    // Modifica getTotalPoolValue
    function getTotalPoolValue() external view returns (uint256) {
        require(address(valueStrategy) != address(0), "Value strategy not set");
        return valueStrategy.calculateTotalValue();
    }
    
    // Modifica convertToBaseToken
    function convertToBaseToken(
        address token,
        uint256 amount
    ) external view returns (uint256) {
        require(address(valueStrategy) != address(0), "Value strategy not set");
        return valueStrategy.convertToBaseToken(token, amount);
    }
    
    // Admin function
    function setValueStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy");
        address oldStrategy = address(valueStrategy);
        valueStrategy = IValueStrategy(_strategy);
        emit ValueStrategyUpdated(oldStrategy, _strategy);
    }
    
    // View function
    function getBaseToken() external view returns (address) {
        return valueStrategy.getBaseToken();
    }
}
```

#### **Fase 2: Implementare Strategies (2-3 giorni)**

**ETH Strategies (1 giorno)**
```solidity
// contracts/strategies/ETHDepositStrategy.sol
pragma solidity ^0.8.19;

import "../interfaces/strategies/IDepositStrategy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IProxyGeneral.sol";

contract ETHDepositStrategy is IDepositStrategy {
    address public immutable weth;
    address public immutable proxyGeneral;
    address public immutable liquidityManager;
    uint256 public constant MIN_DEPOSIT = 0.001 ether; // 0.001 ETH
    
    constructor(address _weth, address _proxyGeneral, address _liquidityManager) {
        weth = _weth;
        proxyGeneral = _proxyGeneral;
        liquidityManager = _liquidityManager;
    }
    
    function execute(uint256 amount, address user) external override returns (uint256 shares) {
        require(msg.sender == liquidityManager, "Only LiquidityManager");
        require(amount >= MIN_DEPOSIT, "Below minimum");
        
        // 1. Wrap ETH to WETH
        IWETH(weth).deposit{value: amount}();
        
        // 2. Transfer WETH to ProxyGeneral
        IERC20(weth).transfer(proxyGeneral, amount);
        
        // 3. Calculate shares (18 decimals native, no scaling needed)
        shares = calculateShares(amount);
        
        // 4. Mint LP tokens to user
        IProxyGeneral(proxyGeneral).mint(user, shares);
        
        return shares;
    }
    
    function getRequiredApprovals() external pure override returns (address[] memory) {
        // Native ETH, no approvals needed
        return new address[](0);
    }
    
    function getTokenDecimals() external pure override returns (uint8) {
        return 18;
    }
    
    function getMinDeposit() external pure override returns (uint256) {
        return MIN_DEPOSIT;
    }
    
    function calculateShares(uint256 amount) internal view returns (uint256) {
        uint256 totalSupply = IProxyGeneral(proxyGeneral).totalSupply();
        if (totalSupply == 0) {
            return amount; // 1:1 for first deposit
        }
        
        uint256 totalValue = IProxyGeneral(proxyGeneral).getTotalPoolValue();
        return (amount * totalSupply) / totalValue;
    }
}

// contracts/strategies/ETHValueStrategy.sol
pragma solidity ^0.8.19;

import "../interfaces/strategies/IValueStrategy.sol";

contract ETHValueStrategy is IValueStrategy {
    address public immutable weth;
    address public immutable proxyGeneral;
    address public immutable valueCalculator;
    
    constructor(address _weth, address _proxyGeneral, address _valueCalculator) {
        weth = _weth;
        proxyGeneral = _proxyGeneral;
        valueCalculator = _valueCalculator;
    }
    
    function calculateTotalValue() external view override returns (uint256) {
        // Get WETH balance in ProxyGeneral
        uint256 wethBalance = IERC20(weth).balanceOf(proxyGeneral);
        
        // Get all other token balances converted to ETH
        uint256 otherTokensValue = calculateOtherTokensValue();
        
        return wethBalance + otherTokensValue;
    }
    
    function convertToBaseToken(
        address token,
        uint256 amount
    ) external view override returns (uint256) {
        if (token == weth) {
            return amount; // Already in base token
        }
        
        // Get token/ETH price from oracle
        uint256 price = getTokenPrice(token, weth);
        return (amount * price) / 1e18;
    }
    
    function getBaseToken() external view override returns (address) {
        return weth;
    }
    
    function calculateOtherTokensValue() internal view returns (uint256) {
        // Implementation: iterate over token list and convert each to ETH
        // ...
    }
    
    function getTokenPrice(address token, address baseToken) internal view returns (uint256) {
        // Implementation: query Chainlink oracle
        // ...
    }
}
```

**USDC Strategies (1 giorno)**
```solidity
// contracts/strategies/USDCDepositStrategy.sol
pragma solidity ^0.8.19;

import "../interfaces/strategies/IDepositStrategy.sol";

contract USDCDepositStrategy is IDepositStrategy {
    address public immutable usdc;
    address public immutable proxyGeneral;
    address public immutable liquidityManager;
    uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDC (6 decimals)
    uint8 public constant TOKEN_DECIMALS = 6;
    uint8 public constant LP_DECIMALS = 18;
    
    constructor(address _usdc, address _proxyGeneral, address _liquidityManager) {
        usdc = _usdc;
        proxyGeneral = _proxyGeneral;
        liquidityManager = _liquidityManager;
    }
    
    function execute(uint256 amount, address user) external override returns (uint256 shares) {
        require(msg.sender == liquidityManager, "Only LiquidityManager");
        require(amount >= MIN_DEPOSIT, "Below minimum");
        
        // 1. Transfer USDC from user to ProxyGeneral (requires prior approval!)
        IERC20(usdc).transferFrom(user, proxyGeneral, amount);
        
        // 2. Scale 6 decimals to 18 for LP token calculation
        uint256 scaledAmount = scaleToLP(amount);
        
        // 3. Calculate shares
        shares = calculateShares(scaledAmount);
        
        // 4. Mint LP tokens (18 decimals) to user
        IProxyGeneral(proxyGeneral).mint(user, shares);
        
        return shares;
    }
    
    function getRequiredApprovals() external view override returns (address[] memory) {
        address[] memory approvals = new address[](1);
        approvals[0] = usdc;
        return approvals;
    }
    
    function getTokenDecimals() external pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }
    
    function getMinDeposit() external pure override returns (uint256) {
        return MIN_DEPOSIT;
    }
    
    /// @notice Scale USDC (6 decimals) to LP token (18 decimals)
    function scaleToLP(uint256 amount) internal pure returns (uint256) {
        return amount * 10**(LP_DECIMALS - TOKEN_DECIMALS); // * 1e12
    }
    
    /// @notice Scale LP token (18 decimals) to USDC (6 decimals)
    function scaleToToken(uint256 amount) internal pure returns (uint256) {
        return amount / 10**(LP_DECIMALS - TOKEN_DECIMALS); // / 1e12
    }
    
    function calculateShares(uint256 scaledAmount) internal view returns (uint256) {
        uint256 totalSupply = IProxyGeneral(proxyGeneral).totalSupply();
        if (totalSupply == 0) {
            return scaledAmount; // 1:1 for first deposit
        }
        
        uint256 totalValue = IProxyGeneral(proxyGeneral).getTotalPoolValue();
        return (scaledAmount * totalSupply) / totalValue;
    }
}

// contracts/strategies/USDCValueStrategy.sol
pragma solidity ^0.8.19;

import "../interfaces/strategies/IValueStrategy.sol";

contract USDCValueStrategy is IValueStrategy {
    address public immutable usdc;
    address public immutable proxyGeneral;
    uint8 public constant TOKEN_DECIMALS = 6;
    uint8 public constant VALUE_DECIMALS = 18;
    
    constructor(address _usdc, address _proxyGeneral) {
        usdc = _usdc;
        proxyGeneral = _proxyGeneral;
    }
    
    function calculateTotalValue() external view override returns (uint256) {
        // Get USDC balance in ProxyGeneral (6 decimals)
        uint256 usdcBalance = IERC20(usdc).balanceOf(proxyGeneral);
        
        // Scale to 18 decimals for consistency
        uint256 scaledBalance = scaleToValue(usdcBalance);
        
        // Get other tokens converted to USDC
        uint256 otherTokensValue = calculateOtherTokensValue();
        
        return scaledBalance + otherTokensValue;
    }
    
    function convertToBaseToken(
        address token,
        uint256 amount
    ) external view override returns (uint256) {
        if (token == usdc) {
            return scaleToValue(amount);
        }
        
        // Get token/USDC price from oracle
        uint256 price = getTokenPrice(token, usdc);
        return (amount * price) / 1e18;
    }
    
    function getBaseToken() external view override returns (address) {
        return usdc;
    }
    
    /// @notice Scale USDC (6 decimals) to value (18 decimals)
    function scaleToValue(uint256 amount) internal pure returns (uint256) {
        return amount * 10**(VALUE_DECIMALS - TOKEN_DECIMALS); // * 1e12
    }
    
    function calculateOtherTokensValue() internal view returns (uint256) {
        // Implementation: iterate and convert
        // ...
    }
    
    function getTokenPrice(address token, address baseToken) internal view returns (uint256) {
        // Implementation: Chainlink oracle
        // ...
    }
}
```

**WBTC Strategies (1 giorno)**
```solidity
// contracts/strategies/WBTCDepositStrategy.sol
pragma solidity ^0.8.19;

import "../interfaces/strategies/IDepositStrategy.sol";

contract WBTCDepositStrategy is IDepositStrategy {
    address public immutable wbtc;
    address public immutable proxyGeneral;
    address public immutable liquidityManager;
    uint256 public constant MIN_DEPOSIT = 1e5; // 0.001 WBTC (8 decimals)
    uint8 public constant TOKEN_DECIMALS = 8;
    uint8 public constant LP_DECIMALS = 18;
    
    constructor(address _wbtc, address _proxyGeneral, address _liquidityManager) {
        wbtc = _wbtc;
        proxyGeneral = _proxyGeneral;
        liquidityManager = _liquidityManager;
    }
    
    function execute(uint256 amount, address user) external override returns (uint256 shares) {
        require(msg.sender == liquidityManager, "Only LiquidityManager");
        require(amount >= MIN_DEPOSIT, "Below minimum");
        
        // 1. Transfer WBTC from user to ProxyGeneral
        IERC20(wbtc).transferFrom(user, proxyGeneral, amount);
        
        // 2. Scale 8 decimals to 18 for LP token calculation
        uint256 scaledAmount = scaleToLP(amount);
        
        // 3. Calculate shares
        shares = calculateShares(scaledAmount);
        
        // 4. Mint LP tokens (18 decimals) to user
        IProxyGeneral(proxyGeneral).mint(user, shares);
        
        return shares;
    }
    
    function getRequiredApprovals() external view override returns (address[] memory) {
        address[] memory approvals = new address[](1);
        approvals[0] = wbtc;
        return approvals;
    }
    
    function getTokenDecimals() external pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }
    
    function getMinDeposit() external pure override returns (uint256) {
        return MIN_DEPOSIT;
    }
    
    /// @notice Scale WBTC (8 decimals) to LP token (18 decimals)
    function scaleToLP(uint256 amount) internal pure returns (uint256) {
        return amount * 10**(LP_DECIMALS - TOKEN_DECIMALS); // * 1e10
    }
    
    function calculateShares(uint256 scaledAmount) internal view returns (uint256) {
        uint256 totalSupply = IProxyGeneral(proxyGeneral).totalSupply();
        if (totalSupply == 0) {
            return scaledAmount;
        }
        
        uint256 totalValue = IProxyGeneral(proxyGeneral).getTotalPoolValue();
        return (scaledAmount * totalSupply) / totalValue;
    }
}
```

### **🚀 Esempio Completo: Aggiungere DAI Ecosystem (Futuro)**

```typescript
// 1. CREATE DAI STRATEGIES (1-2 ore)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// contracts/strategies/DAIDepositStrategy.sol (30 righe)
contract DAIDepositStrategy is IDepositStrategy {
    address public immutable dai;
    address public immutable proxyGeneral;
    uint256 public constant MIN_DEPOSIT = 1 ether; // 1 DAI (18 decimals)
    
    function execute(uint256 amount, address user) external returns (uint256) {
        IERC20(dai).transferFrom(user, proxyGeneral, amount);
        uint256 shares = calculateShares(amount); // No scaling needed (18 decimals)
        IProxyGeneral(proxyGeneral).mint(user, shares);
        return shares;
    }
    
    // ... other required functions (copy from ETHDepositStrategy)
}

// contracts/strategies/DAIValueStrategy.sol (20 righe)
contract DAIValueStrategy is IValueStrategy {
    address public immutable dai;
    address public immutable proxyGeneral;
    
    function calculateTotalValue() external view returns (uint256) {
        uint256 daiBalance = IERC20(dai).balanceOf(proxyGeneral);
        // DAI has 18 decimals, no scaling needed
        return daiBalance + calculateOtherTokensValue();
    }
    
    // ... other required functions (copy from USDCValueStrategy logic)
}


// 2. DEPLOY ECOSYSTEM (30 minuti)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// scripts/deploy/deployDAIEcosystem.ts
import { deployEcosystem } from "./deployEcosystem";

async function main() {
    const DAI_ADDRESS = "0x..."; // DAI su Arbitrum
    
    const daiEcosystem = await deployEcosystem(DAI_ADDRESS, "DAI");
    
    console.log("✅ DAI Ecosystem deployed:");
    console.log("- Beacon:", daiEcosystem.beacon.address);
    console.log("- ProxyGeneral:", daiEcosystem.proxyGeneral.address);
    console.log("- LiquidityManager:", daiEcosystem.liquidityManager.address);
    console.log("- Strategies:", daiEcosystem.strategies);
}

// npx hardhat run scripts/deploy/deployDAIEcosystem.ts --network arbitrum
// ✅ Deploy completo in 1 comando!


// 3. TEST (2-3 ore)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// test/integration/DAIEcosystem.test.ts
describe("DAI Ecosystem", function() {
    it("should deposit DAI and receive LP-DAI", async function() {
        // Setup
        const depositAmount = ethers.parseEther("100"); // 100 DAI
        
        // Approve
        await dai.connect(user).approve(liquidityManagerDAI.address, depositAmount);
        
        // Deposit
        await liquidityManagerDAI.connect(user).deposit(depositAmount);
        
        // Verify
        const lpBalance = await proxyGeneralDAI.balanceOf(user.address);
        expect(lpBalance).to.equal(depositAmount); // 1:1 for first deposit
    });
    
    it("should withdraw DAI by burning LP-DAI", async function() {
        // ... test withdraw flow
    });
    
    it("should calculate pool value correctly", async function() {
        // ... test value calculation
    });
});


// 4. FRONTEND UPDATE (1 ora)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// frontend/config/ecosystems.ts
export const ecosystems = {
    ETH: { /* ... existing config ... */ },
    USDC: { /* ... existing config ... */ },
    WBTC: { /* ... existing config ... */ },
    
    // ADD NEW ECOSYSTEM ✅
    DAI: {
        contracts: {
            liquidityManager: "0x...", // From deployment
            proxyGeneral: "0x...",
            valueCalculator: "0x...",
        },
        token: {
            address: "0x...", // DAI address
            symbol: "DAI",
            name: "Dai Stablecoin",
            decimals: 18,
            icon: "/tokens/dai.svg"
        },
        lpToken: {
            symbol: "LP-DAI",
            name: "DAI Pool LP Token"
        },
        requiresApproval: true,
        category: "stablecoin"
    }
};

// frontend/components/EcosystemSelector.tsx
// Component già supporta nuovo ecosystem automaticamente! ✅


// TOTALE TEMPO: 1-2 GIORNI invece di 1-2 SETTIMANE! 🚀
```

### **📊 Confronto Finale: Perché Opzione 3 Vince**

| Criterio | Opzione 1 (Copy 3x) | Opzione 2 (1 Pool) | Opzione 3 (Hybrid) |
|----------|---------------------|---------------------|---------------------|
| **Modularità Codice** | ❌ Zero | ✅✅✅ Massima | ✅✅ Alta |
| **Isolamento Pool** | ✅✅✅ Totale | ❌ Zero | ✅✅✅ Totale |
| **Sicurezza** | ✅✅ Media | ❌ Bassa | ✅✅✅ Alta |
| **UX Chiarezza** | ✅✅✅ Chiara | ❌ Confusa | ✅✅✅ Chiara |
| **Scalabilità** | ❌ Pessima | ✅✅✅ Ottima | ✅✅✅ Ottima |
| **Deploy Cost** | 💰 $30 | 💰 $10 | 💰💰 $30 |
| **Maintenance** | ❌ 4x codice | ✅ 1x codice | ✅ 1x codice |
| **Compliance** | ✅✅ Separato | ❌ Misto | ✅✅ Separato |
| **Aggiungere Token** | ❌ 1-2 settimane | ✅✅ 1-2 giorni | ✅✅ 1-2 giorni |
| **Testing** | ❌ Complesso | ✅ Semplice | ✅✅ Isolato |
| **Marketing** | ✅✅ Chiaro | ❌ Confuso | ✅✅✅ Chiaro |
| **VERDICT** | ❌ Scartata | ❌ Scartata | ✅ **VINCENTE** |

### **✅ Conclusione**

**Opzione 3 - Hybrid Modular Architecture** è la scelta vincente perché:

1. **Modularità**: Codice scritto 1 volta, riusato N volte
2. **Sicurezza**: Isolamento completo tra pool (failure isolation)
3. **UX**: Esperienza utente chiara e intuitiva
4. **Scalabilità**: Aggiungere token = 1-2 giorni invece di 1-2 settimane
5. **ROI**: Break-even dopo 2° token, risparmio 5-10 settimane in 3 anni

**Status**: ✅ Approvato per implementazione

**Next Steps**: Iniziare Fase 1 - Refactoring per Strategy Pattern

---