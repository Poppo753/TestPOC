# Phase 2 - Admin Operations
## Complete Documentation & Operational Guide

**Version:** 2.0.0  
**Date:** 2024  
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Admin Scripts Reference](#admin-scripts-reference)
4. [Operational Procedures](#operational-procedures)
5. [Security Considerations](#security-considerations)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Appendices](#appendices)

---

## 🎯 Overview

Phase 2 delivers a comprehensive suite of **10 production-ready admin scripts** organized in 4 categories:

### Script Categories

| Category | Scripts | Purpose | LOC |
|----------|---------|---------|-----|
| **Parameter Management** | 3 scripts | Safe parameter updates, viewing, validation | ~2,500 |
| **System Administration** | 3 scripts | Health monitoring, deployment tracking, diagnostics | ~3,700 |
| **Access Control** | 2 scripts | Role management, access auditing | ~2,000 |
| **Emergency Response** | 2 scripts | Emergency controls, backup/recovery | ~1,850 |
| **Total** | **10 scripts** | **Complete admin operations** | **~10,050** |

### Key Capabilities

✅ **Parameter Management**: Safe updates with validation, rollback, impact assessment  
✅ **System Health**: Real-time monitoring with 7 component checks, continuous mode  
✅ **Deployment Verification**: Multi-stage deployment checks with security assessment  
✅ **Performance Diagnostics**: Gas analysis, error detection, optimization recommendations  
✅ **Role Management**: RBAC administration with security violation detection  
✅ **Access Auditing**: Behavioral analysis, anomaly detection, compliance reporting  
✅ **Emergency Response**: 5-level protocols, circuit breakers, system pause/resume  
✅ **Backup/Recovery**: State snapshots, point-in-time recovery, integrity validation  

---

## 🚀 Quick Start

### Prerequisites

```bash
# Verify environment
node --version    # >= 18.0.0
npm --version     # >= 9.0.0

# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### Basic Commands

```bash
# Parameter Management
npx hardhat run scripts/admin/parameters/ViewParameters.ts
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key depositFee --value 100 --dry-run

# System Health
npx hardhat run scripts/admin/system/SystemHealth.ts -- --continuous --interval 60

# Emergency Response
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --check
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --backup
```

---

## 📚 Admin Scripts Reference

### 1. Parameter Management Scripts

#### 1.1 UpdateParameters.ts
**Purpose**: Safely update system parameters with validation and rollback

**Key Features:**
- Pre-execution validation with dry-run mode
- Impact assessment before changes
- Automatic rollback on failure
- Comprehensive audit trail
- Multi-parameter batch updates

**Usage Examples:**

```bash
# View current value first
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --key depositFee

# Dry run to preview changes
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key depositFee --value 100 --dry-run

# Execute with impact assessment
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key depositFee --value 100 --impact --verbose

# Batch update with validation
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --batch updates.json --validate --rollback-on-fail

# Emergency update (skip validation)
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key emergencyDelay --value 3600 --force
```

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--key` | string | Parameter key to update | - |
| `--value` | any | New parameter value | - |
| `--batch` | string | JSON file with multiple updates | - |
| `--dry-run` | flag | Preview without executing | false |
| `--impact` | flag | Show impact assessment | false |
| `--validate` | flag | Validate before execution | true |
| `--rollback-on-fail` | flag | Auto-rollback on error | false |
| `--force` | flag | Skip safety checks | false |
| `--verbose` | flag | Detailed logging | false |

**Safety Mechanisms:**
- ✅ Pre-validation of all parameter values
- ✅ Range and type checking
- ✅ Business rule validation
- ✅ Impact analysis on related components
- ✅ Automatic rollback capability
- ✅ Audit log generation

---

#### 1.2 ViewParameters.ts
**Purpose**: Query and display system parameters with advanced filtering

**Key Features:**
- View all parameters or specific keys
- Advanced filtering by category, modified date
- Multiple output formats (console, JSON, CSV)
- Sorting and export capabilities
- Diff comparison between states

**Usage Examples:**

```bash
# View all parameters
npx hardhat run scripts/admin/parameters/ViewParameters.ts

# View specific parameter
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --key depositFee

# View by category with verbose details
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --category fees --verbose

# View recently modified (last 7 days)
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --modified-since 7

# Export to JSON
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --format json --export parameters.json

# Export to CSV for analysis
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --format csv --export parameters.csv

# Compare with backup
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --diff backup-state.json
```

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--key` | string | Specific parameter key | - |
| `--category` | string | Filter by category (fees/limits/timing) | - |
| `--modified-since` | number | Days since modification | - |
| `--format` | string | Output format (console/json/csv) | console |
| `--export` | string | Export to file | - |
| `--sort` | string | Sort by field (key/value/modified) | key |
| `--diff` | string | Compare with JSON file | - |
| `--verbose` | flag | Show detailed info | false |

**Output Formats:**

1. **Console** (default): Human-readable table with colors
2. **JSON**: Machine-readable format for automation
3. **CSV**: Spreadsheet-compatible for analysis

---

#### 1.3 ValidateParameters.ts
**Purpose**: Comprehensive parameter validation with multi-level checks

**Key Features:**
- Type and range validation
- Cross-parameter dependency checks
- Business rule validation
- Security assessment
- Detailed validation reports

**Usage Examples:**

```bash
# Validate all parameters
npx hardhat run scripts/admin/parameters/ValidateParameters.ts

# Validate specific parameter
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --key depositFee

# Full validation with security checks
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --security --verbose

# Validate parameter set from file
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --file proposed-changes.json

# Quick check (basic validation only)
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --quick

# Generate validation report
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --report validation-report.json
```

**Validation Levels:**

1. **Type Validation**: Ensures correct data types
2. **Range Validation**: Checks min/max boundaries
3. **Cross-Parameter**: Validates parameter relationships
4. **Business Rules**: Enforces business logic constraints
5. **Security Assessment**: Identifies security risks

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--key` | string | Validate specific parameter | - |
| `--file` | string | Validate parameters from JSON | - |
| `--security` | flag | Include security assessment | false |
| `--quick` | flag | Basic validation only | false |
| `--report` | string | Save report to file | - |
| `--fix-suggestions` | flag | Show fix recommendations | false |
| `--verbose` | flag | Detailed validation output | false |

---

### 2. System Administration Scripts

#### 2.1 SystemHealth.ts
**Purpose**: Real-time system health monitoring and alerting

**Key Features:**
- 7 component health checks
- Composite health scoring (0-100)
- Continuous monitoring mode
- Alert generation on threshold breach
- Historical tracking

**Usage Examples:**

```bash
# Quick health check
npx hardhat run scripts/admin/system/SystemHealth.ts

# Detailed health report
npx hardhat run scripts/admin/system/SystemHealth.ts -- --verbose

# Continuous monitoring (checks every 60 seconds)
npx hardhat run scripts/admin/system/SystemHealth.ts -- --continuous --interval 60

# Monitor specific components
npx hardhat run scripts/admin/system/SystemHealth.ts -- --components beacon,tokenManager,liquidity

# Generate alerts on low health
npx hardhat run scripts/admin/system/SystemHealth.ts -- --alert-threshold 70 --continuous

# Export health report
npx hardhat run scripts/admin/system/SystemHealth.ts -- --export health-report.json
```

**Health Components (Weight in Score):**

| Component | Weight | Checks |
|-----------|--------|--------|
| Beacon | 15% | Initialization, module access |
| TokenManager | 15% | Token operations, balances |
| LiquidityManager | 15% | Liquidity state, reserves |
| SwapManager | 15% | Swap functionality |
| ParameterManager | 10% | Parameter access |
| EmergencyHandler | 20% | Emergency system status |
| ValueCalculator | 10% | Calculation accuracy |

**Health Scoring:**
- **90-100**: Excellent ✅
- **70-89**: Good ⚠️
- **50-69**: Warning ⚠️⚠️
- **0-49**: Critical 🚨

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--continuous` | flag | Continuous monitoring mode | false |
| `--interval` | number | Check interval (seconds) | 60 |
| `--components` | string | Comma-separated component list | all |
| `--alert-threshold` | number | Alert when health below | 70 |
| `--export` | string | Export report to file | - |
| `--verbose` | flag | Detailed component info | false |

---

#### 2.2 DeploymentMonitor.ts
**Purpose**: Verify deployment integrity and configuration

**Key Features:**
- Multi-stage deployment verification
- Bytecode verification
- Configuration validation
- Integration testing
- Security assessment
- Risk scoring

**Usage Examples:**

```bash
# Full deployment verification
npx hardhat run scripts/admin/system/DeploymentMonitor.ts

# Quick verification (deployment + bytecode only)
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --quick

# Security-focused verification
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --security --verbose

# Verify specific modules
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --modules tokenManager,liquidityManager

# Generate deployment report
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --report deployment-report.json

# Continuous monitoring for changes
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --watch --interval 300
```

**Verification Stages:**

1. **Deployment Check**: Verify contracts deployed and accessible
2. **Bytecode Verification**: Compare deployed vs expected bytecode
3. **Configuration Validation**: Check parameter settings
4. **Integration Testing**: Verify inter-module communication
5. **Security Assessment**: Identify potential security issues

**Security Checks:**
- Access control configuration
- Emergency system status
- Parameter safety ranges
- Module permissions
- Ownership verification

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--quick` | flag | Basic checks only | false |
| `--security` | flag | Include security assessment | false |
| `--modules` | string | Verify specific modules | all |
| `--report` | string | Save report to file | - |
| `--watch` | flag | Continuous monitoring | false |
| `--interval` | number | Check interval (seconds) | 300 |
| `--verbose` | flag | Detailed output | false |

---

#### 2.3 SystemDiagnostics.ts
**Purpose**: Deep system analysis with performance profiling

**Key Features:**
- Performance analysis
- Gas profiling
- Error pattern detection
- State consistency checks
- Optimization recommendations
- Anomaly detection

**Usage Examples:**

```bash
# Full system diagnostics
npx hardhat run scripts/admin/system/SystemDiagnostics.ts

# Performance analysis
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --performance --verbose

# Gas profiling
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --gas-analysis

# Error pattern detection
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --errors --period 7

# State consistency check
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --consistency

# Full diagnostic with optimization tips
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --optimize --report diagnostics.json

# Anomaly detection
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --anomalies --sensitivity high
```

**Analysis Categories:**

1. **Performance**: Operation timing, throughput analysis
2. **Gas Efficiency**: Gas usage patterns, optimization opportunities
3. **Error Patterns**: Common errors, failure rates
4. **State Consistency**: Data integrity, synchronization
5. **Anomalies**: Unusual patterns, potential issues

**Optimization Recommendations:**
- Gas optimization suggestions
- Parameter tuning recommendations
- Architecture improvements
- Performance bottleneck identification

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--performance` | flag | Performance analysis | false |
| `--gas-analysis` | flag | Gas profiling | false |
| `--errors` | flag | Error pattern detection | false |
| `--period` | number | Analysis period (days) | 7 |
| `--consistency` | flag | State consistency check | false |
| `--optimize` | flag | Show optimization tips | false |
| `--anomalies` | flag | Anomaly detection | false |
| `--sensitivity` | string | Anomaly sensitivity (low/medium/high) | medium |
| `--report` | string | Save report to file | - |
| `--verbose` | flag | Detailed analysis | false |

---

### 3. Access Control Scripts

#### 3.1 RoleManager.ts
**Purpose**: Manage role-based access control (RBAC)

**Key Features:**
- Role assignment/revocation
- Permission auditing
- Security violation detection
- Multi-signature support
- Compliance checking

**Usage Examples:**

```bash
# View all roles
npx hardhat run scripts/admin/access/RoleManager.ts -- --list

# View specific role holders
npx hardhat run scripts/admin/access/RoleManager.ts -- --role ADMIN_ROLE

# Grant role
npx hardhat run scripts/admin/access/RoleManager.ts -- --grant --role OPERATOR_ROLE --address 0x123... --dry-run

# Revoke role
npx hardhat run scripts/admin/access/RoleManager.ts -- --revoke --role OPERATOR_ROLE --address 0x123...

# Audit all access
npx hardhat run scripts/admin/access/RoleManager.ts -- --audit --export audit-report.json

# Check for security violations
npx hardhat run scripts/admin/access/RoleManager.ts -- --security-check --verbose

# Batch role operations
npx hardhat run scripts/admin/access/RoleManager.ts -- --batch role-changes.json
```

**Standard Roles:**

| Role | Permissions | Typical Use |
|------|-------------|-------------|
| DEFAULT_ADMIN_ROLE | Grant/revoke all roles | System owner |
| ADMIN_ROLE | Parameter updates, system config | Day-to-day admin |
| OPERATOR_ROLE | Execute operations | Automated systems |
| EMERGENCY_ROLE | Emergency controls | Emergency responders |
| UPGRADER_ROLE | Contract upgrades | Upgrade procedures |

**Security Violation Types:**
- Excessive permissions
- Role conflicts
- Unauthorized access attempts
- Dormant accounts with high privileges
- Missing required roles

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--list` | flag | List all roles | false |
| `--role` | string | Specific role name | - |
| `--grant` | flag | Grant role to address | false |
| `--revoke` | flag | Revoke role from address | false |
| `--address` | string | Target address | - |
| `--audit` | flag | Full access audit | false |
| `--security-check` | flag | Detect violations | false |
| `--batch` | string | Batch operations from JSON | - |
| `--export` | string | Export report to file | - |
| `--dry-run` | flag | Preview without execution | false |
| `--verbose` | flag | Detailed output | false |

---

#### 3.2 AccessAuditor.ts
**Purpose**: Monitor and analyze access patterns

**Key Features:**
- Access pattern analysis
- Behavioral anomaly detection (5 types)
- Risk scoring
- Compliance reporting
- Alert generation

**Usage Examples:**

```bash
# Full access audit
npx hardhat run scripts/admin/access/AccessAuditor.ts

# Analyze recent activity (last 24 hours)
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --period 1 --verbose

# Anomaly detection
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --anomalies --threshold high

# Check specific address
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --address 0x123... --detailed

# Compliance report
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --compliance --export compliance-report.json

# Continuous monitoring
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --monitor --interval 300 --alert-on-anomaly
```

**Anomaly Types Detected:**

1. **Unusual Frequency**: Excessive operation rate
2. **Suspicious Pattern**: Unusual access patterns
3. **Privilege Escalation**: Unauthorized permission changes
4. **Unauthorized Attempt**: Failed access attempts
5. **Abnormal Timing**: Activity during unusual hours

**Risk Scoring Factors:**
- Access frequency
- Failed attempts rate
- Permission level
- Time pattern abnormality

**Risk Levels:**
- **0-25**: Low 🟢
- **26-50**: Medium 🟡
- **51-75**: High 🟠
- **76-100**: Critical 🔴

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--period` | number | Analysis period (days) | 7 |
| `--anomalies` | flag | Detect anomalies | false |
| `--threshold` | string | Anomaly threshold (low/medium/high) | medium |
| `--address` | string | Analyze specific address | - |
| `--detailed` | flag | Detailed address analysis | false |
| `--compliance` | flag | Generate compliance report | false |
| `--monitor` | flag | Continuous monitoring | false |
| `--interval` | number | Check interval (seconds) | 300 |
| `--alert-on-anomaly` | flag | Alert on detection | false |
| `--export` | string | Export report to file | - |
| `--verbose` | flag | Detailed output | false |

---

### 4. Emergency Response Scripts

#### 4.1 EmergencyControl.ts
**Purpose**: Emergency system control and circuit breakers

**Key Features:**
- 5-level emergency protocols
- System-wide pause/resume
- Circuit breaker activation
- Health validation
- Recovery planning
- Incident logging

**Usage Examples:**

```bash
# Check emergency status
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --check

# Trigger emergency (level 3 - PARTIAL)
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --trigger --level 3 --reason "Suspected exploit" --dry-run

# Pause specific module
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --pause --module SwapManager

# Pause entire system
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --pause-all

# Resume after emergency
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --resume --validate-health

# Generate recovery plan
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --recovery-plan --level 4

# View incident log
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --log --period 30
```

**Emergency Levels:**

| Level | Name | Actions | Use Case |
|-------|------|---------|----------|
| 0 | NONE | Normal operation | No emergency |
| 1 | WARNING | Monitoring increased | Suspicious activity |
| 2 | PARTIAL | Non-critical paused | Minor issue detected |
| 3 | CRITICAL | Most operations paused | Serious issue |
| 4 | FULL_SHUTDOWN | All operations stopped | Critical emergency |

**Circuit Breaker Modules:**
- TokenManager
- LiquidityManager
- SwapManager
- ParameterManager

**Recovery Steps (6-phase):**
1. Assess Damage
2. Secure System
3. Investigate Root Cause
4. Implement Fix
5. Test Recovery
6. Resume Operations

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--check` | flag | Check emergency status | false |
| `--trigger` | flag | Trigger emergency | false |
| `--level` | number | Emergency level (1-4) | - |
| `--reason` | string | Emergency reason | - |
| `--pause` | flag | Pause module | false |
| `--pause-all` | flag | Pause all modules | false |
| `--module` | string | Target module name | - |
| `--resume` | flag | Resume operations | false |
| `--validate-health` | flag | Health check before resume | true |
| `--recovery-plan` | flag | Generate recovery plan | false |
| `--log` | flag | View incident log | false |
| `--period` | number | Log period (days) | 30 |
| `--dry-run` | flag | Preview without execution | false |
| `--force` | flag | Skip safety checks | false |
| `--verbose` | flag | Detailed output | false |

---

#### 4.2 RecoveryManager.ts
**Purpose**: System backup, restoration, and recovery

**Key Features:**
- State snapshot creation
- Point-in-time recovery
- Backup verification
- Recovery validation
- Data integrity checks
- Automated restoration

**Usage Examples:**

```bash
# Create backup
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --backup --description "Pre-upgrade backup"

# List all backups
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --list

# Restore from backup
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --restore --backup-id backup-123 --dry-run

# Execute restoration
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --restore --backup-id backup-123 --force

# Verify recovery
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --verify --backup-id backup-123

# General system verification
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --verify --verbose
```

**Backup Components:**

1. **Contract States**: Pause status, ownership, configurations
2. **Parameter States**: All parameter values and settings
3. **Balance States**: Contract and token balances
4. **Role States**: Role assignments and permissions

**Recovery Process:**

1. **Load Backup**: Retrieve backup file
2. **Verify Integrity**: Check backup checksum
3. **Generate Plan**: Create recovery action plan
4. **Validate Safety**: Assess risks and prerequisites
5. **Execute Recovery**: Apply backup state
6. **Verify Results**: Validate recovery success

**Recovery Action Types:**
- RESTORE_PARAMETER: Restore parameter values
- RESTORE_ROLE: Restore role assignments
- RESTORE_BALANCE: Restore balance states
- UNPAUSE_CONTRACT: Unpause paused contracts
- UPDATE_STATE: Update contract states
- VERIFY_INTEGRITY: Verify system integrity

**Command Line Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--backup` | flag | Create system backup | false |
| `--description` | string | Backup description | Auto-generated |
| `--list` | flag | List all backups | false |
| `--restore` | flag | Restore from backup | false |
| `--backup-id` | string | Backup identifier | - |
| `--verify` | flag | Verify recovery status | false |
| `--validate-before` | flag | Validate before restore | true |
| `--validate-after` | flag | Validate after restore | true |
| `--force` | flag | Execute restoration | false |
| `--verbose` | flag | Detailed output | false |

**Backup Files:**
- Location: `./backups/`
- Format: JSON
- Naming: `backup-{timestamp}-{random}.json`
- Includes: Full system state + checksum

---

## 🔐 Security Considerations

### Access Control

**Role Hierarchy:**
```
DEFAULT_ADMIN_ROLE (Root)
    ├── ADMIN_ROLE (Admin operations)
    ├── EMERGENCY_ROLE (Emergency response)
    ├── UPGRADER_ROLE (Upgrades)
    └── OPERATOR_ROLE (Operations)
```

**Security Best Practices:**
1. ✅ Use separate accounts for different roles
2. ✅ Implement multi-signature for critical operations
3. ✅ Regular access audits (weekly recommended)
4. ✅ Monitor for security violations
5. ✅ Review and rotate credentials periodically
6. ✅ Document all role assignments

### Parameter Updates

**Safety Checklist:**
- [ ] Always run dry-run first
- [ ] Review impact assessment
- [ ] Validate new values
- [ ] Have rollback plan ready
- [ ] Monitor system after changes
- [ ] Document changes in audit log

**High-Risk Parameters:**
- Fee rates (impacts revenue)
- Limits (impacts operations)
- Emergency delays (impacts response time)
- Oracle settings (impacts pricing)

### Emergency Procedures

**Emergency Response Protocol:**

1. **Detection** (0-5 min)
   - Monitor alerts
   - Identify issue severity
   - Document initial findings

2. **Containment** (5-15 min)
   - Trigger appropriate emergency level
   - Pause affected modules
   - Activate circuit breakers

3. **Investigation** (15-60 min)
   - Analyze logs and events
   - Identify root cause
   - Assess damage

4. **Resolution** (1-4 hours)
   - Implement fix
   - Test thoroughly
   - Prepare recovery plan

5. **Recovery** (30 min - 2 hours)
   - Execute recovery plan
   - Validate system state
   - Resume operations gradually

6. **Post-Mortem** (1-2 days)
   - Document incident
   - Identify improvements
   - Update procedures

### Backup Strategy

**Backup Schedule:**
- **Daily**: Automated nightly backups
- **Pre-Upgrade**: Before any contract upgrade
- **Pre-Parameter Change**: Before major parameter updates
- **On-Demand**: When requested by admin

**Backup Retention:**
- Keep last 30 daily backups
- Keep all pre-upgrade backups indefinitely
- Keep incident-related backups indefinitely

**Backup Verification:**
- Automated checksum validation
- Weekly restore testing
- Quarterly full recovery drill

---

## 📖 Best Practices

### Daily Operations

**Morning Routine:**
```bash
# 1. Check system health
npx hardhat run scripts/admin/system/SystemHealth.ts

# 2. Review overnight activity
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --period 1

# 3. Check for alerts
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --check
```

**Weekly Tasks:**
```bash
# 1. Full system audit
npx hardhat run scripts/admin/access/RoleManager.ts -- --audit --export weekly-audit.json

# 2. Deployment verification
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --security

# 3. Performance review
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --performance

# 4. Create backup
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --backup --description "Weekly backup"
```

**Monthly Tasks:**
```bash
# 1. Comprehensive diagnostics
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --optimize --report monthly-diagnostics.json

# 2. Access pattern analysis
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --period 30 --compliance

# 3. Parameter validation
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --security --report monthly-validation.json

# 4. Recovery drill
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --verify
```

### Monitoring Strategy

**Real-Time Monitoring:**
```bash
# Terminal 1: System health
npx hardhat run scripts/admin/system/SystemHealth.ts -- --continuous --interval 60 --alert-threshold 70

# Terminal 2: Access monitoring
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --monitor --interval 300 --alert-on-anomaly

# Terminal 3: Deployment watch
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --watch --interval 600
```

**Alert Escalation:**
- **Level 1** (Low): Log only
- **Level 2** (Medium): Email notification
- **Level 3** (High): SMS + email
- **Level 4** (Critical): Immediate call + SMS + email

### Incident Response

**Response Times (SLA):**
- **Critical**: < 15 minutes
- **High**: < 1 hour
- **Medium**: < 4 hours
- **Low**: < 24 hours

**Escalation Path:**
1. On-call operator (first 15 min)
2. Senior admin (after 15 min)
3. Development team (after 30 min)
4. Management (if major incident)

### Documentation

**Required Documentation:**
- All parameter changes with justification
- Emergency activations with incident reports
- Role assignments with approval records
- Backup creation with descriptions
- Recovery operations with validation results

**Audit Trail Requirements:**
- Who performed the action
- What action was performed
- When it was performed
- Why it was necessary
- What the result was

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Module not found" Error

**Problem**: Script cannot find module contract

**Solutions:**
```bash
# 1. Verify Beacon address
npx hardhat run scripts/admin/system/DeploymentMonitor.ts

# 2. Check module registration
npx hardhat run scripts/admin/system/SystemHealth.ts -- --verbose

# 3. Verify deployment
npx hardhat run scripts/admin/system/DeploymentMonitor.ts -- --quick
```

#### 2. Parameter Update Fails

**Problem**: Parameter update rejected

**Solutions:**
```bash
# 1. Validate parameter first
npx hardhat run scripts/admin/parameters/ValidateParameters.ts -- --key depositFee

# 2. Check current value
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --key depositFee

# 3. Try dry-run
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key depositFee --value 100 --dry-run

# 4. Check permissions
npx hardhat run scripts/admin/access/RoleManager.ts -- --role ADMIN_ROLE
```

#### 3. Health Check Returns Low Score

**Problem**: System health below 70%

**Actions:**
```bash
# 1. Detailed health check
npx hardhat run scripts/admin/system/SystemHealth.ts -- --verbose

# 2. Run diagnostics
npx hardhat run scripts/admin/system/SystemDiagnostics.ts

# 3. Check for errors
npx hardhat run scripts/admin/system/SystemDiagnostics.ts -- --errors --period 1

# 4. If critical, consider emergency mode
npx hardhat run scripts/admin/emergency/EmergencyControl.ts -- --check
```

#### 4. Access Anomaly Detected

**Problem**: Suspicious access pattern identified

**Actions:**
```bash
# 1. Detailed analysis
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --address 0x... --detailed

# 2. Check role assignments
npx hardhat run scripts/admin/access/RoleManager.ts -- --security-check

# 3. Review recent activity
npx hardhat run scripts/admin/access/AccessAuditor.ts -- --period 1 --verbose

# 4. If malicious, revoke access
npx hardhat run scripts/admin/access/RoleManager.ts -- --revoke --role ROLE_NAME --address 0x...
```

#### 5. Recovery Validation Fails

**Problem**: Recovery validation shows discrepancies

**Actions:**
```bash
# 1. Check specific discrepancies
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --verify --backup-id backup-123 --verbose

# 2. Compare current vs backup state
npx hardhat run scripts/admin/parameters/ViewParameters.ts -- --diff backups/backup-123.json

# 3. Manual correction if needed
npx hardhat run scripts/admin/parameters/UpdateParameters.ts -- --key KEY --value VALUE

# 4. Verify again
npx hardhat run scripts/admin/emergency/RecoveryManager.ts -- --verify --backup-id backup-123
```

### Error Messages

**Common Error Messages and Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Insufficient permissions" | Wrong role | Check with `RoleManager.ts --list` |
| "Parameter validation failed" | Invalid value | Use `ValidateParameters.ts` first |
| "Backup checksum mismatch" | Corrupted backup | Use different backup |
| "Emergency already active" | System in emergency | Check with `EmergencyControl.ts --check` |
| "Module paused" | Circuit breaker active | Resume with `EmergencyControl.ts --resume` |

---

## 📊 Appendices

### Appendix A: Script Quick Reference

```bash
# Parameter Management
scripts/admin/parameters/UpdateParameters.ts   # Update parameters
scripts/admin/parameters/ViewParameters.ts     # View parameters
scripts/admin/parameters/ValidateParameters.ts # Validate parameters

# System Administration
scripts/admin/system/SystemHealth.ts          # Health monitoring
scripts/admin/system/DeploymentMonitor.ts     # Deployment verification
scripts/admin/system/SystemDiagnostics.ts     # System diagnostics

# Access Control
scripts/admin/access/RoleManager.ts           # Role management
scripts/admin/access/AccessAuditor.ts         # Access auditing

# Emergency Response
scripts/admin/emergency/EmergencyControl.ts   # Emergency controls
scripts/admin/emergency/RecoveryManager.ts    # Backup & recovery
```

### Appendix B: Role Permission Matrix

| Operation | DEFAULT_ADMIN | ADMIN | OPERATOR | EMERGENCY | UPGRADER |
|-----------|--------------|-------|----------|-----------|----------|
| Update Parameters | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Parameters | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grant/Revoke Roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Trigger Emergency | ✅ | ✅ | ❌ | ✅ | ❌ |
| Pause/Resume | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create Backup | ✅ | ✅ | ✅ | ✅ | ✅ |
| Restore Backup | ✅ | ✅ | ❌ | ✅ | ❌ |
| Upgrade Contracts | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Health | ✅ | ✅ | ✅ | ✅ | ✅ |
| Run Diagnostics | ✅ | ✅ | ✅ | ✅ | ✅ |

### Appendix C: Emergency Level Decision Matrix

| Indicator | WARNING (1) | PARTIAL (2) | CRITICAL (3) | FULL (4) |
|-----------|------------|-------------|--------------|----------|
| Health Score | 60-69 | 50-59 | 30-49 | < 30 |
| Failed Transactions | 5-10% | 10-25% | 25-50% | > 50% |
| Suspicious Activity | Low | Medium | High | Critical |
| Financial Impact | < $1K | $1K-$10K | $10K-$100K | > $100K |
| User Impact | < 1% | 1-10% | 10-50% | > 50% |
| Response Time | 1 hour | 30 min | 15 min | Immediate |

### Appendix D: Backup Naming Convention

```
Format: backup-{timestamp}-{random}.json

Examples:
backup-1704067200000-456.json   # Automated daily
backup-pre-upgrade-v2.1.0.json  # Pre-upgrade
backup-incident-2024-01-15.json # Incident-related
backup-weekly-2024-W03.json     # Weekly scheduled
```

### Appendix E: Script Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | None |
| 1 | General error | Check error message |
| 2 | Validation failed | Fix input |
| 3 | Permission denied | Check roles |
| 4 | Emergency active | Resolve emergency |
| 5 | Backup failed | Check disk space |

---

## 🎓 Training Resources

### New Admin Onboarding (Week 1)

**Day 1-2: Basics**
- System overview
- Script execution fundamentals
- Parameter viewing and validation

**Day 3-4: Monitoring**
- Health monitoring
- Access auditing
- Alert interpretation

**Day 5: Emergency Response**
- Emergency procedures
- Recovery operations
- Incident documentation

### Advanced Topics (Week 2)

- Complex parameter updates
- Performance optimization
- Security hardening
- Custom monitoring dashboards
- Automated alerting setup

---

## 📞 Support & Contact

**Emergency Contact:**
- **Critical Issues**: [emergency-contact]
- **Response Time**: < 15 minutes

**General Support:**
- **Email**: [support-email]
- **Response Time**: < 4 hours

**Documentation:**
- **GitHub**: [repo-url]
- **Wiki**: [wiki-url]

---

**Document Version:** 2.0.0  
**Last Updated:** 2024  
**Next Review:** 2024-Q2  
**Maintained By:** DeFi Development Team

---

*This documentation is part of Phase 2 - Admin Operations implementation. For Phase 1 deployment procedures, see `docs/Sprint1_Completamento_Report.md`*
