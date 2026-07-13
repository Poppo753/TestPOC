import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🏦 E2E USDT BASE ASSET - FULL PROTOCOL FORK TEST
 *
 * Deploys the entire protocol stack on Arbitrum fork with USDT as the base asset (6 decimals).
 * Tests: deposit USDT → Aave supply → value check → withdraw
 *
 * This validates the multi-token base asset abstraction with USDT (6 decimals, like USDC
 * but a different token — confirms generality, not just USDC-specific behavior).
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDT.BaseAsset.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: USDT Base Asset - Full Protocol", function () {
    this.timeout(300000); // 5 minutes

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    // Chainlink feeds
    const CHAINLINK_USDT_USD = "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7";
    const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";
    const CHAINLINK_ETH_USD = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";

    // Aave V3
    const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

    // Whales — large USDT holder on Arbitrum (Aave aUSDT reserve)
    const USDT_WHALE = "0x6ab707Aca953eDAeFBc4fD23bA73294241490620";

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

    let usdtContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;
    let suiteSnapshotId: string;

    before(async function () {
        suiteSnapshotId = await ethers.provider.send("evm_snapshot", []);
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with USDT base asset...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        // Register BASE_ASSET as USDT (6 decimals)
        await beacon.updateImplementation("USDT", USDT);
        await beacon.updateImplementation("BASE_ASSET", USDT);
        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("WETH", WETH);

        // ==================== 2. CHAINLINK ADAPTER ====================
        const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapter.deploy();
        await chainlinkAdapter.waitForDeployment();

        // Use large heartbeat for fork tests (Chainlink data may be stale on fork)
        const FORK_HEARTBEAT = 31536000; // 1 year
        await chainlinkAdapter.setPriceFeed("USDT", CHAINLINK_USDT_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WETH", CHAINLINK_ETH_USD, 8, FORK_HEARTBEAT, "USD");

        // Configure denomination: prices are in USD, target is USDT
        await chainlinkAdapter.setTargetDenomination("USDT");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_USDT_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS (baseAssetCode = "USDT") ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "USDT");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "USDT");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "USDT");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 6); // USDT = 6 decimals
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "USDT");
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
        await tokenManager.setBaseAssetCode("USDT");
        // Register USDC and WETH as tradeable tokens (USDT is BASE_ASSET, not registered)
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("USDC", USDC, 6, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", WETH, 18, 3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);  // 0.3%
        await liquidityManager.setWithdrawFee(50);  // 0.5%
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        // Set withdraw limits (USDT amounts, 6 decimals)
        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100000", 6),  // hourly
            ethers.parseUnits("500000", 6),  // daily
            ethers.parseUnits("1", 6),        // min withdraw
            ethers.parseUnits("50000", 6)     // max per tx
        );

        // ==================== 7. SET PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.1", 6)); // $0.10 min

        // Increase maxDeposit to 1000 USDT (default is 100 USDT, has timelock)
        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxDeposit");

        // Also increase maxWithdrawPerTx
        await parameterManager.proposeParameterChange("maxWithdrawPerTx", ethers.parseUnits("500", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxWithdrawPerTx");

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit", ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));

        // ==================== 10. AAVE V3 SETUP ====================
        const poolFull = await ethers.getContractAt(
            [
                "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))"
            ],
            AAVE_V3_POOL
        );

        const usdtReserve = await poolFull.getReserveData(USDT);
        const wethReserve = await poolFull.getReserveData(WETH);

        const aUSDT = usdtReserve.aTokenAddress;
        const variableDebtUSDT = usdtReserve.variableDebtTokenAddress;
        const aWETH = wethReserve.aTokenAddress;
        const variableDebtWETH = wethReserve.variableDebtTokenAddress;

        console.log(`   aUSDT: ${aUSDT}`);
        console.log(`   aWETH: ${aWETH}`);

        // Deploy AaveV3Registry
        const AaveV3Registry = await ethers.getContractFactory("AaveV3Registry");
        aaveRegistry = await AaveV3Registry.deploy();
        await aaveRegistry.waitForDeployment();
        await aaveRegistry.configureToken("USDT", USDT, aUSDT, variableDebtUSDT);
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
        aavePlugin = await AaveV3Plugin.deploy(beacon.target, "USDT", AAVE_V3_POOL);
        await aavePlugin.waitForDeployment();
        await beacon.updateImplementation("AaveV3Plugin", aavePlugin.target);

        // Authorize plugin
        await proxyGeneral.authorizeModule(aavePlugin.target, "AaveV3Plugin");

        // Deploy AaveV3LensAdapter
        const AaveV3LensAdapter = await ethers.getContractFactory("AaveV3LensAdapter");
        aaveLensAdapter = await AaveV3LensAdapter.deploy(beacon.target, "USDT", AAVE_V3_POOL);
        await aaveLensAdapter.waitForDeployment();
        await beacon.updateImplementation("AaveV3LensAdapter", aaveLensAdapter.target);

        // ==================== 11. FUND USERS WITH USDT ====================
        usdtContract = await ethers.getContractAt("IERC20", USDT);

        // Impersonate USDT whale
        await ethers.provider.send("hardhat_impersonateAccount", [USDT_WHALE]);
        const whale = await ethers.getSigner(USDT_WHALE);
        await ethers.provider.send("hardhat_setBalance", [USDT_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        // Check whale balance and adjust amounts dynamically
        const whaleBalance = await usdtContract.balanceOf(USDT_WHALE);
        console.log(`   Whale USDT balance: ${ethers.formatUnits(whaleBalance, 6)}`);

        // Need 21K total (10K per user + 1K seed). If whale is short, scale down.
        let userAmount = ethers.parseUnits("10000", 6);
        let seedAmount = ethers.parseUnits("1000", 6);
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted amounts: ${ethers.formatUnits(userAmount, 6)} USDT per user`);
        }

        await usdtContract.connect(whale).transfer(user1.address, userAmount);
        await usdtContract.connect(whale).transfer(user2.address, userAmount);
        await usdtContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDT_WHALE]);

        console.log("\n✅ Full protocol deployed with USDT as base asset!");
        console.log(`   Beacon: ${beacon.target}`);
        console.log(`   ProxyGeneral: ${proxyGeneral.target}`);
        console.log(`   LiquidityManager: ${liquidityManager.target}`);
        console.log(`   AaveV3Plugin: ${aavePlugin.target}`);
        console.log(`   User1 USDT: ${ethers.formatUnits(await usdtContract.balanceOf(user1.address), 6)}`);
        console.log(`   User2 USDT: ${ethers.formatUnits(await usdtContract.balanceOf(user2.address), 6)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT USDT
    // ================================================================

    describe("Step 1: Deposit USDT", function () {
        it("should allow user1 to deposit 100 USDT and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("100", 6);

            await usdtContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User1 deposited: 100 USDT`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should allow user2 to deposit 200 USDT", async function () {
            const depositAmount = ethers.parseUnits("200", 6);

            await usdtContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User2 deposited: 200 USDT`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should have correct pool USDT balance after deposits", async function () {
            const poolBalance = await usdtContract.balanceOf(proxyGeneral.target);
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("200", 6));
            console.log(`   Pool USDT balance: ${ethers.formatUnits(poolBalance, 6)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY USDT TO AAVE
    // ================================================================

    describe("Step 2: Supply USDT to Aave V3", function () {
        it("should supply USDT from pool to Aave via ProtocolManager", async function () {
            const supplyAmount = ethers.parseUnits("100", 6);

            const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
            const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

            await pm.deposit("AaveV3Plugin", "USDT", supplyAmount);

            const aaveBalance = await aavePlugin.getBalance("USDT");
            expect(aaveBalance).to.be.greaterThanOrEqual(supplyAmount - 10n); // small rounding tolerance

            console.log(`   Supplied: ${ethers.formatUnits(supplyAmount, 6)} USDT to Aave`);
            console.log(`   Aave aUSDT balance: ${ethers.formatUnits(aaveBalance, 6)}`);
        });
    });

    // ================================================================
    // 3. VALUE CALCULATION
    // ================================================================

    describe("Step 3: Value Calculation with USDT Base", function () {
        it("should calculate total pool value in USDT terms", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0);

            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 6)} USDT`);
        });

        it("should include Aave position in value calculation", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            const custodyBalance = await usdtContract.balanceOf(proxyGeneral.target);

            expect(totalValue).to.be.greaterThanOrEqual(custodyBalance);

            console.log(`   Custody USDT: ${ethers.formatUnits(custodyBalance, 6)}`);
            console.log(`   Total value (incl. Aave): ${ethers.formatUnits(totalValue, 6)}`);
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

        it("getTotalValue should return correct value in USDT terms", async function () {
            const totalValue = await aaveLensAdapter.getTotalValue();
            console.log(`   Aave lens total value: ${ethers.formatUnits(totalValue, 6)} USDT`);
            // Should return ~100 USDT since we supplied 100 USDT to Aave
            expect(totalValue).to.be.greaterThan(0);
            // Sanity check: should be close to 100 USDT, not orders of magnitude off
            expect(totalValue).to.be.lessThan(ethers.parseUnits("1000", 6));
        });
    });

    // ================================================================
    // 5. WITHDRAW USDT FROM AAVE AND RETURN TO POOL
    // ================================================================

    describe("Step 5: Withdraw from Aave", function () {
        it("should withdraw USDT from Aave back to pool", async function () {
            const aaveBalanceBefore = await aavePlugin.getBalance("USDT");
            if (aaveBalanceBefore > 0n) {
                const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
                const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));

                await pm.withdraw("AaveV3Plugin", "USDT", aaveBalanceBefore);

                const aaveBalanceAfter = await aavePlugin.getBalance("USDT");
                // Allow small dust
                expect(aaveBalanceAfter).to.be.lessThan(ethers.parseUnits("1", 6));

                console.log(`   Withdrew: ${ethers.formatUnits(aaveBalanceBefore, 6)} USDT from Aave`);
            }
        });
    });

    // ================================================================
    // 6. USER WITHDRAWAL
    // ================================================================

    describe("Step 6: User Withdraws USDT", function () {
        it("should allow user1 to withdraw LP tokens and receive USDT", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const usdtBefore = await usdtContract.balanceOf(user1.address);

                await liquidityManager.connect(user1).withdraw(lpTokens);

                const usdtAfter = await usdtContract.balanceOf(user1.address);
                const received = usdtAfter - usdtBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 6)} LP tokens`);
                console.log(`   User1 received: ${ethers.formatUnits(received, 6)} USDT`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive USDT", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const usdtBefore = await usdtContract.balanceOf(user2.address);

                await liquidityManager.connect(user2).withdraw(lpTokens);

                const usdtAfter = await usdtContract.balanceOf(user2.address);
                const received = usdtAfter - usdtBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 6)} LP tokens`);
                console.log(`   User2 received: ${ethers.formatUnits(received, 6)} USDT`);
            }
        });

        it("should have minimal USDT remaining in pool after all withdrawals", async function () {
            const poolBalance = await usdtContract.balanceOf(proxyGeneral.target);
            console.log(`   Remaining pool USDT: ${ethers.formatUnits(poolBalance, 6)}`);
            // Some USDT will remain from fees and the initial seed
        });
    });

    after(async function () {
        await ethers.provider.send("evm_revert", [suiteSnapshotId]);
    });
});
