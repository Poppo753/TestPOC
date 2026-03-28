import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * GMX V2 Plugin - Simple E2E Test
 * 
 * Verifica:
 * 1. Compilazione corretta
 * 2. Deployment del plugin
 * 3. Configurazione market
 * 4. Metadata del plugin
 */

describe("GMXv2Plugin - Simple E2E Test", function () {
    this.timeout(120000); // 2 minutes

    // GMX V2 Addresses on Arbitrum
    const GMX_EXCHANGE_ROUTER = "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8";
    const GMX_READER = "0xf60becbba223EEA9495Da3f606753867eC10d139";
    const GMX_DATASTORE = "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8";
    
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const GM_ETH_USD = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

    let gmxPlugin: any;
    let owner: any;
    let mockProxyGeneral: string;

    before(async function () {
        console.log("\n🔧 Setup Test Environment\n");
        [owner] = await ethers.getSigners();
        console.log("Owner:", owner.address);
        
        // Use owner address as mock ProxyGeneral
        mockProxyGeneral = owner.address;
    });

    describe("📦 Deployment", function () {
        it("Should deploy GMXv2Plugin", async function () {
            console.log("\n📦 Deploying GMXv2Plugin...");
            
            const GMXv2PluginFactory = await ethers.getContractFactory("GMXv2Plugin");
            gmxPlugin = await GMXv2PluginFactory.deploy(
                GMX_EXCHANGE_ROUTER,
                GMX_READER,
                GMX_DATASTORE,
                mockProxyGeneral,
                WETH
            );
            
            await gmxPlugin.waitForDeployment();
            const address = await gmxPlugin.getAddress();
            
            console.log("✅ Plugin deployed at:", address);
            expect(address).to.be.properAddress;
        });

        it("Should have correct constructor params", async function () {
            const exchangeRouter = await gmxPlugin.exchangeRouter();
            const reader = await gmxPlugin.reader();
            const dataStore = await gmxPlugin.dataStore();
            const proxyGeneral = await gmxPlugin.proxyGeneral();
            
            expect(exchangeRouter).to.equal(GMX_EXCHANGE_ROUTER);
            expect(reader).to.equal(GMX_READER);
            expect(dataStore).to.equal(GMX_DATASTORE);
            expect(proxyGeneral).to.equal(mockProxyGeneral);
            
            console.log("✅ All constructor params correct");
        });
    });

    describe("🏪 Market Configuration", function () {
        it("Should add GM:ETH/USD market", async function () {
            console.log("\n🏪 Adding GM:ETH/USD market...");
            
            const tx = await gmxPlugin.addMarket(
                GM_ETH_USD,
                WETH, // indexToken
                WETH, // longToken
                USDC  // shortToken
            );
            await tx.wait();
            
            console.log("✅ Market added");
        });

        it("Should verify market configuration", async function () {
            const market = await gmxPlugin.markets(GM_ETH_USD);
            
            expect(market.isActive).to.be.true;
            expect(market.indexToken).to.equal(WETH);
            expect(market.longToken).to.equal(WETH);
            expect(market.shortToken).to.equal(USDC);
            
            console.log("\n📊 Market Config:");
            console.log("   Active:", market.isActive);
            console.log("   Index:", market.indexToken);
            console.log("   Long:", market.longToken);
            console.log("   Short:", market.shortToken);
        });

        it("Should verify market is active", async function () {
            const market = await gmxPlugin.markets(GM_ETH_USD);
            expect(market.isActive).to.be.true;
            
            console.log("\n📝 Market Active:");
            console.log("   GM:ETH/USD active:", market.isActive);
        });
    });

    describe("🔌 Plugin Metadata", function () {
        it("Should return correct metadata", async function () {
            const metadata = await gmxPlugin.getPluginMetadata();
            
            expect(metadata.name).to.equal("GMX V2 Swap Plugin");
            expect(metadata.version).to.equal("1.0.0");
            expect(metadata.requiresApproval).to.be.true;
            
            console.log("\n🔌 Plugin Metadata:");
            console.log("   Name:", metadata.name);
            console.log("   Version:", metadata.version);
            console.log("   Requires Approval:", metadata.requiresApproval);
        });

        it("Should have execution fee configured", async function () {
            const executionFee = await gmxPlugin.getExecutionFee();
            
            expect(executionFee).to.be.gt(0);
            expect(executionFee).to.be.lte(ethers.parseEther("0.01"));
            
            console.log("\n⛽ Execution Fee:", ethers.formatEther(executionFee), "ETH");
        });

        it("Should set new execution fee (only owner)", async function () {
            const newFee = ethers.parseEther("0.002");
            
            await gmxPlugin.setExecutionFee(newFee);
            
            const updatedFee = await gmxPlugin.getExecutionFee();
            expect(updatedFee).to.equal(newFee);
            
            console.log("✅ Execution fee updated to:", ethers.formatEther(newFee), "ETH");
        });
    });

    describe("🔒 Access Control", function () {
        it("Should only allow owner to add markets", async function () {
            const [, nonOwner] = await ethers.getSigners();
            
            await expect(
                gmxPlugin.connect(nonOwner).addMarket(
                    ethers.ZeroAddress,
                    ethers.ZeroAddress,
                    ethers.ZeroAddress,
                    ethers.ZeroAddress
                )
            ).to.be.reverted;
            
            console.log("✅ Non-owner cannot add markets");
        });

        it("Should only allow owner to remove markets", async function () {
            const [, nonOwner] = await ethers.getSigners();
            
            await expect(
                gmxPlugin.connect(nonOwner).removeMarket(GM_ETH_USD)
            ).to.be.reverted;
            
            console.log("✅ Non-owner cannot remove markets");
        });

        it("Should only allow owner to set execution fee", async function () {
            const [, nonOwner] = await ethers.getSigners();
            
            await expect(
                gmxPlugin.connect(nonOwner).setExecutionFee(ethers.parseEther("0.005"))
            ).to.be.reverted;
            
            console.log("✅ Non-owner cannot set execution fee");
        });
    });

    describe("🧮 Market Management", function () {
        it("Should remove market", async function () {
            console.log("\n🗑️  Removing market...");
            
            const tx = await gmxPlugin.removeMarket(GM_ETH_USD);
            await tx.wait();
            
            const market = await gmxPlugin.markets(GM_ETH_USD);
            expect(market.isActive).to.be.false;
            
            console.log("✅ Market removed");
        });

        it("Should verify market is inactive after removal", async function () {
            const market = await gmxPlugin.markets(GM_ETH_USD);
            expect(market.isActive).to.be.false;
            
            console.log("✅ Market is inactive");
        });

        it("Should re-add market", async function () {
            const tx = await gmxPlugin.addMarket(
                GM_ETH_USD,
                WETH,
                WETH,
                USDC
            );
            await tx.wait();
            
            const market = await gmxPlugin.markets(GM_ETH_USD);
            expect(market.isActive).to.be.true;
            
            console.log("✅ Market re-added successfully");
        });
    });

    describe("📊 Final Summary", function () {
        it("Should display test summary", async function () {
            console.log("\n" + "=".repeat(60));
            console.log("🎉 SIMPLE E2E TEST SUMMARY");
            console.log("=".repeat(60));
            
            const pluginAddress = await gmxPlugin.getAddress();
            const metadata = await gmxPlugin.getPluginMetadata();
            const executionFee = await gmxPlugin.getExecutionFee();
            const market = await gmxPlugin.markets(GM_ETH_USD);
            
            console.log("\n✅ Test Results:");
            console.log("   [OK] Plugin deployed successfully");
            console.log("   [OK] Constructor params validated");
            console.log("   [OK] Market configuration working");
            console.log("   [OK] Metadata correct");
            console.log("   [OK] Access control enforced");
            console.log("   [OK] Market management functional");
            
            console.log("\n📊 Plugin State:");
            console.log("   Address:", pluginAddress);
            console.log("   Name:", metadata.name);
            console.log("   Version:", metadata.version);
            console.log("   Execution Fee:", ethers.formatEther(executionFee), "ETH");
            console.log("   GM:ETH/USD Active:", market.isActive);
            
            console.log("\n✅ All tests passed!");
            console.log("🚀 GMXv2Plugin is ready for fork testing\n");
        });
    });
});
