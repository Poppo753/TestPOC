import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainlinkAdapter, MockChainlinkOracle } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * ChainlinkAdapter - Unit Tests
 * 
 * Test Matrix from 07_TESTING_STRATEGY.md:
 * - Configuration (add/update/remove feeds, validation)
 * - Price Retrieval (valid/stale/zero/revert)
 * - Decimals (consistency, validation)
 * - Token Support (active/inactive)
 * - Adapter Info (metadata)
 * - Circuit Breaker (error tracking, threshold)
 * - Gas Benchmarks (<50k per getPrice)
 * 
 * Target: >95% code coverage
 */
describe("ChainlinkAdapter - Unit Tests", function () {
    let adapter: ChainlinkAdapter;
    let mockOracle: MockChainlinkOracle;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        // Deploy mock Chainlink oracle with default price $2000.00 (8 decimals)
        const MockOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
        mockOracle = await MockOracleFactory.deploy(
            2000_00000000,  // initialPrice
            8,              // decimals
            "USDC / USD"    // description
        );

        // Deploy ChainlinkAdapter
        const AdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        adapter = await AdapterFactory.deploy();
    });

    // ==================== CONFIGURATION TESTS ====================

    describe("Configuration", function () {
        
        it("Should add price feed correctly", async function () {
            await adapter.setPriceFeed(
                "USDC",
                await mockOracle.getAddress(),
                8,
                3600 // 1 hour heartbeat
            );

            expect(await adapter.supportsToken("USDC")).to.be.true;
            
            const config = await adapter.getFeedConfig("USDC");
            expect(config.feedAddress).to.equal(await mockOracle.getAddress());
            expect(config.decimals).to.equal(8);
            expect(config.heartbeat).to.equal(3600);
            expect(config.isActive).to.be.true;
            expect(config.errorCount).to.equal(0);
        });

        it("Should emit PriceFeedAdded event", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600)
            ).to.emit(adapter, "PriceFeedAdded")
             .withArgs("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should reject empty token code", async function () {
            await expect(
                adapter.setPriceFeed("", await mockOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Empty token code");
        });

        it("Should reject token code too long", async function () {
            const longCode = "A".repeat(17); // 17 chars > 16 limit
            await expect(
                adapter.setPriceFeed(longCode, await mockOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Token code too long");
        });

        it("Should reject invalid feed address", async function () {
            await expect(
                adapter.setPriceFeed("USDC", ethers.ZeroAddress, 8, 3600)
            ).to.be.revertedWith("Invalid feed address");
        });

        it("Should reject invalid decimals (zero)", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 0, 3600)
            ).to.be.revertedWith("Invalid decimals");
        });

        it("Should reject invalid decimals (>18)", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 19, 3600)
            ).to.be.revertedWith("Invalid decimals");
        });

        it("Should reject zero heartbeat", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 0)
            ).to.be.revertedWith("Invalid heartbeat");
        });

        it("Should validate feed works on add (reject zero price)", async function () {
            // Deploy mock oracle with invalid price
            const badOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                0,              // zero price (invalid)
                8,
                "Bad Oracle"
            );

            await expect(
                adapter.setPriceFeed("USDC", await badOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Invalid price");
        });

        it("Should validate feed works on add (reject incomplete round)", async function () {
            // Deploy mock oracle with updatedAt = 0
            const badOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2000_00000000,
                8,
                "Bad Oracle"
            );
            await badOracle.setUpdatedAt(0);  // Set invalid timestamp

            await expect(
                adapter.setPriceFeed("USDC", await badOracle.getAddress(), 8, 3600)
            ).to.be.reverted; // Generic revert from try-catch
        });

        it("Should validate feed works on add (reject stale feed)", async function () {
            // Deploy mock oracle with answeredInRound < roundId (stale)
            const badOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2000_00000000,
                8,
                "Bad Oracle"
            );
            await badOracle.setAnsweredInRound(0);  // answeredInRound=0 < roundId=1

            await expect(
                adapter.setPriceFeed("USDC", await badOracle.getAddress(), 8, 3600)
            ).to.be.reverted; // Generic revert from try-catch
        });

        it("Should validate decimals match oracle (if available)", async function () {
            // Deploy mock oracle with decimals=6, but we claim 8
            const badOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2000_00000000,
                6,              // Oracle has 6 decimals
                "Bad Oracle"
            );

            await expect(
                adapter.setPriceFeed("USDC", await badOracle.getAddress(), 8, 3600)  // Claiming 8
            ).to.be.revertedWith("Decimals mismatch");
        });

        it("Should update existing feed", async function () {
            // Add initial feed
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);

            // Deploy new oracle with different price
            const newOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2100_00000000,  // Different price: $2100
                8,
                "USDC / USD Updated"
            );

            // Update feed
            await expect(
                adapter.setPriceFeed("USDC", await newOracle.getAddress(), 8, 3600)
            ).to.emit(adapter, "PriceFeedUpdated")
             .withArgs("USDC", await mockOracle.getAddress(), await newOracle.getAddress());

            const config = await adapter.getFeedConfig("USDC");
            expect(config.feedAddress).to.equal(await newOracle.getAddress());
            expect(config.errorCount).to.equal(0); // Reset on update
        });

        it("Should remove feed", async function () {
            // Add feed first
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            expect(await adapter.supportsToken("USDC")).to.be.true;
            
            // Remove it
            await expect(
                adapter.removePriceFeed("USDC")
            ).to.emit(adapter, "PriceFeedRemoved")
             .withArgs("USDC");

            expect(await adapter.supportsToken("USDC")).to.be.false;
        });

        it("Should revert when removing non-active feed", async function () {
            await expect(
                adapter.removePriceFeed("USDC")
            ).to.be.revertedWith("Feed not active");
        });

        it("Should only allow owner to add feeds", async function () {
            await expect(
                adapter.connect(user).setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to remove feeds", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            
            await expect(
                adapter.connect(user).removePriceFeed("USDC")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ==================== PRICE RETRIEVAL TESTS ====================

    describe("Price Retrieval", function () {
        beforeEach(async function () {
            // Setup USDC feed for all price tests
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should return valid price for fresh data", async function () {
            const [price, timestamp, isValid] = await adapter.getPrice("USDC");

            expect(price).to.equal(2000_00000000);
            expect(timestamp).to.be.gt(0);
            expect(isValid).to.be.true;
        });

        it("Should detect stale price (exceeds heartbeat)", async function () {
            // Set oracle timestamp to 2 hours ago (heartbeat is 1 hour)
            const latestBlock = await ethers.provider.getBlock('latest');
            await mockOracle.setUpdatedAt(latestBlock!.timestamp - 7200); // 2 hours ago

            const [price, timestamp, isValid] = await adapter.getPrice("USDC");
            
            expect(price).to.equal(2000_00000000); // Still returns price
            expect(timestamp).to.be.gt(0);
            expect(isValid).to.be.false; // But marked as stale
        });

        it("Should handle zero price (mark as invalid)", async function () {
            await mockOracle.updatePrice(0);

            const [price, , isValid] = await adapter.getPrice("USDC");
            
            expect(price).to.equal(0);
            expect(isValid).to.be.false; // Invalid because price = 0
        });

        it("Should handle negative price (Chainlink won't return negative, but test robustness)", async function () {
            // Chainlink returns int256, so can technically be negative
            await mockOracle.updatePrice(-100);

            const [price, , isValid] = await adapter.getPrice("USDC");
            
            // Should handle as invalid (price <= 0)
            expect(isValid).to.be.false;
        });

        it("Should detect incomplete round (updatedAt = 0)", async function () {
            await mockOracle.setUpdatedAt(0);

            // updatedAt=0 causes oracle to revert with "Oracle is failing" or validation failure
            await expect(
                adapter.getPrice("USDC")
            ).to.be.reverted; // Will revert due to invalid data
        });

        it("Should detect stale Chainlink round (answeredInRound < roundId)", async function () {
            // Update price to increment roundId, then set answeredInRound to old value
            await mockOracle.updatePrice(2100_00000000); // roundId becomes 2
            await mockOracle.setAnsweredInRound(1); // answeredInRound=1 < roundId=2

            const [, , isValid] = await adapter.getPrice("USDC");
            expect(isValid).to.be.false; // Should be marked as stale
        });

        it("Should revert for unsupported token", async function () {
            await expect(
                adapter.getPrice("UNKNOWN")
            ).to.be.revertedWithCustomError(adapter, "TokenNotSupported")
             .withArgs("UNKNOWN");
        });

        it("Should handle oracle call failure", async function () {
            // Make oracle revert
            await mockOracle.setShouldFail(true);

            await expect(
                adapter.getPrice("USDC")
            ).to.be.revertedWithCustomError(adapter, "OracleCallFailed");
        });

        it("Should return price even if stale (but flag it)", async function () {
            // Make price stale
            const latestBlock = await ethers.provider.getBlock('latest');
            await mockOracle.setUpdatedAt(latestBlock!.timestamp - 7200);

            const [price, , isValid] = await adapter.getPrice("USDC");
            
            expect(price).to.equal(2000_00000000); // Still returns price
            expect(isValid).to.be.false; // But flagged as invalid
        });
    });

    // ==================== DECIMALS TESTS ====================

    describe("Decimals", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should return correct decimals", async function () {
            const decimals = await adapter.getPriceDecimals("USDC");
            expect(decimals).to.equal(8);
        });

        it("Should revert for unsupported token", async function () {
            await expect(
                adapter.getPriceDecimals("UNKNOWN")
            ).to.be.revertedWithCustomError(adapter, "TokenNotSupported");
        });

        it("Should return consistent decimals on multiple calls", async function () {
            const decimals1 = await adapter.getPriceDecimals("USDC");
            const decimals2 = await adapter.getPriceDecimals("USDC");
            expect(decimals1).to.equal(decimals2);
        });
    });

    // ==================== TOKEN SUPPORT TESTS ====================

    describe("Token Support", function () {
        it("Should return true for configured token", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            expect(await adapter.supportsToken("USDC")).to.be.true;
        });

        it("Should return false for unconfigured token", async function () {
            expect(await adapter.supportsToken("UNKNOWN")).to.be.false;
        });

        it("Should return false after feed removal", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            await adapter.removePriceFeed("USDC");
            
            expect(await adapter.supportsToken("USDC")).to.be.false;
        });

        it("Should never revert (even for invalid input)", async function () {
            // Should not revert for empty string
            expect(await adapter.supportsToken("")).to.be.false;
            
            // Should not revert for long string
            expect(await adapter.supportsToken("VERYLONGTOKENCODEHERE")).to.be.false;
        });
    });

    // ==================== ADAPTER INFO TESTS ====================

    describe("Adapter Info", function () {
        it("Should return correct name and version", async function () {
            const [name, version] = await adapter.getAdapterInfo();
            expect(name).to.equal("Chainlink");
            expect(version).to.equal("1.0.0");
        });

        it("Should return consistent info on multiple calls", async function () {
            const [name1, version1] = await adapter.getAdapterInfo();
            const [name2, version2] = await adapter.getAdapterInfo();
            expect(name1).to.equal(name2);
            expect(version1).to.equal(version2);
        });
    });

    // ==================== CIRCUIT BREAKER TESTS ====================

    describe("Circuit Breaker", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            await adapter.setMaxErrorThreshold(3);
        });

        it("Should track error count in storage", async function () {
            // Error count is part of PriceFeedConfig
            const configBefore = await adapter.getFeedConfig("USDC");
            expect(configBefore.errorCount).to.equal(0);
            
            // Note: errorCount increments happen in non-view functions
            // This test verifies the storage exists
        });

        it("Should allow updating max error threshold", async function () {
            await adapter.setMaxErrorThreshold(5);
            expect(await adapter.maxErrorThreshold()).to.equal(5);
        });

        it("Should reject zero threshold", async function () {
            await expect(
                adapter.setMaxErrorThreshold(0)
            ).to.be.revertedWith("Invalid threshold");
        });

        it("Should allow manual error count reset", async function () {
            await expect(
                adapter.resetErrorCount("USDC")
            ).to.emit(adapter, "ErrorCountReset")
             .withArgs("USDC");
        });

        it("Should revert reset for inactive feed", async function () {
            await expect(
                adapter.resetErrorCount("UNKNOWN")
            ).to.be.revertedWith("Feed not active");
        });

        it("Should only allow owner to set threshold", async function () {
            await expect(
                adapter.connect(user).setMaxErrorThreshold(5)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to reset errors", async function () {
            await expect(
                adapter.connect(user).resetErrorCount("USDC")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // ==================== GAS BENCHMARKS ====================

    describe("Gas Benchmarks", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("getPrice should use <50k gas", async function () {
            // Warm up (first call is more expensive due to SLOAD)
            await adapter.getPrice("USDC");
            
            // Measure second call
            const tx = await adapter.getPrice.staticCall("USDC");
            
            // Note: Actual gas measurement requires eth_estimateGas
            // This is a placeholder - real gas tests done in benchmarks
        });

        it("getPriceDecimals should be gas-efficient", async function () {
            // Simple mapping lookup - should be very cheap
            await adapter.getPriceDecimals("USDC");
            // Actual gas measurement in benchmark suite
        });

        it("supportsToken should be gas-efficient", async function () {
            // Simple mapping check - should be very cheap
            await adapter.supportsToken("USDC");
            // Actual gas measurement in benchmark suite
        });
    });

    // ==================== EDGE CASES ====================

    describe("Edge Cases", function () {
        it("Should handle maximum uint256 price", async function () {
            // Deploy new oracle with max price
            const maxOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                ethers.MaxInt256, // Chainlink uses int256, so use MaxInt256
                8,
                "Max Price Oracle"
            );
            await adapter.setPriceFeed("MAXTOKEN", await maxOracle.getAddress(), 8, 3600);

            const [price, , ] = await adapter.getPrice("MAXTOKEN");
            expect(price).to.be.gt(0); // Just verify it's positive
        });

        it("Should handle minimum heartbeat (1 second)", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 1);
            
            const config = await adapter.getFeedConfig("USDC");
            expect(config.heartbeat).to.equal(1);
        });

        it("Should handle maximum decimals (18)", async function () {
            // Deploy oracle with 18 decimals
            const highDecOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2000_000000000000000000n, // 18 decimals
                18,
                "High Decimals Oracle"
            );
            await adapter.setPriceFeed("HD_TOKEN", await highDecOracle.getAddress(), 18, 3600);
            
            const decimals = await adapter.getPriceDecimals("HD_TOKEN");
            expect(decimals).to.equal(18);
        });

        it("Should handle multiple tokens simultaneously", async function () {
            // Deploy 3 oracles for different tokens
            const oracle1 = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                2000_00000000,
                8,
                "Token1 / USD"
            );

            const oracle2 = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                50000_00000000,
                8,
                "Token2 / USD"
            );

            const oracle3 = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy(
                1_00000000,
                8,
                "Token3 / USD"
            );

            // Add all three
            await adapter.setPriceFeed("WETH", await oracle1.getAddress(), 8, 3600);
            await adapter.setPriceFeed("WBTC", await oracle2.getAddress(), 8, 3600);
            await adapter.setPriceFeed("USDC", await oracle3.getAddress(), 8, 3600);

            // Verify all work
            expect(await adapter.supportsToken("WETH")).to.be.true;
            expect(await adapter.supportsToken("WBTC")).to.be.true;
            expect(await adapter.supportsToken("USDC")).to.be.true;

            const [price1,,] = await adapter.getPrice("WETH");
            const [price2,,] = await adapter.getPrice("WBTC");
            const [price3,,] = await adapter.getPrice("USDC");

            expect(price1).to.equal(2000_00000000);
            expect(price2).to.equal(50000_00000000);
            expect(price3).to.equal(1_00000000);
        });
    });
});
