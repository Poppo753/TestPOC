/**
 * UserReport.ts - User Activity Analysis
 * 
 * ⚠️ CRITICAL PATTERNS (from contracts and tests):
 * - ALWAYS use beacon.getImplementation() NOT getModule()
 * - Track Deposit and Withdrawn events per user address
 * - Reference: contracts/interfaces/ILiquidityManager.sol, test/integration/Deposit tests
 */

import { ethers } from "hardhat";
import { Beacon, LiquidityManager } from "../../../typechain-types";

interface UserActivity {
  userAddress: string;
  depositCount: number;
  withdrawCount: number;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalShares: bigint;
  firstActivity: number;
  lastActivity: number;
}

interface UserReportData {
  totalUsers: number;
  topDepositors: UserActivity[];
  topWithdrawers: UserActivity[];
  activeUsers: UserActivity[];
  inactiveUsers: number;
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  avgDepositPerUser: bigint;
  avgWithdrawPerUser: bigint;
}

class UserReportMonitor {
  private contracts!: { beacon: Beacon; liquidityManager: LiquidityManager };

  async initialize() {
    console.log("🔧 Initializing User Report Monitor...");
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("❌ BEACON_ADDRESS not set");

    this.contracts = {
      beacon: await ethers.getContractAt("Beacon", beaconAddress)
    } as any;

    const liquidityManagerAddr = await this.contracts.beacon.getImplementation("LiquidityManager");
    this.contracts.liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddr);

    console.log("✅ User Report Monitor initialized");
  }

  async getUserActivity(fromBlock?: number, toBlock?: number | string): Promise<Map<string, UserActivity>> {
    const userMap = new Map<string, UserActivity>();

    // Query Deposit events
    const depositFilter = this.contracts.liquidityManager.filters.Deposit();
    const depositEvents = await this.contracts.liquidityManager.queryFilter(depositFilter, fromBlock, toBlock);

    for (const event of depositEvents) {
      const block = await event.getBlock();
      const user = event.args.user;
      
      if (!userMap.has(user)) {
        userMap.set(user, {
          userAddress: user,
          depositCount: 0,
          withdrawCount: 0,
          totalDeposited: 0n,
          totalWithdrawn: 0n,
          totalShares: 0n,
          firstActivity: block.timestamp,
          lastActivity: block.timestamp
        });
      }

      const userData = userMap.get(user)!;
      userData.depositCount++;
      userData.totalDeposited += event.args.ethAmount;
      userData.totalShares += event.args.sharesReceived;
      userData.lastActivity = Math.max(userData.lastActivity, block.timestamp);
    }

    // Query Withdrawn events
    const withdrawFilter = this.contracts.liquidityManager.filters.Withdrawn();
    const withdrawEvents = await this.contracts.liquidityManager.queryFilter(withdrawFilter, fromBlock, toBlock);

    for (const event of withdrawEvents) {
      const block = await event.getBlock();
      const user = event.args.user;
      
      if (!userMap.has(user)) {
        userMap.set(user, {
          userAddress: user,
          depositCount: 0,
          withdrawCount: 0,
          totalDeposited: 0n,
          totalWithdrawn: 0n,
          totalShares: 0n,
          firstActivity: block.timestamp,
          lastActivity: block.timestamp
        });
      }

      const userData = userMap.get(user)!;
      userData.withdrawCount++;
      userData.totalWithdrawn += event.args.ethAmount;
      userData.totalShares -= event.args.shares;
      userData.lastActivity = Math.max(userData.lastActivity, block.timestamp);
    }

    return userMap;
  }

  async generateReport(fromBlock?: number, toBlock?: number | string): Promise<UserReportData> {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║   USER ACTIVITY ANALYSIS REPORT       ║");
    console.log("╚════════════════════════════════════════╝");

    const userMap = await this.getUserActivity(fromBlock, toBlock);
    const users = Array.from(userMap.values());

    const totalUsers = users.length;
    const totalDeposits = users.reduce((sum, u) => sum + u.totalDeposited, 0n);
    const totalWithdrawals = users.reduce((sum, u) => sum + u.totalWithdrawn, 0n);

    const topDepositors = [...users].sort((a, b) => b.totalDeposited > a.totalDeposited ? 1 : -1).slice(0, 10);
    const topWithdrawers = [...users].sort((a, b) => b.totalWithdrawn > a.totalWithdrawn ? 1 : -1).slice(0, 10);

    console.log(`\n📊 Total users: ${totalUsers}`);
    console.log(`   Total deposits: ${ethers.formatEther(totalDeposits)} ETH`);
    console.log(`   Total withdrawals: ${ethers.formatEther(totalWithdrawals)} ETH`);

    console.log("\n👥 TOP 10 DEPOSITORS:");
    topDepositors.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.userAddress}: ${ethers.formatEther(user.totalDeposited)} ETH (${user.depositCount} deposits)`);
    });

    return {
      totalUsers,
      topDepositors,
      topWithdrawers,
      activeUsers: users.filter(u => u.depositCount > 0 || u.withdrawCount > 0),
      inactiveUsers: 0,
      totalDeposits,
      totalWithdrawals,
      avgDepositPerUser: totalUsers > 0 ? totalDeposits / BigInt(totalUsers) : 0n,
      avgWithdrawPerUser: totalUsers > 0 ? totalWithdrawals / BigInt(totalUsers) : 0n
    };
  }
}

async function main() {
  const monitor = new UserReportMonitor();
  await monitor.initialize();
  await monitor.generateReport();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export { UserReportMonitor, UserActivity, UserReportData };
