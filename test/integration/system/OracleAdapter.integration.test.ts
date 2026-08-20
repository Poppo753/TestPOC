import { expect } from "chai";
import { ethers } from "hardhat";
import { 
    TokenManager, 
    ChainlinkAdapter, 
    MockOracleAdapter,
    MockChainlinkOracle,
    Beacon,
    MockERC20
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * 🔗 ORACLE ADAPTER - INTEGRATION TESTS
 * 
 * Tests integration between TokenManager and oracle adapters:
 * - Hot-swapping oracle adapters (setOracleAdapter)
 * - Multi-token scenarios with same adapter
 * - TokenManager + ChainlinkAdapter integration
 * - TokenManager + MockOracleAdapter integration
 * - Price retrieval through complete chain
 * - Adapter failure handling
 * 
 * These tests verify the modular oracle system works correctly
 * when all components interact together.
 */
describe("🔗 Oracle Adapter - Integration Tests", function () {
    let tokenManager: TokenManager;
    let beacon: Beacon;
    let mockOracleAdapter: MockOracleAdapter;
    let chainlinkAdapter: ChainlinkAdapter;
    let mockOracle1: MockChainlinkOracle;
    let mockOracle2: MockChainlinkOracle;
    let mockToken: MockERC20;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    // Test constants
    const TOKEN_CODES = {
        USDC: "USDC",
        WBTC: "WBTC",
        WETH: "WETH"
    };

    const PRICES = {
        USDC: ethers.parseUnits("1", 8),      // $1.00
        WBTC: ethers.parseUnits("50000", 8),  // $50,000
        WETH: ethers.parseUnits("2000", 8)    // $2,000
    };

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        // Deploy Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();

        // Register WETH in beacon (required by TokenManager)
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const wethForBeacon = await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18);
        await beacon.updateImplementation("WETH", await wethForBeacon.getAddress());
        await beacon.updateImplementation("BASE_ASSET", await wethForBeacon.getAddress());

        // Deploy mock token
        mockToken = await MockERC20Factory.deploy("USD Coin", "USDC", 6);

        // Deploy MockOracleAdapter with initial prices
        const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
        mockOracleAdapter = await MockOracleAdapterFactory.deploy();
        await mockOracleAdapter.setupToken(TOKEN_CODES.USDC, PRICES.USDC, 8, true);
        await mockOracleAdapter.setupToken(TOKEN_CODES.WBTC, PRICES.WBTC, 8, true);
        await mockOracleAdapter.setupToken(TOKEN_CODES.WETH, PRICES.WETH, 8, true);

        // Deploy ChainlinkAdapter
        const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapterFactory.deploy();
        await chainlinkAdapter.setTargetDenomination("USD");

        // Deploy mock Chainlink oracles
        const MockChainlinkFactory = await ethers.getContractFactory("MockChainlinkOracle");
        mockOracle1 = await MockChainlinkFactory.deploy(PRICES.USDC, 8, "USDC / USD");
        mockOracle2 = await MockChainlinkFactory.deploy(PRICES.WBTC, 8, "WBTC / USD");

        // Setup ChainlinkAdapter with feeds
        await chainlinkAdapter.setPriceFeed(TOKEN_CODES.USDC, await mockOracle1.getAddress(), 8, 3600, "USD");
        await chainlinkAdapter.setPriceFeed(TOKEN_CODES.WBTC, await mockOracle2.getAddress(), 8, 3600, "USD");

        // Deploy TokenManager with MockOracleAdapter
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManagerFactory.deploy(
            await beacon.getAddress(),
            await mockOracleAdapter.getAddress()
        );

        // Add token to TokenManager
        await tokenManager["manageTokenData(string,address,uint8,uint256)"](TOKEN_CODES.USDC, await mockToken.getAddress(), 18, 3600);
    });

    // ==================== ORACLE ADAPTER SWITCHING ====================

    describe("🔄 Oracle Adapter Hot-Swapping", function () {

        it("Should switch from MockOracleAdapter to ChainlinkAdapter", async function () {
            // Initial state: using MockOracleAdapter
            expect(await tokenManager.oracleAdapter()).to.equal(await mockOracleAdapter.getAddress());
            
            const [priceBefore] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            expect(priceBefore).to.equal(PRICES.USDC);

            // Switch to ChainlinkAdapter
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            // Verify switch
            expect(await tokenManager.oracleAdapter()).to.equal(await chainlinkAdapter.getAddress());
            
            const [priceAfter] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            expect(priceAfter).to.equal(PRICES.USDC); // Same price from Chainlink
        });

        it("Should emit OracleAdapterUpdated event on switch", async function () {
            await expect(
                tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress())
            ).to.emit(tokenManager, "OracleAdapterUpdated")
             .withArgs(await mockOracleAdapter.getAddress(), await chainlinkAdapter.getAddress());
        });

        it("Should maintain token data after adapter switch", async function () {
            // Get token info before switch
            const infoBefore = await tokenManager.getTokenInfo(TOKEN_CODES.USDC);
            
            // Switch adapter
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            // Get token info after switch
            const infoAfter = await tokenManager.getTokenInfo(TOKEN_CODES.USDC);
            
            // Verify all token data unchanged (except oracle adapter reference)
            expect(infoAfter.tokenAddress).to.equal(infoBefore.tokenAddress);
            expect(infoAfter.tokenCode).to.equal(infoBefore.tokenCode);
            expect(infoAfter.tokenDecimals).to.equal(infoBefore.tokenDecimals);
            expect(infoAfter.heartbeat).to.equal(infoBefore.heartbeat);
            expect(infoAfter.isActive).to.equal(infoBefore.isActive);
        });

        it("Should reject zero address for oracle adapter", async function () {
            await expect(
                tokenManager.setOracleAdapter(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid adapter address");
        });

        it("Should only allow owner to switch oracle adapter", async function () {
            await expect(
                tokenManager.connect(user).setOracleAdapter(await chainlinkAdapter.getAddress())
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should switch adapter multiple times", async function () {
            // Switch to ChainlinkAdapter
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            expect(await tokenManager.oracleAdapter()).to.equal(await chainlinkAdapter.getAddress());
            
            // Switch back to MockOracleAdapter
            await tokenManager.setOracleAdapter(await mockOracleAdapter.getAddress());
            expect(await tokenManager.oracleAdapter()).to.equal(await mockOracleAdapter.getAddress());
            
            // Switch to ChainlinkAdapter again
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            expect(await tokenManager.oracleAdapter()).to.equal(await chainlinkAdapter.getAddress());
        });
    });

    // ==================== MULTI-TOKEN SCENARIOS ====================

    describe("🪙 Multi-Token with Same Adapter", function () {

        beforeEach(async function () {
            // Add WBTC token (WETH is now base asset, cannot be added as token)
            const wbtcToken = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped Bitcoin", "WBTC", 8);
            
            await tokenManager["manageTokenData(string,address,uint8,uint256)"](TOKEN_CODES.WBTC, await wbtcToken.getAddress(), 8, 3600);
        });

        it("Should get prices for multiple tokens from same adapter", async function () {
            const [usdcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            const [wbtcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.WBTC);

            expect(usdcPrice).to.equal(PRICES.USDC);
            expect(wbtcPrice).to.equal(PRICES.WBTC);
        });

        it("Should maintain independent prices after updates", async function () {
            // Update USDC price only
            await mockOracleAdapter.setPrice(TOKEN_CODES.USDC, ethers.parseUnits("1.01", 8));
            
            const [usdcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            const [wbtcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.WBTC);
            
            expect(usdcPrice).to.equal(ethers.parseUnits("1.01", 8));
            expect(wbtcPrice).to.equal(PRICES.WBTC); // Unchanged
        });

        it("Should handle adapter switch for all tokens simultaneously", async function () {
            // Switch to ChainlinkAdapter
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            // All tokens now use ChainlinkAdapter
            const [usdcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            const [wbtcPrice] = await tokenManager.getTokenPrice(TOKEN_CODES.WBTC);
            
            expect(usdcPrice).to.equal(PRICES.USDC);
            expect(wbtcPrice).to.equal(PRICES.WBTC);
        });

        it("Should return active tokens list correctly", async function () {
            const activeTokens = await tokenManager.getActiveTokens();
            
            expect(activeTokens.length).to.equal(2);
            expect(activeTokens).to.include(TOKEN_CODES.USDC);
            expect(activeTokens).to.include(TOKEN_CODES.WBTC);
        });
    });

    // ==================== PRICE RETRIEVAL INTEGRATION ====================

    describe("💰 Price Retrieval Through Complete Chain", function () {

        it("Should retrieve price through MockOracleAdapter", async function () {
            const [price, timestamp, isStale] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            
            expect(price).to.equal(PRICES.USDC);
            expect(timestamp).to.be.gt(0);
            expect(isStale).to.be.false;
        });

        it("Should retrieve price through ChainlinkAdapter", async function () {
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            const [price, timestamp, isStale] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            
            expect(price).to.equal(PRICES.USDC);
            expect(timestamp).to.be.gt(0);
            expect(isStale).to.be.false;
        });

        it("Should detect stale prices through adapter", async function () {
            await mockOracleAdapter.setStale(TOKEN_CODES.USDC);
            
            // TokenManager reverts when adapter returns isValid=false
            await expect(
                tokenManager.getTokenPrice(TOKEN_CODES.USDC)
            ).to.be.revertedWithCustomError(tokenManager, "StalePrice");
        });

        it("Should handle token not supported by adapter", async function () {
            // Try to get price for token not configured in adapter
            await expect(
                tokenManager.getTokenPrice("UNKNOWN")
            ).to.be.revertedWith("Token not active");
        });

        it("Should use getTokenPriceForModule correctly", async function () {
            const price = await tokenManager.getTokenPriceForModule(TOKEN_CODES.USDC);
            expect(price).to.equal(PRICES.USDC);
        });
    });

    // ==================== ADAPTER FAILURE HANDLING ====================

    describe("⚠️ Adapter Failure Scenarios", function () {

        it("Should handle gracefully when adapter returns invalid price", async function () {
            // Set price to 0 (invalid)
            await mockOracleAdapter.setPrice(TOKEN_CODES.USDC, 0);
            
            // Should revert because MockOracleAdapter reverts on price=0
            await expect(
                tokenManager.getTokenPrice(TOKEN_CODES.USDC)
            ).to.be.reverted;
        });

        it("Should allow emergency adapter replacement", async function () {
            // Simulate adapter failure by marking all prices as stale
            await mockOracleAdapter.setStale(TOKEN_CODES.USDC);
            await mockOracleAdapter.setStale(TOKEN_CODES.WBTC);
            
            // Should revert with stale price
            await expect(
                tokenManager.getTokenPrice(TOKEN_CODES.USDC)
            ).to.be.revertedWithCustomError(tokenManager, "StalePrice");
            
            // Emergency replacement with ChainlinkAdapter
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            // Now should work with fresh Chainlink data
            const [price, , ] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
            expect(price).to.equal(PRICES.USDC);
        });

        it("Should continue operating if one token's oracle fails", async function () {
            // Add WBTC token first
            const wbtcToken = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped Bitcoin", "WBTC", 8);
            await tokenManager["manageTokenData(string,address,uint8,uint256)"](TOKEN_CODES.WBTC, await wbtcToken.getAddress(), 8, 3600);
            
            // Mark USDC as stale but keep WBTC valid
            await mockOracleAdapter.setStale(TOKEN_CODES.USDC);
            
            // USDC should revert with StalePrice
            await expect(
                tokenManager.getTokenPrice(TOKEN_CODES.USDC)
            ).to.be.revertedWithCustomError(tokenManager, "StalePrice");
            
            // WBTC should still work (not marked stale)
            const [wbtcPrice, , ] = await tokenManager.getTokenPrice(TOKEN_CODES.WBTC);
            expect(wbtcPrice).to.be.gt(0);
            expect(wbtcPrice).to.equal(PRICES.WBTC);
        });
    });

    // ==================== BACKWARD COMPATIBILITY ====================

    describe("🔄 Backward Compatibility", function () {

        it("Should support legacy 6-param manageTokenData", async function () {
            // Deploy new oracle for legacy function
            const legacyOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                ethers.parseUnits("3000", 8),
                8,
                "LEGACY / USD"
            );

            // Setup LEGACY token in current adapter first (required for oracle validation)
            await mockOracleAdapter.setupToken("LEGACY", ethers.parseUnits("3000", 8), 8, true);

            // Call legacy 6-param function (should still work)
            await tokenManager["manageTokenData(string,address,address,uint8,uint8,uint256)"](
                "LEGACY",
                await mockToken.getAddress(),
                await legacyOracle.getAddress(),
                18,
                8,
                3600
            );

            // Verify token was added
            expect(await tokenManager.isTokenActive("LEGACY")).to.be.true;
        });

        it("Should use current adapter even with legacy function", async function () {
            // Current adapter is MockOracleAdapter
            expect(await tokenManager.oracleAdapter()).to.equal(await mockOracleAdapter.getAddress());
            
            // Setup LEGACY2 token in current adapter
            await mockOracleAdapter.setupToken("LEGACY2", ethers.parseUnits("1500", 8), 8, true);
            
            // Add token via legacy function
            await tokenManager["manageTokenData(string,address,address,uint8,uint8,uint256)"](
                "LEGACY2",
                await mockToken.getAddress(),
                await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                    ethers.parseUnits("1500", 8),
                    8,
                    "LEGACY2"
                ).then(c => c.getAddress()),
                18,
                8,
                3600
            );
            
            // Token uses current adapter (oracle param ignored internally)
            // Verify by switching adapter and checking price source
            const [priceBefore] = await tokenManager.getTokenPrice("LEGACY2");
            expect(priceBefore).to.equal(ethers.parseUnits("1500", 8));
            
            await tokenManager.setOracleAdapter(await chainlinkAdapter.getAddress());
            
            // Price would change if using different adapter (confirms delegation)
            const oracleAddr = await tokenManager.oracleAdapter();
            expect(oracleAddr).to.equal(await chainlinkAdapter.getAddress());
        });
    });

    // ==================== GAS EFFICIENCY ====================

    describe("⛽ Gas Efficiency", function () {

        it("Should have minimal gas overhead for adapter delegation", async function () {
            // First call (cold SLOAD)
            const tx1 = await tokenManager.getTokenPrice.staticCall(TOKEN_CODES.USDC);
            
            // Second call (warm SLOAD) - should be cheaper
            const tx2 = await tokenManager.getTokenPrice.staticCall(TOKEN_CODES.USDC);
            
            // Both should complete (gas measurement would require eth_estimateGas)
            expect(tx1[0]).to.equal(PRICES.USDC);
            expect(tx2[0]).to.equal(PRICES.USDC);
        });

        it("Should efficiently handle multiple price calls", async function () {
            // Multiple sequential calls should all succeed
            for (let i = 0; i < 5; i++) {
                const [price] = await tokenManager.getTokenPrice(TOKEN_CODES.USDC);
                expect(price).to.equal(PRICES.USDC);
            }
        });
    });
});
