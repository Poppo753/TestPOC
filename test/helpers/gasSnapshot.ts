import * as fs from "fs";
import * as path from "path";

/**
 * 📸 Gas Snapshot Testing — Infra 9.6
 *
 * Mantiene una baseline di gas consumption per operazioni chiave.
 * - Prima esecuzione: crea la baseline in gas-snapshots.json
 * - Esecuzioni successive: confronta con la baseline e fallisce se il gas è aumentato > TOLERANCE
 *
 * Usage:
 *   import { assertGasSnapshot } from "../helpers/gasSnapshot";
 *   const receipt = await tx.wait();
 *   await assertGasSnapshot("LiquidityManager.deposit", receipt!.gasUsed);
 */

const SNAPSHOTS_FILE = path.resolve(__dirname, "../../test/gas-snapshots.json");
const GAS_INCREASE_TOLERANCE = 0.05; // 5% tolleranza prima di fallire

type GasSnapshots = Record<string, string>; // bigint salvato come stringa

function loadSnapshots(): GasSnapshots {
    if (!fs.existsSync(SNAPSHOTS_FILE)) {
        return {};
    }
    try {
        const content = fs.readFileSync(SNAPSHOTS_FILE, "utf-8");
        return JSON.parse(content) as GasSnapshots;
    } catch {
        return {};
    }
}

function saveSnapshots(snapshots: GasSnapshots): void {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2) + "\n", "utf-8");
}

/**
 * Asserts that the gas used for an operation is within the stored baseline.
 *
 * @param name      Unique name for the snapshot (e.g. "LiquidityManager.deposit")
 * @param actualGas Gas used in the current test run (bigint)
 * @param options   Optional overrides: { updateBaseline: true } to force-update the snapshot
 */
export function assertGasSnapshot(
    name: string,
    actualGas: bigint,
    options: { updateBaseline?: boolean } = {}
): void {
    const snapshots = loadSnapshots();
    const existing = snapshots[name];

    if (!existing || options.updateBaseline) {
        // First run or forced update: record the baseline
        snapshots[name] = actualGas.toString();
        saveSnapshots(snapshots);
        console.log(`  📸 Gas snapshot saved: ${name} = ${actualGas.toLocaleString()} gas`);
        return;
    }

    const baseline = BigInt(existing);
    const tolerance = (baseline * BigInt(Math.round(GAS_INCREASE_TOLERANCE * 1000))) / 1000n;
    const maxAllowed = baseline + tolerance;

    if (actualGas > maxAllowed) {
        const increase = actualGas - baseline;
        const increasePercent = Number((increase * 10000n) / baseline) / 100;
        throw new Error(
            `Gas regression detected for "${name}": ` +
            `baseline=${baseline.toLocaleString()}, ` +
            `actual=${actualGas.toLocaleString()}, ` +
            `increase=+${increase.toLocaleString()} (+${increasePercent.toFixed(2)}%), ` +
            `tolerance=${GAS_INCREASE_TOLERANCE * 100}%`
        );
    }

    const diff = actualGas - baseline;
    const sign = diff >= 0n ? "+" : "-";
    const absDiff = diff >= 0n ? diff : -diff;
    console.log(
        `  ✅ Gas snapshot OK: ${name} = ${actualGas.toLocaleString()} ` +
        `(baseline=${baseline.toLocaleString()}, ${sign}${absDiff.toLocaleString()})`
    );
}

/**
 * Returns all current snapshots (for debugging or reporting).
 */
export function getSnapshots(): Record<string, bigint> {
    const raw = loadSnapshots();
    const result: Record<string, bigint> = {};
    for (const [k, v] of Object.entries(raw)) {
        result[k] = BigInt(v);
    }
    return result;
}

/**
 * Clears all snapshots (for test isolation when needed).
 */
export function clearSnapshots(): void {
    saveSnapshots({});
}
