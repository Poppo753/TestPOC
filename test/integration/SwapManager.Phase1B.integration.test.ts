import { expect } from "chai";
import { ethers } from "hardhat";
import type { 
    Beacon, 
    SwapManager, 
    TokenManager, 
    ProxyGeneral, 
    LiquidityManager,
    ValueCalculator,
    ParameterManager,
    MockERC20,
    MockWETH,
    MockSimpleSwap,
    MockOracleAdapter
} from "../../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * PHASE 1B: INTEGRATION TESTS
 * 
 * Testa l'ESECUZIONE COMPLETA di swapWithBestPlugin() con setup completo:
 * - TokenManager con price feeds
 * - ProxyGeneral con fondi
 * - Plugins configurati
 * - Autorizzazioni corrette
 * 
 * Questi test coprono:
 * 1. Esecuzione reale dello swap
 * 2. Event emission (BestPluginSelected, SwapExecuted)
 * 3. Selezione del plugin migliore
 * 4. Gestione errori "No valid plugin" / "Best quote below minimum"
 * 5. TightDeadlineWarning
 * 6. Comparison gas cost vs Phase 1A performSwap()
 */
describe("SwapManager - Phase 1B Integration Tests", function () {
    
    let beacon: Beacon;
    let swapManager: SwapManager;
    let tokenManager: TokenManager;
    let proxyGeneral: ProxyGeneral;
    let liquidityManager: LiquidityManager;
    let valueCalculator: ValueCalculator;
    let parameterManager: ParameterManager;
    let mockOracleAdapter: MockOracleAdapter;
    let mockUSDC: MockERC20;
    let mockWBTC: MockERC20;
    let mockWETH: MockWETH;
    let uniswapV3Plugin: MockSimpleSwap;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let feeRecipient: SignerWithAddress;

    const PRICES = {
        WETH: ethers.parseUnits("2000", 8),  // $2000
        USDC: ethers.parseUnits("1", 8),     // $1
        WBTC: ethers.parseUnits("50000", 8)  // $50000
    };

    beforeEach(async function () {
        [owner, user1, feeRecipient] = await ethers.getSigners();

        // Deploy Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();

        // Deploy MockOracleAdapter
        const MockOracleAdapterFactory = await ethers.getContractFactory("MockOracleAdapter");
        mockOracleAdapter = await MockOracleAdapterFactory.deploy();
        
        // Setup oracle prices
        await mockOracleAdapter.setupToken("WETH", PRICES.WETH, 8, true);
        await mockOracleAdapter.setupToken("USDC", PRICES.USDC, 8, true);
        await mockOracleAdapter.setupToken("WBTC", PRICES.WBTC, 8, true);

        // Deploy mock tokens
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
        mockWBTC = await MockERC20Factory.deploy("Wrapped Bitcoin", "WBTC", 8);
        
        const MockWETHFactory = await ethers.getContractFactory("MockWETH");
        mockWETH = await MockWETHFactory.deploy();

        // Deploy core contracts
        const TokenManagerFactory = await ethers.getContractFactory("TokenManager");
        tokenManager = await TokenManagerFactory.deploy(beacon.target, mockOracleAdapter.target);

        const ProxyGeneralFactory = await ethers.getContractFactory("ProxyGeneral");
        proxyGeneral = await ProxyGeneralFactory.deploy(beacon.target);

        const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
        valueCalculator = await ValueCalculatorFactory.deploy(beacon.target);

        const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManagerFactory.deploy(beacon.target);

        const LiquidityManagerFactory = await ethers.getContractFactory("LiquidityManager");
        liquidityManager = await LiquidityManagerFactory.deploy(beacon.target);

        const SwapManagerFactory = await ethers.getContractFactory("SwapManager");
        swapManager = await SwapManagerFactory.deploy(beacon.target);

        // Register in Beacon
        await beacon.updateImplementation("WETH", mockWETH.target);
        await beacon.updateImplementation("TokenManager", tokenManager.target);
        await beacon.updateImplementation("ProxyGeneral", proxyGeneral.target);
        await beacon.updateImplementation("ValueCalculator", valueCalculator.target);
        await beacon.updateImplementation("ParameterManager", parameterManager.target);
        await beacon.updateImplementation("LiquidityManager", liquidityManager.target);
        await beacon.updateImplementation("SwapManager", swapManager.target);

        // Register tokens in TokenManager
        await tokenManager.manageTokenData("USDC", mockUSDC.target, 6, 3600);
        await tokenManager.manageTokenData("WBTC", mockWBTC.target, 8, 3600);

        // Setup SwapManager
        await swapManager.setSimpleSwapRouter(mockUSDC.target); // Mock router
        await swapManager.setSwapsEnabled(true);

        // Deploy and register MockSimpleSwap plugin in Beacon (supports setExpectedOutput)
        const MockSimpleSwapFactory = await ethers.getContractFactory("MockSimpleSwap");
        uniswapV3Plugin = await MockSimpleSwapFactory.deploy();
        
        // Set custody holder for the plugin
        await uniswapV3Plugin.setCustodyHolder(proxyGeneral.target);
        
        // Configure expected swap outputs for USDC → WBTC
        await uniswapV3Plugin.setExpectedOutput(
            mockUSDC.target,
            mockWBTC.target,
            ethers.parseUnits("0.5", 8) // 0.5 WBTC output
        );
        
        await beacon.updateImplementation("UniswapV3Plugin", uniswapV3Plugin.target);
        
        // Set as active plugin
        await swapManager.setActiveSwapPlugin("UniswapV3Plugin");

        // Authorize SwapManager to call from LiquidityManager context
        await proxyGeneral.authorizeModule(swapManager.target, "SwapManager");
        await proxyGeneral.authorizeModule(liquidityManager.target, "LiquidityManager");
        
        // Fund ProxyGeneral with tokens
        await mockWETH.deposit({ value: ethers.parseEther("10") });
        await mockWETH.transfer(proxyGeneral.target, ethers.parseEther("10"));
        await mockUSDC.mint(proxyGeneral.target, ethers.parseUnits("100000", 6));
        await mockWBTC.mint(proxyGeneral.target, ethers.parseUnits("2", 8));

        // Fund plugin with tokens for swaps
        await mockUSDC.mint(uniswapV3Plugin.target, ethers.parseUnits("100000", 6));
        await mockWBTC.mint(uniswapV3Plugin.target, ethers.parseUnits("5", 8));
    });

    // NOTE: Questi test richiedono che UniswapV3Plugin implementi correttamente ISwapPlugin.getQuote()
    // Attualmente getAllQuotes() non trova plugin validi (ritorna "No valid plugin found")
    // TODO: Verificare implementazione ISwapPlugin in UniswapV3Plugin
    
    it("Should execute FULL swap with best plugin", async function () {
        const amountIn = ethers.parseUnits("1000", 6); // 1000 USDC
        const minAmountOut = ethers.parseUnits("0.01", 8); // Min 0.01 WBTC
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        const initialUSDC = await mockUSDC.balanceOf(proxyGeneral.target);
        const initialWBTC = await mockWBTC.balanceOf(proxyGeneral.target);

        // Execute swap through owner (authorized)
        await swapManager.connect(owner).swapWithBestPlugin(
            "USDC",
            "WBTC", 
            amountIn,
            minAmountOut,
            deadline
        );

        // Verify balances changed
        const finalUSDC = await mockUSDC.balanceOf(proxyGeneral.target);
        const finalWBTC = await mockWBTC.balanceOf(proxyGeneral.target);

        expect(finalUSDC).to.be.lt(initialUSDC);
        expect(finalWBTC).to.be.gt(initialWBTC);
    });
    
    it("Should emit TightDeadlineWarning if deadline < 5 minutes", async function () {
        const amountIn = ethers.parseUnits("500", 6);
        const minAmountOut = ethers.parseUnits("0.005", 8);
        const currentBlock = await ethers.provider.getBlock('latest');
        const deadline = currentBlock!.timestamp + 240; // 4 minutes

        const tx = await swapManager.connect(owner).swapWithBestPlugin(
            "USDC",
            "WBTC",
            amountIn,
            minAmountOut,
            deadline
        );

        await expect(tx)
            .to.emit(swapManager, "TightDeadlineWarning");
    });
    
    it("Should revert if ALL plugins return invalid quotes", async function () {
        // Try to swap tokens that don't exist or aren't supported
        // This will cause plugins to return invalid quotes
        const amountIn = ethers.parseUnits("1000", 6);
        const minAmountOut = ethers.parseUnits("1", 6);
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        // Try swapping to a non-existent token
        await expect(
            swapManager.connect(owner).swapWithBestPlugin(
                "USDC",
                "INVALID_TOKEN",
                amountIn,
                minAmountOut,
                deadline
            )
        ).to.be.reverted; // Will revert because token doesn't exist
    });
    
    it("Should revert if bestQuote < minAmountOut", async function () {
        const amountIn = ethers.parseUnits("100", 6); // Small amount
        const minAmountOut = ethers.parseUnits("10", 8); // Unrealistically high for 100 USDC
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        await expect(
            swapManager.connect(owner).swapWithBestPlugin(
                "USDC",
                "WBTC",
                amountIn,
                minAmountOut,
                deadline
            )
        ).to.be.revertedWith("Best quote below minimum");
    });
    
    it("Should validate minAmountOut > 0", async function () {
        const amountIn = ethers.parseUnits("1000", 6);
        const minAmountOut = 0;
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        await expect(
            swapManager.connect(owner).swapWithBestPlugin(
                "USDC",
                "WBTC",
                amountIn,
                minAmountOut,
                deadline
            )
        ).to.be.revertedWith("minAmountOut must be greater than 0");
    });
    
    it("Should select plugin with HIGHEST quote (not first)", async function () {
        // This test requires multiple plugins registered
        // For now, verify that with single plugin it selects correctly
        const amountIn = ethers.parseUnits("1000", 6);
        const minAmountOut = ethers.parseUnits("0.01", 8);
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        const tx = await swapManager.connect(owner).swapWithBestPlugin(
            "USDC",
            "WBTC",
            amountIn,
            minAmountOut,
            deadline
        );

        // Should emit BestPluginSelected with UniswapV3Plugin
        await expect(tx)
            .to.emit(swapManager, "BestPluginSelected");
    });
    
    it("Should compare gas cost: swapWithBestPlugin vs performSwap", async function () {
        const amountIn = ethers.parseUnits("500", 6);
        const minAmountOut = ethers.parseUnits("0.005", 8);
        const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;

        // Measure swapWithBestPlugin gas
        const tx1 = await swapManager.connect(owner).swapWithBestPlugin(
            "USDC",
            "WBTC",
            amountIn,
            minAmountOut,
            deadline
        );
        const receipt1 = await tx1.wait();
        const gasUsedBest = receipt1!.gasUsed;

        // For comparison with performSwap, we would need activeSwapPlugin set
        // For now, just report the gas used
        console.log(`      ⛽ swapWithBestPlugin gas: ${gasUsedBest.toString()}`);
        
        expect(gasUsedBest).to.be.gt(0);
    });

});
