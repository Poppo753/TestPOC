import { expect } from "chai";
import { ethers } from "hardhat";
import { 
    EulerV2Plugin, 
    EulerRegistry, 
    ProtocolManager,
    MockBeacon,
    MockProxyGeneral,
    MockTokenManager
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * TEST DI INTEGRAZIONE: ProtocolManager → EulerV2Plugin
 * 
 * Questo test verifica il flusso COMPLETO:
 * ProtocolManager.deposit() → EulerV2Plugin.deposit() → Euler V2 Vault
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; $env:ARBITRUM_RPC_URL="https://1rpc.io/arb"
 * npx hardhat test test/integration/ProtocolManager.euler.test.ts --network hardhat
 */

describe("ProtocolManager + EulerV2Plugin Integration", function () {
    this.timeout(120000);

    // Contracts
    let protocolManager: ProtocolManager;
    let eulerPlugin: EulerV2Plugin;
    let vaultRegistry: EulerRegistry;
    let mockBeacon: MockBeacon;
    let mockProxyGeneral: MockProxyGeneral;
    let mockTokenManager: MockTokenManager;

    // Signers
    let owner: SignerWithAddress;
    let whale: SignerWithAddress;

    // Arbitrum Addresses
    const EVC_ADDRESS          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const ACCOUNT_LENS_ADDRESS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
    const EULER_VAULTS = {
        WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    };
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    before(async function () {
        // Skip se non siamo su fork
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping - run with FORK_ENABLED=true");
            this.skip();
        }

        [owner] = await ethers.getSigners();
        console.log("\n🔧 Setting up ProtocolManager + EulerV2Plugin Integration...");
        console.log(`   Owner: ${owner.address}`);

        // ==================== DEPLOY MOCK CONTRACTS ====================
        
        // MockBeacon
        const MockBeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await MockBeaconFactory.deploy();
        await mockBeacon.waitForDeployment();
        console.log(`   MockBeacon: ${await mockBeacon.getAddress()}`);

        // MockTokenManager
        const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
        mockTokenManager = await MockTokenManagerFactory.deploy();
        await mockTokenManager.waitForDeployment();
        
        // Registra token addresses
        await mockTokenManager.setTokenAddress("WETH", WETH);
        await mockTokenManager.setTokenAddress("USDC", USDC);
        console.log(`   MockTokenManager: ${await mockTokenManager.getAddress()}`);

        // MockProxyGeneral
        const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
        mockProxyGeneral = await MockProxyGeneralFactory.deploy();
        await mockProxyGeneral.waitForDeployment();
        
        // Registra token nel ProxyGeneral
        await mockProxyGeneral.setTokenAddress("WETH", WETH);
        await mockProxyGeneral.setTokenAddress("USDC", USDC);
        console.log(`   MockProxyGeneral: ${await mockProxyGeneral.getAddress()}`);

        // ==================== DEPLOY EULER VAULT REGISTRY ====================
        
        const VaultRegistryFactory = await ethers.getContractFactory("EulerRegistry");
        vaultRegistry = await VaultRegistryFactory.deploy();
        await vaultRegistry.waitForDeployment();
        
        // Registra vaults
        await vaultRegistry.setVault("WETH", EULER_VAULTS.WETH);
        await vaultRegistry.setVault("USDC", EULER_VAULTS.USDC);
        console.log(`   EulerRegistry: ${await vaultRegistry.getAddress()}`);

        // ==================== DEPLOY EULER V2 PLUGIN ====================
        
        const EulerPluginFactory = await ethers.getContractFactory("EulerV2Plugin");
        eulerPlugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress(), "WETH", EVC_ADDRESS, ACCOUNT_LENS_ADDRESS);
        await eulerPlugin.waitForDeployment();
        console.log(`   EulerV2Plugin: ${await eulerPlugin.getAddress()}`);

        // ==================== DEPLOY PROTOCOL MANAGER ====================
        
        const ProtocolManagerFactory = await ethers.getContractFactory("ProtocolManager");
        protocolManager = await ProtocolManagerFactory.deploy(await mockBeacon.getAddress());
        await protocolManager.waitForDeployment();
        console.log(`   ProtocolManager: ${await protocolManager.getAddress()}`);

        // ==================== CONFIGURE BEACON ====================
        
        await mockBeacon.setImplementation("TokenManager", await mockTokenManager.getAddress());
        await mockBeacon.setImplementation("ProxyGeneral", await mockProxyGeneral.getAddress());
        await mockBeacon.setImplementation("WETH", WETH);
        await mockBeacon.setImplementation("EulerRegistry", await vaultRegistry.getAddress());
        await mockBeacon.setImplementation("EulerV2Plugin", await eulerPlugin.getAddress());
        await mockBeacon.setImplementation("ProtocolManager", await protocolManager.getAddress());
        
        console.log("   ✅ Beacon configured with all modules");

        // ==================== FUND PROXY GENERAL ====================
        
        // Impersona whale e trasferisci WETH al ProxyGeneral
        await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
        whale = await ethers.getSigner(WETH_WHALE);
        await ethers.provider.send("hardhat_setBalance", [WETH_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);

        const wethContract = await ethers.getContractAt("IERC20", WETH);
        const proxyAddress = await mockProxyGeneral.getAddress();
        
        // Trasferisci 1 WETH al ProxyGeneral
        await wethContract.connect(whale).transfer(proxyAddress, ethers.parseEther("1"));
        
        const proxyBalance = await wethContract.balanceOf(proxyAddress);
        console.log(`   ProxyGeneral WETH balance: ${ethers.formatEther(proxyBalance)} WETH`);

        console.log("\n✅ Integration test setup complete!\n");
    });

    describe("1. Setup Verification", function () {
        it("Should have ProtocolManager deployed", async function () {
            expect(await protocolManager.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should have EulerV2Plugin registered in Beacon", async function () {
            const pluginAddr = await mockBeacon.getImplementation("EulerV2Plugin");
            expect(pluginAddr).to.equal(await eulerPlugin.getAddress());
        });

        it("Should have ProxyGeneral with WETH balance", async function () {
            const wethContract = await ethers.getContractAt("IERC20", WETH);
            const balance = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            expect(balance).to.be.gt(0);
        });
    });

    describe("2. Deposit Flow: ProtocolManager → EulerV2Plugin → Euler V2", function () {
        it("Should deposit WETH via ProtocolManager", async function () {
            const depositAmount = ethers.parseEther("0.1");
            
            // Check balance before
            const balanceBefore = await eulerPlugin.getBalance("WETH");
            console.log(`   Balance before: ${ethers.formatEther(balanceBefore)} WETH`);

            // Deposit via ProtocolManager
            const tx = await protocolManager.connect(owner).deposit("EulerV2Plugin", "WETH", depositAmount);
            const receipt = await tx.wait();
            
            // Check balance after
            const balanceAfter = await eulerPlugin.getBalance("WETH");
            console.log(`   Balance after: ${ethers.formatEther(balanceAfter)} WETH`);
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
            
            expect(balanceAfter).to.be.gt(balanceBefore);
            console.log(`   ✅ Deposited ${ethers.formatEther(depositAmount)} WETH via ProtocolManager`);
        });

        it("Should emit ProtocolOperationExecuted event", async function () {
            const depositAmount = ethers.parseEther("0.05");
            
            await expect(protocolManager.connect(owner).deposit("EulerV2Plugin", "WETH", depositAmount))
                .to.emit(protocolManager, "ProtocolOperationExecuted")
                .withArgs("EulerV2Plugin", "deposit", "WETH", depositAmount);
        });

        it("Should get balance via ProtocolManager.getBalance()", async function () {
            const balance = await protocolManager.getBalance("EulerV2Plugin", "WETH");
            console.log(`   Balance via PM: ${ethers.formatEther(balance)} WETH`);
            expect(balance).to.be.gt(0);
        });
    });

    describe("3. Withdraw Flow: Euler V2 → EulerV2Plugin → ProxyGeneral", function () {
        it("Should withdraw WETH via ProtocolManager", async function () {
            const withdrawAmount = ethers.parseEther("0.05");
            
            // Check balances before
            const pluginBalanceBefore = await eulerPlugin.getBalance("WETH");
            const wethContract = await ethers.getContractAt("IERC20", WETH);
            const proxyBalanceBefore = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            
            console.log(`   Plugin balance before: ${ethers.formatEther(pluginBalanceBefore)} WETH`);
            console.log(`   ProxyGeneral balance before: ${ethers.formatEther(proxyBalanceBefore)} WETH`);

            // Withdraw via ProtocolManager
            const tx = await protocolManager.connect(owner).withdraw("EulerV2Plugin", "WETH", withdrawAmount);
            await tx.wait();
            
            // Check balances after
            const pluginBalanceAfter = await eulerPlugin.getBalance("WETH");
            const proxyBalanceAfter = await wethContract.balanceOf(await mockProxyGeneral.getAddress());
            
            console.log(`   Plugin balance after: ${ethers.formatEther(pluginBalanceAfter)} WETH`);
            console.log(`   ProxyGeneral balance after: ${ethers.formatEther(proxyBalanceAfter)} WETH`);
            
            expect(pluginBalanceAfter).to.be.lt(pluginBalanceBefore);
            expect(proxyBalanceAfter).to.be.gt(proxyBalanceBefore);
            console.log(`   ✅ Withdrew ${ethers.formatEther(withdrawAmount)} WETH via ProtocolManager`);
        });
    });

    describe("4. Borrow Flow: ProtocolManager → EulerV2Plugin → Euler V2", function () {
        before(async function () {
            // In the new architecture, collateral is auto-enabled by deposit (section 2)
            // and controller is auto-enabled by borrow (via EVC batch)
            // No manual setupBorrowConfig needed anymore
            console.log("   ℹ️  Borrow config auto-managed by EVC batch operations");
        });

        it("Should borrow USDC via ProtocolManager", async function () {
            const borrowAmount = ethers.parseUnits("5", 6); // 5 USDC
            
            // Check debt before
            const debtBefore = await protocolManager.getDebt("EulerV2Plugin", "USDC");
            console.log(`   Debt before: ${ethers.formatUnits(debtBefore, 6)} USDC`);
            
            // Check ProxyGeneral USDC balance before
            const usdcContract = await ethers.getContractAt("IERC20", USDC);
            const proxyUsdcBefore = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());
            console.log(`   ProxyGeneral USDC before: ${ethers.formatUnits(proxyUsdcBefore, 6)} USDC`);

            // Borrow via ProtocolManager
            const tx = await protocolManager.connect(owner).borrow("EulerV2Plugin", "USDC", borrowAmount);
            const receipt = await tx.wait();
            
            // Check debt after
            const debtAfter = await protocolManager.getDebt("EulerV2Plugin", "USDC");
            console.log(`   Debt after: ${ethers.formatUnits(debtAfter, 6)} USDC`);
            
            // Check ProxyGeneral USDC balance after
            const proxyUsdcAfter = await usdcContract.balanceOf(await mockProxyGeneral.getAddress());
            console.log(`   ProxyGeneral USDC after: ${ethers.formatUnits(proxyUsdcAfter, 6)} USDC`);
            console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
            
            expect(debtAfter).to.be.gt(debtBefore);
            expect(proxyUsdcAfter).to.be.gt(proxyUsdcBefore);
            console.log(`   ✅ Borrowed ${ethers.formatUnits(borrowAmount, 6)} USDC via ProtocolManager`);
        });

        it("Should emit LendingOperationExecuted event", async function () {
            const borrowAmount = ethers.parseUnits("2", 6); // 2 USDC
            
            await expect(protocolManager.connect(owner).borrow("EulerV2Plugin", "USDC", borrowAmount))
                .to.emit(protocolManager, "LendingOperationExecuted")
                .withArgs("EulerV2Plugin", "borrow", "USDC", borrowAmount);
        });
    });

    describe("5. Health Factor via ProtocolManager", function () {
        it("Should get health factor via ProtocolManager", async function () {
            const healthFactor = await protocolManager.getHealthFactor("EulerV2Plugin");
            
            if (healthFactor === ethers.MaxUint256) {
                console.log(`   Health factor: MAX (no debt)`);
            } else {
                const hfFormatted = ethers.formatUnits(healthFactor, 18);
                console.log(`   Health factor: ${hfFormatted}`);
                // Should be > 1 (healthy)
                expect(healthFactor).to.be.gt(ethers.parseEther("1"));
            }
        });
    });

    describe("6. Repay Flow: ProxyGeneral → EulerV2Plugin → Euler V2", function () {
        before(async function () {
            // Ottieni USDC per ripagare
            const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
            await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
            const usdcWhale = await ethers.getSigner(USDC_WHALE);
            await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("10"))]);
            
            // Trasferisci USDC a ProxyGeneral per il repay
            const usdcContract = await ethers.getContractAt("IERC20", USDC);
            await usdcContract.connect(usdcWhale).transfer(
                await mockProxyGeneral.getAddress(), 
                ethers.parseUnits("20", 6)
            );
            console.log("   ✅ Funded ProxyGeneral with 20 USDC for repay");
        });

        it("Should repay USDC via ProtocolManager", async function () {
            const repayAmount = ethers.parseUnits("5", 6); // 5 USDC
            
            // Check debt before
            const debtBefore = await protocolManager.getDebt("EulerV2Plugin", "USDC");
            console.log(`   Debt before: ${ethers.formatUnits(debtBefore, 6)} USDC`);

            // Repay via ProtocolManager
            const tx = await protocolManager.connect(owner).repay("EulerV2Plugin", "USDC", repayAmount);
            await tx.wait();
            
            // Check debt after
            const debtAfter = await protocolManager.getDebt("EulerV2Plugin", "USDC");
            console.log(`   Debt after: ${ethers.formatUnits(debtAfter, 6)} USDC`);
            
            expect(debtAfter).to.be.lt(debtBefore);
            console.log(`   ✅ Repaid ${ethers.formatUnits(repayAmount, 6)} USDC via ProtocolManager`);
        });
    });

    describe("7. Protocol-Specific Calls via executeProtocolCall", function () {
        it("Should fail without whitelisted selector", async function () {
            // Prova a chiamare getBalance via executeProtocolCall senza whitelist
            const data = eulerPlugin.interface.encodeFunctionData("getBalance", ["WETH"]);
            
            await expect(
                protocolManager.connect(owner).executeProtocolCall("EulerV2Plugin", data)
            ).to.be.revertedWithCustomError(protocolManager, "SelectorNotAllowed");
        });

        it("Should whitelist and execute getBalance via executeProtocolCall", async function () {
            // Whitelist getBalance selector
            const selector = eulerPlugin.interface.getFunction("getBalance")!.selector;
            await protocolManager.connect(owner).setAllowedSelectors(
                "EulerV2Plugin", 
                [selector], 
                true
            );
            console.log(`   ✅ Whitelisted getBalance selector: ${selector}`);

            // Ora dovrebbe funzionare
            const data = eulerPlugin.interface.encodeFunctionData("getBalance", ["WETH"]);
            const [success, returnData] = await protocolManager.connect(owner).executeProtocolCall.staticCall("EulerV2Plugin", data);
            
            expect(success).to.be.true;
            
            // Decode il risultato
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], returnData);
            console.log(`   Balance from executeProtocolCall: ${ethers.formatEther(decoded[0])} WETH`);
            console.log(`   ✅ executeProtocolCall successful`);
        });

        it("Should emit SelectorAllowanceChanged event", async function () {
            const selector = eulerPlugin.interface.getFunction("getDebt")!.selector;
            
            await expect(protocolManager.connect(owner).setAllowedSelectors("EulerV2Plugin", [selector], true))
                .to.emit(protocolManager, "SelectorAllowanceChanged")
                .withArgs(await eulerPlugin.getAddress(), selector, true);
        });
    });

    describe("8. Error Cases", function () {
        it("Should revert deposit with zero amount", async function () {
            await expect(
                protocolManager.connect(owner).deposit("EulerV2Plugin", "WETH", 0)
            ).to.be.revertedWithCustomError(protocolManager, "InvalidAmount");
        });

        it("Should revert with invalid protocol name", async function () {
            await expect(
                protocolManager.connect(owner).deposit("NonExistentPlugin", "WETH", ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(protocolManager, "ProtocolNotFound");
        });

        it("Should revert borrow with empty tokenCode", async function () {
            await expect(
                protocolManager.connect(owner).borrow("EulerV2Plugin", "", ethers.parseUnits("1", 6))
            ).to.be.revertedWithCustomError(protocolManager, "InvalidTokenCode");
        });
    });
});
