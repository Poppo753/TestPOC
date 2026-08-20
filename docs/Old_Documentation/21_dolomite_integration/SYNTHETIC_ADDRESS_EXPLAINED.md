# Synthetic Addresses - Spiegazione Dettagliata

## 🤔 Il Problema

Quando SwapManager esegue uno swap, si aspetta di lavorare con **due indirizzi ERC20**:

```solidity
swapManager.performSwap(
    "WETH",  // tokenCodeIn
    "USDC",  // tokenCodeOut
    1 ether,
    deadline
);

// Internamente SwapManager fa:
// 1. address tokenIn = tokenManager.getTokenAddress("WETH");  // 0x82aF...
// 2. address tokenOut = tokenManager.getTokenAddress("USDC"); // 0xaf88...
// 3. Chiama plugin.inputSwap(tokenIn, tokenOut, amountIn)
```

Ma per Dolomite, non abbiamo un "token di output" reale quando facciamo un deposit! Il deposit su Dolomite non ti dà un token ERC20, ti dà solo un **balance** sul loro contratto.

## 💡 La Soluzione: Synthetic Address

Invece di deployare un vero ERC20 (es. "dWETH token"), **generiamo un indirizzo fake** che rappresenta la posizione su Dolomite.

### Come Funziona

#### 1. **Generazione Deterministica**

```solidity
function _generateSyntheticAddress(address realToken) internal pure returns (address) {
    // SYNTHETIC_PREFIX = keccak256("dolomite.")
    bytes32 hash = keccak256(abi.encodePacked(SYNTHETIC_PREFIX, realToken));
    return address(uint160(uint256(hash)));
}

// Esempio pratico:
// WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
// 
// hash = keccak256("dolomite." + 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1)
//      = 0x7a3f...b2c9 (bytes32)
// 
// syntheticAddr = address(0x7a3f...b2c9)
//               = 0x7a3f...b2c9 (address - primi 20 bytes)
```

**Caratteristiche:**
- ✅ **Deterministico**: Stesso input → sempre stesso output
- ✅ **Unico**: Probabilità di collisione con un vero ERC20 = ~0%
- ✅ **Nessun deploy**: Non è un vero contratto, solo un identificatore
- ✅ **Riproducibile**: Chiunque può calcolare lo stesso indirizzo

#### 2. **Registrazione nel Plugin**

```solidity
// Admin registra WETH
dolomitePlugin.registerToken(WETH);

// Internamente:
address dWETH = _generateSyntheticAddress(WETH); // 0x7a3f...b2c9

// Storage mappings:
realToSynthetic[WETH] = dWETH;  // 0x82aF... → 0x7a3f...
syntheticToReal[dWETH] = WETH;  // 0x7a3f... → 0x82aF...
```

#### 3. **Registrazione in TokenManager**

Questo è **fondamentale** - devi dire a TokenManager che esiste questo "token":

```solidity
// Admin di TokenManager registra il synthetic token
tokenManager.addToken(
    "dWETH",              // code (nome simbolico)
    0x7a3f...b2c9,        // address (synthetic!)
    18,                   // decimals (stesso di WETH)
    CHAINLINK_WETH_ORACLE // oracle (usa stesso di WETH per pricing)
);
```

**Nota importante**: Il synthetic address `0x7a3f...` NON è un vero contratto ERC20! È solo un identificatore nel sistema TokenManager.

#### 4. **Uso in SwapManager**

Ora quando chiami SwapManager:

```solidity
// User/Contract chiama:
swapManager.performSwap("WETH", "dWETH", 1 ether, deadline);

// SwapManager fa:
// 1. tokenIn = tokenManager.getTokenAddress("WETH")
//    → 0x82aF... (vero WETH ERC20)
//
// 2. tokenOut = tokenManager.getTokenAddress("dWETH")
//    → 0x7a3f... (synthetic address, non è un vero token!)
//
// 3. Query plugins: chi supporta (0x82aF..., 0x7a3f...)?
//
//    UniswapV3Plugin.supportsTokenPair(0x82aF..., 0x7a3f...)
//    → false (Uniswap non conosce 0x7a3f...)
//
//    DolomitePlugin.supportsTokenPair(0x82aF..., 0x7a3f...)
//    → true! (perché realToSynthetic[0x82aF...] == 0x7a3f...)
//
// 4. Execute: DolomitePlugin.inputSwap(0x82aF..., 0x7a3f..., 1 ether)
```

---

## 🔍 Step-by-Step: Deposit Flow Completo

### Setup (una volta sola)

```solidity
// === STEP 1: Deploy DolomitePlugin ===
DolomitePlugin plugin = new DolomitePlugin(...);
// plugin address = 0xABC...

// === STEP 2: Register in Beacon ===
beacon.upgradeImplementation("DolomitePlugin", 0xABC...);

// === STEP 3: Register WETH in DolomitePlugin ===
plugin.registerToken(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1); // WETH

// Internamente, plugin genera:
// dWETH = 0x7a3f8d2e1b4c5f6a7b8c9d0e1f2a3b4c5d6e7f8a (esempio)

// Storage:
// plugin.realToSynthetic[0x82aF...] = 0x7a3f...
// plugin.syntheticToReal[0x7a3f...] = 0x82aF...

// === STEP 4: Register dWETH in TokenManager ===
tokenManager.addToken(
    "dWETH",                                                // code
    0x7a3f8d2e1b4c5f6a7b8c9d0e1f2a3b4c5d6e7f8a,           // synthetic address
    18,                                                     // decimals
    0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612            // Chainlink WETH/USD oracle
);

// Ora TokenManager sa che:
// "dWETH" → address = 0x7a3f...
```

### Runtime (ogni deposit)

```solidity
// === USER CALLS ===
myVault.depositToProtocol(1 ether);

// === INSIDE VAULT ===
function depositToProtocol(uint256 amount) external {
    // 1. Approva SwapManager per spendere WETH
    IERC20(WETH).approve(address(swapManager), amount);
    
    // 2. "Swap" WETH → dWETH (in realtà è un deposit)
    uint256 received = swapManager.performSwap(
        "WETH",   // tokenCodeIn
        "dWETH",  // tokenCodeOut (synthetic!)
        amount,
        deadline
    );
    
    // received = 1 ether (1:1 ratio)
}

// === INSIDE SWAPMANAGER ===
function performSwap(
    string memory tokenCodeIn,
    string memory tokenCodeOut,
    uint256 amountIn,
    uint256 deadline
) external returns (uint256 amountOut) {
    // 1. Resolve addresses via TokenManager
    address tokenIn = tokenManager.getTokenAddress("WETH");
    // tokenIn = 0x82aF... (vero WETH)
    
    address tokenOut = tokenManager.getTokenAddress("dWETH");
    // tokenOut = 0x7a3f... (synthetic, NON è un vero token!)
    
    // 2. Find active plugin
    ISimpleSwap plugin = _getActivePlugin(); // DolomitePlugin
    
    // 3. Transfer tokenIn from caller to this
    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    // SwapManager ha ora 1 WETH
    
    // 4. Approve plugin to spend tokenIn
    IERC20(tokenIn).approve(address(plugin), amountIn);
    
    // 5. Execute "swap"
    amountOut = plugin.inputSwap(tokenIn, tokenOut, amountIn);
    // → chiama DolomitePlugin.inputSwap(0x82aF..., 0x7a3f..., 1 ether)
    
    return amountOut;
}

// === INSIDE DOLOMITEPLUGIN ===
function inputSwap(
    address spendToken,    // 0x82aF... (WETH)
    address receiveToken,  // 0x7a3f... (dWETH synthetic)
    uint256 amountIn       // 1 ether
) external returns (uint256 amountOut) {
    // 1. Check direction: deposit or withdraw?
    bool isDeposit = (realToSynthetic[spendToken] == receiveToken);
    // realToSynthetic[0x82aF...] == 0x7a3f... → TRUE
    
    // 2. Execute deposit
    return _executeDeposit(spendToken, receiveToken, amountIn);
}

function _executeDeposit(
    address realToken,      // 0x82aF... (WETH)
    address syntheticToken, // 0x7a3f... (dWETH synthetic, unused here)
    uint256 amount          // 1 ether
) internal returns (uint256) {
    // 1. Get Dolomite market ID for WETH
    uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(realToken);
    
    // 2. Transfer WETH from caller (SwapManager) to this plugin
    IERC20(realToken).transferFrom(msg.sender, address(this), amount);
    // Plugin ha ora 1 WETH
    
    // 3. Approve DepositRouter to spend WETH
    IERC20(realToken).approve(address(depositRouter), amount);
    
    // 4. Deposit to Dolomite (account #0 of this plugin)
    depositRouter.depositERC20(
        0,         // accountNumber = 0 (main account)
        marketId,  // WETH market ID
        amount     // 1 ether
    );
    
    // 5. WETH è ora su Dolomite!
    //    DolomiteMargin.getAccountWei(address(this), 0, marketId) = +1 ether
    
    emit DolomiteDeposit(msg.sender, realToken, amount, syntheticToken);
    
    // 6. Return amount (1:1 ratio)
    return amount; // 1 ether
}

// === BACK TO SWAPMANAGER ===
// amountOut = 1 ether
// SwapManager emette evento SwapExecuted(...)
// return 1 ether;

// === BACK TO VAULT ===
// received = 1 ether
// Vault tracking: user ha "1 dWETH" (concettualmente)
```

**Risultato finale:**
- ✅ User ha depositato 1 WETH
- ✅ WETH è su Dolomite (account #0 del plugin)
- ✅ SwapManager ha trackato come "swap WETH → dWETH"
- ✅ Vault ha ricevuto "1 dWETH" (numero, non token reale)

---

## 🔄 Withdraw Flow (Reverse)

```solidity
// User vuole ritirare
myVault.withdrawFromProtocol(1 ether);

// Vault chiama SwapManager
swapManager.performSwap(
    "dWETH",  // tokenCodeIn (synthetic!)
    "WETH",   // tokenCodeOut (vero WETH)
    1 ether,
    deadline
);

// SwapManager:
// tokenIn = 0x7a3f... (dWETH synthetic)
// tokenOut = 0x82aF... (WETH reale)

// DolomitePlugin.inputSwap(0x7a3f..., 0x82aF..., 1 ether):
bool isWithdraw = (syntheticToReal[0x7a3f...] == 0x82aF...);
// TRUE! È un withdraw

// _executeWithdraw():
// 1. Query balance su Dolomite: getAccountWei(this, 0, WETH_marketId)
//    → balance = 1 ether (depositato prima)
//
// 2. Withdraw da Dolomite:
//    depositRouter.withdrawERC20(0, WETH_marketId, 1 ether, ...)
//    → Plugin riceve 1 WETH da Dolomite
//
// 3. Transfer WETH to SwapManager:
//    IERC20(WETH).transfer(swapManager, 1 ether)
//
// 4. Return 1 ether

// SwapManager riceve 1 WETH reale
// Vault riceve 1 WETH reale
// User riceve 1 WETH reale
```

---

## ❓ FAQ

### Q1: Ma se `0x7a3f...` non è un vero token, come fa SwapManager a trasferirlo?

**A**: NON lo trasferisce! Guarda il codice di `_executeDeposit()`:
- SwapManager trasferisce **WETH** (token reale) al plugin
- Plugin deposita **WETH** su Dolomite
- Plugin **non trasferisce nulla indietro** a SwapManager!
- Plugin ritorna solo il numero `1 ether` (amount)

SwapManager **non fa mai** `IERC20(tokenOut).transferFrom(plugin, caller, amount)` per i deposit, perché il plugin **non restituisce token**, restituisce solo un numero.

### Q2: Come fa TokenManager a dare un prezzo a dWETH se non è un vero token?

**A**: Quando registri dWETH in TokenManager, specifichi:
```solidity
tokenManager.addToken(
    "dWETH",
    0x7a3f...,                                  // synthetic address
    18,
    CHAINLINK_WETH_ORACLE  // ← Usa stesso oracle di WETH!
);
```

TokenManager pensa: "dWETH ha lo stesso prezzo di WETH" perché usi lo stesso oracle. Questo funziona perché deposit/withdraw è 1:1.

### Q3: Cosa succede se chiamo `IERC20(0x7a3f...).balanceOf(user)`?

**A**: 
- Se all'indirizzo `0x7a3f...` non c'è nessun contratto → **REVERT**
- Se per caso c'è un contratto (probabilità ~0) → chiamata va a quel contratto

**Soluzione**: Non chiamare mai funzioni ERC20 sul synthetic address! Il balance esiste solo su Dolomite:
```solidity
// ❌ SBAGLIATO
IERC20(dWETH).balanceOf(user)

// ✅ CORRETTO
int256 balance = dolomitePlugin.getDolomiteBalance(WETH);
// o
int256 balance = dolomiteMargin.getAccountWei(address(plugin), 0, WETH_marketId);
```

### Q4: Perché non deployare un vero ERC20 "dWETH"?

**A**: Potresti farlo! Ma comporterebbe:
- ❌ Gas per deploy
- ❌ Mint/burn su ogni deposit/withdraw
- ❌ Gestione supply tracking
- ❌ Complessità aggiuntiva

Con synthetic addresses:
- ✅ Zero deploy
- ✅ Zero gas per token operations
- ✅ Semplice: solo mappings
- ✅ Deterministico e riproducibile

### Q5: Posso trasferire "dWETH" tra users?

**A**: NO! Perché non è un vero token. Il "balance dWETH" esiste solo come:
1. **Balance su Dolomite** (account #0 del plugin)
2. **Tracking interno** nel tuo vault/contract

Se vuoi trasferibilità, devi deployare un vero ERC20 wrapper (come aTokens di Aave).

---

## 🎯 Quando Usare Synthetic vs Real Token

### Synthetic Address (questo design)
**Usa quando:**
- ✅ Non ti serve trasferibilità tra users
- ✅ Vuoi minimizzare gas e complessità
- ✅ Il balance tracking è interno al contratto
- ✅ Esempio: Vault che aggrega deposits

**Limitazioni:**
- ❌ Non puoi fare `transfer(recipient, amount)`
- ❌ Non puoi usare in Uniswap/Sushiswap
- ❌ `balanceOf()` non funziona

### Real ERC20 Token (alternative)
**Usa quando:**
- ✅ Vuoi trasferibilità (es. "share tokens")
- ✅ Vuoi composability con altri DeFi protocols
- ✅ Vuoi listare su DEXes
- ✅ Esempio: Yearn vaults (yvTokens)

**Costo:**
- ❌ Deploy del token contract
- ❌ Mint/burn gas on ogni operazione
- ❌ Supply management complexity

---

## 💡 Alternative: Usare Token Esistente di Dolomite

**Se Dolomite avesse già un wrapper token** (tipo aTokens di Aave), potresti:

```solidity
// Ipotetico: se Dolomite avesse dWETH ERC20
address dWETH = 0xREAL_DOLOMITE_DTOKEN;

// Register in TokenManager
tokenManager.addToken("dWETH", dWETH, 18, oracle);

// Plugin diventa semplice proxy:
function inputSwap(address tokenIn, address tokenOut, uint256 amount) external {
    if (tokenIn == WETH && tokenOut == dWETH) {
        // Deposit
        IERC20(WETH).transferFrom(msg.sender, address(this), amount);
        IDolomite(dolomite).deposit(WETH, amount);
        // Dolomite mints dWETH to this contract
        IERC20(dWETH).transfer(msg.sender, amount);
    }
}
```

**Ma Dolomite non ha wrapper tokens** → quindi usiamo synthetic addresses come workaround.

---

## 📝 Summary

**Synthetic Address = Identificatore Fake per rappresentare posizioni su Dolomite**

```
Real World:
WETH (0x82aF...) → Dolomite Deposit → Balance su DolomiteMargin

Our Abstraction:
WETH (0x82aF...) → "Swap" → dWETH (0x7a3f... fake address)
```

**Come funziona:**
1. Generiamo indirizzo fake con keccak256 (deterministico)
2. Registriamo in TokenManager come se fosse un token
3. SwapManager lo tratta come token normale
4. Plugin riconosce pair (WETH, dWETH) e fa deposit
5. Balance esiste solo su Dolomite, non come token ERC20

**Pro:**
- Zero deploy di contratti
- Integrazione perfetta con SwapManager
- Gas ottimizzato

**Contro:**
- Non è trasferibile come vero token
- Serve tracking interno per balances
- Confusing inizialmente (ma funziona!)

---

Spero sia più chiaro ora! Vuoi che ti mostri un esempio pratico con codice completo di deploy + usage? 🚀
