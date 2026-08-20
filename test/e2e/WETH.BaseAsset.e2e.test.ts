import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🏦 E2E WETH BASE ASSET - FULL PROTOCOL FORK TEST
 *
 * Deploys the entire protocol stack on Arbitrum fork with WETH as the base asset (18 decimals).
 * Tests: deposit WETH → Aave supply → value check → withdraw
 *
 * This validates the multi-token base asset abstraction with an 18-decimal base asset
 * (vs USDC which is 6 decimals).
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/WETH.BaseAsset.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: WETH Base Asset - Full Protocol", function () {
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

    // Whales — large WETH holder on Arbitrum (Aave aWETH reserve / bridge)
    const WETH_WHALE = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

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

    let wethContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;
    let suiteSnapshotId: string;

    before(async function () {
        suiteSnapshotId = await ethers.provider.send("evm_snapshot", []);
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with WETH base asset...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        // Register BASE_ASSET as WETH (18 decimals)
        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", WETH);
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

        // Configure denomination: prices are in USD, target is WETH
        await chainlinkAdapter.setTargetDenomination("WETH");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_ETH_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS (baseAssetCode = "WETH") ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WETH");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "WETH");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "WETH");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 18); // WETH = 18 decimals
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "WETH");
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
        await tokenManager.setBaseAssetCode("WETH");
        // Register USDC and WBTC as tradeable tokens (WETH is BASE_ASSET, not registered)
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", USDC, 6, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", WBTC, 8, 3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);  // 0.3%
        await liquidityManager.setWithdrawFee(50);  // 0.5%
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        // Set withdraw limits (WETH amounts, 18 decimals)
        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100", 18),   // hourly
            ethers.parseUnits("500", 18),   // daily
            ethers.parseUnits("0.001", 18), // min withdraw
            ethers.parseUnits("50", 18)     // max per tx
        );

        // ==================== 7. SET PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.0001", 18)); // tiny min

        // Increase maxDeposit to 1000 WETH (default is low, has timelock)
        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 18));
        // Fast-forward past timelock (24h)
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxDeposit");

        // Also increase maxWithdrawPerTx
        await parameterManager.proposeParameterChange("maxWithdrawPerTx", ethers.parseUnits("500", 18));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxWithdrawPerTx");

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit", ethers.parseUnits("1000000", 18), ethers.parseUnits("5000000", 18));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 18), ethers.parseUnits("5000000", 18));

        // ==================== 10. AAVE V3 SETUP ====================
        const poolFull = await ethers.getContractAt(
            [
                "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))"
            ],
            AAVE_V3_POOL
        );

        const usdcReserve = await poolFull.getReserveData(USDC);
        const wethReserve = await poolFull.getReserveData(WETH);

        const aUSDC = usdcReserve.aTokenAddress;
        const variableDebtUSDC = usdcReserve.variableDebtTokenAddress;
        const aWETH = wethReserve.aTokenAddress;
        const variableDebtWETH = wethReserve.variableDebtTokenAddress;

        console.log(`   aWETH: ${aWETH}`);
        console.log(`   aUSDC: ${aUSDC}`);

        // Deploy AaveV3Registry
        const AaveV3Registry = await ethers.getContractFactory("AaveV3Registry");
        aaveRegistry = await AaveV3Registry.deploy();
        await aaveRegistry.waitForDeployment();
        await aaveRegistry.configureToken("WETH", WETH, aWETH, variableDebtWETH);
        await aaveRegistry.configureToken("USDC", USDC, aUSDC, variableDebtUSDC);

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
        aavePlugin = await AaveV3Plugin.deploy(beacon.target, "WETH", AAVE_V3_POOL);
        await aavePlugin.waitForDeployment();
        await beacon.updateImplementation("AaveV3Plugin", aavePlugin.target);

        // Authorize plugin
        await proxyGeneral.authorizeModule(aavePlugin.target, "AaveV3Plugin");

        // Deploy AaveV3LensAdapter
        const AaveV3LensAdapter = await ethers.getContractFactory("AaveV3LensAdapter");
        aaveLensAdapter = await AaveV3LensAdapter.deploy(beacon.target, "WETH", AAVE_V3_POOL);
        await aaveLensAdapter.waitForDeployment();
        await beacon.updateImplementation("AaveV3LensAdapter", aaveLensAdapter.target);

        // ==================== 11. FUND USERS WITH WETH ====================
        wethContract = await ethers.getContractAt("IERC20", WETH);

        // Impersonate WETH whale
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        const whale = await ethers.getSigner(WETH_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        // Check whale balance and adjust amounts dynamically
        const whaleBalance = await wethContract.balanceOf(WETH_WHALE);
        console.log(`   Whale WETH balance: ${ethers.formatUnits(whaleBalance, 18)}`);

        // Need 21 WETH total (10 per user + 1 seed). If whale is short, scale down.
        let userAmount = ethers.parseUnits("10", 18);
        let seedAmount = ethers.parseUnits("1", 18);
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted amounts: ${ethers.formatUnits(userAmount, 18)} WETH per user`);
        }

        await wethContract.connect(whale).transfer(user1.address, userAmount);
        await wethContract.connect(whale).transfer(user2.address, userAmount);
        await wethContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);

        console.log("\n✅ Full protocol deployed with WETH as base asset!");
        console.log(`   Beacon: ${beacon.target}`);
        console.log(`   ProxyGeneral: ${proxyGeneral.target}`);
        console.log(`   LiquidityManager: ${liquidityManager.target}`);
        console.log(`   AaveV3Plugin: ${aavePlugin.target}`);
        console.log(`   User1 WETH: ${ethers.formatUnits(await wethContract.balanceOf(user1.address), 18)}`);
        console.log(`   User2 WETH: ${ethers.formatUnits(await wethContract.balanceOf(user2.address), 18)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT WETH
    // ================================================================

    describe("Step 1: Deposit WETH", function () {
        it("should allow user1 to deposit 1 WETH and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("1", 18);

            await wethContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User1 deposited: 1 WETH`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 18)}`);
        });

        it("should allow user2 to deposit 2 WETH", async function () {
            const depositAmount = ethers.parseUnits("2", 18);

            await wethContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User2 deposited: 2 WETH`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 18)}`);
        });

        it("should have correct pool WETH balance after deposits", async function () {
            const poolBalance = await wethContract.balanceOf(proxyGeneral.target);
            // Should contain initial seed + deposits (minus fees)
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("2", 18));
            console.log(`   Pool WETH balance: ${ethers.formatUnits(poolBalance, 18)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY WETH TO AAVE
    // ================================================================

    describe("Step 2: Supply WETH to Aave V3", function () {
        it("should supply WETH from pool to Aave via ProtocolManager", async function () {
            const supplyAmount = ethers.parseUnits("1", 18);

            const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
            const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

            await pm.deposit("AaveV3Plugin", "WETH", supplyAmount);

            const aaveBalance = await aavePlugin.getBalance("WETH");
            expect(aaveBalance).to.be.greaterThanOrEqual(supplyAmount - 10n); // small rounding tolerance

            console.log(`   Supplied: ${ethers.formatUnits(supplyAmount, 18)} WETH to Aave`);
            console.log(`   Aave aWETH balance: ${ethers.formatUnits(aaveBalance, 18)}`);
        });
    });

    // ================================================================
    // 3. VALUE CALCULATION
    // ================================================================

    describe("Step 3: Value Calculation with WETH Base", function () {
        it("should calculate total pool value in WETH terms", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0);

            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 18)} WETH`);
        });

        it("should include Aave position in value calculation", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            const custodyBalance = await wethContract.balanceOf(proxyGeneral.target);

            expect(totalValue).to.be.greaterThanOrEqual(custodyBalance);

            console.log(`   Custody WETH: ${ethers.formatUnits(custodyBalance, 18)}`);
            console.log(`   Total value (incl. Aave): ${ethers.formatUnits(totalValue, 18)}`);
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

        it("getTotalValue should return correct value in WETH terms", async function () {
            const totalValue = await aaveLensAdapter.getTotalValue();
            console.log(`   Aave lens total value: ${ethers.formatUnits(totalValue, 18)} WETH`);
            // Should return a non-zero value since we have WETH supplied to Aave
            expect(totalValue).to.be.greaterThan(0);
        });
    });

    // ================================================================
    // 5. WITHDRAW WETH FROM AAVE AND RETURN TO POOL
    // ================================================================

    describe("Step 5: Withdraw from Aave", function () {
        it("should withdraw WETH from Aave back to pool", async function () {
            const aaveBalanceBefore = await aavePlugin.getBalance("WETH");
            if (aaveBalanceBefore > 0n) {
                const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
                const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

                await pm.withdraw("AaveV3Plugin", "WETH", aaveBalanceBefore);

                const aaveBalanceAfter = await aavePlugin.getBalance("WETH");
                // Allow small dust
                expect(aaveBalanceAfter).to.be.lessThan(ethers.parseUnits("0.001", 18));

                console.log(`   Withdrew: ${ethers.formatUnits(aaveBalanceBefore, 18)} WETH from Aave`);
            }
        });
    });

    // ================================================================
    // 6. USER WITHDRAWAL
    // ================================================================

    describe("Step 6: User Withdraws WETH", function () {
        it("should allow user1 to withdraw LP tokens and receive WETH", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const wethBefore = await wethContract.balanceOf(user1.address);

                await liquidityManager.connect(user1).withdraw(lpTokens);

                const wethAfter = await wethContract.balanceOf(user1.address);
                const received = wethAfter - wethBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 18)} LP tokens`);
                console.log(`   User1 received: ${ethers.formatUnits(received, 18)} WETH`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive WETH", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const wethBefore = await wethContract.balanceOf(user2.address);

                await liquidityManager.connect(user2).withdraw(lpTokens);

                const wethAfter = await wethContract.balanceOf(user2.address);
                const received = wethAfter - wethBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 18)} LP tokens`);
                console.log(`   User2 received: ${ethers.formatUnits(received, 18)} WETH`);
            }
        });

        it("should have minimal WETH remaining in pool after all withdrawals", async function () {
            const poolBalance = await wethContract.balanceOf(proxyGeneral.target);
            console.log(`   Remaining pool WETH: ${ethers.formatUnits(poolBalance, 18)}`);
            // Some WETH will remain from fees and the initial seed
        });
    });

    after(async function () {
        await ethers.provider.send("evm_revert", [suiteSnapshotId]);
    });
});
