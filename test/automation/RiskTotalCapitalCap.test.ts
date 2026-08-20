import { expect } from "chai";
import { ethers } from "hardhat";
import { validateAutomationConfig } from "../../scripts/automation/config";
import { observationFingerprint } from "../../scripts/automation/observer";
import { evaluateRisk } from "../../scripts/automation/risk";
import type { AutomationConfig, StrategyDecision, VaultObservation } from "../../scripts/automation/types";

/**
 * Fase 5 — copre il gap tecnico "capitale massimo totale" individuato in
 * `docs/New_Doc/1_Documentation/4. First Deployment/11_Phase_5_Policy_e_Whitelist/00_Architettura_e_Perimetro.md`.
 *
 * Prima di questa fase nessun campo del control file imponeva un tetto
 * assoluto agli asset gestiti. `policy.maxTotalCapitalUnits` e' il nuovo
 * campo opzionale (vedi `scripts/automation/types.ts` e `risk.ts`):
 *   - se assente, il comportamento e' identico a prima (nessun controllo);
 *   - se presente, `evaluateRisk` blocca ogni decisione quando
 *     `observation.managedAssets` supera il tetto.
 *
 * Il valore numerico e' una decisione economica riservata all'utente. Questo
 * test verifica soltanto che il MECCANISMO di enforcement funzioni; non
 * approva alcun numero specifico come policy definitiva.
 */
function baseConfig(overrides: Partial<AutomationConfig> = {}): AutomationConfig {
  return validateAutomationConfig({
    schemaVersion: 1, vaultId: "test-vault", chainId: 42161, manifestPath: "manifest.json", mode: "observe",
    baseAssetCode: "USDC", baseAssetDecimals: 6,
    protocols: [{ name: "A", enabled: true, targetBps: 5000, maxBps: 6000 }],
    policy: {
      reserveTargetBps: 5000, reserveMinimumBps: 1000, rebalanceThresholdBps: 100, minimumActionAmount: "1",
      maxMovementBpsPerCycle: 10000, cooldownSeconds: 0, maxPlanAgeBlocks: 10, maxStateDriftBps: 5, maxObservationBlockSpan: 10,
      minHealthFactor: ethers.parseEther("1.5").toString(), requireOracleFreshness: false, supplyOnly: true, verificationToleranceBps: 100,
    },
    autonomous: { enabled: false, acknowledgement: "" },
    execution: { kind: "disabled" },
    runtime: { stateDirectory: ".automation-test", intervalSeconds: 10, lockTtlSeconds: 60, confirmations: 1, rpcRetries: 1, rpcRetryDelayMs: 1 },
    ...overrides,
  });
}

function observationWithManagedAssets(managedAssets: string): VaultObservation {
  const base: Omit<VaultObservation, "fingerprint"> = {
    vaultId: "test-vault", chainId: 42161, blockNumberStart: 100, blockNumberEnd: 100, observedAt: "2026-01-01T00:00:00.000Z",
    baseAssetCode: "USDC", custodyBalance: managedAssets, managedAssets, reserveBps: 10000, paused: false,
    depositsEnabled: true, withdrawsEnabled: true, globalHealthFactor: ethers.MaxUint256.toString(), oracleDataAvailable: false,
    protocols: [
      { name: "A", active: true, balance: "0", debt: "0", healthFactor: ethers.MaxUint256.toString(), circuitBreakerActive: false, allocationBps: 0 },
    ],
  };
  return { ...base, fingerprint: observationFingerprint(base) };
}

const noActionDecision: StrategyDecision = { kind: "NO_ACTION", reason: "test", actions: [], maximumDriftBps: 0, proposedMovement: "0", targetAmounts: {} };

describe("Fase 5 — enforcement del tetto di capitale totale (gap tecnico chiuso)", function () {
  it("non blocca nulla quando policy.maxTotalCapitalUnits e' assente (comportamento pre-Fase 5, invariato)", function () {
    const config = baseConfig();
    expect(config.policy.maxTotalCapitalUnits).to.equal(undefined);
    const report = evaluateRisk(config, observationWithManagedAssets("1000000000"), noActionDecision);
    expect(report.findings.some(item => item.code === "TOTAL_CAPITAL_EXCEEDED")).to.equal(false);
  });

  it("approva quando gli asset gestiti restano sotto il tetto configurato", function () {
    const config = baseConfig({ policy: { ...baseConfig().policy, maxTotalCapitalUnits: "10000000" } });
    const report = evaluateRisk(config, observationWithManagedAssets("5000000"), noActionDecision);
    expect(report.approved).to.equal(true);
    expect(report.findings.some(item => item.code === "TOTAL_CAPITAL_EXCEEDED")).to.equal(false);
  });

  it("blocca (fail-closed) quando gli asset gestiti superano il tetto configurato", function () {
    const config = baseConfig({ policy: { ...baseConfig().policy, maxTotalCapitalUnits: "10000000" } });
    const report = evaluateRisk(config, observationWithManagedAssets("10000001"), noActionDecision);
    expect(report.approved).to.equal(false);
    const finding = report.findings.find(item => item.code === "TOTAL_CAPITAL_EXCEEDED");
    expect(finding, "manca il finding TOTAL_CAPITAL_EXCEEDED").to.not.equal(undefined);
    expect(finding?.severity).to.equal("blocking");
  });

  it("accetta un valore esattamente pari al tetto (confine inclusivo)", function () {
    const config = baseConfig({ policy: { ...baseConfig().policy, maxTotalCapitalUnits: "10000000" } });
    const report = evaluateRisk(config, observationWithManagedAssets("10000000"), noActionDecision);
    expect(report.findings.some(item => item.code === "TOTAL_CAPITAL_EXCEEDED")).to.equal(false);
  });

  it("valida il formato di policy.maxTotalCapitalUnits alla frontiera di validateAutomationConfig", function () {
    expect(() => baseConfig({ policy: { ...baseConfig().policy, maxTotalCapitalUnits: "not-a-number" } })).to.throw("maxTotalCapitalUnits");
    expect(() => baseConfig({ policy: { ...baseConfig().policy, maxTotalCapitalUnits: "-1" } })).to.throw("maxTotalCapitalUnits");
  });
});
