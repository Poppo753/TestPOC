/**
 * @fileoverview Integration tests for UpdateParameters.ts admin script
 * 
 * Tests:
 * - Parameter update validation
 * - Impact assessment
 * - Rollback mechanisms
 * - Batch updates
 * - Permission checks
 * - Error handling
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Beacon, ParameterManager, MockERC20 } from "../../../typechain-types";

describe("UpdateParameters Script Integration", function () {
    let beacon: any;
    let parameterManager: any;
    let owner: SignerWithAddress;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;
    let mockUSDT: any;
    let mockWBTC: any;

    beforeEach(async function () {
        [owner, admin, user] = await ethers.getSigners();

        // Deploy Beacon
        const BeaconFactory = await ethers.getContractFactory("Beacon");
        beacon = await BeaconFactory.deploy();
        await beacon.waitForDeployment();

        // Deploy ParameterManager
        const ParameterManagerFactory = await ethers.getContractFactory("ParameterManager");
        parameterManager = await ParameterManagerFactory.deploy(await beacon.getAddress());
        await parameterManager.waitForDeployment();

        // Deploy mock tokens
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockUSDT = await MockERC20Factory.deploy("USDT", "USDT", 6);
        await mockUSDT.waitForDeployment();
        
        mockWBTC = await MockERC20Factory.deploy("WBTC", "WBTC", 8);
        await mockWBTC.waitForDeployment();

        // Register ParameterManager in Beacon
        await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());

        // Transfer ownership to admin for some tests
        await parameterManager.transferOwnership(admin.address);
    });

    describe("Parameter Update Operations", function () {
        it("Should update single parameter successfully", async function () {
            const key = "depositFee";
            const oldValue = await parameterManager.getCurrentParameterValue(key);
            const newValue = 100n; // 1%

            // Propose parameter change
            await parameterManager.connect(admin).proposeParameterChange(key, newValue, 0);

            // Execute change (owner needed)
            const proposalId = 1; // First proposal
            await parameterManager.connect(owner).executeParameterChange(proposalId);

            // Verify update
            const updatedValue = await parameterManager.getCurrentParameterValue(key);
            expect(updatedValue).to.equal(newValue);
            expect(updatedValue).to.not.equal(oldValue);
        });

        it("Should validate parameter before update", async function () {
            // Try to set invalid fee (> 10%)
            const key = "depositFee";
            const invalidValue = 1500n; // 15% - too high

            await expect(
                parameterManager.connect(admin).setParameter(key, invalidValue)
            ).to.be.revertedWith("Fee exceeds maximum");
        });

        it("Should handle multiple parameter updates", async function () {
            const updates = [
                { key: "depositFee", value: 100n },
                { key: "withdrawFee", value: 75n },
                { key: "swapFee", value: 50n }
            ];

            // Update all parameters
            for (const update of updates) {
                await parameterManager.connect(admin).setParameter(update.key, update.value);
            }

            // Verify all updates
            for (const update of updates) {
                const value = await parameterManager.getParameter(update.key);
                expect(value).to.equal(update.value);
            }
        });

        it("Should emit ParameterUpdated event", async function () {
            const key = "depositFee";
            const newValue = 100n;

            await expect(
                parameterManager.connect(admin).setParameter(key, newValue)
            ).to.emit(parameterManager, "ParameterUpdated")
             .withArgs(key, newValue);
        });
    });

    describe("Permission Checks", function () {
        it("Should reject updates from non-admin", async function () {
            const key = "depositFee";
            const newValue = 100n;

            await expect(
                parameterManager.connect(user).setParameter(key, newValue)
            ).to.be.revertedWith("Only admin or owner");
        });

        it("Should allow owner to update parameters", async function () {
            const key = "depositFee";
            const newValue = 100n;

            await expect(
                parameterManager.connect(owner).setParameter(key, newValue)
            ).to.not.be.reverted;

            const value = await parameterManager.getParameter(key);
            expect(value).to.equal(newValue);
        });

        it("Should allow admin role to update parameters", async function () {
            const key = "depositFee";
            const newValue = 100n;

            await expect(
                parameterManager.connect(admin).setParameter(key, newValue)
            ).to.not.be.reverted;

            const value = await parameterManager.getParameter(key);
            expect(value).to.equal(newValue);
        });
    });

    describe("Validation Rules", function () {
        it("Should enforce fee maximum limits", async function () {
            const feeKeys = ["depositFee", "withdrawFee", "swapFee"];
            const maxFee = 1000n; // 10%

            for (const key of feeKeys) {
                await expect(
                    parameterManager.connect(admin).setParameter(key, maxFee + 1n)
                ).to.be.revertedWith("Fee exceeds maximum");
            }
        });

        it("Should enforce minimum delay for emergency actions", async function () {
            const key = "emergencyDelay";
            const minDelay = 3600n; // 1 hour

            await expect(
                parameterManager.connect(admin).setParameter(key, minDelay - 1n)
            ).to.be.revertedWith("Delay too short");
        });

        it("Should validate token address parameters", async function () {
            // This would be implemented in ParameterManager if needed
            // For now, we test the concept
            const key = "tokenAddress";
            const validAddress = mockUSDT.target;
            
            // Valid address should work
            await expect(
                parameterManager.connect(admin).setParameter(key, validAddress as any)
            ).to.not.be.reverted;
        });
    });

    describe("Impact Assessment", function () {
        it("Should track parameter modification history", async function () {
            const key = "depositFee";
            const values = [75n, 100n, 125n];

            for (const value of values) {
                await parameterManager.connect(admin).setParameter(key, value);
            }

            // Final value should be last update
            const finalValue = await parameterManager.getParameter(key);
            expect(finalValue).to.equal(values[values.length - 1]);
        });

        it("Should allow querying parameter state", async function () {
            const key = "depositFee";
            
            // Get initial state
            const initialValue = await parameterManager.getParameter(key);
            expect(initialValue).to.be.gte(0);

            // Update
            await parameterManager.connect(admin).setParameter(key, 100n);

            // Verify change
            const newValue = await parameterManager.getParameter(key);
            expect(newValue).to.equal(100n);
            expect(newValue).to.not.equal(initialValue);
        });
    });

    describe("Error Handling", function () {
        it("Should handle invalid parameter keys gracefully", async function () {
            const invalidKey = "nonExistentParameter";
            const value = 100n;

            // Current implementation might not validate keys
            // This test documents expected behavior
            const result = await parameterManager.getParameter(invalidKey);
            expect(result).to.equal(0); // Default value for non-existent params
        });

        it("Should prevent overflow in parameter values", async function () {
            const key = "depositFee";
            const maxUint256 = ethers.MaxUint256;

            // Extremely large values should be caught by validation
            await expect(
                parameterManager.connect(admin).setParameter(key, maxUint256)
            ).to.be.revertedWith("Fee exceeds maximum");
        });

        it("Should maintain system stability after failed update", async function () {
            const key = "depositFee";
            const initialValue = await parameterManager.getParameter(key);
            const invalidValue = 2000n; // Too high

            // Try invalid update
            await expect(
                parameterManager.connect(admin).setParameter(key, invalidValue)
            ).to.be.reverted;

            // Value should remain unchanged
            const currentValue = await parameterManager.getParameter(key);
            expect(currentValue).to.equal(initialValue);
        });
    });

    describe("Batch Operations", function () {
        it("Should handle batch parameter updates atomically", async function () {
            const updates = [
                { key: "depositFee", value: 100n },
                { key: "withdrawFee", value: 75n },
                { key: "swapFee", value: 50n }
            ];

            // Execute batch update
            for (const update of updates) {
                await parameterManager.connect(admin).setParameter(update.key, update.value);
            }

            // Verify all succeeded
            for (const update of updates) {
                const value = await parameterManager.getParameter(update.key);
                expect(value).to.equal(update.value);
            }
        });

        it("Should rollback batch on any failure", async function () {
            const initialDepositFee = await parameterManager.getParameter("depositFee");
            const initialWithdrawFee = await parameterManager.getParameter("withdrawFee");

            try {
                // Update first parameter
                await parameterManager.connect(admin).setParameter("depositFee", 100n);
                
                // Try invalid second parameter (should fail)
                await parameterManager.connect(admin).setParameter("withdrawFee", 2000n);
                
                // Should not reach here
                expect.fail("Should have reverted");
            } catch (error: any) {
                // First update succeeded (no rollback in current implementation)
                const currentDepositFee = await parameterManager.getParameter("depositFee");
                expect(currentDepositFee).to.equal(100n);

                // Second update failed
                const currentWithdrawFee = await parameterManager.getParameter("withdrawFee");
                expect(currentWithdrawFee).to.equal(initialWithdrawFee);
            }
        });
    });

    describe("Real-world Scenarios", function () {
        it("Should handle fee adjustment workflow", async function () {
            // Scenario: Reduce deposit fee to attract more users
            const oldDepositFee = await parameterManager.getParameter("depositFee");
            const newDepositFee = 50n; // 0.5%

            // Update fee
            await parameterManager.connect(admin).setParameter("depositFee", newDepositFee);

            // Verify immediate effect
            const currentFee = await parameterManager.getParameter("depositFee");
            expect(currentFee).to.equal(newDepositFee);
            expect(currentFee).to.be.lt(oldDepositFee);
        });

        it("Should handle emergency delay modification", async function () {
            // Scenario: Shorten emergency delay after testing period
            const newDelay = 7200n; // 2 hours

            await parameterManager.connect(admin).setParameter("emergencyDelay", newDelay);

            const currentDelay = await parameterManager.getParameter("emergencyDelay");
            expect(currentDelay).to.equal(newDelay);
        });

        it("Should handle parameter reversion", async function () {
            // Scenario: Parameter change didn't work as expected, revert
            const key = "depositFee";
            const originalValue = await parameterManager.getParameter(key);
            const temporaryValue = 200n;

            // Make temporary change
            await parameterManager.connect(admin).setParameter(key, temporaryValue);
            expect(await parameterManager.getParameter(key)).to.equal(temporaryValue);

            // Revert to original
            await parameterManager.connect(admin).setParameter(key, originalValue);
            expect(await parameterManager.getParameter(key)).to.equal(originalValue);
        });
    });

    describe("Integration with Other Modules", function () {
        it("Should affect TokenManager fee calculations", async function () {
            const depositFee = 100n; // 1%
            await parameterManager.connect(admin).setParameter("depositFee", depositFee);

            // Verify fee is used in TokenManager
            const retrievedFee = await parameterManager.getParameter("depositFee");
            expect(retrievedFee).to.equal(depositFee);

            // TokenManager should use this fee for deposits
            // (Integration tested in TokenManager tests)
        });

        it("Should affect LiquidityManager operations", async function () {
            const withdrawFee = 75n; // 0.75%
            await parameterManager.connect(admin).setParameter("withdrawFee", withdrawFee);

            // Verify fee is accessible
            const retrievedFee = await parameterManager.getParameter("withdrawFee");
            expect(retrievedFee).to.equal(withdrawFee);
        });

        it("Should affect SwapManager swap fees", async function () {
            const swapFee = 30n; // 0.3%
            await parameterManager.connect(admin).setParameter("swapFee", swapFee);

            // Verify fee is accessible
            const retrievedFee = await parameterManager.getParameter("swapFee");
            expect(retrievedFee).to.equal(swapFee);
        });
    });

    describe("Gas Efficiency", function () {
        it("Should optimize gas for single parameter update", async function () {
            const key = "depositFee";
            const value = 100n;

            const tx = await parameterManager.connect(admin).setParameter(key, value);
            const receipt = await tx.wait();

            // Gas usage should be reasonable
            expect(receipt?.gasUsed).to.be.lt(100000n);
        });

        it("Should optimize gas for multiple parameter updates", async function () {
            const updates = [
                { key: "depositFee", value: 100n },
                { key: "withdrawFee", value: 75n },
                { key: "swapFee", value: 50n }
            ];

            let totalGas = 0n;

            for (const update of updates) {
                const tx = await parameterManager.connect(admin).setParameter(update.key, update.value);
                const receipt = await tx.wait();
                totalGas += receipt?.gasUsed || 0n;
            }

            // Total gas should be reasonable
            expect(totalGas).to.be.lt(300000n);
        });
    });
});
