import type { ExecutionPlan, OperationResult } from "../framework/types";

export type AutomationMode = "observe" | "advisory" | "autonomous";
export type AutomationExecutionKind = "disabled" | "direct" | "safe";

export interface AutomationProtocolConfig {
  name: string;
  enabled: boolean;
  targetBps: number;
  maxBps: number;
  /** Required by monitor-only, market-based protocols such as Morpho. */
  collateralTokenCode?: string;
  loanTokenCode?: string;
}

export interface AutomationConfig {
  schemaVersion: 1;
  vaultId: string;
  chainId: number;
  manifestPath: string;
  mode: AutomationMode;
  baseAssetCode: string;
  baseAssetDecimals: number;
  protocols: AutomationProtocolConfig[];
  policy: {
    reserveTargetBps: number;
    reserveMinimumBps: number;
    rebalanceThresholdBps: number;
    minimumActionAmount: string;
    maxMovementBpsPerCycle: number;
    cooldownSeconds: number;
    maxPlanAgeBlocks: number;
    maxStateDriftBps: number;
    maxObservationBlockSpan: number;
    minHealthFactor: string;
    requireOracleFreshness: boolean;
    supplyOnly: true;
    verificationToleranceBps: number;
  };
  autonomous: {
    enabled: boolean;
    acknowledgement: string;
  };
  execution: {
    kind: AutomationExecutionKind;
    /** Public identity only. Private keys are loaded by the runtime environment. */
    expectedSignerAddress?: string;
  };
  safe?: {
    address: string;
    /** Optional self-hosted Transaction Service. Official services use apiKeyEnv. */
    txServiceUrl?: string;
    /** Name of the environment variable, never the API key itself. */
    apiKeyEnv?: string;
  };
  runtime: {
    stateDirectory: string;
    intervalSeconds: number;
    lockTtlSeconds: number;
    confirmations: number;
    rpcRetries: number;
    rpcRetryDelayMs: number;
    simulationImpersonateAddress?: string;
    heartbeatPath: string;
    maxConsecutiveFailures: number;
  };
}

export interface ProtocolObservation {
  name: string;
  active: boolean;
  balance: string;
  debt: string;
  healthFactor: string;
  circuitBreakerActive?: boolean;
  netApy?: string;
  allocationBps: number;
}

export interface VaultObservation {
  vaultId: string;
  chainId: number;
  blockNumberStart: number;
  blockNumberEnd: number;
  observedAt: string;
  baseAssetCode: string;
  custodyBalance: string;
  managedAssets: string;
  reserveBps: number;
  paused: boolean;
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  globalHealthFactor: string;
  oracleDataAvailable: boolean;
  protocols: ProtocolObservation[];
  fingerprint: string;
}

export interface RebalanceAction {
  id: string;
  kind: "withdraw" | "deposit";
  protocolName: string;
  tokenCode: string;
  amount: string;
  reason: string;
}

export interface StrategyDecision {
  kind: "NO_ACTION" | "REBALANCE";
  reason: string;
  actions: RebalanceAction[];
  maximumDriftBps: number;
  proposedMovement: string;
  targetAmounts: Record<string, string>;
}

export type RiskSeverity = "warning" | "blocking";

export interface RiskFinding {
  code: string;
  severity: RiskSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export interface RiskReport {
  approved: boolean;
  findings: RiskFinding[];
  projectedReserve: string;
  projectedReserveBps: number;
  projectedProtocolBalances: Record<string, string>;
}

export type AutomationRunState =
  | "CREATED" | "OBSERVED" | "OBSERVED_ONLY" | "NO_ACTION" | "VALIDATED" | "REJECTED"
  | "PLANNED" | "AWAITING_SAFE_PROPOSAL" | "SIMULATED" | "SIMULATION_FAILED" | "AWAITING_APPROVAL"
  | "APPROVED" | "STALE" | "EXECUTING" | "EXECUTION_FAILED"
  | "VERIFYING" | "COMPLETED" | "VERIFICATION_FAILED" | "FAILED" | "CANCELLED";

export interface StateTransition {
  from?: AutomationRunState;
  to: AutomationRunState;
  at: string;
  note?: string;
}

export interface AutomationEvent {
  at: string;
  level: "info" | "warning" | "critical";
  type: string;
  runId: string;
  vaultId: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface VerificationReport {
  passed: boolean;
  findings: RiskFinding[];
  observation: VaultObservation;
}

export interface AutomationRun {
  schemaVersion: 1;
  id: string;
  vaultId: string;
  chainId: number;
  configHash: string;
  mode: AutomationMode;
  state: AutomationRunState;
  createdAt: string;
  updatedAt: string;
  transitions: StateTransition[];
  events: AutomationEvent[];
  observation?: VaultObservation;
  decision?: StrategyDecision;
  risk?: RiskReport;
  plan?: ExecutionPlan;
  simulation?: OperationResult<undefined>;
  execution?: OperationResult<undefined>;
  verification?: VerificationReport;
  safe?: SafeProposalBinding;
  approvedAt?: string;
  approvedBy?: string;
  cancelledAt?: string;
  failure?: { message: string };
}

/** Immutable link between one controller run and one exact Safe transaction. */
export interface SafeProposalBinding {
  safeAddress: string;
  safeTxHash: string;
  nonce: number;
  proposer: string;
  proposedAt: string;
  transactionData: {
    to: string;
    value: string;
    data: string;
    operation: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
  };
}

export interface SafeExecutionStatus {
  safeAddress: string;
  safeTxHash: string;
  transactionData: SafeProposalBinding["transactionData"];
  executed: boolean;
  trusted: boolean;
  successful?: boolean;
  transactionHash?: string;
}

export interface AutomationServiceHeartbeat {
  schemaVersion: 1;
  vaultId: string;
  pid: number;
  state: "starting" | "ready" | "running" | "waiting" | "failed" | "stopped";
  startedAt: string;
  updatedAt: string;
  lastRunId?: string;
  lastRunState?: AutomationRunState;
  consecutiveFailures: number;
  lastError?: string;
}

export interface RunSummary {
  id: string;
  state: AutomationRunState;
  mode: AutomationMode;
  createdAt: string;
  updatedAt: string;
}
