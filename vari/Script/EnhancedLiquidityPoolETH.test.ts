import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EnhancedLiquidityPoolETH } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EnhancedLiquidityPoolETH Parameter Updates", function () {
    let liquidityPool: EnhancedLiquidityPoolETH;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    const TIMELOCK_DURATION = 2 * 24 * 60 * 60; // 2 days in seconds

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        
        // Replace this address with your actual deployed contract address
        const DEPLOYED_CONTRACT_ADDRESS = process.env.EthResVaultAdress!;
        
        // Get instance of already deployed contract
        liquidityPool = await ethers.getContractAt(
            "EnhancedLiquidityPoolETH",
            DEPLOYED_CONTRACT_ADDRESS
        ) as EnhancedLiquidityPoolETH;
    });
    
    

    describe("Access Control", function() {
        it("Should only allow owner to propose updates", async function() {
            const newValue = ethers.parseEther("150");
            await expect(
                liquidityPool.connect(user).proposeParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to cancel updates", async function() {
            const newValue = ethers.parseEther("150");
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            
            await expect(
                liquidityPool.connect(user).cancelParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to execute updates", async function() {
            const newValue = ethers.parseEther("150");
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            await time.increase(TIMELOCK_DURATION);
            
            await expect(
                liquidityPool.connect(user).executeParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Parameter Validation", function() {
        it("Should reject invalid parameter names", async function() {
            const newValue = ethers.parseEther("150");
            await expect(
                liquidityPool.proposeParameterUpdate("invalidParameter", newValue)
            ).to.be.revertedWith("Invalid parameter or value");
        });

        it("Should reject invalid parameter values", async function() {
            // Try to set maxSlippage too high
            await expect(
                liquidityPool.proposeParameterUpdate("maxSlippage", 5001)
            ).to.be.revertedWith("Invalid parameter or value");

            // Try to set maxDeposit to zero
            await expect(
                liquidityPool.proposeParameterUpdate("maxDeposit", 0)
            ).to.be.revertedWith("Invalid parameter or value");
        });
    });

    describe("Timelock Functionality", function() {
        it("Should enforce timelock duration", async function() {
            const newValue = ethers.parseEther("150");
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            
            // Try to execute immediately
            await expect(
                liquidityPool.executeParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Timelock not expired");

            // Try to execute just before timelock expires
            await time.increase(TIMELOCK_DURATION - 60);
            await expect(
                liquidityPool.executeParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Timelock not expired");

            // Should succeed after timelock
            await time.increase(60);
            await expect(
                liquidityPool.executeParameterUpdate("maxDeposit", newValue)
            ).to.not.be.reverted;
        });
    });

    describe("Update Management", function() {
        it("Should handle multiple pending updates", async function() {
            const updates = {
                maxDeposit: ethers.parseEther("150"),
                maxWithdrawPerTx: ethers.parseEther("75"),
                maxSlippage: 150n
            };

            // Propose multiple updates
            for (const [param, value] of Object.entries(updates)) {
                await liquidityPool.proposeParameterUpdate(param, value);
                
                // Verify pending update exists
                const [exists] = await liquidityPool.getPendingUpdate(param, value);
                expect(exists).to.be.true;
            }
        });

        it("Should prevent duplicate pending updates", async function() {
            const newValue = ethers.parseEther("150");
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            
            await expect(
                liquidityPool.proposeParameterUpdate("maxDeposit", newValue)
            ).to.be.revertedWith("Update already pending");
        });

        it("Should allow cancellation of pending updates", async function() {
            const newValue = ethers.parseEther("150");
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            
            // Cancel the update
            await liquidityPool.cancelParameterUpdate("maxDeposit", newValue);
            
            // Verify update no longer exists
            const [exists] = await liquidityPool.getPendingUpdate("maxDeposit", newValue);
            expect(exists).to.be.false;
        });
    });

    describe("Event Emissions", function() {
        it("Should emit correct events for the full update lifecycle", async function() {
            const newValue = ethers.parseEther("150");
            const oldValue = await liquidityPool.maxDeposit();

            // Propose
            await expect(liquidityPool.proposeParameterUpdate("maxDeposit", newValue))
                .to.emit(liquidityPool, "ParameterUpdateProposed")
                .withArgs("maxDeposit", newValue, await time.latest() + TIMELOCK_DURATION, owner.address);

            // Cancel
            await expect(liquidityPool.cancelParameterUpdate("maxDeposit", newValue))
                .to.emit(liquidityPool, "ParameterUpdateCancelled")
                .withArgs("maxDeposit", newValue, owner.address, await time.latest());

            // Propose again and execute
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            await time.increase(TIMELOCK_DURATION);
            
            await expect(liquidityPool.executeParameterUpdate("maxDeposit", newValue))
                .to.emit(liquidityPool, "ParameterUpdated")
                .withArgs("maxDeposit", oldValue, newValue, await time.latest(), owner.address);
        });
    });

    describe("State Changes", function() {
        it("Should correctly update and restore parameter values", async function() {
            // Store original value
            const originalValue = await liquidityPool.maxDeposit();
            const newValue = ethers.parseEther("150");

            // Update value
            await liquidityPool.proposeParameterUpdate("maxDeposit", newValue);
            await time.increase(TIMELOCK_DURATION);
            await liquidityPool.executeParameterUpdate("maxDeposit", newValue);
            
            // Verify update
            expect(await liquidityPool.maxDeposit()).to.equal(newValue);

            // Restore original value
            await liquidityPool.proposeParameterUpdate("maxDeposit", originalValue);
            await time.increase(TIMELOCK_DURATION);
            await liquidityPool.executeParameterUpdate("maxDeposit", originalValue);
            
            // Verify restoration
            expect(await liquidityPool.maxDeposit()).to.equal(originalValue);
        });
    });
});
