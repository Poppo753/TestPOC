import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Arbitrum Mainnet protocol addresses (used for unit test deploys)
const ARBITRUM_AAVE_POOL    = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const ARBITRUM_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ARBITRUM_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const ARBITRUM_VAULT_LENS   = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
const ARBITRUM_UTILS_LENS   = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";
const ARBITRUM_MORPHO       = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

/**
 * 🔍 LENS ADAPTERS - UNIT TESTS
 * 
 * Tests the unit-testable parts of all 4 LensAdapters:
 * - AaveV3LensAdapter
 * - EulerLensAdapter
 * - MorphoLensAdapter
 * - MorphoVaultLensAdapter
 * 
 * NOTE: LensAdapters use hardcoded external addresses (Aave Pool, Euler AccountLens,
 * Morpho, etc.) which are only available on Arbitrum fork. Functions that call these
 * external contracts are tested in fork integration tests instead.
 * 
 * This file tests: constructor validation, pure functions, constant values,
 * beacon resolution path, and ownership.
 */
describe("LensAdapters - Unit Tests", function () {
    let owner: SignerWithAddress;
    let nonOwner: SignerWithAddress;
    let mockBeacon: any;

    beforeEach(async function () {
        [owner, nonOwner] = await ethers.getSigners();

        // Deploy MockBeacon
        const BeaconFactory = await ethers.getContractFactory("MockBeacon");
        mockBeacon = await BeaconFactory.deploy();
        await mockBeacon.waitForDeployment();
    });

    // ================================================================
    // AAVE V3 LENS ADAPTER
    // ================================================================

    describe("AaveV3LensAdapter", function () {
        let adapter: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("AaveV3LensAdapter");
            adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH", ARBITRUM_AAVE_POOL);
            await adapter.waitForDeployment();
        });

        describe("Constructor", function () {
            it("Should deploy with correct beacon", async function () {
                expect(await adapter.beacon()).to.equal(await mockBeacon.getAddress());
            });

            it("Should set baseAssetCode", async function () {
                expect(await adapter.baseAssetCode()).to.equal("WETH");
            });

            it("Should set correct owner", async function () {
                expect(await adapter.owner()).to.equal(owner.address);
            });

            it("Should revert with zero beacon address", async function () {
                const Factory = await ethers.getContractFactory("AaveV3LensAdapter");
                await expect(
                    Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_AAVE_POOL)
                ).to.be.revertedWithCustomError(adapter, "InvalidBeacon");
            });
        });

        describe("Pure/View Functions", function () {
            it("protocolName should return 'AaveV3'", async function () {
                expect(await adapter.protocolName()).to.equal("AaveV3");
            });

            it("protocolType should return LENDING (0)", async function () {
                expect(await adapter.protocolType()).to.equal(0); // LENDING = 0
            });

            it("aavePool immutable should match injected address", async function () {
                expect(await adapter.aavePool()).to.equal(ARBITRUM_AAVE_POOL);
            });

            it("DEFAULT_SAFE_HEALTH_FACTOR should be 1.5e18", async function () {
                expect(await adapter.DEFAULT_SAFE_HEALTH_FACTOR()).to.equal(ethers.parseEther("1.5"));
            });
        });

        describe("Beacon Resolution", function () {
            it("getPlugin should return address from beacon", async function () {
                const pluginAddr = "0x0000000000000000000000000000000000000042";
                await mockBeacon.setImplementation("AaveV3Plugin", pluginAddr);
                expect(await adapter.getPlugin()).to.equal(pluginAddr);
            });

            it("getPlugin should return zero if not registered", async function () {
                expect(await adapter.getPlugin()).to.equal(ethers.ZeroAddress);
            });
        });

        describe("Ownership", function () {
            it("Should transfer ownership", async function () {
                await adapter.transferOwnership(nonOwner.address);
                expect(await adapter.owner()).to.equal(nonOwner.address);
            });
        });
    });

    // ================================================================
    // EULER LENS ADAPTER
    // ================================================================

    describe("EulerLensAdapter", function () {
        let adapter: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("EulerLensAdapter");
            adapter = await Factory.deploy(
                await mockBeacon.getAddress(), "WETH",
                ARBITRUM_ACCOUNT_LENS, ARBITRUM_VAULT_LENS, ARBITRUM_UTILS_LENS, ARBITRUM_EVC
            );
            await adapter.waitForDeployment();
        });

        describe("Constructor", function () {
            it("Should deploy with correct beacon", async function () {
                expect(await adapter.beacon()).to.equal(await mockBeacon.getAddress());
            });

            it("Should set baseAssetCode", async function () {
                expect(await adapter.baseAssetCode()).to.equal("WETH");
            });

            it("Should revert with zero beacon address", async function () {
                const Factory = await ethers.getContractFactory("EulerLensAdapter");
                await expect(
                    Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_ACCOUNT_LENS, ARBITRUM_VAULT_LENS, ARBITRUM_UTILS_LENS, ARBITRUM_EVC)
                ).to.be.revertedWithCustomError(adapter, "InvalidBeacon");
            });
        });

        describe("Pure/View Functions", function () {
            it("protocolName should return 'Euler'", async function () {
                expect(await adapter.protocolName()).to.equal("Euler");
            });

            it("protocolType should return LENDING (0)", async function () {
                expect(await adapter.protocolType()).to.equal(0);
            });
        });

        describe("Beacon Resolution", function () {
            it("getPlugin should return address from beacon", async function () {
                const pluginAddr = "0x0000000000000000000000000000000000000043";
                await mockBeacon.setImplementation("EulerV2Plugin", pluginAddr);
                expect(await adapter.getPlugin()).to.equal(pluginAddr);
            });
        });
    });

    // ================================================================
    // MORPHO LENS ADAPTER
    // ================================================================

    describe("MorphoLensAdapter", function () {
        let adapter: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("MorphoLensAdapter");
            adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH", ARBITRUM_MORPHO);
            await adapter.waitForDeployment();
        });

        describe("Constructor", function () {
            it("Should deploy with correct beacon", async function () {
                expect(await adapter.beacon()).to.equal(await mockBeacon.getAddress());
            });

            it("Should set baseAssetCode", async function () {
                expect(await adapter.baseAssetCode()).to.equal("WETH");
            });

            it("Should revert with zero beacon address", async function () {
                const Factory = await ethers.getContractFactory("MorphoLensAdapter");
                await expect(
                    Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_MORPHO)
                ).to.be.revertedWithCustomError(adapter, "InvalidBeacon");
            });
        });

        describe("Pure/View Functions", function () {
            it("protocolName should return 'Morpho'", async function () {
                expect(await adapter.protocolName()).to.equal("Morpho");
            });

            it("protocolType should return LENDING (0)", async function () {
                expect(await adapter.protocolType()).to.equal(0);
            });
        });

        describe("Beacon Resolution", function () {
            it("getPlugin should return address from beacon", async function () {
                const pluginAddr = "0x0000000000000000000000000000000000000044";
                await mockBeacon.setImplementation("MorphoPlugin", pluginAddr);
                expect(await adapter.getPlugin()).to.equal(pluginAddr);
            });
        });
    });

    // ================================================================
    // MORPHO VAULT LENS ADAPTER
    // ================================================================

    describe("MorphoVaultLensAdapter", function () {
        let adapter: any;

        beforeEach(async function () {
            const Factory = await ethers.getContractFactory("MorphoVaultLensAdapter");
            adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH");
            await adapter.waitForDeployment();
        });

        describe("Constructor", function () {
            it("Should deploy with correct beacon", async function () {
                expect(await adapter.beacon()).to.equal(await mockBeacon.getAddress());
            });

            it("Should set baseAssetCode", async function () {
                expect(await adapter.baseAssetCode()).to.equal("WETH");
            });

            it("Should revert with zero beacon address", async function () {
                const Factory = await ethers.getContractFactory("MorphoVaultLensAdapter");
                await expect(
                    Factory.deploy(ethers.ZeroAddress, "WETH")
                ).to.be.revertedWithCustomError(adapter, "InvalidBeacon");
            });
        });

        describe("Pure/View Functions", function () {
            it("protocolName should return 'MorphoVault'", async function () {
                expect(await adapter.protocolName()).to.equal("MorphoVault");
            });

            it("protocolType should return YIELD (1)", async function () {
                expect(await adapter.protocolType()).to.equal(1); // YIELD = 1
            });
        });

        describe("Beacon Resolution", function () {
            it("getPlugin should return address from beacon", async function () {
                const pluginAddr = "0x0000000000000000000000000000000000000045";
                await mockBeacon.setImplementation("MorphoVaultPlugin", pluginAddr);
                expect(await adapter.getPlugin()).to.equal(pluginAddr);
            });
        });
    });
});
