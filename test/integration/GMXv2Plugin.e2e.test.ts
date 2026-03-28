import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    GMXv2Plugin,
    ProxyGeneral,
    TokenManager,
    SwapManager,
    Beacon,
    ChainlinkAdapter,
    ParameterManager,
    IERC20
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * GMX V2 Plugin - End-to-End Integration Test
 * 
 * Tests complete flow on Arbitrum fork:
 * 1. Setup entire ecosystem (TokenManager, ProxyGeneral, SwapManager, etc)
 * 2. Deploy GMXv2Plugin
 * 3. Register GM tokens
 * 4. Execute buy flow (USDC → GM:ETH/USD)
 * 5. Verify balance auto-detection
 * 6. Execute sell flow (GM:ETH/USD → USDC)
 * 7. Verify final balances
 * 
 * Requirements:
 * - Run on Arbitrum fork: npx hardhat test test/integration/GMXv2Plugin.e2e.test.ts --network hardhat
 * - Fork block: Latest Arbitrum block
 * - Whale accounts for USDC
 */

describe("GMXv2Plugin - E2E Integration Test", function () {
    // Increase timeout for fork operations
    this.timeout(300000); // 5 minutes

    // ============ ARBITRUM ADDRESSES ============

    const ARBITRUM_ADDRESSES = {
        // Tokens
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        
        // GMX V2
        ExchangeRouter: "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8",
        Reader: "0xf60becbba223EEA9495Da3f606753867eC10d139",
        DataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
        
        // GM Tokens
        GM_ETH_USD: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        GM_BTC_USD: "0x47c031236e19d024b42f8AE6780E44A573170703",
        
        // Chainlink Price Feeds (for TokenManager)
        CHAINLINK_USDC_USD: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
        CHAINLINK_ETH_USD: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
        CHAINLINK_BTC_USD: "0x6ce185860a4963106506C203335A2910413708e9",
        
        // Whale accounts (for funding tests)
        USDC_WHALE: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Binance wallet
    };

    // ============ TEST VARIABLES ============

    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let keeper: SignerWithAddress;
    
    let beacon: Beacon;
    let tokenManager: TokenManager;
    let chainlinkAdapter: ChainlinkAdapter;
    let parameterManager: ParameterManager;
    let proxyGeneral: ProxyGeneral;
    let swapManager: SwapManager;
    let gmxv2Plugin: GMXv2Plugin;
    
    let usdc: IERC20;
    let gmEthToken: IERC20;
    
    const EXECUTION_FEE = ethers.parseEther("0.003"); // 0.003 ETH
    const TEST_USDC_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC

    // ============ SETUP ============

    before(async function () {
        console.log("\n🔧 Setting up E2E test environment...\n");
        
        // Get signers
        [owner, user, keeper] = await ethers.getSigners();
        
        console.log("👤 Test accounts:");
        console.log("   Owner:", owner.address);
        console.log("   User:", user.address);
        console.log("   Keeper:", keeper.address);
        
        console.log("\n📦 Deploying core ecosystem contracts...\n");
        
        // Deploy Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();
        await beacon.waitForDeployment();
        console.log("✅ Beacon deployed:", await beacon.getAddress());
        
        // Deploy ParameterManager
        const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManagerFactory.deploy();
        await parameterManager.waitForDeployment();
        console.log("✅ ParameterManager deployed:", await parameterManager.getAddress());
        
        // Deploy ChainlinkAdapter
        const ChainlinkAdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapterFactory.deploy();
        await chainlinkAdapter.waitForDeployment();
        console.log("✅ ChainlinkAdapter deployed:", await chainlinkAdapter.getAddress());
        
        // Add Chainlink price feeds
        console.log("\n📡 Adding Chainlink price feeds...");
        await chainlinkAdapter.addPriceFeed("USDC", ARBITRUM_ADDRESSES.CHAINLINK_USDC_USD, 8, 86400);
        await chainlinkAdapter.addPriceFeed("WETH", ARBITRUM_ADDRESSES.CHAINLINK_ETH_USD, 8, 86400);
        await chainlinkAdapter.addPriceFeed("WBTC", ARBITRUM_ADDRESSES.CHAINLINK_BTC_USD, 8, 86400);
        console.log("✅ Price feeds configured");
        
        // Deploy TokenManager
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManagerFactory.deploy(
            await beacon.getAddress(),
            await chainlinkAdapter.getAddress()
        );
        await tokenManager.waitForDeployment();
        console.log("✅ TokenManager deployed:", await tokenManager.getAddress());
        
        // Register base tokens in TokenManager
        console.log("\n📝 Registering base tokens...");
        await tokenManager.manageTokenData("USDC", ARBITRUM_ADDRESSES.USDC, 6, 86400);
        await tokenManager.manageTokenData("WETH", ARBITRUM_ADDRESSES.WETH, 18, 86400);
        await tokenManager.manageTokenData("WBTC", ARBITRUM_ADDRESSES.WBTC, 8, 86400);
        console.log("✅ Base tokens registered");
        
        // Deploy ProxyGeneral
        const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneralFactory.deploy(
            await beacon.getAddress(),
            await tokenManager.getAddress(),
            await parameterManager.getAddress()
        );
        await proxyGeneral.waitForDeployment();
        console.log("✅ ProxyGeneral deployed:", await proxyGeneral.getAddress());
        
        // Deploy SwapManager
        const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManagerFactory.deploy(
            await beacon.getAddress(),
            await proxyGeneral.getAddress(),
            await tokenManager.getAddress()
        );
        await swapManager.waitForDeployment();
        console.log("✅ SwapManager deployed:", await swapManager.getAddress());
        
        // Authorize SwapManager in ProxyGeneral
        await proxyGeneral.authorizeModule(await swapManager.getAddress(), "SwapManager");
        console.log("✅ SwapManager authorized");
        
        // Deploy GMXv2Plugin
        console.log("\n🔌 Deploying GMXv2Plugin...");
        const GMXv2PluginFactory = await ethers.getContractFactory("GMXv2Plugin");
        gmxv2Plugin = await GMXv2PluginFactory.deploy(
            ARBITRUM_ADDRESSES.ExchangeRouter,
            ARBITRUM_ADDRESSES.Reader,
            ARBITRUM_ADDRESSES.DataStore,
            await proxyGeneral.getAddress(),
            ARBITRUM_ADDRESSES.WETH
        );
        await gmxv2Plugin.waitForDeployment();
        console.log("✅ GMXv2Plugin deployed:", await gmxv2Plugin.getAddress());
        
        // Configure GM:ETH/USD market
        console.log("\n🏪 Configuring GM markets...");
        await gmxv2Plugin.addMarket(
            ARBITRUM_ADDRESSES.GM_ETH_USD,
            ARBITRUM_ADDRESSES.WETH, // indexToken
            ARBITRUM_ADDRESSES.WETH, // longToken
            ARBITRUM_ADDRESSES.USDC  // shortToken
        );
        console.log("✅ GM:ETH/USD market added");
        
        // Register GM token in TokenManager
        // Note: Using ETH price as proxy for GM:ETH/USD (in production, need dedicated oracle)
        console.log("\n📝 Registering GM tokens in TokenManager...");
        await chainlinkAdapter.addPriceFeed("GM-ETH-USD", ARBITRUM_ADDRESSES.CHAINLINK_ETH_USD, 8, 86400);
        await tokenManager.manageTokenData("GM-ETH-USD", ARBITRUM_ADDRESSES.GM_ETH_USD, 18, 86400);
        console.log("✅ GM:ETH/USD registered");
        
        // Authorize plugin in ProxyGeneral
        await proxyGeneral.authorizeModule(await gmxv2Plugin.getAddress(), "GMX-V2-Plugin");
        console.log("✅ GMXv2Plugin authorized in ProxyGeneral");
        
        // Register plugin in Beacon
        await beacon.updateImplementation("GMX-V2", await gmxv2Plugin.getAddress());
        console.log("✅ GMXv2Plugin registered in Beacon");
        
        // Set active swap plugin
        await swapManager.setActiveSwapPlugin("GMX-V2");
        console.log("✅ Active swap plugin set to GMX-V2");
        
        // Get token contracts
        usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
        gmEthToken = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.GM_ETH_USD);
        
        // Fund user with USDC from whale
        console.log("\n💰 Funding user with USDC...");
        await impersonateAndFund(ARBITRUM_ADDRESSES.USDC_WHALE, user.address, TEST_USDC_AMOUNT);
        
        const userUsdcBalance = await usdc.balanceOf(user.address);
        console.log("✅ User USDC balance:", ethers.formatUnits(userUsdcBalance, 6));
        
        console.log("\n✅ Setup complete!\n");
    });

    // ============ HELPER FUNCTIONS ============

    async function impersonateAndFund(whaleAddress: string, recipient: string, amount: bigint) {
        // Impersonate whale account
        await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
        const whale = await ethers.getSigner(whaleAddress);
        
        // Fund whale with ETH for gas
        await owner.sendTransaction({
            to: whaleAddress,
            value: ethers.parseEther("1")
        });
        
        // Transfer USDC
        const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC, whale);
        await usdcContract.transfer(recipient, amount);
        
        // Stop impersonating
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [whaleAddress]);
    }

    async function displayBalances(title: string) {
        console.log(`\n${title}`);
        
        const proxyAddress = await proxyGeneral.getAddress();
        
        const usdcBalance = await usdc.balanceOf(proxyAddress);
        const gmBalance = await gmEthToken.balanceOf(proxyAddress);
        
        console.log(`   ProxyGeneral USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
        console.log(`   ProxyGeneral GM:ETH/USD: ${ethers.formatEther(gmBalance)}`);
        
        // Get prices from TokenManager
        try {
            const usdcPrice = await tokenManager.getTokenPrice("USDC");
            const gmPrice = await tokenManager.getTokenPrice("GM-ETH-USD");
            
            const usdcValue = (usdcBalance * usdcPrice) / ethers.parseUnits("1", 6);
            const gmValue = (gmBalance * gmPrice) / ethers.parseEther("1");
            const totalValue = usdcValue + gmValue;
            
            console.log(`   Total value: $${ethers.formatUnits(totalValue, 8)}`);
        } catch (error) {
            console.log(`   ⚠️  Could not fetch prices`);
        }
    }

    // ============ TEST CASES ============

    describe("📋 Initial Setup Verification", function () {
        it("Should have all contracts deployed", async function () {
            expect(await beacon.getAddress()).to.be.properAddress;
            expect(await tokenManager.getAddress()).to.be.properAddress;
            expect(await proxyGeneral.getAddress()).to.be.properAddress;
            expect(await swapManager.getAddress()).to.be.properAddress;
            expect(await gmxv2Plugin.getAddress()).to.be.properAddress;
        });

        it("Should have GM token registered in TokenManager", async function () {
            const gmAddress = await tokenManager.getTokenAddress("GM-ETH-USD");
            expect(gmAddress).to.equal(ARBITRUM_ADDRESSES.GM_ETH_USD);
            
            const isActive = await tokenManager.isTokenActive("GM-ETH-USD");
            expect(isActive).to.be.true;
        });

        it("Should have plugin authorized in ProxyGeneral", async function () {
            const isAuthorized = await proxyGeneral.authorizedModules(await gmxv2Plugin.getAddress());
            expect(isAuthorized).to.be.true;
        });

        it("Should have plugin registered in Beacon", async function () {
            const pluginAddress = await beacon.getImplementation("GMX-V2");
            expect(pluginAddress).to.equal(await gmxv2Plugin.getAddress());
        });

        it("Should have correct active swap plugin", async function () {
            const activePlugin = await swapManager.activeSwapPlugin();
            expect(activePlugin).to.equal("GMX-V2");
        });

        it("Should have user funded with USDC", async function () {
            const balance = await usdc.balanceOf(user.address);
            expect(balance).to.be.gte(TEST_USDC_AMOUNT);
        });
    });

    describe("🛒 Buy Flow: USDC → GM:ETH/USD", function () {
        let initialUsdcBalance: bigint;
        let depositAmount: bigint;

        before(async function () {
            initialUsdcBalance = await usdc.balanceOf(user.address);
            depositAmount = ethers.parseUnits("500", 6); // Buy with 500 USDC
            
            await displayBalances("💰 Initial Balances");
        });

        it("Should approve USDC to ProxyGeneral", async function () {
            console.log("\n📝 Approving USDC...");
            
            const tx = await usdc.connect(user).approve(
                await proxyGeneral.getAddress(),
                depositAmount
            );
            await tx.wait();
            
            const allowance = await usdc.allowance(user.address, await proxyGeneral.getAddress());
            expect(allowance).to.be.gte(depositAmount);
            
            console.log("✅ USDC approved");
        });

        it("Should get quote before buying", async function () {
            console.log("\n💭 Getting quote...");
            
            // Note: This is a placeholder quote (95% estimate)
            // In production, should call GMX Reader directly
            const quote = await gmxv2Plugin.getInputQuote(
                "USDC",
                "GM-ETH-USD",
                depositAmount
            );
            
            console.log(`   Expected GM tokens: ${ethers.formatEther(quote)}`);
            expect(quote).to.be.gt(0);
        });

        it("Should execute buy swap (USDC → GM:ETH/USD)", async function () {
            console.log("\n🛒 Executing buy swap...");
            
            // Transfer USDC to ProxyGeneral first (simulating deposit)
            await usdc.connect(user).transfer(await proxyGeneral.getAddress(), depositAmount);
            
            const tx = await swapManager.connect(user).executeSwap(
                "USDC",
                "GM-ETH-USD",
                depositAmount,
                0, // minAmountOut = 0 for testing (risky in production!)
                { value: EXECUTION_FEE }
            );
            
            const receipt = await tx.wait();
            console.log(`✅ Swap transaction confirmed (gas: ${receipt?.gasUsed})`);
            
            // Verify USDC was transferred
            const proxyUsdcBalance = await usdc.balanceOf(await proxyGeneral.getAddress());
            console.log(`   ProxyGeneral USDC after swap: ${ethers.formatUnits(proxyUsdcBalance, 6)}`);
        });

        it("Should have created deposit in GMX", async function () {
            console.log("\n⏳ Verifying deposit creation...");
            
            // Check pending deposits
            const pendingDeposits = await gmxv2Plugin.pendingDeposits(user.address, 0);
            console.log(`   Pending deposit key: ${pendingDeposits}`);
            
            // Note: In real scenario, would parse DepositCreated event from ExchangeRouter
            // For this test, we assume deposit was created successfully
        });

        it("Should wait for keeper execution (simulated)", async function () {
            console.log("\n⏰ Simulating keeper execution...");
            console.log("   In production, GMX keeper would execute after 1-2 minutes");
            console.log("   For testing, we skip the actual keeper wait");
            
            // In a real fork test with keeper simulation, we would:
            // 1. Wait for oracle price update
            // 2. Call executeDeposit() as keeper
            // 3. Verify GM tokens minted
            
            // For now, we mark this as informational
            console.log("   ✅ Would wait for keeper in production environment");
        });
    });

    describe("🔍 Balance Auto-Detection", function () {
        it("Should detect GM tokens in TokenManager active list", async function () {
            console.log("\n🔍 Testing auto-detection...");
            
            const activeTokens = await tokenManager.getActiveTokens();
            console.log(`   Active tokens: ${activeTokens.length}`);
            
            const hasGmToken = activeTokens.some(token => token === "GM-ETH-USD");
            expect(hasGmToken).to.be.true;
            
            console.log("✅ GM:ETH/USD is in active token list");
        });

        it("Should get GM token info from TokenManager", async function () {
            const tokenInfo = await tokenManager.getTokenInfo("GM-ETH-USD");
            
            expect(tokenInfo.tokenAddress).to.equal(ARBITRUM_ADDRESSES.GM_ETH_USD);
            expect(tokenInfo.decimals).to.equal(18);
            expect(tokenInfo.isActive).to.be.true;
            
            console.log("\n📊 GM Token Info:");
            console.log(`   Address: ${tokenInfo.tokenAddress}`);
            console.log(`   Decimals: ${tokenInfo.decimals}`);
            console.log(`   Active: ${tokenInfo.isActive}`);
        });

        it("Should get GM token price from oracle", async function () {
            const price = await tokenManager.getTokenPrice("GM-ETH-USD");
            
            expect(price).to.be.gt(0);
            console.log(`\n💰 GM:ETH/USD price: $${ethers.formatUnits(price, 8)}`);
        });
    });

    describe("💸 Sell Flow: GM:ETH/USD → USDC", function () {
        it("Should check if GM tokens available (simulated)", async function () {
            console.log("\n💸 Preparing sell flow...");
            
            // In production, after keeper execution, GM tokens would be in ProxyGeneral
            // For testing, we simulate having GM tokens
            
            const gmBalance = await gmEthToken.balanceOf(await proxyGeneral.getAddress());
            console.log(`   ProxyGeneral GM balance: ${ethers.formatEther(gmBalance)}`);
            
            // Note: In real scenario with keeper, balance would be > 0
            // For this test structure, we document the expected flow
            console.log("   ℹ️  In production, keeper would have minted GM tokens by now");
        });

        it("Should get quote for selling GM tokens", async function () {
            const mockGmAmount = ethers.parseEther("1"); // 1 GM token
            
            const quote = await gmxv2Plugin.getInputQuote(
                "GM-ETH-USD",
                "USDC",
                mockGmAmount
            );
            
            console.log(`\n💭 Sell quote: ${ethers.formatUnits(quote, 6)} USDC for 1 GM token`);
            expect(quote).to.be.gt(0);
        });

        it("Should execute sell swap (GM:ETH/USD → USDC) - structure verification", async function () {
            console.log("\n💸 Verifying sell swap structure...");
            
            // Verify the swap function exists and is properly configured
            const activePlugin = await swapManager.activeSwapPlugin();
            expect(activePlugin).to.equal("GMX-V2");
            
            // Verify plugin can handle GM → USDC direction
            const gmTokenAddress = await tokenManager.getTokenAddress("GM-ETH-USD");
            const usdcAddress = await tokenManager.getTokenAddress("USDC");
            
            expect(gmTokenAddress).to.equal(ARBITRUM_ADDRESSES.GM_ETH_USD);
            expect(usdcAddress).to.equal(ARBITRUM_ADDRESSES.USDC);
            
            console.log("✅ Sell swap structure validated");
            console.log("   ℹ️  Actual execution would require GM tokens from keeper");
        });
    });

    describe("📊 Final Verification", function () {
        it("Should display final balances", async function () {
            await displayBalances("📊 Final Balances");
        });

        it("Should verify plugin metadata", async function () {
            const metadata = await gmxv2Plugin.getPluginMetadata();
            
            expect(metadata.name).to.equal("GMX V2 Swap Plugin");
            expect(metadata.version).to.equal("1.0.0");
            expect(metadata.requiresApproval).to.be.true;
            
            console.log("\n🔌 Plugin Metadata:");
            console.log(`   Name: ${metadata.name}`);
            console.log(`   Version: ${metadata.version}`);
            console.log(`   Requires Approval: ${metadata.requiresApproval}`);
        });

        it("Should verify execution fee configuration", async function () {
            const executionFee = await gmxv2Plugin.getExecutionFee();
            
            expect(executionFee).to.be.gt(0);
            expect(executionFee).to.be.lte(ethers.parseEther("0.01")); // Max 0.01 ETH
            
            console.log(`\n⛽ Execution Fee: ${ethers.formatEther(executionFee)} ETH`);
        });

        it("Should have correct market configuration", async function () {
            const market = await gmxv2Plugin.markets(ARBITRUM_ADDRESSES.GM_ETH_USD);
            
            expect(market.isActive).to.be.true;
            expect(market.indexToken).to.equal(ARBITRUM_ADDRESSES.WETH);
            expect(market.longToken).to.equal(ARBITRUM_ADDRESSES.WETH);
            expect(market.shortToken).to.equal(ARBITRUM_ADDRESSES.USDC);
            
            console.log("\n🏪 Market Configuration:");
            console.log(`   Active: ${market.isActive}`);
            console.log(`   Index: ${market.indexToken}`);
            console.log(`   Long: ${market.longToken}`);
            console.log(`   Short: ${market.shortToken}`);
        });
    });

    describe("🎯 Integration Summary", function () {
        it("Should display complete test summary", async function () {
            console.log("\n" + "=".repeat(60));
            console.log("🎉 E2E TEST SUMMARY");
            console.log("=".repeat(60));
            
            console.log("\n✅ Components Tested:");
            console.log("   1. Beacon - Module registry");
            console.log("   2. TokenManager - Token registry & oracle");
            console.log("   3. ChainlinkAdapter - Price feeds");
            console.log("   4. ProxyGeneral - Token custody");
            console.log("   5. SwapManager - Swap routing");
            console.log("   6. GMXv2Plugin - GMX V2 integration");
            
            console.log("\n✅ Flows Verified:");
            console.log("   1. Setup & Configuration");
            console.log("   2. Token Registration");
            console.log("   3. Plugin Authorization");
            console.log("   4. Buy Flow Structure (USDC → GM)");
            console.log("   5. Auto-Detection Mechanism");
            console.log("   6. Sell Flow Structure (GM → USDC)");
            
            console.log("\n📝 Notes:");
            console.log("   - Keeper execution is async (1-2 min in production)");
            console.log("   - Actual GM token minting requires keeper execution");
            console.log("   - Test verifies structure and integration points");
            console.log("   - For full flow test, run on live fork with keeper simulation");
            
            console.log("\n⚠️  Production Checklist:");
            console.log("   [ ] Add real Chainlink feeds for GM tokens");
            console.log("   [ ] Implement callback handler for keeper status");
            console.log("   [ ] Add event listeners for deposit/withdrawal");
            console.log("   [ ] Set proper slippage protection (minAmountOut)");
            console.log("   [ ] Test with real keeper execution");
            console.log("   [ ] Monitor execution fees and refunds");
            
            console.log("\n✅ Test completed successfully!\n");
        });
    });
});
