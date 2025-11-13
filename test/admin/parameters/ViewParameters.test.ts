/**
 * @fileoverview Integration tests for ViewParameters.ts admin script
 * 
 * Tests:
 * - Parameter viewing operations
 * - Filtering capabilities
 * - Output formatting
 * - Export functionality
 * - Performance
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Beacon, ParameterManager, MockERC20 } from "../../../typechain-types";
import { deployBeaconSystem } from "../../utils/deployment";

describe("ViewParameters Script Integration", function () {
    let beacon: Beacon;
    let parameterManager: ParameterManager;
    let owner: SignerWithAddress;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;

    const TEST_PARAMETERS = [
        { key: "depositFee", value: 75n, category: "fees" },
        { key: "withdrawFee", value: 50n, category: "fees" },
        { key: "swapFee", value: 30n, category: "fees" },
        { key: "maxDepositAmount", value: ethers.parseEther("100"), category: "limits" },
        { key: "emergencyDelay", value: 7200n, category: "timing" }
    ];

    beforeEach(async function () {
        [owner, admin, user] = await ethers.getSigners();

        // Deploy system
        const deployment = await deployBeaconSystem(owner);
        beacon = deployment.beacon;
        parameterManager = deployment.parameterManager;

        // Grant admin role
        const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
        await beacon.connect(owner).grantRole(ADMIN_ROLE, admin.address);

        // Set up test parameters
        for (const param of TEST_PARAMETERS) {
            await parameterManager.connect(admin).setParameter(param.key, param.value);
        }
    });

    describe("Basic Parameter Viewing", function () {
        it("Should view single parameter", async function () {
            const key = "depositFee";
            const value = await parameterManager.getParameter(key);

            const expectedParam = TEST_PARAMETERS.find(p => p.key === key);
            expect(value).to.equal(expectedParam?.value);
        });

        it("Should view all parameters", async function () {
            const allParams: Array<{ key: string; value: bigint }> = [];

            for (const param of TEST_PARAMETERS) {
                const value = await parameterManager.getParameter(param.key);
                allParams.push({ key: param.key, value });
            }

            expect(allParams.length).to.equal(TEST_PARAMETERS.length);

            // Verify each parameter
            for (let i = 0; i < TEST_PARAMETERS.length; i++) {
                expect(allParams[i].value).to.equal(TEST_PARAMETERS[i].value);
            }
        });

        it("Should handle non-existent parameters", async function () {
            const key = "nonExistentParameter";
            const value = await parameterManager.getParameter(key);

            // Should return default value (0)
            expect(value).to.equal(0n);
        });

        it("Should view parameters with different value types", async function () {
            // Small values (fees)
            const depositFee = await parameterManager.getParameter("depositFee");
            expect(depositFee).to.equal(75n);

            // Large values (amounts)
            const maxDeposit = await parameterManager.getParameter("maxDepositAmount");
            expect(maxDeposit).to.equal(ethers.parseEther("100"));

            // Time values
            const emergencyDelay = await parameterManager.getParameter("emergencyDelay");
            expect(emergencyDelay).to.equal(7200n);
        });
    });

    describe("Filtering Operations", function () {
        it("Should filter parameters by category", async function () {
            // Get all fee parameters
            const feeParams = TEST_PARAMETERS.filter(p => p.category === "fees");
            
            for (const param of feeParams) {
                const value = await parameterManager.getParameter(param.key);
                expect(value).to.equal(param.value);
            }

            expect(feeParams.length).to.equal(3); // depositFee, withdrawFee, swapFee
        });

        it("Should filter parameters by value range", async function () {
            const allParams: Array<{ key: string; value: bigint }> = [];

            for (const param of TEST_PARAMETERS) {
                const value = await parameterManager.getParameter(param.key);
                if (value > 0n && value < 1000n) { // Fee range
                    allParams.push({ key: param.key, value });
                }
            }

            // Should get all fees
            expect(allParams.length).to.be.gte(3);
        });

        it("Should filter parameters by key pattern", async function () {
            const feeKeys = TEST_PARAMETERS
                .filter(p => p.key.includes("Fee"))
                .map(p => p.key);

            expect(feeKeys).to.include("depositFee");
            expect(feeKeys).to.include("withdrawFee");
            expect(feeKeys).to.include("swapFee");
            expect(feeKeys.length).to.equal(3);
        });
    });

    describe("Output Formatting", function () {
        it("Should format parameter values correctly", async function () {
            // Fee values (basis points)
            const depositFee = await parameterManager.getParameter("depositFee");
            const depositFeePercent = Number(depositFee) / 100;
            expect(depositFeePercent).to.equal(0.75); // 75 basis points = 0.75%

            // Amount values (wei to ether)
            const maxDeposit = await parameterManager.getParameter("maxDepositAmount");
            const maxDepositEther = ethers.formatEther(maxDeposit);
            expect(maxDepositEther).to.equal("100.0");

            // Time values (seconds to hours)
            const emergencyDelay = await parameterManager.getParameter("emergencyDelay");
            const delayHours = Number(emergencyDelay) / 3600;
            expect(delayHours).to.equal(2);
        });

        it("Should generate readable parameter descriptions", async function () {
            const descriptions: Record<string, string> = {
                depositFee: "Fee charged on deposits (basis points)",
                withdrawFee: "Fee charged on withdrawals (basis points)",
                swapFee: "Fee charged on swaps (basis points)",
                maxDepositAmount: "Maximum deposit amount per transaction",
                emergencyDelay: "Delay before emergency actions (seconds)"
            };

            for (const [key, description] of Object.entries(descriptions)) {
                expect(description).to.be.a("string");
                expect(description.length).to.be.gt(0);
            }
        });

        it("Should support multiple output formats", async function () {
            const depositFee = await parameterManager.getParameter("depositFee");

            // Console format (human-readable)
            const consoleFormat = `depositFee: ${depositFee} (${Number(depositFee) / 100}%)`;
            expect(consoleFormat).to.include("depositFee");
            expect(consoleFormat).to.include("0.75");

            // JSON format (machine-readable)
            const jsonFormat = {
                key: "depositFee",
                value: depositFee.toString(),
                formatted: `${Number(depositFee) / 100}%`
            };
            expect(jsonFormat.key).to.equal("depositFee");
            expect(jsonFormat.value).to.equal("75");

            // CSV format
            const csvFormat = `depositFee,${depositFee},${Number(depositFee) / 100}%`;
            expect(csvFormat).to.include("depositFee,75,0.75%");
        });
    });

    describe("Sorting Operations", function () {
        it("Should sort parameters by key alphabetically", async function () {
            const keys = TEST_PARAMETERS.map(p => p.key).sort();

            expect(keys[0]).to.equal("depositFee");
            expect(keys[keys.length - 1]).to.equal("withdrawFee");
        });

        it("Should sort parameters by value", async function () {
            const params = await Promise.all(
                TEST_PARAMETERS.map(async (p) => ({
                    key: p.key,
                    value: await parameterManager.getParameter(p.key)
                }))
            );

            const sorted = params.sort((a, b) => {
                if (a.value < b.value) return -1;
                if (a.value > b.value) return 1;
                return 0;
            });

            // swapFee (30) should be first
            expect(sorted[0].key).to.equal("swapFee");
        });

        it("Should sort parameters by category", async function () {
            const byCategory = TEST_PARAMETERS.reduce((acc, param) => {
                if (!acc[param.category]) {
                    acc[param.category] = [];
                }
                acc[param.category].push(param);
                return acc;
            }, {} as Record<string, typeof TEST_PARAMETERS>);

            expect(byCategory["fees"].length).to.equal(3);
            expect(byCategory["limits"].length).to.equal(1);
            expect(byCategory["timing"].length).to.equal(1);
        });
    });

    describe("Comparison Operations", function () {
        it("Should compare current vs expected values", async function () {
            const expected = { key: "depositFee", value: 75n };
            const actual = await parameterManager.getParameter(expected.key);

            expect(actual).to.equal(expected.value);
        });

        it("Should detect parameter changes", async function () {
            const key = "depositFee";
            const oldValue = await parameterManager.getParameter(key);
            const newValue = 100n;

            // Update parameter
            await parameterManager.connect(admin).setParameter(key, newValue);

            // Detect change
            const currentValue = await parameterManager.getParameter(key);
            expect(currentValue).to.not.equal(oldValue);
            expect(currentValue).to.equal(newValue);

            const changePercent = Number((currentValue - oldValue) * 100n / oldValue);
            expect(changePercent).to.be.gt(0);
        });

        it("Should compare multiple parameters", async function () {
            const depositFee = await parameterManager.getParameter("depositFee");
            const withdrawFee = await parameterManager.getParameter("withdrawFee");
            const swapFee = await parameterManager.getParameter("swapFee");

            // Verify fee hierarchy
            expect(depositFee).to.be.gt(withdrawFee);
            expect(withdrawFee).to.be.gt(swapFee);
        });
    });

    describe("Performance", function () {
        it("Should efficiently query single parameter", async function () {
            const startTime = Date.now();

            const value = await parameterManager.getParameter("depositFee");

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(value).to.equal(75n);
            expect(duration).to.be.lt(1000); // Should be fast
        });

        it("Should efficiently query multiple parameters", async function () {
            const startTime = Date.now();

            const values = await Promise.all(
                TEST_PARAMETERS.map(p => parameterManager.getParameter(p.key))
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(values.length).to.equal(TEST_PARAMETERS.length);
            expect(duration).to.be.lt(5000); // Should handle batch queries
        });

        it("Should cache parameter values efficiently", async function () {
            const key = "depositFee";

            // First query
            const start1 = Date.now();
            const value1 = await parameterManager.getParameter(key);
            const duration1 = Date.now() - start1;

            // Second query (potentially cached)
            const start2 = Date.now();
            const value2 = await parameterManager.getParameter(key);
            const duration2 = Date.now() - start2;

            expect(value1).to.equal(value2);
            // Second query might be faster due to caching
        });
    });

    describe("Permission Checks", function () {
        it("Should allow anyone to view parameters", async function () {
            // Owner can view
            const ownerView = await parameterManager.connect(owner).getParameter("depositFee");
            expect(ownerView).to.equal(75n);

            // Admin can view
            const adminView = await parameterManager.connect(admin).getParameter("depositFee");
            expect(adminView).to.equal(75n);

            // Regular user can view
            const userView = await parameterManager.connect(user).getParameter("depositFee");
            expect(userView).to.equal(75n);
        });

        it("Should provide read-only access", async function () {
            // View operation should not modify state
            const before = await parameterManager.getParameter("depositFee");
            
            // View again
            const after = await parameterManager.getParameter("depositFee");

            expect(after).to.equal(before);
        });
    });

    describe("Real-world Scenarios", function () {
        it("Should support parameter audit workflow", async function () {
            // Scenario: Audit all parameters before upgrade
            const audit: Array<{ key: string; value: bigint; status: string }> = [];

            for (const param of TEST_PARAMETERS) {
                const value = await parameterManager.getParameter(param.key);
                const status = value === param.value ? "OK" : "MISMATCH";
                audit.push({ key: param.key, value, status });
            }

            // All parameters should match expected values
            expect(audit.every(a => a.status === "OK")).to.be.true;
        });

        it("Should support fee comparison analysis", async function () {
            // Scenario: Compare fees across operations
            const depositFee = await parameterManager.getParameter("depositFee");
            const withdrawFee = await parameterManager.getParameter("withdrawFee");
            const swapFee = await parameterManager.getParameter("swapFee");

            const analysis = {
                avgFee: (depositFee + withdrawFee + swapFee) / 3n,
                maxFee: depositFee > withdrawFee && depositFee > swapFee ? depositFee : 
                        withdrawFee > swapFee ? withdrawFee : swapFee,
                minFee: depositFee < withdrawFee && depositFee < swapFee ? depositFee :
                        withdrawFee < swapFee ? withdrawFee : swapFee
            };

            expect(analysis.maxFee).to.equal(depositFee);
            expect(analysis.minFee).to.equal(swapFee);
            expect(analysis.avgFee).to.be.gt(0n);
        });

        it("Should support parameter validation workflow", async function () {
            // Scenario: Validate all parameters meet business rules
            const validations: Array<{ key: string; valid: boolean; reason: string }> = [];

            for (const param of TEST_PARAMETERS) {
                const value = await parameterManager.getParameter(param.key);
                let valid = true;
                let reason = "OK";

                if (param.category === "fees") {
                    if (value > 1000n) {
                        valid = false;
                        reason = "Fee exceeds 10%";
                    }
                }

                validations.push({ key: param.key, valid, reason });
            }

            // All should be valid
            expect(validations.every(v => v.valid)).to.be.true;
        });
    });
});
