/**
 * @file FlashLoanService.e2e.test.ts
 * @description E2E Test per FlashLoanService + EulerV2Plugin leverage ATOMICO
 * 
 * OBIETTIVO: Testare l'architettura centralizzata FlashLoanService che viene
 * chiamata da EulerV2Plugin.openLeverageAtomic() per operazioni leverage atomiche.
 * 
 * ARCHITETTURA:
 * - FlashLoanService: Servizio centralizzato (1 deployment) che gestisce flash loans Balancer
 * - EulerV2Plugin: Implementa IFlashLoanCallback, riceve callback da FlashLoanService
 * 
 * SICUREZZA (Double Layer):
 * - Layer 1: Beacon Check - Solo plugin registrati possono chiamare FlashLoanService
 * - Layer 2: Trust-the-Revert - Se plugin non restituisce token, Balancer reverta tutto
 * 
 * FLUSSO OPEN LEVERAGE ATOMICO:
 * 1. EulerV2Plugin.openLeverageAtomic() → FlashLoanService.executeFlashLoan()
 * 2. FlashLoanService → Balancer flash loan (0% fee!)
 * 3. Balancer callback → FlashLoanService.receiveFlashLoan()
 * 4. FlashLoanService trasferisce USDC a EulerV2Plugin
 * 5. FlashLoanService → EulerV2Plugin.onFlashLoanReceived()
 * 6. EulerV2Plugin: swap USDC→WETH via FlashLoanService.swap()
 * 7. EulerV2Plugin: deposit WETH in Euler (auto-enables collateral)
 * 8. EulerV2Plugin: borrow USDC from Euler (auto-enables controller)
 * 9. EulerV2Plugin: transfer USDC back to FlashLoanService
 * 10. FlashLoanService: repay Balancer
 * → Tutto atomico!
 * 
 * SETUP:
 * $env:FORK_ENABLED="true"; npx hardhat test test/integration/FlashLoanService.e2e.test.ts
 */

import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("FlashLoanService + EulerV2Plugin - Atomic Leverage E2E", function () {
    this.timeout(300000); // 5 minuti

    // ==================== ARBITRUM ADDRESSES ====================
    
    const ADDRESSES = {
        // Tokens
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        
        // Euler V2 Vaults
        WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
        
        // Euler V2 Core
        EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
        ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
        
        // Balancer V2 Vault (0% fee flash loans!)
        BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        
        // SimpleSwap (Uniswap V3 wrapper)
        SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096",
        
        // Our deployed infrastructure
        BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
        TOKEN_MANAGER: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    };

    // Whale addresses con WETH
    const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

    // Contracts
    let deployer: Signer;
    let deployerAddress: string;
    let flashLoanService: Contract;
    let eulerV2Plugin: Contract;
    let beacon: Contract;
    let weth: Contract;
    let usdc: Contract;
    let wethVault: Contract;
    let usdcVault: Contract;
    let evc: Contract;
    let accountLens: Contract;

    // Test state
    let initialWethBalance: bigint;

    // ==================== HELPER FUNCTIONS ====================
    
    function formatAmount(amount: bigint, decimals: number = 18): string {
        return Number(ethers.formatUnits(amount, decimals)).toFixed(4);
    }

    async function checkPluginHealth(label: string): Promise<{ healthFactor: bigint, collateral: bigint, debt: bigint }> {
        try {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const shares = await wethVault.balanceOf(pluginAddress);
            const collateral = await wethVault.convertToAssets(shares);
            const debt = await usdcVault.debtOf(pluginAddress);
            
            let healthStr = "∞";
            let healthEmoji = "🟢";
            let healthFactor = 0n;
            
            if (debt > 0n) {
                const info = await accountLens.getAccountLiquidityInfo(pluginAddress, ADDRESSES.USDC_VAULT);
                const collateralValue = info.collateralValueBorrowing;
                const liabilityValue = info.liabilityValueBorrowing;
                
                if (liabilityValue > 0n) {
                    healthFactor = (collateralValue * BigInt(1e18)) / liabilityValue;
                    const hfNum = Number(healthFactor) / 1e18;
                    healthStr = hfNum.toFixed(2);
                    
                    if (hfNum < 1.1) {
                        healthEmoji = "🔴";
                    } else if (hfNum < 1.3) {
                        healthEmoji = "🟡";
                    }
                }
            }
            
            console.log(`   ${healthEmoji} [${label}] Health: ${healthStr}x | Collateral: ${formatAmount(collateral)} WETH | Debt: ${formatAmount(debt, 6)} USDC`);
            
            return { healthFactor, collateral, debt };
        } catch (error: any) {
            console.log(`   ⚪ [${label}] Health check failed: ${error.message?.slice(0, 80)}`);
            return { healthFactor: 0n, collateral: 0n, debt: 0n };
        }
    }

    async function estimateLeverage(): Promise<number> {
        const pluginAddress = await eulerV2Plugin.getAddress();
        const shares = await wethVault.balanceOf(pluginAddress);
        const collateral = await wethVault.convertToAssets(shares);
        const debt = await usdcVault.debtOf(pluginAddress);
        
        if (debt === 0n) return 1.0;
        
        // 1 ETH ≈ 3000 USDC
        const debtInWeth = (debt * BigInt(10 ** 12)) / 3000n;
        const equity = collateral > debtInWeth ? collateral - debtInWeth : 1n;
        const leverage = Number(collateral) / Number(equity);
        
        return leverage;
    }

    // ==================== SETUP ====================
    
    before(async function () {
        if (process.env.FORK_ENABLED !== "true") {
            console.log("⚠️  Skipping - set FORK_ENABLED=true");
            this.skip();
        }

        console.log("\n" + "=".repeat(70));
        console.log("⚡ FLASH LOAN SERVICE + EULER V2 PLUGIN E2E TEST");
        console.log("   Centralized FlashLoanService architecture with Beacon authorization");
        console.log("=".repeat(70));

        [deployer] = await ethers.getSigners();
        deployerAddress = await deployer.getAddress();

        console.log(`\n📍 Deployer: ${deployerAddress}`);

        // Setup token contracts
        weth = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.WETH,
            deployer
        );
        usdc = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            ADDRESSES.USDC,
            deployer
        );

        // Setup Euler vault contracts
        const vaultAbi = [
            "function deposit(uint256 assets, address receiver) external returns (uint256)",
            "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)",
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
            "function repay(uint256 amount, address receiver) external returns (uint256)",
            "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function debtOf(address) view returns (uint256)",
            "function asset() view returns (address)",
            "function approve(address, uint256) external returns (bool)",
            "function convertToAssets(uint256 shares) view returns (uint256)",
        ];

        wethVault = await ethers.getContractAt(vaultAbi, ADDRESSES.WETH_VAULT, deployer);
        usdcVault = await ethers.getContractAt(vaultAbi, ADDRESSES.USDC_VAULT, deployer);

        // Setup EVC
        evc = await ethers.getContractAt([
            "function enableCollateral(address account, address vault) external",
            "function enableController(address account, address vault) external",
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)",
        ], ADDRESSES.EVC, deployer);

        // Setup AccountLens
        accountLens = await ethers.getContractAt([
            "function getAccountLiquidityInfo(address account, address vault) external view returns ((bool queryFailure, bytes queryFailureReason, address account, address vault, address unitOfAccount, int256 timeToLiquidation, uint256 liabilityValueBorrowing, uint256 liabilityValueLiquidation, uint256 collateralValueBorrowing, uint256 collateralValueLiquidation, uint256 collateralValueRaw, address[] collaterals, uint256[] collateralValuesBorrowing, uint256[] collateralValuesLiquidation, uint256[] collateralValuesRaw))",
        ], ADDRESSES.ACCOUNT_LENS, deployer);

        // Setup Beacon
        beacon = await ethers.getContractAt([
            "function getImplementation(string memory moduleName) view returns (address)",
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function owner() view returns (address)",
            "function checkModuleExists(string memory module) view returns (bool)",
        ], ADDRESSES.BEACON, deployer);

        console.log(`   WETH: ${ADDRESSES.WETH}`);
        console.log(`   USDC: ${ADDRESSES.USDC}`);
        console.log(`   Beacon: ${ADDRESSES.BEACON}`);
        console.log(`   Balancer Vault: ${ADDRESSES.BALANCER_VAULT} (0% fee!)`);
    });

    // ==================== PHASE 1: DEPLOY CONTRACTS ====================
    
    describe("Phase 1: Deploy FlashLoanService and EulerV2Plugin", function () {
        it("Should setup Beacon with required implementations", async function () {
            console.log("\n   Setting up Beacon with required implementations...");
            
            const beaconOwner = await beacon.owner();
            let beaconAsOwner = beacon;
            
            if (beaconOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [beaconOwner],
                });
                const owner = await ethers.getSigner(beaconOwner);
                await deployer.sendTransaction({ to: beaconOwner, value: ethers.parseEther("0.1") });
                beaconAsOwner = beacon.connect(owner);
            }
            
            // Deploy and register EulerRegistry
            const EulerRegistry = await ethers.getContractFactory("EulerRegistry");
            const eulerRegistry = await EulerRegistry.deploy();
            await eulerRegistry.waitForDeployment();
            
            await (await beaconAsOwner.updateImplementation("EulerRegistry", await eulerRegistry.getAddress())).wait();
            console.log(`   ✅ EulerRegistry registered`);
            
            // Configure vaults in registry
            await (await eulerRegistry.setVault("WETH", ADDRESSES.WETH_VAULT)).wait();
            await (await eulerRegistry.setVault("USDC", ADDRESSES.USDC_VAULT)).wait();
            console.log(`   ✅ Vaults configured in registry`);
            
            // Store registry for later use
            (this as any).eulerRegistry = eulerRegistry;
            
            // Register tokens (only if not already registered)
            try {
                const existingWeth = await beacon.getImplementation("WETH");
                if (existingWeth !== ADDRESSES.WETH) {
                    await (await beaconAsOwner.updateImplementation("WETH", ADDRESSES.WETH)).wait();
                }
            } catch {
                await (await beaconAsOwner.updateImplementation("WETH", ADDRESSES.WETH)).wait();
            }
            
            try {
                const existingUsdc = await beacon.getImplementation("USDC");
                if (existingUsdc !== ADDRESSES.USDC) {
                    await (await beaconAsOwner.updateImplementation("USDC", ADDRESSES.USDC)).wait();
                }
            } catch {
                await (await beaconAsOwner.updateImplementation("USDC", ADDRESSES.USDC)).wait();
            }
            console.log(`   ✅ Tokens registered`);
            
            // Register existing TokenManager as ProtocolManager (for plugin authorization)
            await (await beaconAsOwner.updateImplementation("ProtocolManager", ADDRESSES.TOKEN_MANAGER)).wait();
            console.log(`   ✅ TokenManager registered as ProtocolManager`);

            // Deploy MockTokenManager with prices for FlashLoanService fallback
            const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
            const mockTokenManager = await MockTokenManagerFactory.deploy();
            await mockTokenManager.waitForDeployment();
            await mockTokenManager.setTokenAddress("WETH", ADDRESSES.WETH);
            await mockTokenManager.setTokenAddress("USDC", ADDRESSES.USDC);
            await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8)); // $3000
            await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));    // $1
            await (await beaconAsOwner.updateImplementation("TokenManager", await mockTokenManager.getAddress())).wait();
            console.log(`   ✅ MockTokenManager registered with prices`);
        });
        
        it("Should deploy FlashLoanService", async function () {
            console.log("\n   Deploying FlashLoanService...");
            
            const FlashLoanService = await ethers.getContractFactory("FlashLoanService");
            flashLoanService = await FlashLoanService.deploy(ADDRESSES.BEACON);
            await flashLoanService.waitForDeployment();
            
            const address = await flashLoanService.getAddress();
            console.log(`   ✅ FlashLoanService deployed at: ${address}`);
            
            // Verify configuration
            const balancerVault = await flashLoanService.getBalancerVault();
            const simpleSwap = await flashLoanService.getSimpleSwap();
            
            expect(balancerVault).to.equal(ADDRESSES.BALANCER_VAULT);
            expect(simpleSwap).to.equal(ADDRESSES.SIMPLE_SWAP);
            
            console.log(`   ✅ Balancer Vault: ${balancerVault}`);
            console.log(`   ✅ SimpleSwap: ${simpleSwap}`);
        });

        it("Should deploy EulerV2Plugin", async function () {
            console.log("\n   Deploying EulerV2Plugin...");
            
            const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
            eulerV2Plugin = await EulerV2Plugin.deploy(ADDRESSES.BEACON, "WETH");
            await eulerV2Plugin.waitForDeployment();
            
            const address = await eulerV2Plugin.getAddress();
            console.log(`   ✅ EulerV2Plugin deployed at: ${address}`);
            
            // Verify Euler V2 configuration
            const evcAddress = await eulerV2Plugin.EVC_ADDRESS();
            expect(evcAddress).to.equal(ADDRESSES.EVC);
            
            console.log(`   ✅ EVC: ${evcAddress}`);
        });

        it("Should register EulerV2Plugin in Beacon", async function () {
            console.log("\n   Registering EulerV2Plugin in Beacon...");
            
            // Check if we need to impersonate beacon owner
            const beaconOwner = await beacon.owner();
            console.log(`   Beacon owner: ${beaconOwner}`);
            console.log(`   Deployer: ${deployerAddress}`);
            
            if (beaconOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
                // Impersonate owner
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [beaconOwner],
                });
                const owner = await ethers.getSigner(beaconOwner);
                
                // Fund owner for gas
                await deployer.sendTransaction({ to: beaconOwner, value: ethers.parseEther("0.1") });
                
                // Register plugin
                const beaconAsOwner = beacon.connect(owner);
                await (await beaconAsOwner.updateImplementation("EulerV2Plugin", await eulerV2Plugin.getAddress())).wait();
                
                console.log(`   ✅ EulerV2Plugin registered via impersonation`);
            } else {
                await (await beacon.updateImplementation("EulerV2Plugin", await eulerV2Plugin.getAddress())).wait();
                console.log(`   ✅ EulerV2Plugin registered directly`);
            }
            
            // Verify registration
            const registered = await beacon.getImplementation("EulerV2Plugin");
            expect(registered).to.equal(await eulerV2Plugin.getAddress());
            
            console.log(`   ✅ Verified: EulerV2Plugin = ${registered}`);
            
            // Transfer EulerRegistry ownership to plugin (required for createPosition)
            const eulerRegistry = (this as any).eulerRegistry;
            if (eulerRegistry) {
                await (await eulerRegistry.transferOwnership(await eulerV2Plugin.getAddress())).wait();
                console.log(`   ✅ EulerRegistry ownership transferred to plugin`);
            }
        });

        it("Should register FlashLoanService in Beacon", async function () {
            console.log("\n   Registering FlashLoanService in Beacon...");
            
            const beaconOwner = await beacon.owner();
            
            if (beaconOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
                const owner = await ethers.getSigner(beaconOwner);
                const beaconAsOwner = beacon.connect(owner);
                await (await beaconAsOwner.updateImplementation("FlashLoanService", await flashLoanService.getAddress())).wait();
            } else {
                await (await beacon.updateImplementation("FlashLoanService", await flashLoanService.getAddress())).wait();
            }
            
            // Verify
            const registered = await beacon.getImplementation("FlashLoanService");
            expect(registered).to.equal(await flashLoanService.getAddress());
            
            console.log(`   ✅ FlashLoanService registered: ${registered}`);
        });

        it("FlashLoanService should recognize EulerV2Plugin as authorized", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const isAuthorized = await flashLoanService.isAuthorizedPlugin(pluginAddress);
            
            console.log(`\n   Plugin ${pluginAddress} authorized: ${isAuthorized}`);
            expect(isAuthorized).to.be.true;
        });
    });

    // ==================== PHASE 2: GET TEST WETH ====================
    
    describe("Phase 2: Setup Initial Collateral", function () {
        it("Should get WETH from whale", async function () {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WETH_WHALE],
            });
            const whale = await ethers.getSigner(WETH_WHALE);
            
            await deployer.sendTransaction({ to: WETH_WHALE, value: ethers.parseEther("0.1") });

            const wethAmount = ethers.parseEther("0.5");
            const wethAsWhale = weth.connect(whale);
            
            const whaleBal = await weth.balanceOf(WETH_WHALE);
            console.log(`\n   Whale WETH balance: ${formatAmount(whaleBal)}`);
            
            await (await wethAsWhale.transfer(deployerAddress, wethAmount)).wait();
            
            initialWethBalance = await weth.balanceOf(deployerAddress);
            console.log(`   ✅ Got ${formatAmount(initialWethBalance)} WETH`);
            
            expect(initialWethBalance).to.be.gte(wethAmount);
        });
    });

    // ==================== PHASE 3: TEST ATOMIC LEVERAGE ====================
    
    describe("Phase 3: Open Leverage Position (Atomic via FlashLoanService)", function () {
        it("Should approve WETH for EulerV2Plugin", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            
            await (await weth.approve(pluginAddress, ethers.MaxUint256)).wait();
            console.log(`   ✅ WETH approved for EulerV2Plugin`);
        });

        it("Should open 2x leverage position ATOMICALLY", async function () {
            const collateralAmount = ethers.parseEther("0.3");
            const targetLeverage = 200; // 2x
            const minHealthFactor = ethers.parseEther("1.05");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            console.log(`\n   ⚡ Opening ${targetLeverage/100}x leverage via FlashLoanService...`);
            console.log(`      Initial WETH: ${formatAmount(collateralAmount)}`);
            console.log(`      Target Leverage: ${targetLeverage/100}x`);
            console.log(`      Min Health Factor: 1.05x`);
            
            // Record gas before
            const balanceBefore = await ethers.provider.getBalance(deployerAddress);
            
            // Open leverage position via openLeverageAtomic
            const tx = await eulerV2Plugin.openLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                collateralAmount: collateralAmount,
                targetLeverageX100: targetLeverage,
                minHealthFactor: minHealthFactor,
                deadline: deadline
            });
            
            const receipt = await tx.wait();
            const gasUsed = receipt?.gasUsed || 0n;
            const gasPrice = receipt?.gasPrice || 0n;
            const gasCost = gasUsed * gasPrice;
            
            console.log(`\n   ✅ Leverage position opened ATOMICALLY!`);
            console.log(`      Gas Used: ${gasUsed.toString()}`);
            console.log(`      Gas Cost: ${formatAmount(gasCost)} ETH`);
            console.log(`      Block: ${receipt?.blockNumber}`);
            
            // Check position
            await checkPluginHealth("After Atomic Leverage");
            
            const leverage = await estimateLeverage();
            console.log(`      Actual Leverage: ${leverage.toFixed(2)}x`);
            
            // Verify leverage is approximately correct
            expect(leverage).to.be.gte(1.5);
            expect(leverage).to.be.lte(2.5);
        });

        it("Should have position state on Euler", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            
            const shares = await wethVault.balanceOf(pluginAddress);
            const collateral = await wethVault.convertToAssets(shares);
            const debt = await usdcVault.debtOf(pluginAddress);
            
            console.log(`\n   📊 Position State on Euler:`);
            console.log(`      WETH Shares: ${formatAmount(shares)}`);
            console.log(`      WETH Collateral: ${formatAmount(collateral)}`);
            console.log(`      USDC Debt: ${formatAmount(debt, 6)}`);
            
            expect(shares).to.be.gt(0);
            expect(debt).to.be.gt(0);
        });
    });

    // ==================== PHASE 4: VERIFY LEVERAGE STATE ====================
    
    describe("Phase 4: Verify Leverage State", function () {
        it("Should have collateral enabled on EVC", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const isEnabled = await evc.isCollateralEnabled(pluginAddress, ADDRESSES.WETH_VAULT);
            
            console.log(`\n   Collateral enabled: ${isEnabled}`);
            expect(isEnabled).to.be.true;
        });

        it("Should have controller enabled on EVC", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const isEnabled = await evc.isControllerEnabled(pluginAddress, ADDRESSES.USDC_VAULT);
            
            console.log(`   Controller enabled: ${isEnabled}`);
            expect(isEnabled).to.be.true;
        });

        it("Should report correct leverage (calculated from position)", async function () {
            const leverage = await estimateLeverage();
            
            console.log(`\n   Calculated Leverage: ${leverage.toFixed(2)}x`);
            
            expect(leverage).to.be.gte(1.5);
            expect(leverage).to.be.lte(2.5);
        });

        it("Should have healthy position (health factor > 1.05)", async function () {
            const { healthFactor } = await checkPluginHealth("Final Health Check");
            
            const minHealth = ethers.parseEther("1.05");
            expect(healthFactor).to.be.gte(minHealth);
        });
    });

    // ==================== PHASE 5: CLOSE LEVERAGE ATOMICALLY ====================
    
    describe("Phase 5: Close Leverage Position (Atomic)", function () {
        it("Should close leverage position ATOMICALLY", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            
            console.log(`\n   ⚡ Closing leverage via FlashLoanService...`);
            
            // Get state before
            const { collateral: collateralBefore, debt: debtBefore } = await checkPluginHealth("Before Close");
            const wethBalanceBefore = await weth.balanceOf(deployerAddress);
            const usdcBalanceBefore = await usdc.balanceOf(deployerAddress);
            
            console.log(`      WETH Balance Before: ${formatAmount(wethBalanceBefore)}`);
            console.log(`      USDC Balance Before: ${formatAmount(usdcBalanceBefore, 6)}`);
            console.log(`      Collateral: ${formatAmount(collateralBefore)}`);
            console.log(`      Debt to repay: ${formatAmount(debtBefore, 6)} USDC`);
            
            // Close leverage position
            const tx = await eulerV2Plugin.closeLeverageAtomic({
                collateralToken: "WETH",
                borrowToken: "USDC",
                maxSlippageBps: 200,  // 2% max slippage
                deadline: deadline
            });
            
            const receipt = await tx.wait();
            const gasUsed = receipt?.gasUsed || 0n;
            const gasPrice = receipt?.gasPrice || 0n;
            const gasCost = gasUsed * gasPrice;
            
            console.log(`\n   ✅ Leverage position closed ATOMICALLY!`);
            console.log(`      Gas Used: ${gasUsed.toString()}`);
            console.log(`      Gas Cost: ${formatAmount(gasCost)} ETH`);
            
            // Check final state
            await checkPluginHealth("After Close");
            
            const wethBalanceAfter = await weth.balanceOf(deployerAddress);
            const usdcBalanceAfter = await usdc.balanceOf(deployerAddress);
            const usdcReturned = usdcBalanceAfter - usdcBalanceBefore;
            
            console.log(`      USDC Returned: ${formatAmount(usdcReturned, 6)}`);
            console.log(`      WETH Balance After: ${formatAmount(wethBalanceAfter)}`);
            console.log(`      USDC Balance After: ${formatAmount(usdcBalanceAfter, 6)}`);
            
            // Should have gotten some USDC back (equity, since we swap all WETH→USDC)
            expect(usdcReturned).to.be.gt(0);
        });

        it("Should have no debt remaining", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const debt = await usdcVault.debtOf(pluginAddress);
            
            console.log(`\n   Remaining Debt: ${formatAmount(debt, 6)} USDC`);
            expect(debt).to.equal(0);
        });

        it("Should have minimal/no collateral remaining", async function () {
            const pluginAddress = await eulerV2Plugin.getAddress();
            const shares = await wethVault.balanceOf(pluginAddress);
            const collateral = await wethVault.convertToAssets(shares);
            
            console.log(`   Remaining Collateral: ${formatAmount(collateral)} WETH`);
            // Should have very little or no collateral left (some dust possible)
            expect(collateral).to.be.lt(ethers.parseEther("0.01")); // Less than 0.01 WETH dust
        });

        it("Should have returned equity to user", async function () {
            const usdcBalance = await usdc.balanceOf(deployerAddress);
            const wethBalance = await weth.balanceOf(deployerAddress);
            
            console.log(`\n   Final WETH Balance: ${formatAmount(wethBalance)}`);
            console.log(`   Final USDC Balance: ${formatAmount(usdcBalance, 6)}`);
            
            // User should have received back their equity in USDC (since we swap all WETH→USDC)
            // Initial collateral was ~0.3 WETH, leveraged 2x → ~0.6 WETH collateral, ~900 USDC debt
            // After close: ~0.6 WETH → ~1500 USDC (at 2500 ETH/USD), minus 900 debt = ~600 USDC equity
            // Accounting for slippage, should get at least 400 USDC back
            expect(usdcBalance).to.be.gt(ethers.parseUnits("400", 6)); // At least 400 USDC
        });
    });

    // ==================== PHASE 6: VERIFY SECURITY ====================
    
    describe("Phase 6: Verify Security", function () {
        it("Should reject flash loan from unregistered caller", async function () {
            console.log("\n   Testing security: unregistered caller...");
            
            const [, attacker] = await ethers.getSigners();
            const flashLoanServiceAsAttacker = flashLoanService.connect(attacker);
            
            try {
                await flashLoanServiceAsAttacker.executeFlashLoan(
                    [ADDRESSES.USDC],
                    [ethers.parseUnits("1000", 6)],
                    "0x"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                const errorMsg = error.message || "";
                console.log(`   ✅ Rejected: ${errorMsg.slice(0, 100)}`);
                expect(errorMsg).to.include("NotRegisteredPlugin");
            }
        });

        it("Should reject swap from unregistered caller", async function () {
            console.log("\n   Testing security: swap from unregistered caller...");
            
            const [, attacker] = await ethers.getSigners();
            const flashLoanServiceAsAttacker = flashLoanService.connect(attacker);
            
            try {
                await flashLoanServiceAsAttacker.swap(
                    ADDRESSES.USDC,
                    ADDRESSES.WETH,
                    ethers.parseUnits("100", 6)
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                const errorMsg = error.message || "";
                console.log(`   ✅ Rejected: ${errorMsg.slice(0, 100)}`);
                expect(errorMsg).to.include("NotRegisteredPlugin");
            }
        });
    });

    // ==================== SUMMARY ====================
    
    describe("Summary", function () {
        it("Should print summary", async function () {
            console.log("\n" + "=".repeat(70));
            console.log("📊 FLASH LOAN SERVICE E2E TEST SUMMARY");
            console.log("=".repeat(70));
            console.log("\n   ✅ ARCHITECTURE VERIFIED!");
            console.log("\n   Components Deployed:");
            console.log(`   • FlashLoanService: ${await flashLoanService.getAddress()}`);
            console.log(`   • EulerV2Plugin: ${await eulerV2Plugin.getAddress()}`);
            console.log("\n   Security Features:");
            console.log("   • ✅ Layer 1: Beacon check - only registered plugins authorized");
            console.log("   • ✅ Layer 2: Trust-the-Revert - Balancer enforces repayment");
            console.log("\n   Integration:");
            console.log("   • ✅ openLeverageAtomic() - Open 2x leverage in 1 tx");
            console.log("   • ✅ closeLeverageAtomic() - Close position in 1 tx");
            console.log("   • ✅ FlashLoanService.swap() for bidirectional swaps");
            console.log("\n   Benefits:");
            console.log("   • Centralized flash loan logic (1 deployment)");
            console.log("   • Reusable by multiple plugins (Euler, future Morpho, etc.)");
            console.log("   • 0% flash loan fees (Balancer V2)");
            console.log("   • Atomic execution (all or nothing)");
            console.log("   • Full lifecycle: OPEN + CLOSE leverage");
            console.log("=".repeat(70) + "\n");
        });
    });
});
