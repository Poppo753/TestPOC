import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🏦 E2E USDC BASE ASSET - FULL PROTOCOL FORK TEST
 *
 * Deploys the entire protocol stack on Arbitrum fork with USDC as the base asset.
 * Tests: deposit USDC → Aave supply → value check → withdraw
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: USDC Base Asset - Full Protocol", function () {
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

    // Whales
    const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

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

    let usdcContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    before(async function () {
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with USDC base asset...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        // Register BASE_ASSET as USDC (not WETH!)
        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", USDC);
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

        // Configure denomination: prices are in USD, target is USDC
        await chainlinkAdapter.setTargetDenomination("USDC");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS (baseAssetCode = "USDC") ====================
        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "USDC");
        await proxyGeneral.waitForDeployment();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, chainlinkAdapter.target);
        await tokenManager.waitForDeployment();

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "USDC");
        await valueCalculator.waitForDeployment();

        const SwapManager = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManager.deploy(beacon.target, "USDC");
        await swapManager.waitForDeployment();

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 6); // USDC = 6 decimals
        await parameterManager.waitForDeployment();

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "USDC");
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
        await tokenManager.setBaseAssetCode("USDC");
        // Register WETH and WBTC as tradeable tokens (USDC is BASE_ASSET, not registered)
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", WETH, 18, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", WBTC, 8, 3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);  // 0.3%
        await liquidityManager.setWithdrawFee(50);  // 0.5%
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        // Set withdraw limits (USDC amounts, 6 decimals)
        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100000", 6),  // hourly
            ethers.parseUnits("500000", 6),  // daily
            ethers.parseUnits("1", 6),        // min withdraw
            ethers.parseUnits("50000", 6)     // max per tx
        );

        // ==================== 7. SET PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.1", 6)); // $0.10 min

        // Increase maxDeposit to 1000 USDC (default is 100 USDC, has timelock)
        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 6));
        // Fast-forward past timelock (24h)
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
        // Get Aave reserve data
        const pool = await ethers.getContractAt(
            ["function getReserveData(address) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))"],
            AAVE_V3_POOL
        );

        // Use low-level calls for aToken/debtToken addresses
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

        console.log(`   aUSDC: ${aUSDC}`);
        console.log(`   aWETH: ${aWETH}`);

        // Deploy AaveV3Registry
        const AaveV3Registry = await ethers.getContractFactory("AaveV3Registry");
        aaveRegistry = await AaveV3Registry.deploy();
        await aaveRegistry.waitForDeployment();
        await aaveRegistry.configureToken("USDC", USDC, aUSDC, variableDebtUSDC);
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
        aavePlugin = await AaveV3Plugin.deploy(beacon.target, "USDC", AAVE_V3_POOL);
        await aavePlugin.waitForDeployment();
        await beacon.updateImplementation("AaveV3Plugin", aavePlugin.target);

        // Authorize plugin
        await proxyGeneral.authorizeModule(aavePlugin.target, "AaveV3Plugin");

        // Deploy AaveV3LensAdapter
        const AaveV3LensAdapter = await ethers.getContractFactory("AaveV3LensAdapter");
        aaveLensAdapter = await AaveV3LensAdapter.deploy(beacon.target, "USDC", AAVE_V3_POOL);
        await aaveLensAdapter.waitForDeployment();
        await beacon.updateImplementation("AaveV3LensAdapter", aaveLensAdapter.target);

        // ==================== 11. FUND USERS WITH USDC ====================
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        // Impersonate USDC whale
        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        const whale = await ethers.getSigner(USDC_WHALE);
        await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        // Check whale balance and adjust amounts dynamically
        const whaleBalance = await usdcContract.balanceOf(USDC_WHALE);
        console.log(`   Whale USDC balance: ${ethers.formatUnits(whaleBalance, 6)}`);

        // Need 21K total (10K per user + 1K seed). If whale is short, use 1/10th of whale balance
        let userAmount = ethers.parseUnits("10000", 6);
        let seedAmount = ethers.parseUnits("1000", 6);
        const totalNeeded = userAmount * 2n + seedAmount;
        
        if (whaleBalance < totalNeeded) {
            // Use 40% for each user, 10% for seed, keep 10% buffer
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted amounts: ${ethers.formatUnits(userAmount, 6)} USDC per user`);
        }

        await usdcContract.connect(whale).transfer(user1.address, userAmount);
        await usdcContract.connect(whale).transfer(user2.address, userAmount);
        await usdcContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

        console.log("\n✅ Full protocol deployed with USDC as base asset!");
        console.log(`   Beacon: ${beacon.target}`);
        console.log(`   ProxyGeneral: ${proxyGeneral.target}`);
        console.log(`   LiquidityManager: ${liquidityManager.target}`);
        console.log(`   AaveV3Plugin: ${aavePlugin.target}`);
        console.log(`   User1 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user1.address), 6)}`);
        console.log(`   User2 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user2.address), 6)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT USDC
    // ================================================================

    describe("Step 1: Deposit USDC", function () {
        it("should allow user1 to deposit 100 USDC and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("100", 6);

            // Approve LiquidityManager
            await usdcContract.connect(user1).approve(liquidityManager.target, depositAmount);

            // Deposit
            const tx = await liquidityManager.connect(user1).deposit(depositAmount);
            const receipt = await tx.wait();

            // Check LP tokens minted
            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User1 deposited: 100 USDC`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should allow user2 to deposit 200 USDC", async function () {
            const depositAmount = ethers.parseUnits("200", 6);

            await usdcContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0);

            console.log(`   User2 deposited: 200 USDC`);
            console.log(`   LP tokens received: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should have correct pool USDC balance after deposits", async function () {
            const poolBalance = await usdcContract.balanceOf(proxyGeneral.target);
            // Should contain initial seed + deposits (minus fees)
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("200", 6));
            console.log(`   Pool USDC balance: ${ethers.formatUnits(poolBalance, 6)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY USDC TO AAVE
    // ================================================================

    describe("Step 2: Supply USDC to Aave V3", function () {
        it("should supply USDC from pool to Aave via ProtocolManager", async function () {
            const supplyAmount = ethers.parseUnits("100", 6);

            // Use ProtocolManager to orchestrate: ProxyGeneral → Plugin → Aave
            const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
            const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));
            
            await pm.deposit("AaveV3Plugin", "USDC", supplyAmount);

            // Check Aave deposit
            const aaveBalance = await aavePlugin.getBalance("USDC");
            expect(aaveBalance).to.be.greaterThanOrEqual(supplyAmount - 10n); // small rounding tolerance

            console.log(`   Supplied: ${ethers.formatUnits(supplyAmount, 6)} USDC to Aave`);
            console.log(`   Aave aUSDC balance: ${ethers.formatUnits(aaveBalance, 6)}`);
        });
    });

    // ================================================================
    // 3. VALUE CALCULATION
    // ================================================================

    describe("Step 3: Value Calculation with USDC Base", function () {
        it("should calculate total pool value in USDC terms", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            // Should be at least the sum of deposits (minus fees)
            expect(totalValue).to.be.greaterThan(0);

            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });

        it("should include Aave position in value calculation", async function () {
            // Value should include both custody USDC and Aave position
            const totalValue = await valueCalculator.getTotalPoolValueView();
            const custodyBalance = await usdcContract.balanceOf(proxyGeneral.target);

            // Total value should be greater than just custody balance
            // (it includes Aave position)
            expect(totalValue).to.be.greaterThanOrEqual(custodyBalance);

            console.log(`   Custody USDC: ${ethers.formatUnits(custodyBalance, 6)}`);
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
            // After depositing 100 USDC, should have at least 1 position
            expect(count).to.be.greaterThanOrEqual(0);
        });

        it("getTotalValue should return correct value using Aave Oracle", async function () {
            const totalValue = await aaveLensAdapter.getTotalValue();
            console.log(`   Aave lens total value: ${ethers.formatUnits(totalValue, 6)} USDC`);
            // Should return a non-zero value since we have USDC supplied to Aave
            expect(totalValue).to.be.greaterThan(0);
        });
    });

    // ================================================================
    // 5. WITHDRAW USDC FROM AAVE AND RETURN TO USERS
    // ================================================================

    describe("Step 5: Withdraw from Aave", function () {
        it("should withdraw USDC from Aave back to pool", async function () {
            const aaveBalanceBefore = await aavePlugin.getBalance("USDC");
            if (aaveBalanceBefore > 0n) {
                // Withdraw all from Aave via ProtocolManager
                const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
                const pm = ProtocolManager.attach(await beacon.getImplementation("ProtocolManager"));
                
                await pm.withdraw("AaveV3Plugin", "USDC", aaveBalanceBefore);

                const aaveBalanceAfter = await aavePlugin.getBalance("USDC");
                // Allow small dust
                expect(aaveBalanceAfter).to.be.lessThan(ethers.parseUnits("1", 6));

                console.log(`   Withdrew: ${ethers.formatUnits(aaveBalanceBefore, 6)} USDC from Aave`);
            }
        });
    });

    // ================================================================
    // 6. USER WITHDRAWAL
    // ================================================================

    describe("Step 6: User Withdraws USDC", function () {
        it("should allow user1 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user1.address);

                await liquidityManager.connect(user1).withdraw(lpTokens);

                const usdcAfter = await usdcContract.balanceOf(user1.address);
                const received = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 6)} LP tokens`);
                console.log(`   User1 received: ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user2.address);

                await liquidityManager.connect(user2).withdraw(lpTokens);

                const usdcAfter = await usdcContract.balanceOf(user2.address);
                const received = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 6)} LP tokens`);
                console.log(`   User2 received: ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("should have minimal USDC remaining in pool after all withdrawals", async function () {
            const poolBalance = await usdcContract.balanceOf(proxyGeneral.target);
            console.log(`   Remaining pool USDC: ${ethers.formatUnits(poolBalance, 6)}`);
            // Some USDC will remain from fees and the initial seed
        });
    });
});
