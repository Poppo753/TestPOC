# Implementation Guide: Oracle Modularity

## 🎯 Obiettivo

Implementare il sistema di oracle modulari **senza breaking changes** e con **backward compatibility completa**.

---

## 📋 Prerequisites

Prima di iniziare:
- ✅ Codebase funzionante con Chainlink hardcoded
- ✅ Test suite completa esistente
- ✅ Deployment scripts per testnet/mainnet
- ✅ Gas benchmarks attuali (per confronto)

---

## 🗺️ Roadmap Completa

```
Step 1: Interface Definition (1 giorno)
   ↓
Step 2: ChainlinkAdapter Implementation (2 giorni)
   ↓
Step 3: TokenManager Refactor (2 giorni)
   ↓
Step 4: Testing & Validation (3 giorni)
   ↓
Step 5: Migration Scripts (1 giorno)
   ↓
Step 6: Deploy & Verify (1 giorno)
   ↓
Step 7: Advanced Features (Optional, 3-5 giorni)

Total: ~10 giorni (core) + ~5 giorni (advanced)
```

---

## 📦 Step 1: Interface Definition

### File: `contracts/interfaces/IOracleAdapter.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracleAdapter
 * @notice Standard interface for oracle price adapters
 * @dev All oracle implementations must conform to this interface
 * 
 * @custom:security-considerations
 * - Always validate price > 0
 * - Check timestamp freshness
 * - Handle reverts gracefully
 */
interface IOracleAdapter {
    
    // ==================== ERRORS ====================
    
    error TokenNotSupported(string tokenCode);
    error InvalidPrice();
    error StalePrice(uint256 timestamp, uint256 maxAge);
    error OracleCallFailed(string reason);
    
    // ==================== EVENTS ====================
    
    event PriceRetrieved(
        string indexed tokenCode,
        uint256 price,
        uint256 timestamp,
        bool isValid
    );
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Get current price for a token
     * @dev MUST revert if token not supported
     * @dev MUST validate price before returning
     * 
     * @param tokenCode Unique token identifier (e.g., "USDC", "WBTC")
     * @return price Current price (decimals specified by getPriceDecimals)
     * @return timestamp Unix timestamp of price update
     * @return isValid True if price is valid and fresh, false otherwise
     */
    function getPrice(string memory tokenCode)
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        );
    
    /**
     * @notice Get decimals for price normalization
     * @dev CRITICAL: All price calculations must account for these decimals
     * 
     * @param tokenCode Token identifier
     * @return decimals Number of decimals (e.g., 8 for Chainlink USD pairs)
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        returns (uint8 decimals);
    
    /**
     * @notice Check if adapter supports a specific token
     * @dev Use this before calling getPrice to avoid reverts
     * 
     * @param tokenCode Token to check
     * @return supported True if token is supported by this adapter
     */
    function supportsToken(string memory tokenCode)
        external
        view
        returns (bool supported);
    
    /**
     * @notice Get adapter metadata for identification
     * @dev Useful for debugging and analytics
     * 
     * @return name Human-readable adapter name (e.g., "Chainlink", "Pyth")
     * @return version Semantic version string (e.g., "1.0.0")
     */
    function getAdapterInfo()
        external
        view
        returns (
            string memory name,
            string memory version
        );
    
    // ==================== OPTIONAL EXTENSIONS ====================
    
    /**
     * @notice Get historical price (optional, may revert if not supported)
     * @param tokenCode Token identifier
     * @param timestamp Target timestamp
     * @return price Historical price at given timestamp
     */
    function getHistoricalPrice(string memory tokenCode, uint256 timestamp)
        external
        view
        returns (uint256 price);
}
```

### ✅ Checklist Step 1
- [ ] Create `contracts/interfaces/IOracleAdapter.sol`
- [ ] Review interface con team
- [ ] Verify compatibilità con use cases esistenti
- [ ] Commit: `feat: add IOracleAdapter interface for oracle modularity`

---

## 🔧 Step 2: ChainlinkAdapter Implementation

### File: `contracts/oracles/ChainlinkAdapter.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IOracleAdapter.sol";

/**
 * @title ChainlinkAdapter
 * @notice Adapter for Chainlink Price Feeds
 * @dev Wraps Chainlink-specific logic to conform to IOracleAdapter
 * 
 * @custom:security-contact security@yourdomain.com
 */
contract ChainlinkAdapter is IOracleAdapter, Ownable {
    
    // ==================== STRUCTS ====================
    
    struct PriceFeedConfig {
        address feedAddress;      // Chainlink aggregator address
        uint8 decimals;           // Feed decimals (usually 8)
        uint256 heartbeat;        // Max seconds between updates
        bool isActive;            // Whether feed is active
        uint256 errorCount;       // Track consecutive errors
    }
    
    // ==================== STORAGE ====================
    
    /// @notice Mapping: tokenCode => Chainlink feed config
    mapping(string => PriceFeedConfig) private priceFeeds;
    
    /// @notice List of all configured token codes
    string[] private tokenCodes;
    
    /// @notice Max errors before circuit breaker
    uint256 public maxErrorThreshold = 5;
    
    // ==================== EVENTS ====================
    
    event PriceFeedAdded(
        string indexed tokenCode,
        address indexed feedAddress,
        uint8 decimals,
        uint256 heartbeat
    );
    
    event PriceFeedUpdated(
        string indexed tokenCode,
        address indexed oldFeed,
        address indexed newFeed
    );
    
    event PriceFeedRemoved(string indexed tokenCode);
    
    event ErrorThresholdReached(string indexed tokenCode, uint256 errorCount);
    
    event HeartbeatUpdated(string indexed tokenCode, uint256 newHeartbeat);
    
    // ==================== CONSTRUCTOR ====================
    
    constructor() Ownable() {}
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Add or update a price feed configuration
     * @dev Validates feed before accepting it
     * 
     * @param tokenCode Unique token identifier
     * @param feedAddress Chainlink aggregator address
     * @param decimals Feed decimals
     * @param heartbeat Maximum seconds between updates
     */
    function setPriceFeed(
        string memory tokenCode,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat
    ) external onlyOwner {
        // VALIDATIONS
        require(bytes(tokenCode).length > 0, "Empty token code");
        require(feedAddress != address(0), "Invalid feed address");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(heartbeat > 0, "Invalid heartbeat");
        
        // VALIDATE FEED WORKS
        _validateChainlinkFeed(feedAddress);
        
        // CHECK IF UPDATING OR ADDING
        bool isUpdate = priceFeeds[tokenCode].isActive;
        address oldFeed = priceFeeds[tokenCode].feedAddress;
        
        // UPDATE CONFIG
        priceFeeds[tokenCode] = PriceFeedConfig({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true,
            errorCount: 0
        });
        
        // ADD TO LIST IF NEW
        if (!isUpdate) {
            tokenCodes.push(tokenCode);
            emit PriceFeedAdded(tokenCode, feedAddress, decimals, heartbeat);
        } else {
            emit PriceFeedUpdated(tokenCode, oldFeed, feedAddress);
        }
    }
    
    /**
     * @notice Remove a price feed
     * @param tokenCode Token to remove
     */
    function removePriceFeed(string memory tokenCode) external onlyOwner {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        
        priceFeeds[tokenCode].isActive = false;
        
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(tokenCode))) {
                tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                tokenCodes.pop();
                break;
            }
        }
        
        emit PriceFeedRemoved(tokenCode);
    }
    
    /**
     * @notice Update heartbeat for a token
     * @param tokenCode Token to update
     * @param newHeartbeat New heartbeat value
     */
    function updateHeartbeat(string memory tokenCode, uint256 newHeartbeat) 
        external 
        onlyOwner 
    {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        require(newHeartbeat > 0, "Invalid heartbeat");
        
        priceFeeds[tokenCode].heartbeat = newHeartbeat;
        emit HeartbeatUpdated(tokenCode, newHeartbeat);
    }
    
    /**
     * @notice Reset error count for a token
     * @param tokenCode Token to reset
     */
    function resetErrorCount(string memory tokenCode) external onlyOwner {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        priceFeeds[tokenCode].errorCount = 0;
    }
    
    // ==================== IORACLEADAPTER IMPLEMENTATION ====================
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256 price, uint256 timestamp, bool isValid)
    {
        PriceFeedConfig memory config = priceFeeds[tokenCode];
        
        if (!config.isActive) {
            revert TokenNotSupported(tokenCode);
        }
        
        // CHECK CIRCUIT BREAKER
        if (config.errorCount >= maxErrorThreshold) {
            return (0, 0, false);
        }
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 rawPrice,
            uint256 /* startedAt */,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            // CHAINLINK VALIDATIONS
            bool priceValid = rawPrice > 0 && 
                             updatedAt > 0 && 
                             answeredInRound >= roundId;
            
            if (!priceValid) {
                return (0, 0, false);
            }
            
            // CHECK FRESHNESS
            bool isFresh = block.timestamp - updatedAt <= config.heartbeat;
            
            emit PriceRetrieved(tokenCode, uint256(rawPrice), updatedAt, isFresh);
            
            return (uint256(rawPrice), updatedAt, isFresh);
            
        } catch Error(string memory reason) {
            revert OracleCallFailed(reason);
        } catch {
            revert OracleCallFailed("Unknown error");
        }
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8)
    {
        if (!priceFeeds[tokenCode].isActive) {
            revert TokenNotSupported(tokenCode);
        }
        return priceFeeds[tokenCode].decimals;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool)
    {
        return priceFeeds[tokenCode].isActive;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getAdapterInfo()
        external
        pure
        override
        returns (string memory name, string memory version)
    {
        return ("Chainlink", "1.0.0");
    }
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @notice Get all configured token codes
     * @return Array of token codes
     */
    function getSupportedTokens() external view returns (string[] memory) {
        return tokenCodes;
    }
    
    /**
     * @notice Get feed config for a token
     * @param tokenCode Token to query
     * @return config Full configuration struct
     */
    function getFeedConfig(string memory tokenCode)
        external
        view
        returns (PriceFeedConfig memory)
    {
        return priceFeeds[tokenCode];
    }
    
    /**
     * @notice Validate multiple feeds in batch
     * @param tokenCodesToCheck Array of tokens to validate
     * @return results Array of validation results
     */
    function batchValidate(string[] memory tokenCodesToCheck)
        external
        view
        returns (bool[] memory results)
    {
        results = new bool[](tokenCodesToCheck.length);
        
        for (uint256 i = 0; i < tokenCodesToCheck.length; i++) {
            try this.getPrice(tokenCodesToCheck[i]) returns (uint256, uint256, bool isValid) {
                results[i] = isValid;
            } catch {
                results[i] = false;
            }
        }
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    /**
     * @dev Validate a Chainlink feed works correctly
     * @param feedAddress Feed to validate
     */
    function _validateChainlinkFeed(address feedAddress) private view {
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price");
            require(updatedAt > 0, "Round not complete");
            require(answeredInRound >= roundId, "Stale feed");
        } catch {
            revert("Feed validation failed");
        }
    }
    
    // ==================== PARAMETER MANAGEMENT ====================
    
    /**
     * @notice Update max error threshold
     * @param newThreshold New threshold value
     */
    function setMaxErrorThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0 && newThreshold <= 100, "Invalid threshold");
        maxErrorThreshold = newThreshold;
    }
}
```

### Test File: `test/unit/ChainlinkAdapter.test.ts`

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainlinkAdapter, MockChainlinkOracle } from "../../typechain-types";

describe("ChainlinkAdapter", function () {
    let adapter: ChainlinkAdapter;
    let mockOracle: MockChainlinkOracle;
    let owner: any;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        // Deploy mock oracle
        const MockOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
        mockOracle = await MockOracleFactory.deploy();

        // Deploy adapter
        const AdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        adapter = await AdapterFactory.deploy();
    });

    describe("Configuration", function () {
        it("Should add price feed correctly", async function () {
            await mockOracle.setPrice(2000_00000000); // $2000 with 8 decimals

            await adapter.setPriceFeed(
                "USDC",
                await mockOracle.getAddress(),
                8,
                3600
            );

            expect(await adapter.supportsToken("USDC")).to.be.true;
        });

        it("Should reject invalid feed address", async function () {
            await expect(
                adapter.setPriceFeed("USDC", ethers.ZeroAddress, 8, 3600)
            ).to.be.revertedWith("Invalid feed address");
        });

        it("Should validate feed on add", async function () {
            // Mock with invalid price
            await mockOracle.setPrice(0);

            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Invalid price");
        });
    });

    describe("Price Retrieval", function () {
        beforeEach(async function () {
            await mockOracle.setPrice(2000_00000000);
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should return valid price", async function () {
            const [price, timestamp, isValid] = await adapter.getPrice("USDC");

            expect(price).to.equal(2000_00000000);
            expect(isValid).to.be.true;
        });

        it("Should detect stale price", async function () {
            // Advance time beyond heartbeat
            await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
            await ethers.provider.send("evm_mine", []);

            const [, , isValid] = await adapter.getPrice("USDC");
            expect(isValid).to.be.false;
        });

        it("Should revert for unsupported token", async function () {
            await expect(adapter.getPrice("UNKNOWN")).to.be.revertedWithCustomError(
                adapter,
                "TokenNotSupported"
            );
        });
    });

    describe("Adapter Info", function () {
        it("Should return correct metadata", async function () {
            const [name, version] = await adapter.getAdapterInfo();
            expect(name).to.equal("Chainlink");
            expect(version).to.equal("1.0.0");
        });
    });
});
```

### ✅ Checklist Step 2
- [ ] Create `contracts/oracles/` directory
- [ ] Implement `ChainlinkAdapter.sol`
- [ ] Write complete test suite
- [ ] Test con MockChainlinkOracle esistente
- [ ] Gas benchmarks
- [ ] Commit: `feat: implement ChainlinkAdapter for oracle modularity`

---

## 🔄 Step 3: TokenManager Refactor

### Changes to `contracts/TokenManager.sol`

#### 3.1 Update Imports
```solidity
// REMOVE THIS:
// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// ADD THIS:
import "./interfaces/IOracleAdapter.sol";
```

#### 3.2 Update TokenInfo Struct
```solidity
struct TokenInfo {
    address tokenAddress;
    uint8 tokenDecimals;
    string tokenCode;
    // REMOVE THESE:
    // address priceFeed;
    // uint8 priceFeedDecimals;
    
    bool isActive;
    uint256 lastPriceTimestamp;
    uint256 lastPrice;
    uint256 heartbeat;
    uint256 errorCount;
}
```

#### 3.3 Add Oracle Adapter Storage
```solidity
/// @notice Oracle adapter for price feeds
IOracleAdapter public oracleAdapter;

event OracleAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);
```

#### 3.4 Update Constructor
```solidity
constructor(address _beacon, address _oracleAdapter) Ownable() {
    require(_beacon != address(0), "Invalid beacon address");
    require(_oracleAdapter != address(0), "Invalid oracle adapter");
    
    beacon = _beacon;
    oracleAdapter = IOracleAdapter(_oracleAdapter);
    tokenCodesCount = 0;
}
```

#### 3.5 Add Adapter Management
```solidity
/**
 * @notice Update oracle adapter (owner only)
 * @param _newAdapter New adapter contract address
 */
function setOracleAdapter(address _newAdapter) external onlyOwner {
    require(_newAdapter != address(0), "Invalid adapter");
    
    address oldAdapter = address(oracleAdapter);
    oracleAdapter = IOracleAdapter(_newAdapter);
    
    emit OracleAdapterUpdated(oldAdapter, _newAdapter);
}
```

#### 3.6 Simplify manageTokenData
```solidity
/**
 * @notice Add or update token data
 * @dev Simplified - oracle config handled in adapter
 */
function manageTokenData(
    string memory _tokenCode,
    address _tokenAddress,
    uint8 _tokenDecimals,
    uint256 _heartbeat
) external onlyOwner {
    // VALIDATIONS
    require(bytes(_tokenCode).length > 0 && bytes(_tokenCode).length <= 16, "Invalid token code");
    require(_tokenAddress != address(0), "Invalid token address");
    require(_heartbeat > 0, "Invalid heartbeat");
    
    // WETH CHECK
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    require(_tokenAddress != wethAddress, "Cannot add WETH as token");
    
    // VERIFY ORACLE SUPPORTS TOKEN
    require(oracleAdapter.supportsToken(_tokenCode), "Token not supported by oracle");
    
    // MAX TOKENS CHECK
    if (!tokenData[_tokenCode].isActive) {
        require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
        tokenCodes.push(_tokenCode);
        tokenCodesCount++;
    }
    
    // UPDATE TOKEN DATA (simplified)
    tokenData[_tokenCode] = TokenInfo({
        tokenAddress: _tokenAddress,
        tokenDecimals: _tokenDecimals,
        tokenCode: _tokenCode,
        isActive: true,
        lastPriceTimestamp: 0,
        lastPrice: 0,
        heartbeat: _heartbeat,
        errorCount: 0
    });
    
    tokenErrors[_tokenCode] = 0;
    
    emit TokenAdded(_tokenCode, _tokenAddress, address(oracleAdapter));
}
```

#### 3.7 Update getTokenPrice (Delegation)
```solidity
/**
 * @notice Gets the latest price for a token from oracle adapter
 * @param _tokenCode The token to get the price for
 * @return price The current price
 * @return updatedAt The timestamp of the price
 * @return isStale Whether the price is considered stale
 */
function getTokenPrice(string memory _tokenCode)
    public
    view
    returns (
        uint256 price,
        uint256 updatedAt,
        bool isStale
    )
{
    require(tokenData[_tokenCode].isActive, "Token not active");
    
    // DELEGATE TO ORACLE ADAPTER
    (uint256 oraclePrice, uint256 timestamp, bool isValid) = oracleAdapter.getPrice(_tokenCode);
    
    require(isValid, "Invalid oracle price");
    
    // CHECK STALENESS BASED ON TOKEN HEARTBEAT
    TokenInfo memory token = tokenData[_tokenCode];
    bool stale = block.timestamp - timestamp > token.heartbeat;
    
    return (oraclePrice, timestamp, stale);
}
```

### ✅ Checklist Step 3
- [ ] Backup current `TokenManager.sol`
- [ ] Apply all changes above
- [ ] Update `ITokenManagerForModules.sol` interface (rimuovi `priceFeedDecimals` da struct)
- [ ] Compile: `npx hardhat compile`
- [ ] Fix compilation errors
- [ ] Commit: `refactor: migrate TokenManager to use IOracleAdapter`

---

## 🧪 Step 4: Testing & Validation

### 4.1 Update Existing Tests

File: `test/unit/TokenManager.test.ts`

```typescript
describe("TokenManager with ChainlinkAdapter", function () {
    let tokenManager: TokenManager;
    let chainlinkAdapter: ChainlinkAdapter;
    let beacon: Beacon;
    let mockOracle: MockChainlinkOracle;

    beforeEach(async function () {
        // Deploy beacon
        beacon = await deployBeacon();

        // Deploy mock oracle
        mockOracle = await deployMockOracle();
        await mockOracle.setPrice(2000_00000000);

        // Deploy adapter
        const AdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await AdapterFactory.deploy();

        // Configure adapter
        await chainlinkAdapter.setPriceFeed(
            "USDC",
            await mockOracle.getAddress(),
            8,
            3600
        );

        // Deploy TokenManager with adapter
        const TMFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TMFactory.deploy(
            await beacon.getAddress(),
            await chainlinkAdapter.getAddress()
        );
    });

    it("Should use adapter for price", async function () {
        // Add token (simplified params)
        await tokenManager.manageTokenData(
            "USDC",
            USDC_ADDRESS,
            6,
            3600
        );

        const [price, , ] = await tokenManager.getTokenPrice("USDC");
        expect(price).to.equal(2000_00000000);
    });

    it("Should allow adapter switch", async function () {
        // Deploy new adapter
        const newAdapter = await AdapterFactory.deploy();
        await newAdapter.setPriceFeed("USDC", mockOracle2Address, 8, 3600);

        // Switch adapter
        await tokenManager.setOracleAdapter(await newAdapter.getAddress());

        // Verify uses new adapter
        expect(await tokenManager.oracleAdapter()).to.equal(await newAdapter.getAddress());
    });
});
```

### 4.2 Integration Tests

```typescript
describe("Integration: Oracle Modularity", function () {
    it("ValueCalculator works with new adapter", async function () {
        // Deploy full stack
        const system = await deployFullSystem();

        // Calculate value (should work transparently)
        const value = await system.valueCalculator.calculateTokenValue("USDC");
        expect(value).to.be.gt(0);
    });

    it("SwapManager validates prices correctly", async function () {
        const system = await deployFullSystem();

        // Perform swap (price validation should work)
        await system.swapManager.executeSwap("USDC", ethers.parseEther("1"));
        // Should not revert
    });

    it("No breaking changes for existing flows", async function () {
        // Run ALL existing integration tests
        // They should pass without modifications
    });
});
```

### 4.3 Gas Benchmarks

```typescript
describe("Gas Benchmarks", function () {
    it("getTokenPrice gas comparison", async function () {
        // Old implementation (from backup)
        const oldTx = await oldTokenManager.getTokenPrice("USDC");
        const oldGas = (await oldTx.wait()).gasUsed;

        // New implementation
        const newTx = await newTokenManager.getTokenPrice("USDC");
        const newGas = (await newTx.wait()).gasUsed;

        console.log(`Old gas: ${oldGas}`);
        console.log(`New gas: ${newGas}`);
        console.log(`Overhead: ${newGas - oldGas}`);

        // Acceptable overhead: < 5000 gas
        expect(newGas - oldGas).to.be.lt(5000);
    });
});
```

### ✅ Checklist Step 4
- [ ] Update all unit tests
- [ ] Run integration tests: `npx hardhat test`
- [ ] All tests pass ✅
- [ ] Gas benchmarks < 5k overhead
- [ ] Coverage report: `npx hardhat coverage`
- [ ] Commit: `test: update tests for oracle modularity`

---

## 📜 Step 5: Migration Scripts

### File: `scripts/migration/01_deploy_chainlink_adapter.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying ChainlinkAdapter...");

    const AdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
    const adapter = await AdapterFactory.deploy();
    await adapter.waitForDeployment();

    console.log(`✅ ChainlinkAdapter deployed to: ${await adapter.getAddress()}`);

    // Configure all existing price feeds
    const feeds = [
        { token: "USDC", address: "0x...", decimals: 8, heartbeat: 3600 },
        { token: "WBTC", address: "0x...", decimals: 8, heartbeat: 3600 },
        // ... more feeds
    ];

    for (const feed of feeds) {
        console.log(`Configuring ${feed.token}...`);
        await adapter.setPriceFeed(feed.token, feed.address, feed.decimals, feed.heartbeat);
    }

    console.log("✅ All feeds configured");

    return adapter;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

### File: `scripts/migration/02_deploy_new_token_manager.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS!;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS!;

    console.log("🚀 Deploying new TokenManager...");

    const TMFactory = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TMFactory.deploy(BEACON_ADDRESS, ADAPTER_ADDRESS);
    await tokenManager.waitForDeployment();

    console.log(`✅ TokenManager deployed to: ${await tokenManager.getAddress()}`);

    // Migrate existing token configs
    const tokens = [
        { code: "USDC", address: "0x...", decimals: 6, heartbeat: 3600 },
        // ... more tokens
    ];

    for (const token of tokens) {
        console.log(`Migrating ${token.code}...`);
        await tokenManager.manageTokenData(
            token.code,
            token.address,
            token.decimals,
            token.heartbeat
        );
    }

    console.log("✅ All tokens migrated");

    return tokenManager;
}
```

### File: `scripts/migration/03_update_beacon.ts`

```typescript
async function main() {
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS!;
    const NEW_TOKEN_MANAGER = process.env.NEW_TOKEN_MANAGER!;

    console.log("🚀 Updating Beacon...");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);

    // Update implementation
    await beacon.updateImplementation("TokenManager", NEW_TOKEN_MANAGER);

    console.log("✅ Beacon updated - system now uses modular oracles!");

    // Verify
    const currentImpl = await beacon.getImplementation("TokenManager");
    console.log(`Current TokenManager: ${currentImpl}`);
}
```

### ✅ Checklist Step 5
- [ ] Create migration scripts
- [ ] Test on local fork: `npx hardhat node --fork`
- [ ] Dry-run on testnet
- [ ] Document rollback procedure
- [ ] Commit: `feat: add migration scripts for oracle modularity`

---

## 🚀 Step 6: Deploy & Verify

### 6.1 Testnet Deployment

```bash
# Step 1: Deploy adapter
npx hardhat run scripts/migration/01_deploy_chainlink_adapter.ts --network arbitrum-sepolia

# Step 2: Deploy new TokenManager
export ADAPTER_ADDRESS=<address from step 1>
npx hardhat run scripts/migration/02_deploy_new_token_manager.ts --network arbitrum-sepolia

# Step 3: Update beacon (CRITICAL - point of no return)
export NEW_TOKEN_MANAGER=<address from step 2>
npx hardhat run scripts/migration/03_update_beacon.ts --network arbitrum-sepolia
```

### 6.2 Verification

```bash
# Verify contracts on Arbiscan
npx hardhat verify --network arbitrum-sepolia <ADAPTER_ADDRESS>
npx hardhat verify --network arbitrum-sepolia <TOKEN_MANAGER_ADDRESS> <BEACON_ADDRESS> <ADAPTER_ADDRESS>
```

### 6.3 Post-Deployment Tests

```typescript
// test/live/post_deployment.test.ts
describe("Post-Deployment Validation", function () {
    it("All tokens have valid prices", async function () {
        const tokenManager = await ethers.getContractAt("TokenManager", TM_ADDRESS);
        const tokens = await tokenManager.getActiveTokens();

        for (const token of tokens) {
            const [price, , isStale] = await tokenManager.getTokenPrice(token);
            expect(price).to.be.gt(0);
            expect(isStale).to.be.false;
        }
    });

    it("ValueCalculator works", async function () {
        const vc = await ethers.getContractAt("ValueCalculator", VC_ADDRESS);
        const totalValue = await vc.getTotalPoolValueView();
        expect(totalValue).to.be.gt(0);
    });
});
```

### ✅ Checklist Step 6
- [ ] Deploy to testnet ✅
- [ ] Verify contracts ✅
- [ ] Run post-deployment tests ✅
- [ ] Monitor for 24h
- [ ] Deploy to mainnet (if all OK)
- [ ] Update documentation

---

## 🎓 Step 7: Advanced Features (Optional)

### 7.1 Pyth Network Adapter

```solidity
// contracts/oracles/PythAdapter.sol
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract PythAdapter is IOracleAdapter {
    IPyth public immutable pyth;
    
    mapping(string => bytes32) private priceIds;
    
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256, uint256, bool)
    {
        bytes32 priceId = priceIds[tokenCode];
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
        
        // Convert Pyth price format
        uint256 price = uint256(uint64(pythPrice.price));
        uint256 timestamp = pythPrice.publishTime;
        
        return (price, timestamp, true);
    }
}
```

### 7.2 Composite Adapter (Multi-Oracle)

See detailed implementation in `02_ORACLE_MODULARITY_PROPOSAL.md`

### 7.3 Uniswap TWAP Adapter

```solidity
contract UniswapTWAPAdapter is IOracleAdapter {
    using OracleLibrary for *;
    
    IUniswapV3Factory public immutable factory;
    uint32 public twapInterval = 30 minutes;
    
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256, uint256, bool)
    {
        // Get TWAP price from Uniswap V3
        // Implementation details...
    }
}
```

### ✅ Checklist Step 7
- [ ] Choose which advanced adapters to implement
- [ ] Deploy and test each adapter
- [ ] Configure in CompositeAdapter
- [ ] Document usage patterns

---

## 📊 Success Metrics

### ✅ Migration Successful If:

1. **Zero Downtime**
   - [ ] System continues operating during migration
   - [ ] No transactions fail due to oracle issues

2. **Backward Compatibility**
   - [ ] All existing contracts work without changes
   - [ ] `getTokenPrice()` interface unchanged
   - [ ] ValueCalculator functions identically

3. **Performance**
   - [ ] Gas overhead < 5000 gas per price fetch
   - [ ] Response times unchanged

4. **Flexibility Gained**
   - [ ] Can switch adapters without redeploying core
   - [ ] Can add new oracle providers
   - [ ] Tested with at least 2 different adapters

---

## 🆘 Rollback Procedure

If something goes wrong:

```bash
# Step 1: Revert Beacon to old TokenManager
await beacon.updateImplementation("TokenManager", OLD_TOKEN_MANAGER_ADDRESS);

# Step 2: Verify rollback
const impl = await beacon.getImplementation("TokenManager");
console.log(`Reverted to: ${impl}`);

# Step 3: Test old functionality
npx hardhat test test/integration/*.test.ts
```

**Important**: Keep old TokenManager deployed for quick rollback!

---

## 📚 Documentation Updates

After successful deployment:

- [ ] Update `README.md` with oracle modularity section
- [ ] Document how to add new oracle adapters
- [ ] Update architecture diagrams
- [ ] Add adapter configuration guide
- [ ] Update deployment guide

---

## 🎯 Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Interface | 1 day | `IOracleAdapter.sol` |
| 2. ChainlinkAdapter | 2 days | Adapter + tests |
| 3. TokenManager | 2 days | Refactored contract |
| 4. Testing | 3 days | Full test coverage |
| 5. Migration | 1 day | Scripts ready |
| 6. Deploy | 1 day | Testnet/Mainnet |
| **TOTAL CORE** | **10 days** | Production ready |
| 7. Advanced (optional) | 3-5 days | Multi-oracle support |

---

## ✅ Final Checklist

- [ ] All code committed to `feat/oracle-modularity` branch
- [ ] CI/CD passes
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Testnet deployed and verified
- [ ] Mainnet deployment plan approved
- [ ] Team trained on new system
- [ ] Monitoring dashboards updated

---

**Ready to implement? Start with Step 1!** 🚀
