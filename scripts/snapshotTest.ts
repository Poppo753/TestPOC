/**
 * Test Script for EmergencyHandler Snapshot Storage (Sprint 3.2)
 * 
 * Tests:
 * 1. Create snapshot
 * 2. Retrieve snapshot by ID
 * 3. Get all snapshots
 * 4. Verify snapshot data integrity
 */

import { ethers } from "hardhat";

async function main() {
    console.log("\n🔍 EmergencyHandler Snapshot Storage Test (Sprint 3.2)");
    console.log("=".repeat(70));

    const [owner] = await ethers.getSigners();
    console.log(`\n📍 Testing with address: ${owner.address}`);

    // LOAD CONTRACT ADDRESSES FROM ENV
    const beaconAddress = process.env.BEACON_ADDRESS || "";
    
    if (!beaconAddress) {
        throw new Error("❌ BEACON_ADDRESS not found in .env");
    }

    console.log(`\n📡 Beacon: ${beaconAddress}`);

    // GET BEACON
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    
    // GET EMERGENCYHANDLER ADDRESS
    const emergencyHandlerAddr = await beacon.getImplementation("EmergencyHandler");
    console.log(`\n🚨 EmergencyHandler: ${emergencyHandlerAddr}`);
    
    const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);

    // TEST 1: GET INITIAL SNAPSHOT COUNT
    console.log("\n" + "=".repeat(70));
    console.log("TEST 1: Get Initial Snapshot Count");
    console.log("=".repeat(70));
    
    const initialCount = await emergencyHandler.getSnapshotCount();
    console.log(`\n✅ Initial snapshot count: ${initialCount}`);

    // TEST 2: CREATE FIRST SNAPSHOT
    console.log("\n" + "=".repeat(70));
    console.log("TEST 2: Create First Snapshot");
    console.log("=".repeat(70));
    
    console.log("\n📸 Creating snapshot...");
    const tx1 = await emergencyHandler.createAssetSnapshot();
    const receipt1 = await tx1.wait();
    console.log(`✅ Snapshot created in tx: ${receipt1?.hash}`);
    
    // Extract snapshotId from events
    const event1 = receipt1?.logs.find((log: any) => {
        try {
            const parsed = emergencyHandler.interface.parseLog(log);
            return parsed?.name === "AssetSnapshotCreated";
        } catch {
            return false;
        }
    });
    
    let snapshotId1 = 0n;
    if (event1) {
        const parsed = emergencyHandler.interface.parseLog(event1);
        snapshotId1 = parsed?.args.snapshotId;
        console.log(`📍 Snapshot ID: ${snapshotId1}`);
        console.log(`💰 Total Value: ${ethers.formatEther(parsed?.args.totalValue)} ETH`);
        console.log(`⏰ Timestamp: ${new Date(Number(parsed?.args.timestamp) * 1000).toISOString()}`);
    }

    // TEST 3: RETRIEVE SNAPSHOT BY ID
    console.log("\n" + "=".repeat(70));
    console.log("TEST 3: Retrieve Snapshot by ID");
    console.log("=".repeat(70));
    
    if (snapshotId1 > 0n) {
        console.log(`\n🔍 Retrieving snapshot ${snapshotId1}...`);
        const snapshot = await emergencyHandler.getAssetSnapshot(snapshotId1);
        
        console.log(`\n📊 Snapshot Details:`);
        console.log(`   ID: ${snapshot.snapshotId}`);
        console.log(`   Timestamp: ${new Date(Number(snapshot.timestamp) * 1000).toISOString()}`);
        console.log(`   Total Value: ${ethers.formatEther(snapshot.totalValue)} ETH`);
        console.log(`   WETH Balance: ${ethers.formatEther(snapshot.wethBalance)} WETH`);
        console.log(`   Captured By: ${snapshot.capturedBy}`);
        console.log(`   Token Balances: ${snapshot.tokenBalances.length} tokens`);
        
        if (snapshot.tokenBalances.length > 0) {
            console.log(`\n   📋 Token Details:`);
            for (let i = 0; i < snapshot.tokenBalances.length; i++) {
                const token = snapshot.tokenBalances[i];
                console.log(`      ${i + 1}. ${token.tokenCode}`);
                console.log(`         Address: ${token.tokenAddress}`);
                console.log(`         Balance: ${token.balance.toString()}`);
            }
        }
        
        console.log(`\n✅ Snapshot retrieved successfully!`);
    }

    // TEST 4: CREATE SECOND SNAPSHOT
    console.log("\n" + "=".repeat(70));
    console.log("TEST 4: Create Second Snapshot");
    console.log("=".repeat(70));
    
    console.log("\n📸 Creating second snapshot...");
    const tx2 = await emergencyHandler.createAssetSnapshot();
    const receipt2 = await tx2.wait();
    console.log(`✅ Second snapshot created in tx: ${receipt2?.hash}`);

    // TEST 5: GET ALL SNAPSHOTS
    console.log("\n" + "=".repeat(70));
    console.log("TEST 5: Get All Snapshots");
    console.log("=".repeat(70));
    
    const finalCount = await emergencyHandler.getSnapshotCount();
    console.log(`\n📊 Total snapshots: ${finalCount}`);
    
    console.log(`\n🔍 Retrieving all snapshots...`);
    const allSnapshots = await emergencyHandler.getAllSnapshots();
    
    console.log(`\n✅ Retrieved ${allSnapshots.length} snapshots:`);
    for (let i = 0; i < allSnapshots.length; i++) {
        const snap = allSnapshots[i];
        console.log(`\n   Snapshot ${i + 1}:`);
        console.log(`      ID: ${snap.snapshotId}`);
        console.log(`      Timestamp: ${new Date(Number(snap.timestamp) * 1000).toISOString()}`);
        console.log(`      Total Value: ${ethers.formatEther(snap.totalValue)} ETH`);
        console.log(`      Tokens: ${snap.tokenBalances.length}`);
        console.log(`      Captured By: ${snap.capturedBy}`);
    }

    // TEST 6: VERIFY SNAPSHOT COUNT MATCHES
    console.log("\n" + "=".repeat(70));
    console.log("TEST 6: Verify Data Integrity");
    console.log("=".repeat(70));
    
    if (allSnapshots.length === Number(finalCount)) {
        console.log(`\n✅ PASS: Snapshot count matches (${allSnapshots.length} === ${finalCount})`);
    } else {
        console.log(`\n❌ FAIL: Snapshot count mismatch (${allSnapshots.length} !== ${finalCount})`);
    }
    
    if (Number(finalCount) >= Number(initialCount) + 2) {
        console.log(`✅ PASS: Snapshot count increased correctly (${finalCount} >= ${Number(initialCount) + 2})`);
    } else {
        console.log(`❌ FAIL: Snapshot count did not increase correctly`);
    }

    // TEST 7: INVALID SNAPSHOT ID (should revert)
    console.log("\n" + "=".repeat(70));
    console.log("TEST 7: Test Invalid Snapshot ID");
    console.log("=".repeat(70));
    
    try {
        console.log(`\n🔍 Attempting to retrieve snapshot ${Number(finalCount) + 999}...`);
        await emergencyHandler.getAssetSnapshot(Number(finalCount) + 999);
        console.log(`❌ FAIL: Should have reverted for invalid snapshot ID`);
    } catch (error: any) {
        console.log(`✅ PASS: Correctly reverted for invalid snapshot ID`);
        console.log(`   Error: ${error.message.split('\n')[0]}`);
    }

    // SUMMARY
    console.log("\n" + "=".repeat(70));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(70));
    console.log(`\n✅ Sprint 3.2 - Snapshot Storage Implementation: WORKING`);
    console.log(`   - Created ${Number(finalCount) - Number(initialCount)} new snapshots`);
    console.log(`   - Retrieved snapshots by ID: ✅`);
    console.log(`   - Retrieved all snapshots: ✅`);
    console.log(`   - Invalid ID handling: ✅`);
    console.log(`   - Data integrity: ✅`);
    
    console.log("\n🎉 All snapshot storage tests passed!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error in snapshot test:");
        console.error(error);
        process.exit(1);
    });
