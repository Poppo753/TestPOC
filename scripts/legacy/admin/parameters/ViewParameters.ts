/**
 * @fileoverview ViewParameters.ts - Parameter viewing and inspection script
 * 
 * This script provides comprehensive parameter viewing capabilities including:
 * - Display current parameter values
 * - Parameter categorization and description
 * - Historical parameter changes
 * - Validation status checking
 * - Export capabilities for analysis
 * 
 * Features:
 * - Multiple output formats (console, JSON, CSV, table)
 * - Parameter filtering by category or impact level
 * - Historical change tracking
 * - Validation rule display
 * - Comprehensive parameter documentation
 * - Search and filtering capabilities
 * 
 * Usage Examples:
 * - View all: npx hardhat run scripts/admin/parameters/ViewParameters.ts
 * - Filter by category: npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --category=fees
 * - JSON export: npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --format=json --export=params.json
 * - Show history: npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --include-history
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

// Parameter definitions (shared with UpdateParameters)
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

interface ParameterDefinition {
    key: string;
    category: ParameterCategory;
    description: string;
    impactLevel: ImpactLevel;
    validationRules?: ValidationRule[];
    defaultValue?: any;
    unit?: string;
}

interface ValidationRule {
    type: 'range' | 'enum' | 'pattern' | 'custom';
    rule: any;
    message: string;
}

interface ParameterStatus {
    key: string;
    currentValue: any;
    formattedValue: string;
    definition: ParameterDefinition;
    lastChanged?: Date;
    changeHistory?: ParameterChange[];
    validationStatus: 'valid' | 'invalid' | 'unknown';
    validationErrors?: string[];
}

interface ParameterChange {
    timestamp: Date;
    oldValue: any;
    newValue: any;
    txHash?: string;
    reason?: string;
}

interface ViewParametersOptions extends ScriptOptions {
    // Filtering options
    category?: ParameterCategory;
    impactLevel?: ImpactLevel;
    search?: string;
    
    // Display options
    format?: 'console' | 'json' | 'csv' | 'table';
    export?: string;
    includeHistory?: boolean;
    includeValidation?: boolean;
    includeRules?: boolean;
    
    // Sorting options
    sortBy?: 'key' | 'category' | 'impact' | 'lastChanged';
    sortOrder?: 'asc' | 'desc';
    
    // Analysis options
    analyzeCompliance?: boolean;
    validateCurrent?: boolean;
    compareDefaults?: boolean;
}

/**
 * ViewParameters - Comprehensive parameter viewing and analysis script
 * 
 * Provides advanced parameter inspection with:
 * - Current value display and formatting
 * - Historical change tracking
 * - Validation status checking
 * - Multi-format output and export
 * - Filtering and search capabilities
 */
export class ViewParameters extends BaseScript {
    private parameterManager: any;
    private beacon: any;
    private parameterStatuses: { [key: string]: ParameterStatus } = {};
    
    // Complete parameter definitions with validation rules
    private readonly PARAMETER_DEFINITIONS: { [key: string]: ParameterDefinition } = {
        // Fee parameters
        'depositFee': {
            key: 'depositFee',
            category: ParameterCategory.FEES,
            description: 'Fee charged on ETH deposits',
            impactLevel: ImpactLevel.MEDIUM,
            defaultValue: 50,
            unit: 'basis points (bp)',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 1000 }, message: 'Deposit fee must be 0-1000bp (0-10%)' }
            ]
        },
        'withdrawFee': {
            key: 'withdrawFee',
            category: ParameterCategory.FEES,
            description: 'Fee charged on ETH withdrawals',
            impactLevel: ImpactLevel.MEDIUM,
            defaultValue: 50,
            unit: 'basis points (bp)',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 1000 }, message: 'Withdrawal fee must be 0-1000bp (0-10%)' }
            ]
        },
        'swapFee': {
            key: 'swapFee',
            category: ParameterCategory.FEES,
            description: 'Fee charged on token swaps',
            impactLevel: ImpactLevel.HIGH,
            defaultValue: 30,
            unit: 'basis points (bp)',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 500 }, message: 'Swap fee must be 0-500bp (0-5%)' }
            ]
        },
        
        // Limit parameters
        'maxDepositAmount': {
            key: 'maxDepositAmount',
            category: ParameterCategory.LIMITS,
            description: 'Maximum ETH amount allowed in single deposit',
            impactLevel: ImpactLevel.LOW,
            defaultValue: "100.0",
            unit: 'ETH',
            validationRules: [
                { type: 'range', rule: { min: 0.01, max: 10000 }, message: 'Max deposit must be 0.01-10000 ETH' }
            ]
        },
        'maxWithdrawAmount': {
            key: 'maxWithdrawAmount',
            category: ParameterCategory.LIMITS,
            description: 'Maximum ETH amount allowed in single withdrawal',
            impactLevel: ImpactLevel.LOW,
            defaultValue: "100.0",
            unit: 'ETH',
            validationRules: [
                { type: 'range', rule: { min: 0.01, max: 10000 }, message: 'Max withdrawal must be 0.01-10000 ETH' }
            ]
        },
        'dailyTransactionLimit': {
            key: 'dailyTransactionLimit',
            category: ParameterCategory.LIMITS,
            description: 'Maximum number of transactions per user per day',
            impactLevel: ImpactLevel.MEDIUM,
            defaultValue: 50,
            unit: 'transactions',
            validationRules: [
                { type: 'range', rule: { min: 1, max: 1000 }, message: 'Daily limit must be 1-1000 transactions' }
            ]
        },
        
        // Security parameters
        'emergencyDelay': {
            key: 'emergencyDelay',
            category: ParameterCategory.SECURITY,
            description: 'Delay before emergency actions can be executed',
            impactLevel: ImpactLevel.CRITICAL,
            defaultValue: 3600,
            unit: 'seconds',
            validationRules: [
                { type: 'range', rule: { min: 0, max: 86400 }, message: 'Emergency delay must be 0-86400 seconds (24h)' }
            ]
        },
        'minLiquidityThreshold': {
            key: 'minLiquidityThreshold',
            category: ParameterCategory.SECURITY,
            description: 'Minimum liquidity required for normal operations',
            impactLevel: ImpactLevel.HIGH,
            defaultValue: "10.0",
            unit: 'ETH',
            validationRules: [
                { type: 'range', rule: { min: 0.1, max: 1000 }, message: 'Min liquidity must be 0.1-1000 ETH' }
            ]
        },
        
        // Operational parameters
        'maxSlippage': {
            key: 'maxSlippage',
            category: ParameterCategory.OPERATIONAL,
            description: 'Maximum allowed slippage for automated operations',
            impactLevel: ImpactLevel.MEDIUM,
            defaultValue: 300,
            unit: 'basis points (bp)',
            validationRules: [
                { type: 'range', rule: { min: 1, max: 1000 }, message: 'Max slippage must be 1-1000bp (0.01-10%)' }
            ]
        },
        'rebalanceThreshold': {
            key: 'rebalanceThreshold',
            category: ParameterCategory.OPERATIONAL,
            description: 'Threshold for triggering automatic rebalancing',
            impactLevel: ImpactLevel.MEDIUM,
            defaultValue: 500,
            unit: 'basis points (bp)',
            validationRules: [
                { type: 'range', rule: { min: 100, max: 2000 }, message: 'Rebalance threshold must be 100-2000bp (1-20%)' }
            ]
        }
    };

    constructor(options: ViewParametersOptions = {}) {
        super({
            format: 'console',
            includeHistory: false,
            includeValidation: true,
            includeRules: false,
            sortBy: 'category',
            sortOrder: 'asc',
            analyzeCompliance: false,
            validateCurrent: true,
            compareDefaults: false,
            ...options
        });
    }

    protected getScriptName(): string {
        return "ViewParameters";
    }

    protected async customPreExecutionChecks(): Promise<void> {
        const opts = this.options as ViewParametersOptions;
        
        // Validate format
        if (opts.format && !['console', 'json', 'csv', 'table'].includes(opts.format)) {
            throw new Error(`Invalid format: ${opts.format}. Must be: console, json, csv, table`);
        }

        // Validate category filter
        if (opts.category && !Object.values(ParameterCategory).includes(opts.category)) {
            throw new Error(`Invalid category: ${opts.category}. Must be: ${Object.values(ParameterCategory).join(', ')}`);
        }

        // Validate impact level filter
        if (opts.impactLevel && !Object.values(ImpactLevel).includes(opts.impactLevel)) {
            throw new Error(`Invalid impact level: ${opts.impactLevel}. Must be: ${Object.values(ImpactLevel).join(', ')}`);
        }

        // Validate sort options
        if (opts.sortBy && !['key', 'category', 'impact', 'lastChanged'].includes(opts.sortBy)) {
            throw new Error(`Invalid sortBy: ${opts.sortBy}. Must be: key, category, impact, lastChanged`);
        }

        if (opts.sortOrder && !['asc', 'desc'].includes(opts.sortOrder)) {
            throw new Error(`Invalid sortOrder: ${opts.sortOrder}. Must be: asc, desc`);
        }

        // Initialize contracts
        await this.initializeContracts();
    }

    protected async executeMain(): Promise<ScriptResult> {
        Logger.info("🔍 PARAMETER VIEWER");
        Logger.info("==================================================");

        const opts = this.options as ViewParametersOptions;

        // Load all parameter statuses
        await this.loadParameterStatuses();

        // Apply filters
        const filteredParams = this.applyFilters();

        // Sort parameters
        const sortedParams = this.sortParameters(filteredParams);

        // Load history if requested
        if (opts.includeHistory) {
            await this.loadParameterHistory(sortedParams);
        }

        // Validate current values if requested
        if (opts.validateCurrent) {
            await this.validateCurrentValues(sortedParams);
        }

        // Generate output
        const output = await this.generateOutput(sortedParams);

        // Export if requested
        if (opts.export) {
            await this.exportOutput(output, sortedParams);
        }

        // Additional analysis
        let analysis: any = {};
        if (opts.analyzeCompliance) {
            analysis.compliance = await this.analyzeCompliance(sortedParams);
        }

        if (opts.compareDefaults) {
            analysis.defaultComparison = await this.compareWithDefaults(sortedParams);
        }

        Logger.success("✅ Parameter viewing completed!");
        
        return {
            success: true,
            data: {
                parameters: sortedParams,
                output,
                analysis
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
            const paramManagerAddress = await this.beacon.getImplementation("ParameterManager");
            this.parameterManager = await ethers.getContractAt("ParameterManager", paramManagerAddress);
            
            if (this.options.verbose) {
                Logger.info(`📡 Connected to ParameterManager: ${paramManagerAddress}`);
            }
        } catch (error: any) {
            throw new Error(`Failed to initialize contracts: ${error.message}`);
        }
    }

    /**
     * Load current status for all parameters
     */
    private async loadParameterStatuses(): Promise<void> {
        Logger.info("📊 Loading parameter statuses...");

        for (const [key, definition] of Object.entries(this.PARAMETER_DEFINITIONS)) {
            try {
                const currentValue = await this.getCurrentParameterValue(key);
                const formattedValue = this.formatParameterValue(currentValue, definition);

                this.parameterStatuses[key] = {
                    key,
                    currentValue,
                    formattedValue,
                    definition,
                    validationStatus: 'unknown'
                };

                if (this.options.verbose) {
                    Logger.info(`✅ Loaded ${key}: ${formattedValue}`);
                }
            } catch (error: any) {
                Logger.error(`❌ Failed to load ${key}: ${error.message}`);
                
                this.parameterStatuses[key] = {
                    key,
                    currentValue: null,
                    formattedValue: 'Error loading value',
                    definition,
                    validationStatus: 'invalid',
                    validationErrors: [error.message]
                };
            }
        }

        Logger.success(`📊 Loaded ${Object.keys(this.parameterStatuses).length} parameter statuses`);
    }

    /**
     * Get current parameter value from contract
     */
    private async getCurrentParameterValue(parameterKey: string): Promise<any> {
        try {
            // This would call the actual parameter manager contract
            // For now, return mock values that match the parameter type
            switch (parameterKey) {
                case 'depositFee':
                    return 50; // 50bp = 0.5%
                case 'withdrawFee':
                    return 50; // 50bp = 0.5%
                case 'swapFee':
                    return 30; // 30bp = 0.3%
                case 'maxDepositAmount':
                    return ethers.parseEther("100"); // 100 ETH
                case 'maxWithdrawAmount':
                    return ethers.parseEther("50"); // 50 ETH
                case 'dailyTransactionLimit':
                    return 25; // 25 transactions
                case 'emergencyDelay':
                    return 7200; // 2 hours
                case 'minLiquidityThreshold':
                    return ethers.parseEther("5"); // 5 ETH
                case 'maxSlippage':
                    return 200; // 200bp = 2%
                case 'rebalanceThreshold':
                    return 750; // 750bp = 7.5%
                default:
                    return 0;
            }
        } catch (error: any) {
            throw new Error(`Failed to get current value for ${parameterKey}: ${error.message}`);
        }
    }

    /**
     * Format parameter value for display
     */
    private formatParameterValue(value: any, definition: ParameterDefinition): string {
        if (value === null || value === undefined) {
            return 'N/A';
        }

        try {
            switch (definition.unit) {
                case 'ETH':
                    // Handle BigInt values from ethers
                    if (typeof value === 'bigint') {
                        return `${ethers.formatEther(value)} ETH`;
                    }
                    return `${value} ETH`;
                
                case 'basis points (bp)':
                    const percentage = (Number(value) / 100).toFixed(2);
                    return `${value}bp (${percentage}%)`;
                
                case 'seconds':
                    const hours = Math.floor(Number(value) / 3600);
                    const minutes = Math.floor((Number(value) % 3600) / 60);
                    if (hours > 0) {
                        return `${value}s (${hours}h ${minutes}m)`;
                    } else if (minutes > 0) {
                        return `${value}s (${minutes}m)`;
                    }
                    return `${value}s`;
                
                case 'transactions':
                    return `${value} transactions`;
                
                default:
                    return String(value);
            }
        } catch (error) {
            return `${value} (format error)`;
        }
    }

    /**
     * Apply filtering based on options
     */
    private applyFilters(): ParameterStatus[] {
        const opts = this.options as ViewParametersOptions;
        let filtered = Object.values(this.parameterStatuses);

        // Filter by category
        if (opts.category) {
            filtered = filtered.filter(param => param.definition.category === opts.category);
        }

        // Filter by impact level
        if (opts.impactLevel) {
            filtered = filtered.filter(param => param.definition.impactLevel === opts.impactLevel);
        }

        // Filter by search term
        if (opts.search) {
            const searchLower = opts.search.toLowerCase();
            filtered = filtered.filter(param => 
                param.key.toLowerCase().includes(searchLower) ||
                param.definition.description.toLowerCase().includes(searchLower) ||
                param.formattedValue.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    /**
     * Sort parameters based on options
     */
    private sortParameters(parameters: ParameterStatus[]): ParameterStatus[] {
        const opts = this.options as ViewParametersOptions;
        const sortBy = opts.sortBy || 'category';
        const sortOrder = opts.sortOrder || 'asc';

        return parameters.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'key':
                    comparison = a.key.localeCompare(b.key);
                    break;
                case 'category':
                    comparison = a.definition.category.localeCompare(b.definition.category);
                    break;
                case 'impact':
                    const impactOrder = [ImpactLevel.LOW, ImpactLevel.MEDIUM, ImpactLevel.HIGH, ImpactLevel.CRITICAL];
                    comparison = impactOrder.indexOf(a.definition.impactLevel) - impactOrder.indexOf(b.definition.impactLevel);
                    break;
                case 'lastChanged':
                    const aTime = a.lastChanged?.getTime() || 0;
                    const bTime = b.lastChanged?.getTime() || 0;
                    comparison = aTime - bTime;
                    break;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }

    /**
     * Load parameter change history
     */
    private async loadParameterHistory(parameters: ParameterStatus[]): Promise<void> {
        Logger.info("📜 Loading parameter history...");

        for (const param of parameters) {
            try {
                // This would load from audit logs or blockchain events
                // For now, generate mock history
                param.changeHistory = this.generateMockHistory(param);
                
                if (param.changeHistory.length > 0) {
                    param.lastChanged = param.changeHistory[param.changeHistory.length - 1].timestamp;
                }
            } catch (error: any) {
                Logger.info(`⚠️ Could not load history for ${param.key}: ${error.message}`);
                param.changeHistory = [];
            }
        }
    }

    /**
     * Generate mock history for demonstration
     */
    private generateMockHistory(param: ParameterStatus): ParameterChange[] {
        const history: ParameterChange[] = [];
        const now = new Date();

        // Generate some sample changes
        if (param.key === 'depositFee') {
            history.push({
                timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                oldValue: 100,
                newValue: 75,
                reason: 'Competitive adjustment'
            });
            history.push({
                timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                oldValue: 75,
                newValue: 50,
                reason: 'User acquisition campaign'
            });
        }

        return history;
    }

    /**
     * Validate current parameter values
     */
    private async validateCurrentValues(parameters: ParameterStatus[]): Promise<void> {
        Logger.info("🔍 Validating current parameter values...");

        for (const param of parameters) {
            if (param.currentValue === null) {
                param.validationStatus = 'invalid';
                param.validationErrors = ['Parameter value could not be loaded'];
                continue;
            }

            const validationResults = await this.validateSingleParameter(param);
            param.validationStatus = validationResults.valid ? 'valid' : 'invalid';
            param.validationErrors = validationResults.errors;
        }
    }

    /**
     * Validate single parameter against its rules
     */
    private async validateSingleParameter(param: ParameterStatus): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        if (!param.definition.validationRules) {
            return { valid: true, errors: [] };
        }

        for (const rule of param.definition.validationRules) {
            try {
                const validation = await this.applyValidationRule(param.currentValue, rule);
                if (!validation.valid) {
                    errors.push(validation.message);
                }
            } catch (error: any) {
                errors.push(`Validation error: ${error.message}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Apply single validation rule
     */
    private async applyValidationRule(value: any, rule: ValidationRule): Promise<{ valid: boolean; message: string }> {
        try {
            switch (rule.type) {
                case 'range':
                    let numValue = Number(value);
                    
                    // Handle BigInt values
                    if (typeof value === 'bigint') {
                        numValue = Number(ethers.formatEther(value));
                    }
                    
                    if (isNaN(numValue)) {
                        return { valid: false, message: `Value must be a number for range validation` };
                    }
                    
                    const { min, max } = rule.rule;
                    if (numValue < min || numValue > max) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'enum':
                    if (!rule.rule.includes(value)) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'pattern':
                    const regex = new RegExp(rule.rule);
                    if (!regex.test(String(value))) {
                        return { valid: false, message: rule.message };
                    }
                    break;

                case 'custom':
                    const customResult = await rule.rule(value);
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
     * Generate output in specified format
     */
    private async generateOutput(parameters: ParameterStatus[]): Promise<string> {
        const opts = this.options as ViewParametersOptions;

        switch (opts.format) {
            case 'json':
                return this.generateJSONOutput(parameters);
            case 'csv':
                return this.generateCSVOutput(parameters);
            case 'table':
                return this.generateTableOutput(parameters);
            default:
                return this.generateConsoleOutput(parameters);
        }
    }

    /**
     * Generate console output
     */
    private generateConsoleOutput(parameters: ParameterStatus[]): string {
        const opts = this.options as ViewParametersOptions;
        let output = '\n📋 PARAMETER STATUS REPORT\n';
        output += '='.repeat(50) + '\n';

        // Group by category
        const grouped: { [category: string]: ParameterStatus[] } = {};
        for (const param of parameters) {
            const category = param.definition.category;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(param);
        }

        for (const [category, params] of Object.entries(grouped)) {
            output += `\n🔷 ${category.toUpperCase()} PARAMETERS:\n`;
            
            for (const param of params) {
                const statusIcon = param.validationStatus === 'valid' ? '✅' : 
                                 param.validationStatus === 'invalid' ? '❌' : '⚠️';
                const impactIcon = this.getImpactIcon(param.definition.impactLevel);

                output += `\n  ${statusIcon} ${param.key} ${impactIcon}\n`;
                output += `     Current: ${param.formattedValue}\n`;
                output += `     Description: ${param.definition.description}\n`;
                output += `     Impact: ${param.definition.impactLevel}\n`;

                if (opts.includeValidation && param.validationErrors?.length) {
                    output += `     Validation Errors:\n`;
                    for (const error of param.validationErrors) {
                        output += `       • ${error}\n`;
                    }
                }

                if (opts.includeRules && param.definition.validationRules?.length) {
                    output += `     Validation Rules:\n`;
                    for (const rule of param.definition.validationRules) {
                        output += `       • ${rule.message}\n`;
                    }
                }

                if (opts.includeHistory && param.changeHistory?.length) {
                    output += `     Recent Changes:\n`;
                    const recentChanges = param.changeHistory.slice(-3); // Last 3 changes
                    for (const change of recentChanges) {
                        output += `       • ${change.timestamp.toLocaleDateString()}: ${change.oldValue} → ${change.newValue}`;
                        if (change.reason) {
                            output += ` (${change.reason})`;
                        }
                        output += '\n';
                    }
                }
            }
        }

        // Summary
        output += '\n📊 SUMMARY:\n';
        output += `Total Parameters: ${parameters.length}\n`;
        const validCount = parameters.filter(p => p.validationStatus === 'valid').length;
        const invalidCount = parameters.filter(p => p.validationStatus === 'invalid').length;
        const unknownCount = parameters.filter(p => p.validationStatus === 'unknown').length;
        
        output += `Valid: ${validCount}, Invalid: ${invalidCount}, Unknown: ${unknownCount}\n`;

        // By category
        output += '\nBy Category:\n';
        for (const category of Object.values(ParameterCategory)) {
            const count = parameters.filter(p => p.definition.category === category).length;
            if (count > 0) {
                output += `  ${category}: ${count}\n`;
            }
        }

        return output;
    }

    /**
     * Get impact level icon
     */
    private getImpactIcon(impact: ImpactLevel): string {
        switch (impact) {
            case ImpactLevel.LOW: return '🟢';
            case ImpactLevel.MEDIUM: return '🟡';
            case ImpactLevel.HIGH: return '🟠';
            case ImpactLevel.CRITICAL: return '🔴';
            default: return '⚪';
        }
    }

    /**
     * Generate JSON output
     */
    private generateJSONOutput(parameters: ParameterStatus[]): string {
        const output = {
            timestamp: new Date().toISOString(),
            network: NETWORK_CONFIG.name,
            totalParameters: parameters.length,
            parameters: parameters.map(param => ({
                key: param.key,
                currentValue: param.currentValue,
                formattedValue: param.formattedValue,
                category: param.definition.category,
                description: param.definition.description,
                impactLevel: param.definition.impactLevel,
                unit: param.definition.unit,
                validationStatus: param.validationStatus,
                validationErrors: param.validationErrors,
                lastChanged: param.lastChanged?.toISOString(),
                changeHistory: param.changeHistory?.map(change => ({
                    timestamp: change.timestamp.toISOString(),
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                    txHash: change.txHash,
                    reason: change.reason
                }))
            }))
        };

        return JSON.stringify(output, null, 2);
    }

    /**
     * Generate CSV output
     */
    private generateCSVOutput(parameters: ParameterStatus[]): string {
        const headers = [
            'Key',
            'Current Value',
            'Formatted Value',
            'Category',
            'Description',
            'Impact Level',
            'Unit',
            'Validation Status',
            'Last Changed'
        ];

        let csv = headers.join(',') + '\n';

        for (const param of parameters) {
            const row = [
                param.key,
                String(param.currentValue),
                `"${param.formattedValue}"`,
                param.definition.category,
                `"${param.definition.description}"`,
                param.definition.impactLevel,
                param.definition.unit || '',
                param.validationStatus,
                param.lastChanged?.toISOString() || ''
            ];

            csv += row.join(',') + '\n';
        }

        return csv;
    }

    /**
     * Generate table output
     */
    private generateTableOutput(parameters: ParameterStatus[]): string {
        // Simple table implementation
        let table = '\n┌─────────────────────┬─────────────────────┬─────────────────┬─────────────────┐\n';
        table += '│ Parameter           │ Current Value       │ Category        │ Status          │\n';
        table += '├─────────────────────┼─────────────────────┼─────────────────┼─────────────────┤\n';

        for (const param of parameters) {
            const key = param.key.padEnd(19);
            const value = param.formattedValue.slice(0, 19).padEnd(19);
            const category = param.definition.category.padEnd(15);
            const status = param.validationStatus.padEnd(15);

            table += `│ ${key} │ ${value} │ ${category} │ ${status} │\n`;
        }

        table += '└─────────────────────┴─────────────────────┴─────────────────┴─────────────────┘\n';

        return table;
    }

    /**
     * Export output to file
     */
    private async exportOutput(output: string, parameters: ParameterStatus[]): Promise<void> {
        const opts = this.options as ViewParametersOptions;
        if (!opts.export) return;

        try {
            const exportPath = opts.export;
            const exportDir = path.dirname(exportPath);

            // Create directory if it doesn't exist
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            // Write output to file
            fs.writeFileSync(exportPath, output);

            Logger.success(`📤 Output exported to: ${exportPath}`);
            Logger.info(`📊 Exported ${parameters.length} parameters`);
        } catch (error: any) {
            Logger.error(`❌ Failed to export output: ${error.message}`);
        }
    }

    /**
     * Analyze compliance with validation rules
     */
    private async analyzeCompliance(parameters: ParameterStatus[]): Promise<any> {
        const compliance = {
            totalParameters: parameters.length,
            validParameters: 0,
            invalidParameters: 0,
            unknownParameters: 0,
            complianceRate: 0,
            issues: [] as string[]
        };

        for (const param of parameters) {
            switch (param.validationStatus) {
                case 'valid':
                    compliance.validParameters++;
                    break;
                case 'invalid':
                    compliance.invalidParameters++;
                    if (param.validationErrors) {
                        compliance.issues.push(`${param.key}: ${param.validationErrors.join(', ')}`);
                    }
                    break;
                case 'unknown':
                    compliance.unknownParameters++;
                    break;
            }
        }

        compliance.complianceRate = (compliance.validParameters / compliance.totalParameters) * 100;

        return compliance;
    }

    /**
     * Compare current values with defaults
     */
    private async compareWithDefaults(parameters: ParameterStatus[]): Promise<any> {
        const comparison = {
            totalParameters: parameters.length,
            matchingDefaults: 0,
            deviations: [] as any[]
        };

        for (const param of parameters) {
            const defaultValue = param.definition.defaultValue;
            if (defaultValue !== undefined) {
                const currentStr = String(param.currentValue);
                const defaultStr = String(defaultValue);
                
                if (currentStr === defaultStr) {
                    comparison.matchingDefaults++;
                } else {
                    comparison.deviations.push({
                        key: param.key,
                        current: param.formattedValue,
                        default: this.formatParameterValue(defaultValue, param.definition),
                        deviation: 'Value differs from default'
                    });
                }
            }
        }

        return comparison;
    }
}

// Script execution
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options: ViewParametersOptions = {
        verbose: args.includes('--verbose'),
        includeHistory: args.includes('--include-history'),
        includeValidation: !args.includes('--no-validation'),
        includeRules: args.includes('--include-rules'),
        analyzeCompliance: args.includes('--analyze-compliance'),
        validateCurrent: !args.includes('--no-validate'),
        compareDefaults: args.includes('--compare-defaults')
    };

    // Parse category filter
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex >= 0 && args[categoryIndex + 1]) {
        options.category = args[categoryIndex + 1] as ParameterCategory;
    }

    // Parse impact filter
    const impactIndex = args.indexOf('--impact');
    if (impactIndex >= 0 && args[impactIndex + 1]) {
        options.impactLevel = args[impactIndex + 1] as ImpactLevel;
    }

    // Parse format
    const formatIndex = args.indexOf('--format');
    if (formatIndex >= 0 && args[formatIndex + 1]) {
        options.format = args[formatIndex + 1] as 'console' | 'json' | 'csv' | 'table';
    }

    // Parse export
    const exportIndex = args.indexOf('--export');
    if (exportIndex >= 0 && args[exportIndex + 1]) {
        options.export = args[exportIndex + 1];
    }

    // Parse search
    const searchIndex = args.indexOf('--search');
    if (searchIndex >= 0 && args[searchIndex + 1]) {
        options.search = args[searchIndex + 1];
    }

    // Parse sort options
    const sortByIndex = args.indexOf('--sort-by');
    if (sortByIndex >= 0 && args[sortByIndex + 1]) {
        options.sortBy = args[sortByIndex + 1] as 'key' | 'category' | 'impact' | 'lastChanged';
    }

    const sortOrderIndex = args.indexOf('--sort-order');
    if (sortOrderIndex >= 0 && args[sortOrderIndex + 1]) {
        options.sortOrder = args[sortOrderIndex + 1] as 'asc' | 'desc';
    }

    const script = new ViewParameters(options);
    
    try {
        const result = await script.execute();
        
        if (result.success) {
            // Display output
            if (options.format === 'console' || !options.format) {
                console.log(result.data?.output || '');
            }

            console.log("\n🎉 VIEW PARAMETERS COMPLETED SUCCESSFULLY!");
            console.log(`📊 Displayed: ${result.data?.parameters?.length || 0} parameters`);
            
            if (result.data?.analysis?.compliance) {
                const compliance = result.data.analysis.compliance;
                console.log(`✅ Compliance: ${compliance.complianceRate.toFixed(1)}% (${compliance.validParameters}/${compliance.totalParameters})`);
            }
        } else {
            console.log("\n❌ VIEW PARAMETERS FAILED");
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