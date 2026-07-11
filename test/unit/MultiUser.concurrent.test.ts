import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * 👥 MULTI-USER CONCURRENT OPERATION TESTS
 *
 * Verifies that multiple users can interact with the system 
 * simultaneously without state corruption or loss of funds.
 */
describe("Multi-User Concurrent Tests", function () {
    let liquidityManager: any;
    let beacon: any;
    let proxyGeneral: any;
    let tokenManager: any;
    let valueCalculator: any;
    let parameterManager: any;
    let mockWETH: any;
    let owner: any;
    let user1: any;
    let user2: any;
    let user3: any;

    const DEFAULT_DEPOSIT_FEE = 30;   // 0.3%
    const DEFAULT_WITHDRAW_FEE = 50;  // 0.5%

    async function depositWETH(signer: any, amount: bigint) {
        await signer.sendTransaction({ to: mockWETH.target, value: amount });
        await mockWETH.connect(signer).approve(liquidityManager.target, amount);
        return liquidityManager.connect(signer).deposit(amount);
    }

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();

        const MockWETH = await ethers.getContractFactory("MockWETH");
        mockWETH = await MockWETH.deploy();

        const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
        const mockOracle = await MockOracleAdapter.deploy();

        const Beacon = await ethers.getContractFactory("Beacon");
        beacon = await Beacon.deploy();
        await beacon.updateImplementation("WETH", mockWETH.target);
        await beacon.updateImplementation("BASE_ASSET", mockWETH.target);

        const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneral.deploy(beacon.target, "WETH");

        const TokenManager = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManager.deploy(beacon.target, mockOracle.target);

        const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculator.deploy(beacon.target, "WETH");

        const ParameterManager = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManager.deploy(beacon.target, 18);

        const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManager.deploy(beacon.target, "WETH");

        // Register in Beacon
        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);

        // Authorize LiquidityManager
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");

        // Setup fees
        await liquidityManager.setDepositFee(DEFAULT_DEPOSIT_FEE);
        await liquidityManager.setWithdrawFee(DEFAULT_WITHDRAW_FEE);
        await liquidityManager.setFeeRecipient(owner.address);
        await liquidityManager.setDepositsEnabled(true);
        await liquidityManager.setWithdrawsEnabled(true);

        // Setup params
        await parameterManager.proposeParameterChange("minDeposit", ethers.parseEther("0.01"));

        // Setup withdraw limits
        await liquidityManager.setWithdrawLimits(
            ethers.parseEther("600"),
            ethers.parseEther("2000"),
            ethers.parseEther("0.000001"),
            ethers.parseEther("500")
        );

        // Rate limits
        await proxyGeneral.setRateLimit("deposit", ethers.parseEther("100"), ethers.parseEther("500"));
        await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("2000"));

        // Bootstrap pool
        await depositWETH(owner, ethers.parseEther("10"));
    });

    // ================================================================
    // 1. Multiple Users Depositing Sequentially
    // ================================================================

    describe("Multiple users depositing", function () {
        it("should correctly track LP shares for 3 users depositing sequentially", async function () {
            const amount = ethers.parseEther("1");

            await depositWETH(user1, amount);
            await depositWETH(user2, amount);
            await depositWETH(user3, amount);

            const bal1 = await proxyGeneral.balanceOf(user1.address);
            const bal2 = await proxyGeneral.balanceOf(user2.address);
            const bal3 = await proxyGeneral.balanceOf(user3.address);

            // All users deposited the same amount, so their LP share balances
            // should be approximately equal (first depositor gets slightly more
            // because pool grows with fees)
            expect(bal1).to.be.greaterThan(0);
            expect(bal2).to.be.greaterThan(0);
            expect(bal3).to.be.greaterThan(0);

            // Total supply should be owner bootstrap + 3 user deposits
            const totalSupply = await proxyGeneral.totalSupply();
            expect(totalSupply).to.be.greaterThan(bal1 + bal2 + bal3);
        });

        it("should handle different deposit amounts from different users", async function () {
            await depositWETH(user1, ethers.parseEther("1"));
            await depositWETH(user2, ethers.parseEther("5"));
            await depositWETH(user3, ethers.parseEther("0.5"));

            const bal1 = await proxyGeneral.balanceOf(user1.address);
            const bal2 = await proxyGeneral.balanceOf(user2.address);
            const bal3 = await proxyGeneral.balanceOf(user3.address);

            // User2 deposited 5x more than user1, should have ~5x more LP tokens
            // Allow 5% tolerance for fee effects on pool ratio
            const ratio = Number(bal2) / Number(bal1);
            expect(ratio).to.be.greaterThan(4.5);
            expect(ratio).to.be.lessThan(5.5);

            // User3 deposited 0.5x of user1
            const ratio3 = Number(bal3) / Number(bal1);
            expect(ratio3).to.be.greaterThan(0.4);
            expect(ratio3).to.be.lessThan(0.6);
        });
    });

    // ================================================================
    // 2. Multiple Users Withdrawing
    // ================================================================

    describe("Multiple users withdrawing", function () {
        beforeEach(async function () {
            // All users deposit
            await depositWETH(user1, ethers.parseEther("5"));
            await depositWETH(user2, ethers.parseEther("5"));
            await depositWETH(user3, ethers.parseEther("5"));
        });

        it("should allow sequential withdrawals without state corruption", async function () {
            const bal1Before = await proxyGeneral.balanceOf(user1.address);
            const bal2Before = await proxyGeneral.balanceOf(user2.address);

            // User1 withdraws half their LP tokens
            const withdraw1 = bal1Before / 2n;
            await liquidityManager.connect(user1).withdraw(withdraw1);

            // User2 withdraws all LP tokens
            await liquidityManager.connect(user2).withdraw(bal2Before);

            // User1 should have half their tokens remaining
            const bal1After = await proxyGeneral.balanceOf(user1.address);
            expect(bal1After).to.equal(bal1Before - withdraw1);

            // User2 should have 0 LP tokens
            const bal2After = await proxyGeneral.balanceOf(user2.address);
            expect(bal2After).to.equal(0);

            // User3 should be unaffected
            const bal3 = await proxyGeneral.balanceOf(user3.address);
            expect(bal3).to.be.greaterThan(0);
        });

        it("should maintain total supply consistency after withdrawals", async function () {
            const supplyBefore = await proxyGeneral.totalSupply();

            const shares1 = await proxyGeneral.balanceOf(user1.address);
            const shares2 = await proxyGeneral.balanceOf(user2.address);

            await liquidityManager.connect(user1).withdraw(shares1);
            await liquidityManager.connect(user2).withdraw(shares2);

            const supplyAfter = await proxyGeneral.totalSupply();
            expect(supplyAfter).to.equal(supplyBefore - shares1 - shares2);
        });
    });

    // ================================================================
    // 3. Interleaved Deposits and Withdrawals
    // ================================================================

    describe("Interleaved deposit/withdraw operations", function () {
        it("should handle deposit-withdraw-deposit pattern", async function () {
            // User1 deposits
            await depositWETH(user1, ethers.parseEther("2"));
            const bal1After1stDeposit = await proxyGeneral.balanceOf(user1.address);

            // User2 deposits
            await depositWETH(user2, ethers.parseEther("3"));

            // User1 withdraws half
            const withdrawAmount = bal1After1stDeposit / 2n;
            await liquidityManager.connect(user1).withdraw(withdrawAmount);

            // User3 deposits
            await depositWETH(user3, ethers.parseEther("1"));

            // User1 deposits again
            await depositWETH(user1, ethers.parseEther("1"));

            // All should have positive balances
            expect(await proxyGeneral.balanceOf(user1.address)).to.be.greaterThan(0);
            expect(await proxyGeneral.balanceOf(user2.address)).to.be.greaterThan(0);
            expect(await proxyGeneral.balanceOf(user3.address)).to.be.greaterThan(0);
        });

        it("should preserve LP token value during concurrent operations", async function () {
            // User1 deposits first
            await depositWETH(user1, ethers.parseEther("5"));
            const user1Shares = await proxyGeneral.balanceOf(user1.address);

            // Multiple users deposit after
            await depositWETH(user2, ethers.parseEther("5"));
            await depositWETH(user3, ethers.parseEther("5"));

            // User1 withdraws everything - should get back ~original deposit (minus fee)
            const wethBefore = await mockWETH.balanceOf(user1.address);
            await liquidityManager.connect(user1).withdraw(user1Shares);
            const wethAfter = await mockWETH.balanceOf(user1.address);

            const received = wethAfter - wethBefore;
            const deposited = ethers.parseEther("5");
            const feeAdjusted = deposited * BigInt(10000 - DEFAULT_DEPOSIT_FEE - DEFAULT_WITHDRAW_FEE) / 10000n;

            // Should get back at least 90% of fee-adjusted deposit
            expect(received).to.be.greaterThan(feeAdjusted * 90n / 100n);
        });
    });

    // ================================================================
    // 4. No Cross-User Fund Leaking
    // ================================================================

    describe("Fund isolation between users", function () {
        it("should prevent user from withdrawing more than their shares", async function () {
            await depositWETH(user1, ethers.parseEther("1"));
            await depositWETH(user2, ethers.parseEther("1"));

            const user1Shares = await proxyGeneral.balanceOf(user1.address);
            const excessShares = user1Shares + 1n;

            await expect(
                liquidityManager.connect(user1).withdraw(excessShares)
            ).to.be.reverted;
        });

        it("should not allow user to affect another user's balance", async function () {
            await depositWETH(user1, ethers.parseEther("5"));
            await depositWETH(user2, ethers.parseEther("5"));

            const user2SharesBefore = await proxyGeneral.balanceOf(user2.address);

            // User1 withdraws everything
            const user1Shares = await proxyGeneral.balanceOf(user1.address);
            await liquidityManager.connect(user1).withdraw(user1Shares);

            // User2's LP balance should not change
            const user2SharesAfter = await proxyGeneral.balanceOf(user2.address);
            expect(user2SharesAfter).to.equal(user2SharesBefore);
        });
    });
});
