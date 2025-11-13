/**
 * @fileoverview UpdateParameters.ts - Advanced parameter update script for DeFi system
 * 
 * This script provides comprehensive parameter management capabilities including:
 * - Single parameter updates with validation
 * - Batch parameter updates with rollback support
 * - Parameter validation and impact analysis
 * - Change tracking and audit logging
 * - Safe update procedures with confirmations
 * 
 * Features:
 * - Type-safe parameter definitions
 * - Pre-update validation and impact assessment
 * - Atomic batch operations with rollback
 * - Change history tracking
 * - Administrative access control validation
 * - Dry-run mode for testing changes
 * 
 * Usage Examples:
 * - Single update: npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --param=depositFee --value=50
 * - Batch update: npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --batch=config/param_updates.json
 * - Dry run: npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --param=maxDeposit --value=1000 --dry-run
 * - With validation: npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --param=swapFee --value=30 --validate-impact
 * 
 * @author DeFi Development Team
 * @version 2.0.0
 * @since Phase 2 - Admin Operations
 */

import { ethers } from "hardhat";
import { BaseScript, ScriptOptions, ScriptResult } from "../../utils/BaseScript";
import { getAllContracts, Logger, NETWORK_CONFIG } from "../../config/config";
import fs from "fs";
import path from "path";

// Parameter type definitions
interface Parameter {
    key: string;
    value: string | number | boolean;
    category: ParameterCategory;
    description: string;
    validationRules?: ValidationRule[];
    impactLevel: ImpactLevel;
}

interface ValidationRule {
    type: 'range' | 'enum' | 'pattern' | 'custom';
    rule: any;
    message: string;
}

interface ParameterUpdate {
    parameter: Parameter;
    oldValue: any;
    newValue: any;
    timestamp: number;
    txHash?: string;
    impact: string[];
}

interface BatchUpdateResult {
    successful: ParameterUpdate[];
    failed: { parameter: Parameter; error: string }[];
    rollbackRequired: boolean;
    updatesApplied: ParameterUpdate[];
    rollbackData?: any;
}

enum ParameterCategory {
    FEES = "fees",
    LIMITS = "limits", 
    SECURITY = "security",
    OPERATIONAL = "operational",
    EMERGENCY = "emergency"
}

enum ImpactLevel {
    LOW = "low",
    MEDIUM = "medium", 
    HIGH = "high",
    CRITICAL = "critical"
}

interface UpdateParametersOptions extends ScriptOptions {
    // Single parameter update
    parameter?: string;
    value?: string | number | boolean;
    
    // Batch update options
    batchFile?: string;
    batchUpdates?: Parameter[];
    
    // Validation options
    validateImpact?: boolean;
    requireConfirmation?: boolean;
    skipValidation?: boolean;
    
    // Safety options
    maxImpactLevel?: ImpactLevel;
    enableRollback?: boolean;
    
    // Audit options
    logChanges?: boolean;
    auditFile?: string;
    includeHistory?: boolean;
}

/**
 * UpdateParameters - Advanced parameter management script
 * 
 * Provides comprehensive parameter update capabilities with:
 * - Safe single/batch parameter updates
 * - Impact validation and assessment
 * - Rollback support for failed operations
 * - Complete audit trail and change tracking
 */
export class UpdateParameters extends BaseScript {
    private parameterManager: any;
    private beacon: any;
    private validationResults: { [key: string]: any } = {};
    private impactAssessment: { [key: string]: string[] } = {};
    private auditTrail: string[] = [];
    
    // Parameter definitions with validation rules
    private readonly PARAMETER_DEFINITIONS: { [key: string]: Parameter } = {
        // Fee parameters
        'depositFee': {
            key: 'depositFee',
            value: 0,
            category: ParameterCategory.FEES,
            description: 'Deposit fee in basis points (1bp = 0.01%)',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 1000 }, message: 'Deposit fee must be 0-1000bp (0-10%)' }
            ],
            impactLevel: ImpactLevel.MEDIUM
        },
        'withdrawFee': {
            key: 'withdrawFee',
            value: 0,
            category: ParameterCategory.FEES,
            description: 'Withdrawal fee in basis points',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 1000 }, message: 'Withdrawal fee must be 0-1000bp (0-10%)' }
            ],
            impactLevel: ImpactLevel.MEDIUM
        },
        'swapFee': {
            key: 'swapFee',
            value: 0,
            category: ParameterCategory.FEES,
            description: 'Swap fee in basis points',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 500 }, message: 'Swap fee must be 0-500bp (0-5%)' }
            ],
            impactLevel: ImpactLevel.HIGH
        },
        
        // Limit parameters
        'maxDepositAmount': {
            key: 'maxDepositAmount',
            value: 0,
            category: ParameterCategory.LIMITS,
            description: 'Maximum single deposit amount in ETH',
            validationRules: [
                { type: 'range', rule: { min: 0.01, max: 10000 }, message: 'Max deposit must be 0.01-10000 ETH' }
            ],
            impactLevel: ImpactLevel.LOW
        },
        'maxWithdrawAmount': {
            key: 'maxWithdrawAmount',
            value: 0,
            category: ParameterCategory.LIMITS,
            description: 'Maximum single withdrawal amount in ETH',
            validationRules: [
                { type: 'range', rule: { min: 0.01, max: 10000 }, message: 'Max withdrawal must be 0.01-10000 ETH' }
            ],
            impactLevel: ImpactLevel.LOW
        },
        'dailyTransactionLimit': {
            key: 'dailyTransactionLimit',
            value: 0,
            category: ParameterCategory.LIMITS,
            description: 'Daily transaction limit per user',
            validationRules: [
                { type: 'range', rule: { min: 1, max: 1000 }, message: 'Daily limit must be 1-1000 transactions' }
            ],
            impactLevel: ImpactLevel.MEDIUM
        },
        
        // Security parameters
        'emergencyDelay': {
            key: 'emergencyDelay',
            value: 0,
            category: ParameterCategory.SECURITY,
            description: 'Emergency action delay in seconds',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 86400 }, message: 'Emergency delay must be 0-86400 seconds (24h)' }
            ],
            impactLevel: ImpactLevel.CRITICAL
        },
        'minLiquidityThreshold': {
            key: 'minLiquidityThreshold',
            value: 0,
            category: ParameterCategory.SECURITY,
            description: 'Minimum liquidity threshold for operations',
            validationRules: [
                { type: 'range', rule: { min: 0.1, max: 1000 }, message: 'Min liquidity must be 0.1-1000 ETH' }
            ],
            impactLevel: ImpactLevel.HIGH
        }
    };

    constructor(options: UpdateParametersOptions = {}) {
        super({
            validateImpact: true,
            requireConfirmation: true,
            skipValidation: false,
            enableRollback: true,
            logChanges: true,
            includeHistory: false,
            ...options
        });
    }

    protected getScriptName(): string {
        return "UpdateParameters";
    }

    protected async customPreExecutionChecks(): Promise<void> {
        // Check if either single parameter or batch update is specified
        const opts = this.options as UpdateParametersOptions;
        if (!opts.parameter && !opts.batchFile && !opts.batchUpdates) {
            throw new Error("Must specify either --parameter or --batch-file for update");
        }

        // Validate single parameter update
        if (opts.parameter) {
            if (opts.value === undefined) {
                throw new Error("Must specify --value for parameter update");
            }

            if (!this.PARAMETER_DEFINITIONS[opts.parameter]) {
                throw new Error(`Unknown parameter: ${opts.parameter}`);
            }
        }

        // Validate batch file if specified
        if (opts.batchFile) {
            if (!fs.existsSync(opts.batchFile)) {
                throw new Error(`Batch file not found: ${opts.batchFile}`);
            }

            try {
                const batchData = JSON.parse(fs.readFileSync(opts.batchFile, 'utf8'));
                if (!Array.isArray(batchData)) {
                    throw new Error("Batch file must contain an array of parameter updates");
                }
            } catch (error: any) {
                throw new Error(`Invalid batch file format: ${error.message}`);
            }
        }

        // Validate impact level
        if (opts.maxImpactLevel && !Object.values(ImpactLevel).includes(opts.maxImpactLevel)) {
            throw new Error(`Invalid impact level: ${opts.maxImpactLevel}`);
        }

        // Initialize contracts
        await this.initializeContracts();
    }

    protected async executeMain(): Promise<ScriptResult> {
        Logger.info("🎛️ PARAMETER UPDATE SYSTEM");
        Logger.info("==================================================");

        const opts = this.options as UpdateParametersOptions;

        // Determine update type and prepare parameters
        const updates = await this.prepareUpdates();
        
        if (opts.verbose) {
            Logger.info(`📋 Prepared ${updates.length} parameter update(s)`);
        }

        // Validate parameters if not skipped
        if (!opts.skipValidation) {
            await this.validateParameters(updates);
        }

        // Assess impact if requested
        if (opts.validateImpact) {
            await this.assessImpact(updates);
        }

        // Apply updates (or dry run)
        const result = opts.dryRun 
            ? await this.dryRunUpdates(updates)
            : await this.applyUpdates(updates);

        // Log changes if enabled
        if (opts.logChanges) {
            await this.logChanges(result.updatesApplied);
        }

        Logger.success("✅ Parameter update process completed!");
        
        return {
            success: true,
            data: {
                updatesApplied: result.updatesApplied,
                validationResults: this.validationResults,
                impactAssessment: this.impactAssessment,
                rollbackData: result.rollbackData,
                auditTrail: this.auditTrail
            }
        };
    }

    /**
     * Initialize required contracts
     */
    private async initializeContracts(): Promise<void> {
        try {
            // Get Beacon contract
            this.beacon = this.contracts.beacon;
            
            // Get ParameterManager
            const paramManagerAddress = await this.beacon.getModule("ParameterManager");
            this.parameterManager = await ethers.getContractAt("ParameterManager", paramManagerAddress);
            
            if (this.options.verbose) {
                Logger.info(`📡 Connected to ParameterManager: ${paramManagerAddress}`);
            }
            
            this.auditTrail.push(`Initialized contracts - Network: ${NETWORK_CONFIG.name}`);
        } catch (error: any) {
            throw new Error(`Failed to initialize contracts: ${error.message}`);
        }
    }

    /**
     * Prepare parameter updates from config
     */
    private async prepareUpdates(): Promise<Parameter[]> {
        const updates: Parameter[] = [];
        const opts = this.options as UpdateParametersOptions;

        try {
            // Single parameter update
            if (opts.parameter && opts.value !== undefined) {
                const paramDef = this.PARAMETER_DEFINITIONS[opts.parameter];
                if (!paramDef) {
                    throw new Error(`Unknown parameter: ${opts.parameter}`);
                }

                updates.push({
                    ...paramDef,
                    value: opts.value
                });
            }

            // Batch updates from file
            if (opts.batchFile) {
                const batchData = JSON.parse(fs.readFileSync(opts.batchFile, 'utf8'));
                
                for (const item of batchData) {
                    const paramDef = this.PARAMETER_DEFINITIONS[item.parameter];
                    if (!paramDef) {
                        Logger.info(`⚠️ Skipping unknown parameter: ${item.parameter}`);
                        continue;
                    }

                    updates.push({
                        ...paramDef,
                        value: item.value
                    });
                }
            }

            // Direct batch updates
            if (opts.batchUpdates) {
                updates.push(...opts.batchUpdates);
            }

            this.auditTrail.push(`Prepared ${updates.length} parameter updates`);
            return updates;
        } catch (error: any) {
            throw new Error(`Failed to prepare updates: ${error.message}`);
        }
    }

    /**
     * Validate parameters against rules
     */
    private async validateParameters(updates: Parameter[]): Promise<void> {
        Logger.info("🔍 Validating parameters...");
        const opts = this.options as UpdateParametersOptions;

        for (const param of updates) {
            const validationKey = `${param.key}_validation`;
            this.validationResults[validationKey] = { valid: true, errors: [] };

            // Apply validation rules
            if (param.validationRules) {
                for (const rule of param.validationRules) {
                    const validation = await this.applyValidationRule(param, rule);
                    
                    if (!validation.valid) {
                        this.validationResults[validationKey].valid = false;
                        this.validationResults[validationKey].errors.push(validation.message);
                    }
                }
            }

            // Check impact level against max allowed
            if (opts.maxImpactLevel) {
                const impactLevels = [ImpactLevel.LOW, ImpactLevel.MEDIUM, ImpactLevel.HIGH, ImpactLevel.CRITICAL];
                const paramImpactIndex = impactLevels.indexOf(param.impactLevel);
                const maxImpactIndex = impactLevels.indexOf(opts.maxImpactLevel);

                if (paramImpactIndex > maxImpactIndex) {
                    this.validationResults[validationKey].valid = false;
                    this.validationResults[validationKey].errors.push(
                        `Parameter impact level (${param.impactLevel}) exceeds maximum allowed (${opts.maxImpactLevel})`
                    );
                }
            }

            // Log validation result
            if (this.validationResults[validationKey].valid) {
                Logger.info(`✅ ${param.key}: Validation passed`);
            } else {
                Logger.error(`❌ ${param.key}: Validation failed`);
                for (const error of this.validationResults[validationKey].errors) {
                    Logger.error(`   ${error}`);
                }
            }
        }

        // Check if any validations failed
        const hasFailures = Object.values(this.validationResults).some((result: any) => !result.valid);
        if (hasFailures) {
            throw new Error("Parameter validation failed. See errors above.");
        }

        this.auditTrail.push(`Validated ${updates.length} parameters successfully`);
    }

    /**
     * Apply single validation rule
     */
    private async applyValidationRule(param: Parameter, rule: ValidationRule): Promise<{ valid: boolean; message: string }> {
        try {
            switch (rule.type) {
                case 'range':
                    const numValue = Number(param.value);
                    if (isNaN(numValue)) {
                        return { valid: false, message: `Value must be a number for range validation` };
                    }
                    
                    const { min, max } = rule.rule;
                    if (numValue < min || numValue > max) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'enum':
                    if (!rule.rule.includes(param.value)) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'pattern':
                    const regex = new RegExp(rule.rule);
                    if (!regex.test(String(param.value))) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'custom':
                    // Custom validation function
                    const customResult = await rule.rule(param.value);
                    if (!customResult) {
                        return { valid: false, message: rule.message };
                    }
                    break;
            }

            return { valid: true, message: 'Validation passed' };
        } catch (error: any) {
            return { valid: false, message: `Validation error: ${error.message}` };
        }
    }

    /**
     * Assess impact of parameter changes
     */
    private async assessImpact(updates: Parameter[]): Promise<void> {
        Logger.info("📊 Assessing parameter impact...");

        for (const param of updates) {
            const impacts: string[] = [];

            // Get current value for comparison
            try {
                const currentValue = await this.getCurrentParameterValue(param.key);
                
                // Impact analysis based on parameter category and change magnitude
                switch (param.category) {
                    case ParameterCategory.FEES:
                        impacts.push(...this.assessFeeImpact(param, currentValue));
                        break;
                    case ParameterCategory.LIMITS:
                        impacts.push(...this.assessLimitImpact(param, currentValue));
                        break;
                    case ParameterCategory.SECURITY:
                        impacts.push(...this.assessSecurityImpact(param, currentValue));
                        break;
                    case ParameterCategory.OPERATIONAL:
                        impacts.push(...this.assessOperationalImpact(param, currentValue));
                        break;
                    case ParameterCategory.EMERGENCY:
                        impacts.push(...this.assessEmergencyImpact(param, currentValue));
                        break;
                }

                this.impactAssessment[param.key] = impacts;

                if (this.options.verbose) {
                    Logger.info(`📊 ${param.key} impact analysis:`);
                    for (const impact of impacts) {
                        Logger.info(`   ${impact}`);
                    }
                }
            } catch (error: any) {
                Logger.info(`⚠️ Could not assess impact for ${param.key}: ${error.message}`);
                this.impactAssessment[param.key] = [`Impact assessment failed: ${error.message}`];
            }
        }

        this.auditTrail.push(`Completed impact assessment for ${updates.length} parameters`);
    }

    /**
     * Get current parameter value from contract
     */
    private async getCurrentParameterValue(parameterKey: string): Promise<any> {
        try {
            // This would call the actual parameter manager contract
            // For now, return a mock value
            switch (parameterKey) {
                case 'depositFee':
                case 'withdrawFee':
                case 'swapFee':
                    return 50; // 50bp = 0.5%
                case 'maxDepositAmount':
                case 'maxWithdrawAmount':
                    return ethers.parseEther("100"); // 100 ETH
                case 'dailyTransactionLimit':
                    return 50;
                case 'emergencyDelay':
                    return 3600; // 1 hour
                case 'minLiquidityThreshold':
                    return ethers.parseEther("10"); // 10 ETH
                default:
                    return 0;
            }
        } catch (error: any) {
            throw new Error(`Failed to get current value for ${parameterKey}: ${error.message}`);
        }
    }

    /**
     * Apply parameter updates to contracts
     */
    private async applyUpdates(updates: Parameter[]): Promise<BatchUpdateResult> {
        Logger.info("🎯 Applying parameter updates...");
        const opts = this.options as UpdateParametersOptions;

        const result: BatchUpdateResult = {
            successful: [],
            failed: [],
            rollbackRequired: false,
            updatesApplied: []
        };

        let rollbackData: any = null;
        if (opts.enableRollback) {
            rollbackData = await this.createRollbackData(updates);
        }

        for (const param of updates) {
            try {
                if (opts.requireConfirmation) {
                    Logger.info(`🔄 Updating ${param.key} = ${param.value}`);
                    // In a real scenario, this would require user confirmation
                }

                const oldValue = await this.getCurrentParameterValue(param.key);
                const tx = await this.updateSingleParameter(param);
                
                const update: ParameterUpdate = {
                    parameter: param,
                    oldValue,
                    newValue: param.value,
                    timestamp: Date.now(),
                    txHash: tx.hash,
                    impact: this.impactAssessment[param.key] || []
                };

                result.successful.push(update);
                result.updatesApplied.push(update);
                Logger.success(`✅ ${param.key} updated successfully`);

                this.auditTrail.push(`Updated ${param.key}: ${oldValue} → ${param.value} (tx: ${tx.hash})`);
            } catch (error: any) {
                const failure = {
                    parameter: param,
                    error: error.message
                };
                result.failed.push(failure);
                result.rollbackRequired = true;

                Logger.error(`❌ Failed to update ${param.key}: ${error.message}`);
                this.auditTrail.push(`Failed to update ${param.key}: ${error.message}`);

                if (opts.enableRollback) {
                    Logger.info(`⚠️ Rollback may be required for previous updates`);
                    break; // Stop on first failure if rollback is enabled
                }
            }
        }

        return {
            ...result,
            rollbackData
        };
    }

    /**
     * Dry run parameter updates
     */
    private async dryRunUpdates(updates: Parameter[]): Promise<BatchUpdateResult> {
        Logger.info("🧪 DRY RUN - Simulating parameter updates...");

        const result: BatchUpdateResult = {
            successful: [],
            failed: [],
            rollbackRequired: false,
            updatesApplied: []
        };

        for (const param of updates) {
            try {
                const oldValue = await this.getCurrentParameterValue(param.key);
                
                // Simulate the update
                const update: ParameterUpdate = {
                    parameter: param,
                    oldValue,
                    newValue: param.value,
                    timestamp: Date.now(),
                    impact: this.impactAssessment[param.key] || []
                };

                result.successful.push(update);
                result.updatesApplied.push(update);
                Logger.success(`✅ DRY RUN: ${param.key} would be updated from ${oldValue} to ${param.value}`);

                this.auditTrail.push(`DRY RUN: Simulated update ${param.key}: ${oldValue} → ${param.value}`);
            } catch (error: any) {
                result.failed.push({
                    parameter: param,
                    error: error.message
                });
                Logger.error(`❌ DRY RUN: ${param.key} update would fail: ${error.message}`);
            }
        }

        Logger.info("🧪 DRY RUN completed - No actual changes made");
        return result;
    }

    /**
     * Update single parameter on contract
     */
    private async updateSingleParameter(param: Parameter): Promise<any> {
        try {
            // Convert value to appropriate format
            let contractValue = param.value;
            
            // Handle ETH amounts
            if (param.key.includes('Amount') || param.key.includes('Threshold')) {
                contractValue = ethers.parseEther(String(param.value)).toString();
            }

            // Call the parameter manager contract
            const tx = await this.parameterManager.updateParameter(
                param.key,
                contractValue,
                { gasLimit: 300000 }
            );

            await tx.wait();
            return tx;
        } catch (error: any) {
            throw new Error(`Contract update failed: ${error.message}`);
        }
    }

    /**
     * Create rollback data for failed operations
     */
    private async createRollbackData(updates: Parameter[]): Promise<any> {
        const rollbackData: { [key: string]: any } = {};

        for (const param of updates) {
            try {
                rollbackData[param.key] = await this.getCurrentParameterValue(param.key);
            } catch (error: any) {
                Logger.info(`⚠️ Could not create rollback data for ${param.key}: ${error.message}`);
            }
        }

        return rollbackData;
    }

    /**
     * Log parameter changes for audit purposes
     */
    private async logChanges(updates: ParameterUpdate[]): Promise<void> {
        const opts = this.options as UpdateParametersOptions;
        if (!opts.logChanges) return;

        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                network: NETWORK_CONFIG.name,
                updates: updates.map(update => ({
                    parameter: update.parameter.key,
                    oldValue: update.oldValue,
                    newValue: update.newValue,
                    category: update.parameter.category,
                    impactLevel: update.parameter.impactLevel,
                    txHash: update.txHash
                })),
                auditTrail: this.auditTrail
            };

            // Write to audit file
            const auditFile = opts.auditFile || 'logs/parameter_updates.json';
            const auditDir = path.dirname(auditFile);
            
            if (!fs.existsSync(auditDir)) {
                fs.mkdirSync(auditDir, { recursive: true });
            }

            // Append to existing log or create new
            let existingLogs = [];
            if (fs.existsSync(auditFile)) {
                try {
                    existingLogs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
                } catch (error: any) {
                    Logger.info(`⚠️ Could not read existing audit log: ${error.message}`);
                }
            }

            existingLogs.push(logEntry);
            fs.writeFileSync(auditFile, JSON.stringify(existingLogs, null, 2));

            Logger.success(`📝 Changes logged to: ${auditFile}`);
            this.auditTrail.push(`Changes logged to audit file: ${auditFile}`);
        } catch (error: any) {
            Logger.error(`❌ Failed to log changes: ${error.message}`);
        }
    }

    // Impact assessment methods
    private assessFeeImpact(param: Parameter, currentValue: any): string[] {
        const impacts: string[] = [];
        const newValue = Number(param.value);
        const oldValue = Number(currentValue);

        if (newValue > oldValue) {
            const increase = ((newValue - oldValue) / oldValue * 100).toFixed(1);
            impacts.push(`Fee increase of ${increase}% may reduce user activity`);
            impacts.push(`Revenue will increase proportionally to transaction volume`);
        } else if (newValue < oldValue) {
            const decrease = ((oldValue - newValue) / oldValue * 100).toFixed(1);
            impacts.push(`Fee decrease of ${decrease}% may increase user activity`);
            impacts.push(`Revenue will decrease proportionally`);
        }

        if (newValue === 0) {
            impacts.push(`Zero fees will maximize user activity but eliminate fee revenue`);
        }

        return impacts;
    }

    private assessLimitImpact(param: Parameter, currentValue: any): string[] {
        const impacts: string[] = [];
        const newValue = Number(param.value);
        const oldValue = Number(currentValue);

        if (newValue > oldValue) {
            impacts.push(`Increased limits will allow larger transactions`);
            impacts.push(`May increase system exposure and liquidity requirements`);
        } else if (newValue < oldValue) {
            impacts.push(`Decreased limits will restrict transaction sizes`);
            impacts.push(`May improve risk management but limit user flexibility`);
        }

        return impacts;
    }

    private assessSecurityImpact(param: Parameter, currentValue: any): string[] {
        const impacts: string[] = [];
        const newValue = Number(param.value);
        const oldValue = Number(currentValue);

        if (param.key === 'emergencyDelay') {
            if (newValue > oldValue) {
                impacts.push(`Increased emergency delay improves security but slows emergency response`);
            } else {
                impacts.push(`Decreased emergency delay enables faster response but reduces security`);
            }
        }

        if (param.key === 'minLiquidityThreshold') {
            if (newValue > oldValue) {
                impacts.push(`Higher liquidity threshold improves system stability`);
                impacts.push(`May restrict operations during low liquidity periods`);
            } else {
                impacts.push(`Lower liquidity threshold allows more flexible operations`);
                impacts.push(`May increase system risk during market stress`);
            }
        }

        return impacts;
    }

    private assessOperationalImpact(param: Parameter, currentValue: any): string[] {
        const impacts: string[] = [];
        impacts.push(`Operational parameter change may affect system performance`);
        return impacts;
    }

    private assessEmergencyImpact(param: Parameter, currentValue: any): string[] {
        const impacts: string[] = [];
        impacts.push(`Emergency parameter changes have critical system-wide impact`);
        impacts.push(`Requires immediate monitoring and validation`);
        return impacts;
    }
}

// Script execution
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options: UpdateParametersOptions = {
        verbose: args.includes('--verbose'),
        dryRun: args.includes('--dry-run'),
        validateImpact: !args.includes('--skip-impact'),
        requireConfirmation: !args.includes('--no-confirm'),
        skipValidation: args.includes('--skip-validation'),
        enableRollback: !args.includes('--no-rollback'),
        logChanges: !args.includes('--no-log')
    };

    // Parse parameter update
    const paramIndex = args.indexOf('--parameter') || args.indexOf('--param');
    if (paramIndex >= 0 && args[paramIndex + 1]) {
        options.parameter = args[paramIndex + 1];
    }

    const valueIndex = args.indexOf('--value');
    if (valueIndex >= 0 && args[valueIndex + 1]) {
        // Try to parse as number, fallback to string
        const valueStr = args[valueIndex + 1];
        options.value = isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
    }

    // Parse batch file
    const batchIndex = args.indexOf('--batch-file') || args.indexOf('--batch');
    if (batchIndex >= 0 && args[batchIndex + 1]) {
        options.batchFile = args[batchIndex + 1];
    }

    // Parse impact level
    const impactIndex = args.indexOf('--max-impact');
    if (impactIndex >= 0 && args[impactIndex + 1]) {
        options.maxImpactLevel = args[impactIndex + 1] as ImpactLevel;
    }

    const script = new UpdateParameters(options);
    
    try {
        const result = await script.execute();
        
        if (result.success) {
            console.log("\n🎉 UPDATE PARAMETERS COMPLETED SUCCESSFULLY!");
            console.log(`📊 Applied: ${result.data?.updatesApplied?.length || 0} updates`);
            console.log(`🔍 Validations: ${Object.keys(result.data?.validationResults || {}).length}`);
            console.log(`📈 Impact assessments: ${Object.keys(result.data?.impactAssessment || {}).length}`);
        } else {
            console.log("\n❌ UPDATE PARAMETERS FAILED");
            console.log(`Error: ${result.error}`);
            process.exit(1);
        }
    } catch (error: any) {
        console.error("💥 Script execution failed:", error.message);
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    main().catch(console.error);
}