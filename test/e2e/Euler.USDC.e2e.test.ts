import { expect } from "chai";
import { ethers, network } from "hardhat";

/**
 * 🦉 E2E EULER V2 - FULL PROTOCOL FORK TEST (USDC Base Asset)
 *
 * Deploys the entire protocol stack on Arbitrum fork with USDC as base asset.
 * Tests: deposit USDC → Euler V2 supply → value check (via EulerLensAdapter) → withdraw
 *
 * Euler V2 Arbitrum addresses:
 * - EVC:         0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - AccountLens: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
 * - USDC Vault:  0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899
 * - WETH Vault:  0x78E3E051D32157AACD550fBB78458762d8f7edFF
 *
 * Run: $env:FORK_ENABLED="true"; npx hardhat test test/e2e/Euler.USDC.e2e.test.ts
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";

(FORK_ENABLED ? describe : describe.skip)("E2E: Euler V2 - USDC Base Asset", function () {
    this.timeout(300000); // 5 minutes

    // ==================== ARBITRUM MAINNET ADDRESSES ====================
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

    // Chainlink feeds
    const CHAINLINK_ETH_USD  = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
    const CHAINLINK_BTC_USD  = "0x6ce185860a4963106506C203335A2910413708e9";
    const CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

    // Euler V2 Arbitrum
    const EULER_USDC_VAULT   = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
    const EULER_WETH_VAULT   = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
    const EULER_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const EULER_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
    const EULER_VAULT_LENS   = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
    const EULER_UTILS_LENS   = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";

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
    let protocolManager: any;
    let eulerRegistry: any;
    let eulerPlugin: any;
    let eulerLensAdapter: any;

    let usdcContract: any;

    let owner: any;
    let user1: any;
    let user2: any;
    let feeRecipient: any;
    let suiteSnapshotId: string;

    before(async function () {
        suiteSnapshotId = await ethers.provider.send("evm_snapshot", []);
        [owner, user1, user2, feeRecipient] = await ethers.getSigners();

        console.log("\n🔧 Deploying full protocol with USDC base asset (Euler V2 plugin)...\n");

        // ==================== 1. BEACON ====================
        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.waitForDeployment();

        await beacon.updateImplementation("USDC", USDC);
        await beacon.updateImplementation("BASE_ASSET", USDC);
        await beacon.updateImplementation("WETH", WETH);
        await beacon.updateImplementation("WBTC", WBTC);

        // ==================== 2. CHAINLINK ADAPTER ====================
        const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
        chainlinkAdapter = await ChainlinkAdapter.deploy();
        await chainlinkAdapter.waitForDeployment();

        const FORK_HEARTBEAT = 31536000; // 1 year (fork data may be stale)
        await chainlinkAdapter.setPriceFeed("USDC", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WETH", CHAINLINK_ETH_USD,  8, FORK_HEARTBEAT, "USD");
        await chainlinkAdapter.setPriceFeed("WBTC", CHAINLINK_BTC_USD,  8, FORK_HEARTBEAT, "USD");

        // Target denomination = USDC
        await chainlinkAdapter.setTargetDenomination("USDC");
        await chainlinkAdapter.setReferenceFeed("USD", CHAINLINK_USDC_USD, 8, FORK_HEARTBEAT);

        // ==================== 3. CORE CONTRACTS ====================
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

        // ==================== 4. REGISTER CORE IN BEACON ====================
        await beacon.updateImplementation("ProxyGeneral",      proxyGeneral.target);
        await beacon.updateImplementation("TokenManager",      tokenManager.target);
        await beacon.updateImplementation("ValueCalculator",   valueCalculator.target);
        await beacon.updateImplementation("SwapManager",       swapManager.target);
        await beacon.updateImplementation("ParameterManager",  parameterManager.target);
        await beacon.updateImplementation("LiquidityManager",  liquidityManager.target);

        // ==================== 5. CONFIGURE TOKEN MANAGER ====================
        await tokenManager.setBaseAssetCode("USDC");
        // WETH and WBTC as tradeable tokens (USDC is BASE_ASSET, not registered)
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WETH", WETH, 18, 3600);
        await tokenManager["manageTokenData(string,address,uint8,uint256)"]("WBTC", WBTC, 8,  3600);

        // ==================== 6. CONFIGURE LIQUIDITY MANAGER ====================
        await liquidityManager.setFeeRecipient(feeRecipient.address);
        await liquidityManager.setDepositFee(30);
        await liquidityManager.setWithdrawFee(50);
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        await liquidityManager.setWithdrawLimits(
            ethers.parseUnits("100000", 6),
            ethers.parseUnits("500000", 6),
            ethers.parseUnits("1", 6),
            ethers.parseUnits("50000", 6)
        );

        // ==================== 7. PARAMETERS ====================
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseUnits("0.1", 6));

        await parameterManager.proposeParameterChange("maxDeposit", ethers.parseUnits("1000", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxDeposit");

        await parameterManager.proposeParameterChange("maxWithdrawPerTx", ethers.parseUnits("500", 6));
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        await parameterManager["executeParameterChange(string)"]("maxWithdrawPerTx");

        // ==================== 8. AUTHORIZE MODULES ====================
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");

        // ==================== 9. RATE LIMITS ====================
        await proxyGeneral.setRateLimit("deposit",  ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseUnits("1000000", 6), ethers.parseUnits("5000000", 6));

        // ==================== 10. EULER V2 SETUP ====================

        // Deploy EulerRegistry and configure USDC vault
        const EulerRegistry = await ethers.getContractFactory("EulerRegistry");
        eulerRegistry = await EulerRegistry.deploy();
        await eulerRegistry.waitForDeployment();
        await eulerRegistry.setVault("USDC", EULER_USDC_VAULT);
        await eulerRegistry.setVault("WETH", EULER_WETH_VAULT);

        await beacon.updateImplementation("EulerRegistry", eulerRegistry.target);

        // Deploy EulerV2Plugin
        const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
        eulerPlugin = await EulerV2Plugin.deploy(beacon.target, "USDC", EULER_EVC, EULER_ACCOUNT_LENS);
        await eulerPlugin.waitForDeployment();
        await beacon.updateImplementation("EulerV2Plugin", eulerPlugin.target);

        // Deploy EulerLensAdapter
        const EulerLensAdapter = await ethers.getContractFactory("EulerLensAdapter");
        eulerLensAdapter = await EulerLensAdapter.deploy(beacon.target, "USDC", EULER_ACCOUNT_LENS, EULER_VAULT_LENS, EULER_UTILS_LENS, EULER_EVC);
        await eulerLensAdapter.waitForDeployment();
        await beacon.updateImplementation("EulerLensAdapter", eulerLensAdapter.target);

        // Deploy ProtocolManager
        const ProtocolManager = await ethers.getContractFactory("ProtocolManager");
        protocolManager = await ProtocolManager.deploy(beacon.target);
        await protocolManager.waitForDeployment();
        await beacon.updateImplementation("ProtocolManager", protocolManager.target);

        // Authorize ProtocolManager in ProxyGeneral (needed for withdrawToken)
        await proxyGeneral.authorizeModule(protocolManager.target, "ProtocolManager");
        // Authorize EulerV2Plugin in ProxyGeneral (for fund returns)
        await proxyGeneral.authorizeModule(eulerPlugin.target, "EulerV2Plugin");

        // ==================== 11. FUND USERS WITH USDC ====================
        usdcContract = await ethers.getContractAt("IERC20", USDC);

        await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
        const whale = await ethers.getSigner(USDC_WHALE);
        await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        const whaleBalance = await usdcContract.balanceOf(USDC_WHALE);
        console.log(`   Whale USDC balance: ${ethers.formatUnits(whaleBalance, 6)}`);

        let userAmount = ethers.parseUnits("10000", 6);
        let seedAmount = ethers.parseUnits("1000", 6);
        const totalNeeded = userAmount * 2n + seedAmount;

        if (whaleBalance < totalNeeded) {
            userAmount = whaleBalance * 40n / 100n;
            seedAmount = whaleBalance * 10n / 100n;
            console.log(`   ⚠️ Whale low, adjusted: ${ethers.formatUnits(userAmount, 6)} USDC per user`);
        }

        await usdcContract.connect(whale).transfer(user1.address, userAmount);
        await usdcContract.connect(whale).transfer(user2.address, userAmount);
        await usdcContract.connect(whale).transfer(proxyGeneral.target, seedAmount);

        await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

        console.log("\n✅ Full protocol deployed with Euler V2 (USDC vault)");
        console.log(`   Beacon:           ${beacon.target}`);
        console.log(`   ProxyGeneral:     ${proxyGeneral.target}`);
        console.log(`   EulerV2Plugin:    ${eulerPlugin.target}`);
        console.log(`   EulerRegistry:    ${eulerRegistry.target}`);
        console.log(`   EulerLensAdapter: ${eulerLensAdapter.target}`);
        console.log(`   ProtocolManager:  ${protocolManager.target}`);
        console.log(`   User1 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user1.address), 6)}`);
        console.log(`   User2 USDC: ${ethers.formatUnits(await usdcContract.balanceOf(user2.address), 6)}\n`);
    });

    // ================================================================
    // 1. DEPOSIT USDC INTO POOL
    // ================================================================

    describe("Step 1: Deposit USDC into pool", function () {
        it("should allow user1 to deposit 100 USDC and receive LP tokens", async function () {
            const depositAmount = ethers.parseUnits("100", 6);

            await usdcContract.connect(user1).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user1).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user1.address);
            expect(lpBalance).to.be.greaterThan(0n);

            console.log(`   User1 deposited 100 USDC, LP tokens: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("should allow user2 to deposit 200 USDC", async function () {
            const depositAmount = ethers.parseUnits("200", 6);

            await usdcContract.connect(user2).approve(liquidityManager.target, depositAmount);
            await liquidityManager.connect(user2).deposit(depositAmount);

            const lpBalance = await proxyGeneral.balanceOf(user2.address);
            expect(lpBalance).to.be.greaterThan(0n);

            console.log(`   User2 deposited 200 USDC, LP tokens: ${ethers.formatUnits(lpBalance, 6)}`);
        });

        it("pool should have USDC after deposits", async function () {
            const poolBalance = await usdcContract.balanceOf(proxyGeneral.target);
            expect(poolBalance).to.be.greaterThan(ethers.parseUnits("200", 6));
            console.log(`   Pool USDC: ${ethers.formatUnits(poolBalance, 6)}`);
        });
    });

    // ================================================================
    // 2. SUPPLY USDC TO EULER
    // ================================================================

    describe("Step 2: Supply USDC to Euler V2", function () {
        it("should supply 100 USDC from pool to Euler USDC vault", async function () {
            const supplyAmount = ethers.parseUnits("100", 6);

            await protocolManager.deposit("EulerV2Plugin", "USDC", supplyAmount);

            const eulerBalance = await eulerPlugin.getBalance("USDC");
            // Allow small rounding from share conversion
            expect(eulerBalance).to.be.greaterThan(ethers.parseUnits("99", 6));

            console.log(`   Supplied ${ethers.formatUnits(supplyAmount, 6)} USDC to Euler`);
            console.log(`   Euler vault balance (via getBalance): ${ethers.formatUnits(eulerBalance, 6)} USDC`);
        });
    });

    // ================================================================
    // 3. VALUE CALCULATION
    // ================================================================

    describe("Step 3: Value Calculation", function () {
        it("should calculate total pool value in USDC", async function () {
            const totalValue = await valueCalculator.getTotalPoolValueView();
            expect(totalValue).to.be.greaterThan(0n);
            console.log(`   Total pool value: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });
    });

    // ================================================================
    // 4. EULER LENS ADAPTER
    // ================================================================

    describe("Step 4: Euler Lens Adapter Reads", function () {
        it("getTotalValue should return USDC-denominated value of Euler position", async function () {
            // USDC deposited to Euler USDC vault:
            // _convertToBaseAssetValue(USDC, balance) → token == baseAsset → returns directly
            const totalValue = await eulerLensAdapter.getTotalValue();
            expect(totalValue).to.be.greaterThan(ethers.parseUnits("99", 6));

            console.log(`   Euler lens total value: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });

        it("getTotalEulerValue should match getTotalValue", async function () {
            const lensValue   = await eulerLensAdapter.getTotalValue();
            const eulerValue  = await eulerLensAdapter.getTotalEulerValue();
            expect(lensValue).to.equal(eulerValue);
        });

        it("getValueBreakdown should return non-zero collateral and zero debt", async function () {
            const breakdown = await eulerLensAdapter.getValueBreakdown();
            expect(breakdown.totalCollateral).to.be.greaterThan(0n);
            expect(breakdown.totalDebt).to.equal(0n);
            expect(breakdown.netValue).to.be.greaterThan(0n);

            console.log(`   Collateral: ${ethers.formatUnits(breakdown.totalCollateral, 6)} USDC`);
            console.log(`   Debt:       ${ethers.formatUnits(breakdown.totalDebt, 6)} USDC`);
            console.log(`   Net:        ${ethers.formatUnits(breakdown.netValue, 6)} USDC`);
        });

        it("getHealthFactor should return max (no debt)", async function () {
            const hf = await eulerLensAdapter.getHealthFactor();
            expect(hf).to.equal(ethers.MaxUint256);
            console.log(`   Health factor: MAX (no debt) ✅`);
        });

        it("getActivePositionCount should return 0 (no leverage positions)", async function () {
            const count = await eulerLensAdapter.getActivePositionCount();
            expect(count).to.equal(0n);
            console.log(`   Leverage positions: ${count}`);
        });
    });

    // ================================================================
    // 5. WITHDRAW USDC FROM EULER
    // ================================================================

    describe("Step 5: Withdraw from Euler", function () {
        it("should withdraw USDC from Euler back to pool", async function () {
            const eulerBalanceBefore = await eulerPlugin.getBalance("USDC");
            expect(eulerBalanceBefore).to.be.greaterThan(0n);

            const poolBalanceBefore = await usdcContract.balanceOf(proxyGeneral.target);

            await protocolManager.withdraw("EulerV2Plugin", "USDC", eulerBalanceBefore);

            const eulerBalanceAfter = await eulerPlugin.getBalance("USDC");
            const poolBalanceAfter  = await usdcContract.balanceOf(proxyGeneral.target);

            // Allow 1 USDC dust from share rounding
            expect(eulerBalanceAfter).to.be.lessThan(ethers.parseUnits("1", 6));
            expect(poolBalanceAfter).to.be.greaterThan(poolBalanceBefore);

            console.log(`   Withdrew: ${ethers.formatUnits(eulerBalanceBefore, 6)} USDC from Euler`);
            console.log(`   Pool USDC after: ${ethers.formatUnits(poolBalanceAfter, 6)}`);
        });

        it("Euler lens should return ~0 after full withdrawal", async function () {
            const totalValue = await eulerLensAdapter.getTotalValue();
            expect(totalValue).to.be.lessThan(ethers.parseUnits("1", 6));
            console.log(`   Euler lens value after withdraw: ${ethers.formatUnits(totalValue, 6)} USDC`);
        });
    });

    // ================================================================
    // 6. USER WITHDRAWALS
    // ================================================================

    describe("Step 6: User Withdrawals", function () {
        it("should allow user1 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user1.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user1.address);
                await liquidityManager.connect(user1).withdraw(lpTokens);
                const usdcAfter = await usdcContract.balanceOf(user1.address);
                const received  = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User1 burned ${ethers.formatUnits(lpTokens, 6)} LP → received ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("should allow user2 to withdraw LP tokens and receive USDC", async function () {
            const lpTokens = await proxyGeneral.balanceOf(user2.address);
            if (lpTokens > 0n) {
                const usdcBefore = await usdcContract.balanceOf(user2.address);
                await liquidityManager.connect(user2).withdraw(lpTokens);
                const usdcAfter = await usdcContract.balanceOf(user2.address);
                const received  = usdcAfter - usdcBefore;

                expect(received).to.be.greaterThan(0n);
                console.log(`   User2 burned ${ethers.formatUnits(lpTokens, 6)} LP → received ${ethers.formatUnits(received, 6)} USDC`);
            }
        });

        it("pool should have minimal USDC after all withdrawals", async function () {
            const remaining = await usdcContract.balanceOf(proxyGeneral.target);
            console.log(`   Pool remaining: ${ethers.formatUnits(remaining, 6)} USDC (fees + seed)`);
        });
    });

    after(async function () {
        await ethers.provider.send("evm_revert", [suiteSnapshotId]);
    });
});
