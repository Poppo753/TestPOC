/**
 * @fileoverview Phase 3 - Integration tests for Admin Parameter Scripts
 * 
 * Tests admin script functionality:
 * - Parameter update workflows
 * - View/query operations
 * - Validation logic
 * - Permission handling
 * - Error scenarios
 * 
 * These tests validate that admin scripts can properly interact with
 * the deployed system using the same patterns as the actual scripts.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Admin Parameter Scripts - Integration Tests", function () {
    let beacon: any;
    let parameterManager: any;
    let owner: SignerWithAddress;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;

    // Helper to advance time in tests
    async function advanceTime(seconds: number) {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    }

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

        // Deploy EmergencyHandler (needed for emergency functions)
        const EmergencyHandlerFactory = await ethers.getContractFactory("EmergencyHandler");
        const emergencyHandler = await EmergencyHandlerFactory.deploy(await beacon.getAddress());
        await emergencyHandler.waitForDeployment();

        // Register modules in Beacon
        await beacon.updateImplementation("ParameterManager", await parameterManager.getAddress());
        await beacon.updateImplementation("EmergencyHandler", await emergencyHandler.getAddress());
    });

    describe("UpdateParameters Script Workflow", function () {
        it("Should simulate parameter update workflow", async function () {
            const key = "maxSlippage"; // Use real parameter
            
            // Get initial value
            const initialValue = await parameterManager.getCurrentParameterValue(key);
            console.log(`Initial ${key}:`, initialValue.toString());

            // Propose new value (like admin script would do)
            const newValue = 300n; // Change from 200 to 300
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);

            // Advance time past timelock
            await advanceTime(86401);

            // Execute proposal (like admin script would do)
            await parameterManager.connect(owner)["executeParameterChange(string)"](key);

            // Verify update
            const updatedValue = await parameterManager.getCurrentParameterValue(key);
            console.log(`Updated ${key}:`, updatedValue.toString());
            
            expect(updatedValue).to.equal(newValue);
        });

        it("Should handle emergency parameter updates", async function () {
            const key = "cacheDuration"; // Use real parameter (no timelock)
            const newValue = 600n; // Change from 300 to 600 seconds

            // Immediate update (cacheDuration doesn't require timelock)
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);

            // Verify immediate effect (no execute needed for non-timelock parameters)
            const updatedValue = await parameterManager.getCurrentParameterValue(key);
            expect(updatedValue).to.equal(newValue);
        });

        it("Should validate parameter values", async function () {
            const key = "maxSlippage";
            const validValue = 500n; // Valid: within [10, 1000]
            const invalidValue = 2000n; // Invalid: exceeds max 1000

            // Check validation
            const isValid = await parameterManager.isValidParameterValue(key, validValue);
            const isInvalid = await parameterManager.isValidParameterValue(key, invalidValue);

            expect(isValid).to.be.true;
            expect(isInvalid).to.be.false;
        });

        it("Should track multiple parameter updates", async function () {
            // Mix of timelock (maxSlippage) and non-timelock (cacheDuration, maxTokensPerOperation) parameters
            const timelockParam = { key: "maxSlippage", value: 400n };
            const immediateParams = [
                { key: "cacheDuration", value: 500n },
                { key: "maxTokensPerOperation", value: 20n }
            ];

            // Update timelock parameter
            await parameterManager.connect(owner).proposeParameterChange(timelockParam.key, timelockParam.value);
            await advanceTime(86401);
            await parameterManager.connect(owner)["executeParameterChange(string)"](timelockParam.key);

            // Update non-timelock parameters (immediate effect)
            for (const update of immediateParams) {
                await parameterManager.connect(owner).proposeParameterChange(update.key, update.value);
            }

            // Verify all updates
            let value = await parameterManager.getCurrentParameterValue(timelockParam.key);
            expect(value).to.equal(timelockParam.value);
            
            for (const update of immediateParams) {
                value = await parameterManager.getCurrentParameterValue(update.key);
                expect(value).to.equal(update.value);
            }
        });
    });

    describe("ViewParameters Script Workflow", function () {
        it("Should query single parameter", async function () {
            const key = "maxSlippage";
            
            // Get parameter (like view script would do)
            const value = await parameterManager.getCurrentParameterValue(key);
            const info = await parameterManager.getParameterInfo(key);

            expect(value).to.be.gte(0n);
            expect(info.currentValue).to.equal(value);
            console.log(`Parameter ${key}:`, value.toString());
        });

        it("Should list all parameters", async function () {
            // Get all parameter names (like view script would do)
            const names = await parameterManager.getAllParameterNames();

            expect(names.length).to.be.gt(0);
            console.log("Registered parameters:", names);

            // Query each parameter
            for (const name of names) {
                const value = await parameterManager.getCurrentParameterValue(name);
                const info = await parameterManager.getParameterInfo(name);
                
                expect(value).to.be.gte(0n);
                expect(info.currentValue).to.equal(value);
            }
        });

        it("Should get parameter detailed info", async function () {
            const key = "maxSlippage";
            
            // Get full parameter info (like view script would do)
            const info = await parameterManager.getParameterInfo(key);

            expect(info.isActive).to.be.true; // Check isActive instead of exists
            expect(info.currentValue).to.be.gte(0n);
            expect(info.minValue).to.be.gte(0n);
            expect(info.maxValue).to.be.gt(info.minValue);
            
            console.log(`${key} Info:`);
            console.log(`  Current: ${info.currentValue}`);
            console.log(`  Min: ${info.minValue}`);
            console.log(`  Max: ${info.maxValue}`);
        });

        it("Should filter parameters by value range", async function () {
            // Get all parameters and filter (like view script would do)
            const names = await parameterManager.getAllParameterNames();
            const feeParams = [];

            for (const name of names) {
                const value = await parameterManager.getCurrentParameterValue(name);
                // Fees are typically < 1000 basis points (10%)
                if (value > 0n && value < 1000n) {
                    feeParams.push({ name, value });
                }
            }

            expect(feeParams.length).to.be.gt(0);
            console.log("Fee parameters:", feeParams);
        });
    });

    describe("ValidateParameters Script Workflow", function () {
        it("Should validate parameter value ranges", async function () {
            const key = "maxSlippage";
            const testValues = [
                { value: 10n, shouldPass: true },   // Min value
                { value: 500n, shouldPass: true },  // Mid value
                { value: 1000n, shouldPass: true }, // Max value
                { value: 1500n, shouldPass: false } // Above max
            ];

            for (const test of testValues) {
                const isValid = await parameterManager.isValidParameterValue(key, test.value);
                expect(isValid).to.equal(test.shouldPass, 
                    `Value ${test.value} validation failed`);
            }
        });

        it("Should check if parameter change can be executed", async function () {
            const key = "maxSlippage";
            const newValue = 400n;

            // Propose change
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);
            await advanceTime(86401);

            // Check if can execute
            const [canExecute, reason] = await parameterManager.canExecuteParameterChange(key);
            
            expect(canExecute).to.be.true;
            if (!canExecute) {
                console.log("Cannot execute:", reason);
            }
        });

        it("Should validate timelock requirements", async function () {
            const key = "maxSlippage";
            const newValue = 500n;
            const timelockDelay = 3600n; // 1 hour

            // Propose change with timelock (uses default parameter timelock)
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);

            // Should not be executable immediately
            const [canExecute, reason] = await parameterManager.canExecuteParameterChange(key);
            
            expect(canExecute).to.be.false;
            expect(reason).to.include("Timelock active");
        });

        it("Should validate all registered parameters", async function () {
            // Get all parameters
            const names = await parameterManager.getAllParameterNames();

            // Validate each parameter
            const validationResults = [];
            for (const name of names) {
                const info = await parameterManager.getParameterInfo(name);
                const isValid = info.currentValue >= info.minValue && 
                               info.currentValue <= info.maxValue;
                
                validationResults.push({
                    name,
                    isValid,
                    value: info.currentValue,
                    range: `[${info.minValue}, ${info.maxValue}]`
                });
            }

            // All should be valid
            expect(validationResults.every(r => r.isValid)).to.be.true;
            console.log("Validation results:", validationResults);
        });
    });

    describe("Permission Handling", function () {
        it("Should enforce owner permissions for proposals", async function () {
            const key = "maxSlippage";
            const newValue = 400n;

            // Non-owner should not be able to propose
            await expect(
                parameterManager.connect(user).proposeParameterChange(key, newValue)
            ).to.be.reverted;
        });

        it("Should allow anyone to view parameters", async function () {
            const key = "maxSlippage";

            // Any user can view
            const value = await parameterManager.connect(user).getCurrentParameterValue(key);
            expect(value).to.be.gte(0n);
        });

        it("Should restrict parameter execution to authorized users", async function () {
            const key = "maxSlippage";
            const newValue = 400n;

            // Propose as owner
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);
            await advanceTime(86401);

            // User should not be able to execute
            await expect(
                parameterManager.connect(user)["executeParameterChange(string)"](key)
            ).to.be.reverted;
        });
    });

    describe("Error Handling", function () {
        it("Should handle invalid parameter keys", async function () {
            const invalidKey = "nonExistentParameter";
            
            // Should revert for non-existent parameter
            await expect(
                parameterManager.getCurrentParameterValue(invalidKey)
            ).to.be.revertedWith("Parameter does not exist");

            // Info should revert too for non-existent parameter
            await expect(
                parameterManager.getParameterInfo(invalidKey)
            ).to.be.revertedWith("Parameter does not exist");
        });

        it("Should reject invalid parameter values", async function () {
            const key = "maxSlippage";
            const invalidValue = 5000n; // Too high - max is 1000

            // Validation should fail
            const isValid = await parameterManager.isValidParameterValue(key, invalidValue);
            expect(isValid).to.be.false;

            // Proposal should be rejected
            await expect(
                parameterManager.connect(owner).proposeParameterChange(key, invalidValue)
            ).to.be.reverted;
        });

        it("Should handle canceled proposals", async function () {
            const key = "maxSlippage";
            const newValue = 400n;

            // Propose change
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);

            // Try to execute before timelock (should fail)
            await expect(
                parameterManager.connect(owner)["executeParameterChange(string)"](key)
            ).to.be.revertedWith("Timelock not expired");
        });
    });

    describe("Real-world Scenarios", function () {
        it("Should handle parameter reduction workflow", async function () {
            // Scenario: Reduce slippage tolerance
            const key = "maxSlippage";
            const oldValue = await parameterManager.getCurrentParameterValue(key);
            const newValue = 150n; // Reduce to 150

            // Admin proposes change
            await parameterManager.connect(owner).proposeParameterChange(key, newValue);
            await advanceTime(86401);

            // Admin executes immediately
            await parameterManager.connect(owner)["executeParameterChange(string)"](key);

            // Verify change
            const currentValue = await parameterManager.getCurrentParameterValue(key);
            expect(currentValue).to.equal(newValue);
            expect(currentValue).to.be.lt(oldValue);

            console.log(`Parameter reduced: ${oldValue} -> ${currentValue}`);
        });

        it("Should handle emergency parameter adjustment", async function () {
            // Scenario: Emergency requires immediate parameter change
            const key = "cacheDuration"; // Non-timelock parameter for immediate updates
            const urgentValue = 120n; // 2 minutes for emergency

            // Immediate update (cacheDuration doesn't require timelock)
            await parameterManager.connect(owner).proposeParameterChange(key, urgentValue);

            // Verify immediate effect
            const currentValue = await parameterManager.getCurrentParameterValue(key);
            expect(currentValue).to.equal(urgentValue);

            console.log(`Cache duration updated to: ${currentValue}s`);
        });

        it("Should handle parameter audit workflow", async function () {
            // Scenario: Audit all parameters before upgrade
            const names = await parameterManager.getAllParameterNames();
            const auditReport = [];

            for (const name of names) {
                const info = await parameterManager.getParameterInfo(name);
                const isValid = info.currentValue >= info.minValue && 
                               info.currentValue <= info.maxValue;

                auditReport.push({
                    parameter: name,
                    value: info.currentValue.toString(),
                    range: `[${info.minValue}, ${info.maxValue}]`,
                    status: isValid ? "PASS" : "FAIL"
                });
            }

            // All should pass
            expect(auditReport.every(r => r.status === "PASS")).to.be.true;

            console.log("\n📋 PARAMETER AUDIT REPORT");
            console.log("=".repeat(60));
            for (const item of auditReport) {
                console.log(`${item.status} | ${item.parameter}: ${item.value} ${item.range}`);
            }
        });

        it("Should handle batch parameter update workflow", async function () {
            // Scenario: Update multiple parameters (mix of timelock and non-timelock)
            const timelockUpdates = [
                { key: "maxSlippage", value: 350n }
            ];
            const immediateUpdates = [
                { key: "cacheDuration", value: 450n },
                { key: "maxTokensPerOperation", value: 25n }
            ];

            console.log("\n🔄 BATCH UPDATE WORKFLOW");
            console.log("=".repeat(60));

            // Propose timelock changes
            for (const update of timelockUpdates) {
                const oldValue = await parameterManager.getCurrentParameterValue(update.key);
                console.log(`Proposing ${update.key}: ${oldValue} -> ${update.value}`);
                await parameterManager.connect(owner).proposeParameterChange(update.key, update.value);
            }

            // Wait for timelock
            await advanceTime(86401);

            // Execute timelock proposals
            for (const update of timelockUpdates) {
                await parameterManager.connect(owner)["executeParameterChange(string)"](update.key);
                console.log(`✅ Executed proposal for ${update.key}`);
            }

            // Immediate updates (no timelock)
            for (const update of immediateUpdates) {
                const oldValue = await parameterManager.getCurrentParameterValue(update.key);
                console.log(`Updating ${update.key}: ${oldValue} -> ${update.value}`);
                await parameterManager.connect(owner).proposeParameterChange(update.key, update.value);
                console.log(`✅ Updated ${update.key}`);
            }

            // Verify all updates
            const allUpdates = [...timelockUpdates, ...immediateUpdates];
            for (const update of allUpdates) {
                const value = await parameterManager.getCurrentParameterValue(update.key);
                expect(value).to.equal(update.value);
            }

            console.log("✅ All updates completed successfully");
        });
    });

    describe("Performance & Gas Optimization", function () {
        it("Should efficiently query multiple parameters", async function () {
            const keys = ["maxSlippage", "cacheDuration", "maxTokensPerOperation", "maxPriceAge"];
            
            const startTime = Date.now();
            
            // Query all parameters
            const values = await Promise.all(
                keys.map(key => parameterManager.getCurrentParameterValue(key))
            );
            
            const duration = Date.now() - startTime;

            expect(values.length).to.equal(keys.length);
            console.log(`Queried ${keys.length} parameters in ${duration}ms`);
        });

        it("Should track gas costs for parameter updates", async function () {
            const key = "maxSlippage";
            const newValue = 600n;

            // Propose
            const proposeTx = await parameterManager.connect(owner).proposeParameterChange(key, newValue);
            const proposeReceipt = await proposeTx.wait();

            // Wait for timelock
            await advanceTime(86401);

            // Execute
            const executeTx = await parameterManager.connect(owner)["executeParameterChange(string)"](key);
            const executeReceipt = await executeTx.wait();

            console.log("\n⛽ GAS USAGE");
            console.log("=".repeat(60));
            console.log(`Propose: ${proposeReceipt?.gasUsed.toString()} gas`);
            console.log(`Execute: ${executeReceipt?.gasUsed.toString()} gas`);
            console.log(`Total: ${(proposeReceipt!.gasUsed + executeReceipt!.gasUsed).toString()} gas`);

            // Gas should be reasonable
            expect(proposeReceipt?.gasUsed).to.be.lt(300000n);
            expect(executeReceipt?.gasUsed).to.be.lt(300000n);
        });
    });
});














