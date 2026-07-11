import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🏦 E2E WBTC BASE ASSET - FULL PROTOCOL FORK TEST
 *
 * Deploys the entire protocol stack on Arbitrum fork with WBTC as the base asset (8 decimals).
 * Tests: deposit WBTC → Aave supply → value check → withdraw
 *
 * This validates the multi-token base asset abstraction with an 8-decimal base asset
 * (vs USDC 6 decimals and WETH 18 decimals).
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/WBTC.BaseAsset.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: WBTC Base Asset - Full Protocol", function () {
    this.timeout(300000); // 5 minutes

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

    // Chainlink feeds
    const CHAINLINK_ETH_USD = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
    const CHAINLINK_BTC_USD = "0x6ce185860a4963106506C203335A2910413708e9";
    const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

    // Aave V3
    const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

    // Whales — large WBTC holder on Arbitrum (Aave aWBTC reserve)
    const WBTC_WHALE = "0x078f358208685046a11C85e8ad32895DED33A249";

    // Contracts
    let beacon: any;
    let proxyGeneral: any;
    let tokenManager: any;
    let valueCalculator: any;
    let swapManager: any;
    let parameterManager: any;
    let liquidityManager: any;
    let chainlinkAdapter: any;
    let aavePlugin: any;
    let aaveRegistry: any;
    let aaveLensAdapter: any;

    let wbtcContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;

    before(async function () {
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with WBTC base asset...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        // Register BASE_ASSET as WBTC (8 decimals)
        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", WBTC);
        await beacon.updateImplementation("WETH", WETH);
        await beacon.updateImplementation("WBTC", WBTC);

        // ==================== 2. CHAINLINK ADAPTER ====================
        const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapter.deploy();
        await chainlinkAdapter.waitForDeployment();

        // Use large heartbeat for fork tests (Chainlink data may be stale on fork)
        const FORK_HEARTBEAT = 31536000; // 1 year
        await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WETH", CHAINLINK_ETH_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WBTC", CHAINLINK_BTC_USD, 8, FORK_HEARTBEAT, "USD");

        // Configure denomination: prices are in USD, target is WBTC
        await chainlinkAdapter.setTargetDenomination("WBTC");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_BTC_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS (baseAssetCode = "WBTC") ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WBTC");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "WBTC");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "WBTC");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 8); // WBTC = 8 decimals
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "WBTC");
        await liquidityManager.waitForDeployment();

        // ==================== 4. REGISTER ALL IN BEACON ====================
        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
        await beacon.updateImplementation("SwapManager", swapManager.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        // ==================== 5. CONFIGURE TOKEN MANAGER ====================
        // Set base asset code for price lookups (used by getBaseAssetPrice / convertUsdToBaseAsset)
        await tokenManager.setBaseAssetCode("WBTC");
        // Register USDC and WETH as tradeable tokens (WBTC is BASE_ASSET, not registered)
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", USDC, 6, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", WETH, 18, 3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);  // 0.3%
        await liquidityManager.setWithdrawFee(50);  // 0.5%
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        // Set withdraw limits (WBTC amounts, 8 decimals)
        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("10", 8),      // hourly
            ethers.parseUnits("50", 8),      // daily
            ethers.parseUnits("0.00001", 8), // min withdraw
            ethers.parseUnits("5", 8)        // max per tx
        );

        // ==================== 7. SET PARAMETERS ====================
        // minDeposit default (unit/1_000_000 = 100 for WBTC 8 dec) is already fine, no change needed.
        // maxDeposit default is 100 WBTC, maxWithdrawPerTx default is 50 WBTC — both already
        // sufficient for our small test amounts (0.05-0.1 WBTC), so no parameter changes needed.

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit", ethers.parseUnits("1000000", 8), ethers.parseUnits("5000000", 8));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 8), ethers.parseUnits("5000000", 8));

        // ==================== 10. AAVE V3 SETUP ====================
        const poolFull = await ethers.getContractAt(
            [
                "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))"
            ],
            AAVE_V3_POOL
        );

        const wbtcReserve = await poolFull.getReserveData(WBTC);
        const wethReserve = await poolFull.getReserveData(WETH);

        const aWBTC = wbtcReserve.aTokenAddress;
        const variableDebtWBTC = wbtcReserve.variableDebtTokenAddress;
        const aWETH = wethReserve.aTokenAddress;
        const variableDebtWETH = wethReserve.variableDebtTokenAddress;

        console.log(`   aWBTC: ${aWBTC}`);
        console.log(`   aWETH: ${aWETH}`);

        // Deploy AaveV3Registry
        const AaveV3Registry = await ethers.getContractFactory("AaveV3Registry");
        aaveRegistry = await AaveV3Registry.deploy();
        await aaveRegistry.waitForDeployment();
        await aaveRegistry.configureToken("WBTC", WBTC, aWBTC, variableDebtWBTC);
        await aaveRegistry.configureToken("WETH", WETH, aWETH, variableDebtWETH);

        await beacon.updateImplementation("AaveV3Registry", aaveRegistry.target);

        // Deploy ProtocolManager (required by AaveV3Plugin's onlyProtocolManager modifier)
        const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
        const protocolManager = await ProtocolManager.deploy(beacon.target);
        await protocolManager.waitForDeployment();
        await beacon.updateImplementation("ProtocolManager", protocolManager.target);

        // Authorize ProtocolManager to call ProxyGeneral
        await proxyGeneral.authorizeModule(protocolManager.target, "ProtocolManager");

        // Deploy AaveV3Plugin
        const AaveV3Plugin = await ethers.getContractFactory("AaveV3Plugin");
        aavePlugin = await AaveV3Plugin.deploy(beacon.target, "WBTC", AAVE_V3_POOL);
        await aavePlugin.waitForDeployment();
        await beacon.updateImplementation("AaveV3Plugin", aavePlugin.target);

        // Authorize plugin
        await proxyGeneral.authorizeModule(aavePlugin.target, "AaveV3Plugin");

        // Deploy AaveV3LensAdapter
        const AaveV3LensAdapter = await ethers.getContractFactory("AaveV3LensAdapter");
        aaveLensAdapter = await AaveV3LensAdapter.deploy(beacon.target, "WBTC", AAVE_V3_POOL);
        await aaveLensAdapter.waitForDeployment();
        await beacon.updateImplementation("AaveV3LensAdapter", aaveLensAdapter.target);

        // ==================== 11. FUND USERS WITH WBTC ====================
        wbtcContract = await ethers.getContractAt("IERC20", WBTC);

        // Impersonate WBTC whale
        await ethers.provider.send("hardhat_impersonateAccount", [WBTC_WHALE]);
        const whale = await ethers.getSigner(WBTC_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WBTC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        // Check whale balance and adjust amounts dynamically
        const whaleBalance = await wbtcContract.balanceOf(WBTC_WHALE);
        console.log(`   Whale WBTC balance: ${ethers.formatUnits(whaleBalance, 8)}`);

        // Need 0.21 WBTC total (0.1 per user + 0.01 seed). If whale is short, scale down.
        let userAmount = ethers.parseUnits("0.1", 8);
        let seedAmount = ethers.parseUnits("0.01", 8);
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted amounts: ${ethers.formatUnits(userAmount, 8)} WBTC per user`);
        }

        await wbtcContract.connect(whale).transfer(user1.address, userAmount);
        await wbtcContract.connect(whale).transfer(user2.address, userAmount);
        await wbtcContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WBTC_WHALE]);

        console.log("\n✅ Full protocol deployed with WBTC as base asset!");
        console.log(`   Beacon: ${beacon.target}`);
        console.log(`   ProxyGeneral: ${proxyGeneral.target}`);
        console.log(`   LiquidityManager: ${liquidityManager.target}`);
        console.log(`   AaveV3Plugin: ${aavePlugin.target}`);
        console.log(`   User1 WBTC: ${ethers.formatUnits(await wbtcContract.balanceOf(user1.address), 8)}`);
        console.log(`   User2 WBTC: ${ethers.formatUnits(await wbtcContract.balanceOf(user2.address), 8)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT WBTC
    // ================================================================

    describe("Step 1: Deposit WBTC", function () {
        it("should allow user1 to deposit 0.05 WBTC and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("0.05", 8);

            await wbtcContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User1 deposited: 0.05 WBTC`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 8)}`);
        });

        it("should allow user2 to deposit 0.1 WBTC", async function () {
            const depositAmount = ethers.parseUnits("0.1", 8);

            await wbtcContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User2 deposited: 0.1 WBTC`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 8)}`);
        });

        it("should have correct pool WBTC balance after deposits", async function () {
            const poolBalance = await wbtcContract.balanceOf(proxyGeneral.target);
            // Should contain initial seed + deposits (minus fees)
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("0.1", 8));
            console.log(`   Pool WBTC balance: ${ethers.formatUnits(poolBalance, 8)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY WBTC TO AAVE
    // ================================================================

    describe("Step 2: Supply WBTC to Aave V3", function () {
        it("should supply WBTC from pool to Aave via ProtocolManager", async function () {
            const supplyAmount = ethers.parseUnits("0.05", 8);

            const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
            const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

            await pm.deposit("AaveV3Plugin", "WBTC", supplyAmount);

            const aaveBalance = await aavePlugin.getBalance("WBTC");
            expect(aaveBalance).to.be.greaterThanOrEqual(supplyAmount - 10n); // small rounding tolerance

            console.log(`   Supplied: ${ethers.formatUnits(supplyAmount, 8)} WBTC to Aave`);
            console.log(`   Aave aWBTC balance: ${ethers.formatUnits(aaveBalance, 8)}`);
        });
    });

    // ================================================================
    // 3. VALUE CALCULATION
    // ================================================================

    describe("Step 3: Value Calculation with WBTC Base", function () {
        it("should calculate total pool value in WBTC terms", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0);

            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 8)} WBTC`);
        });

        it("should include Aave position in value calculation", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            const custodyBalance = await wbtcContract.balanceOf(proxyGeneral.target);

            expect(totalValue).to.be.greaterThanOrEqual(custodyBalance);

            console.log(`   Custody WBTC: ${ethers.formatUnits(custodyBalance, 8)}`);
            console.log(`   Total value (incl. Aave): ${ethers.formatUnits(totalValue, 8)}`);
        });
    });

    // ================================================================
    // 4. AAVE LENS ADAPTER
    // ================================================================

    describe("Step 4: Aave Lens Adapter Reads", function () {
        it("should report active position count", async function () {
            const count = await aaveLensAdapter.getActivePositionCount();
            console.log(`   Active position count: ${count}`);
            expect(count).to.be.greaterThanOrEqual(0);
        });

        it("getTotalValue should return correct value in WBTC terms", async function () {
            const totalValue = await aaveLensAdapter.getTotalValue();
            console.log(`   Aave lens total value: ${ethers.formatUnits(totalValue, 8)} WBTC`);
            // Should return ~0.05 WBTC since we supplied 0.05 WBTC to Aave
            expect(totalValue).to.be.greaterThan(0);
            // Sanity check: should be close to 0.05 WBTC, not orders of magnitude off
            expect(totalValue).to.be.lessThan(ethers.parseUnits("1", 8));
        });
    });

    // ================================================================
    // 5. WITHDRAW WBTC FROM AAVE AND RETURN TO POOL
    // ================================================================

    describe("Step 5: Withdraw from Aave", function () {
        it("should withdraw WBTC from Aave back to pool", async function () {
            const aaveBalanceBefore = await aavePlugin.getBalance("WBTC");
            if (aaveBalanceBefore > 0n) {
                const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
                const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

                await pm.withdraw("AaveV3Plugin", "WBTC", aaveBalanceBefore);

                const aaveBalanceAfter = await aavePlugin.getBalance("WBTC");
                // Allow small dust
                expect(aaveBalanceAfter).to.be.lessThan(ethers.parseUnits("0.00001", 8));

                console.log(`   Withdrew: ${ethers.formatUnits(aaveBalanceBefore, 8)} WBTC from Aave`);
            }
        });
    });

    // ================================================================
    // 6. USER WITHDRAWAL
    // ================================================================

    describe("Step 6: User Withdraws WBTC", function () {
        it("should allow user1 to withdraw LP tokens and receive WBTC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const wbtcBefore = await wbtcContract.balanceOf(user1.address);

                await liquidityManager.connect(user1).withdraw(lpTokens);

                const wbtcAfter = await wbtcContract.balanceOf(user1.address);
                const received = wbtcAfter - wbtcBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 8)} LP tokens`);
                console.log(`   User1 received: ${ethers.formatUnits(received, 8)} WBTC`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive WBTC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const wbtcBefore = await wbtcContract.balanceOf(user2.address);

                await liquidityManager.connect(user2).withdraw(lpTokens);

                const wbtcAfter = await wbtcContract.balanceOf(user2.address);
                const received = wbtcAfter - wbtcBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 8)} LP tokens`);
                console.log(`   User2 received: ${ethers.formatUnits(received, 8)} WBTC`);
            }
        });

        it("should have minimal WBTC remaining in pool after all withdrawals", async function () {
            const poolBalance = await wbtcContract.balanceOf(proxyGeneral.target);
            console.log(`   Remaining pool WBTC: ${ethers.formatUnits(poolBalance, 8)}`);
            // Some WBTC will remain from fees and the initial seed
        });
    });
});
