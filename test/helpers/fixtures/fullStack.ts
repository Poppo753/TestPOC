import { ethers } from "hardhat";

/**
 * @file fullStack.ts
 * @description Shared fixture system per i test del protocollo.
 *
 * Usa loadFixture() di Hardhat per il caching automatico dello stato:
 * ```typescript
 * import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
 * import { deployFullProtocolFixture } from "./helpers/fixtures/fullStack";
 *
 * const { beacon, liquidityManager, ... } = await loadFixture(deployFullProtocolFixture);
 * ```
 */

// ==================== TOKEN ADDRESSES ====================
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

// ==================== BASE FIXTURE ====================

/**
 * Deploy completo di tutti i contratti core con MockERC20 come BASE_ASSET.
 * Funziona sia in fork che in locale (no fork required).
 */
export async function deployFullProtocolFixture() {
    const [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();

    // Real core contracts with deterministic local tokens/oracles.
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdcToken  = await MockERC20Factory.deploy("MockUSDC", "mUSDC", 6);
    const wbtcToken  = await MockERC20Factory.deploy("MockWBTC", "mWBTC", 8);
    const baseToken = await (await ethers.getContractFactory("MockWETH")).deploy();

    const beacon = await (await ethers.getContractFactory("Beacon")).deploy();
    const oracle = await (await ethers.getContractFactory("MockOracleAdapter")).deploy();
    const proxyGeneral = await (await ethers.getContractFactory("ProxyGeneral")).deploy(
        await beacon.getAddress(),
        "WETH"
    );
    const tokenManager = await (await ethers.getContractFactory("TokenManager")).deploy(
        await beacon.getAddress(),
        await oracle.getAddress()
    );
    const valueCalculator = await (await ethers.getContractFactory("ValueCalculator")).deploy(
        await beacon.getAddress(),
        "WETH"
    );
    const swapManager = await (await ethers.getContractFactory("SwapManager")).deploy(
        await beacon.getAddress(),
        "WETH"
    );
    const parameterManager = await (await ethers.getContractFactory("ParameterManager")).deploy(
        await beacon.getAddress(),
        18
    );
    const emergencyHandler = await (await ethers.getContractFactory("EmergencyHandler")).deploy(
        await beacon.getAddress()
    );
    await beacon.updateImplementation("BASE_ASSET", await baseToken.getAddress());
    await beacon.updateImplementation("WETH", await baseToken.getAddress());

    // Configure oracle prices
    await oracle.setupToken("WETH", ethers.parseEther("1"), 18, true);
    await oracle.setupToken("USDC", 333333333333333n, 18, true);
    await oracle.setupToken("WBTC", ethers.parseEther("20"), 18, true);
    await oracle.setUsdPrice("WETH", ethers.parseEther("3000"));
    await oracle.setUsdPrice("USDC", ethers.parseEther("1"));
    await oracle.setUsdPrice("WBTC", ethers.parseEther("60000"));

    // Configure tokenManager
    await tokenManager.setBaseAssetCode("WETH");
    await tokenManager["manageTokenData(string,address,uint8,uint256)"](
        "USDC", await usdcToken.getAddress(), 6, 3600
    );
    await tokenManager["manageTokenData(string,address,uint8,uint256)"](
        "WBTC", await wbtcToken.getAddress(), 8, 3600
    );

    // Configure beacon
    await beacon.updateImplementation("TokenManager", await tokenManager.getAddress());
    await beacon.updateImplementation("ProxyGeneral", await proxyGeneral.getAddress());
    await beacon.updateImplementation("ValueCalculator", await valueCalculator.getAddress());
    await beacon.updateImplementation("SwapManager", await swapManager.getAddress());
    await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
    await beacon.updateImplementation("EmergencyHandler", await emergencyHandler.getAddress());

    // Deploy LiquidityManager
    const LMFactory = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LMFactory.deploy(await beacon.getAddress(), "WETH");
    await beacon.updateImplementation("LiquidityManager", await liquidityManager.getAddress());

    await proxyGeneral.authorizeModule(await liquidityManager.getAddress(), "LiquidityManager");
    await proxyGeneral.authorizeModule(await swapManager.getAddress(), "SwapManager");
    await proxyGeneral.authorizeModule(await emergencyHandler.getAddress(), "EmergencyHandler");
    await liquidityManager.setDepositsEnabled(true);
    await liquidityManager.setWithdrawsEnabled(true);
    await liquidityManager.setFeeRecipient(feeRecipient.address);
    await proxyGeneral.setRateLimit("deposit", ethers.parseEther("1000"), ethers.parseEther("5000"));
    await proxyGeneral.setRateLimit("withdraw", ethers.parseEther("1000"), ethers.parseEther("5000"));

    return {
        beacon,
        tokenManager,
        proxyGeneral,
        oracle,
        valueCalculator,
        swapManager,
        parameterManager,
        emergencyHandler,
        liquidityManager,
        baseToken,
        usdcToken,
        wbtcToken,
        owner,
        user1,
        user2,
        user3,
        feeRecipient,
    };
}

// ==================== AAVE FIXTURE ====================

/**
 * Stack completo + AaveV3Plugin configurato (richiede fork).
 */
export async function deployWithAaveFixture() {
    const base = await deployFullProtocolFixture();

    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const AAVE_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    // Aggiorna beacon con WETH reale (solo se in fork)
    const code = await ethers.provider.getCode(AAVE_WETH);
    if (code.length > 2) {
        // Fork disponibile
        await base.beacon.updateImplementation("BASE_ASSET", AAVE_WETH);
        await base.beacon.updateImplementation("WETH",       AAVE_WETH);
    }

    const AaveFactory = await ethers.getContractFactory("AaveV3Plugin");
    const aavePlugin = await AaveFactory.deploy(
        await base.beacon.getAddress(),
        "WETH",
        AAVE_POOL
    );
    await base.beacon.updateImplementation("AaveV3Plugin", await aavePlugin.getAddress());

    return { ...base, aavePlugin, AAVE_POOL };
}

// ==================== EULER FIXTURE ====================

/**
 * Stack completo + EulerV2Plugin configurato (richiede fork).
 */
export async function deployWithEulerFixture() {
    const base = await deployFullProtocolFixture();

    const EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
    const ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";

    const EulerFactory = await ethers.getContractFactory("EulerV2Plugin");
    const eulerPlugin = await EulerFactory.deploy(
        await base.beacon.getAddress(),
        "WETH",
        EVC,
        ACCOUNT_LENS
    );
    await base.beacon.updateImplementation("EulerV2Plugin", await eulerPlugin.getAddress());

    return { ...base, eulerPlugin, EVC, ACCOUNT_LENS };
}
