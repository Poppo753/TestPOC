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

    // Deploy MockERC20 come base asset (WETH simulato)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const baseToken = await MockERC20Factory.deploy("MockWETH", "mWETH", 18);
    const usdcToken  = await MockERC20Factory.deploy("MockUSDC", "mUSDC", 6);
    const wbtcToken  = await MockERC20Factory.deploy("MockWBTC", "mWBTC", 8);

    // Deploy MockBeacon + Mocks
    const MockBeaconFactory       = await ethers.getContractFactory("MockBeacon");
    const MockTokenManagerFactory = await ethers.getContractFactory("MockTokenManager");
    const MockProxyGeneralFactory = await ethers.getContractFactory("MockProxyGeneral");
    const MockOracleFactory       = await ethers.getContractFactory("MockOracleAdapter");

    const beacon         = await MockBeaconFactory.deploy();
    const tokenManager   = await MockTokenManagerFactory.deploy();
    const proxyGeneral   = await MockProxyGeneralFactory.deploy();
    const oracle         = await MockOracleFactory.deploy();

    // Configure oracle prices
    await oracle.setPrice("WETH", ethers.parseUnits("3000", 8));
    await oracle.setPrice("USDC", ethers.parseUnits("1", 8));
    await oracle.setPrice("WBTC", ethers.parseUnits("60000", 8));

    // Configure tokenManager
    await tokenManager.setTokenAddress("WETH", await baseToken.getAddress());
    await tokenManager.setTokenAddress("USDC", await usdcToken.getAddress());
    await tokenManager.setTokenAddress("WBTC", await wbtcToken.getAddress());
    await tokenManager.setTokenPrice("WETH", ethers.parseUnits("3000", 8));
    await tokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));
    await tokenManager.setTokenPrice("WBTC", ethers.parseUnits("60000", 8));

    // Configure beacon
    await beacon.setImplementation("TokenManager",     await tokenManager.getAddress());
    await beacon.setImplementation("ProxyGeneral",     await proxyGeneral.getAddress());
    await beacon.setImplementation("ProtocolManager",  owner.address);
    await beacon.setImplementation("BASE_ASSET",       await baseToken.getAddress());
    await beacon.setImplementation("WETH",             await baseToken.getAddress());

    // Deploy LiquidityManager
    const LMFactory = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LMFactory.deploy(await beacon.getAddress(), "WETH");
    await beacon.setImplementation("LiquidityManager", await liquidityManager.getAddress());

    // Set fee recipient
    await liquidityManager.setFeeRecipient(feeRecipient.address);

    return {
        beacon,
        tokenManager,
        proxyGeneral,
        oracle,
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
        await base.beacon.setImplementation("BASE_ASSET", AAVE_WETH);
        await base.beacon.setImplementation("WETH",       AAVE_WETH);
    }

    const AaveFactory = await ethers.getContractFactory("AaveV3Plugin");
    const aavePlugin = await AaveFactory.deploy(
        await base.beacon.getAddress(),
        "WETH",
        AAVE_POOL
    );
    await base.beacon.setImplementation("AaveV3Plugin", await aavePlugin.getAddress());

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
    await base.beacon.setImplementation("EulerV2Plugin", await eulerPlugin.getAddress());

    return { ...base, eulerPlugin, EVC, ACCOUNT_LENS };
}
