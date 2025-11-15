import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * UNISWAPV3PLUGIN UNIT TESTS
 * 
 * Tests the UniswapV3Plugin wrapper around deployed SimpleSwap
 */
describe("UniswapV3Plugin", function () {
    
    async function deployFixture() {
        const [owner, user] = await ethers.getSigners();
        
        // Deploy MockSimpleSwap (simulates deployed SimpleSwap)
        const MockSimpleSwap = await ethers.getContractFactory("MockSimpleSwap");
        const simpleSwap = await MockSimpleSwap.deploy();
        await simpleSwap.waitForDeployment();
        
        // Deploy UniswapV3Plugin (wrapper)
        const UniswapV3Plugin = await ethers.getContractFactory("UniswapV3Plugin");
        const plugin = await UniswapV3Plugin.deploy(await simpleSwap.getAddress());
        await plugin.waitForDeployment();
        
        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
        const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
        await weth.waitForDeployment();
        await usdc.waitForDeployment();
        
        // Setup SimpleSwap with expected output
        await simpleSwap.setExpectedOutput(
            await weth.getAddress(),
            await usdc.getAddress(),
            2000n * 10n**6n // 2000 USDC per WETH
        );
        
        // Mint tokens
        await weth.mint(owner.address, ethers.parseEther("10"));
        await usdc.mint(await simpleSwap.getAddress(), 50000n * 10n**6n);
        
        return {
            plugin,
            simpleSwap,
            weth,
            usdc,
            owner,
            user
        };
    }
    
    describe("Deployment", function () {
        
        it("Should deploy with correct simpleSwap address", async function () {
            const { plugin, simpleSwap } = await deployFixture();
            
            expect(await plugin.simpleSwap()).to.equal(await simpleSwap.getAddress());
        });
        
        it("Should revert if simpleSwap is zero address", async function () {
            const UniswapV3Plugin = await ethers.getContractFactory("UniswapV3Plugin");
            
            await expect(
                UniswapV3Plugin.deploy(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(UniswapV3Plugin, "InvalidSimpleSwapAddress");
        });
    });
    
    describe("ISwapPlugin Metadata", function () {
        
        it("Should return correct protocol info", async function () {
            const { plugin } = await deployFixture();
            
            const info = await plugin.getProtocolInfo();
            
            expect(info.name).to.equal("Uniswap V3");
            expect(info.version).to.equal("1.0.0");
            expect(info.features).to.equal(3); // BASIC_SWAP | MULTI_HOP
            
            console.log("\n📊 Protocol Info:");
            console.log(`   Name: ${info.name}`);
            console.log(`   Version: ${info.version}`);
            console.log(`   Features: ${info.features} (BASIC_SWAP | MULTI_HOP)`);
        });
        
        it("Should support all token pairs", async function () {
            const { plugin, weth, usdc } = await deployFixture();
            
            const supported = await plugin.supportsTokenPair(
                await weth.getAddress(),
                await usdc.getAddress()
            );
            
            expect(supported).to.be.true;
            console.log("✅ Supports WETH/USDC pair");
        });
        
        it("Should report healthy status", async function () {
            const { plugin } = await deployFixture();
            
            const [healthy, reason] = await plugin.isHealthy();
            
            expect(healthy).to.be.true;
            expect(reason).to.equal("");
            console.log("✅ Plugin is healthy");
        });
    });
    
    describe("ISimpleSwap Delegation", function () {
        
        it("Should delegate getExpectedOutput to SimpleSwap", async function () {
            const { plugin, weth, usdc } = await deployFixture();
            
            const expectedOutput = await plugin.getExpectedOutput(
                await weth.getAddress(),
                await usdc.getAddress(),
                ethers.parseEther("1")
            );
            
            expect(expectedOutput).to.equal(2000n * 10n**6n); // 2000 USDC
            console.log(`\n💰 Expected output: ${ethers.formatUnits(expectedOutput, 6)} USDC`);
        });
        
        it("Should execute inputSwap via SimpleSwap", async function () {
            const { plugin, weth, usdc, owner } = await deployFixture();
            
            const amountIn = ethers.parseEther("1"); // 1 WETH
            
            // Approve plugin to spend WETH
            await weth.approve(await plugin.getAddress(), amountIn);
            
            // Check initial balances
            const initialWETH = await weth.balanceOf(owner.address);
            const initialUSDC = await usdc.balanceOf(owner.address);
            
            console.log("\n📊 Initial Balances:");
            console.log(`   Owner WETH: ${ethers.formatEther(initialWETH)}`);
            console.log(`   Owner USDC: ${ethers.formatUnits(initialUSDC, 6)}`);
            
            // Execute swap
            const tx = await plugin.inputSwap(
                await weth.getAddress(),
                await usdc.getAddress(),
                amountIn
            );
            
            const receipt = await tx.wait();
            
            // Check final balances
            const finalWETH = await weth.balanceOf(owner.address);
            const finalUSDC = await usdc.balanceOf(owner.address);
            
            console.log("\n📊 Final Balances:");
            console.log(`   Owner WETH: ${ethers.formatEther(finalWETH)}`);
            console.log(`   Owner USDC: ${ethers.formatUnits(finalUSDC, 6)}`);
            
            // Verify swap executed
            expect(finalWETH).to.equal(initialWETH - amountIn);
            expect(finalUSDC).to.equal(initialUSDC + 2000n * 10n**6n);
            
            console.log("\n✅ Swap executed successfully via UniswapV3Plugin");
        });
        
        it("Should revert on invalid inputs", async function () {
            const { plugin, weth, usdc } = await deployFixture();
            
            // Zero address tokenIn
            await expect(
                plugin.inputSwap(ethers.ZeroAddress, await usdc.getAddress(), 1000)
            ).to.be.revertedWith("Invalid spendToken");
            
            // Zero address tokenOut
            await expect(
                plugin.inputSwap(await weth.getAddress(), ethers.ZeroAddress, 1000)
            ).to.be.revertedWith("Invalid receiveToken");
            
            // Zero amount
            await expect(
                plugin.inputSwap(await weth.getAddress(), await usdc.getAddress(), 0)
            ).to.be.revertedWith("Invalid amountIn");
            
            // Same token
            await expect(
                plugin.inputSwap(await weth.getAddress(), await weth.getAddress(), 1000)
            ).to.be.revertedWith("Same token");
            
            console.log("✅ All input validations work correctly");
        });
    });
    
    describe("Integration with SwapManager", function () {
        
        it("Should work when registered in Beacon", async function () {
            const { plugin, weth, usdc, owner } = await deployFixture();
            
            // Deploy Beacon
            const Beacon = await ethers.getContractFactory("Beacon");
            const beacon = await Beacon.deploy();
            await beacon.waitForDeployment();
            
            // Register plugin in Beacon
            await beacon.updateImplementation("UniswapV3Plugin", await plugin.getAddress());
            
            // Verify registration
            const registeredAddress = await beacon.getImplementation("UniswapV3Plugin");
            expect(registeredAddress).to.equal(await plugin.getAddress());
            
            console.log("\n✅ UniswapV3Plugin registered in Beacon");
            console.log(`   Name: UniswapV3Plugin`);
            console.log(`   Address: ${registeredAddress}`);
        });
    });
    
    describe("Gas Benchmarking", function () {
        
        it("Should measure gas cost for inputSwap", async function () {
            const { plugin, weth, usdc, owner } = await deployFixture();
            
            const amountIn = ethers.parseEther("1");
            await weth.approve(await plugin.getAddress(), amountIn);
            
            const tx = await plugin.inputSwap(
                await weth.getAddress(),
                await usdc.getAddress(),
                amountIn
            );
            
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed;
            
            console.log(`\n⛽ Gas Used: ${gasUsed.toString()}`);
            expect(gasUsed).to.be.lt(300000); // Should be < 300k gas
        });
    });
});
