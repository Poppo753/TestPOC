# Security Control Scripts

Emergency system pause/unpause operations for critical situations.

## 📋 Available Scripts

### 1. PauseSystem.ts
Emergency system pause to block all user operations.

**When to Use:**
- Oracle malfunction detected
- Smart contract vulnerability discovered
- Suspicious activity detected
- Planned emergency maintenance
- Critical bug identified

**Effects:**
- ⛔ Blocks all deposits
- ⛔ Blocks all withdrawals
- ⛔ Blocks all swaps
- ⛔ Blocks all LP token operations
- ✅ Only owner can unpause

**Usage:**
```bash
# Pause with reason
PAUSE_REASON="Oracle malfunction detected" \
npx hardhat run scripts/admin/security/PauseSystem.ts

# Skip confirmation
SKIP_CONFIRMATION=true \
PAUSE_REASON="Emergency maintenance" \
npx hardhat run scripts/admin/security/PauseSystem.ts

# Dry run test
DRY_RUN=true PAUSE_REASON="Testing" \
npx hardhat run scripts/admin/security/PauseSystem.ts
```

### 2. UnpauseSystem.ts
Restore system to normal operation after pause.

**Pre-Requisites:**
- Issue that caused pause must be resolved
- All system components must be operational
- Owner authorization required

**Safety Checks:**
- ✅ Beacon contract responsive
- ✅ TokenManager operational
- ✅ ParameterManager accessible
- ✅ ValueCalculator working
- ✅ All modules healthy

**Usage:**
```bash
# Unpause with full checks
npx hardhat run scripts/admin/security/UnpauseSystem.ts

# Skip safety checks (use with extreme caution)
SKIP_CHECKS=true \
npx hardhat run scripts/admin/security/UnpauseSystem.ts

# Disable operation testing
TEST_OPERATIONS=false \
npx hardhat run scripts/admin/security/UnpauseSystem.ts
```

## 🚨 Emergency Response Procedures

### Level 1: Oracle Issue
```bash
# 1. Pause immediately
PAUSE_REASON="Oracle price anomaly detected" \
SKIP_CONFIRMATION=true \
npx hardhat run scripts/admin/security/PauseSystem.ts

# 2. Investigate oracle
# ... check Chainlink status, compare prices ...

# 3. Update oracle if needed
TOKEN_CODE=USDC NEW_PRICE_FEED=0x... FULL_UPDATE=true \
npx hardhat run scripts/admin/tokens/UpdateOracles.ts

# 4. Unpause system
npx hardhat run scripts/admin/security/UnpauseSystem.ts
```

### Level 2: Smart Contract Vulnerability
```bash
# 1. Pause immediately
PAUSE_REASON="Security vulnerability identified" \
SKIP_CONFIRMATION=true \
npx hardhat run scripts/admin/security/PauseSystem.ts

# 2. Deploy fix or implement mitigation
# ... contract upgrade or parameter adjustment ...

# 3. Verify fix in test environment
DRY_RUN=true npx hardhat run scripts/admin/security/UnpauseSystem.ts

# 4. Unpause after verification
npx hardhat run scripts/admin/security/UnpauseSystem.ts
```

### Level 3: Suspicious Activity
```bash
# 1. Pause system
PAUSE_REASON="Suspicious activity under investigation" \
npx hardhat run scripts/admin/security/PauseSystem.ts

# 2. Audit logs and access
npx hardhat run scripts/admin/access/AccessAuditor.ts

# 3. Review transactions
# ... analyze on-chain activity ...

# 4. Take corrective action if needed
# ... revoke access, update permissions ...

# 5. Unpause when safe
npx hardhat run scripts/admin/security/UnpauseSystem.ts
```

## 🔒 Authorization

**Pause System:**
- ✅ Contract owner
- ✅ Authorized modules (EmergencyHandler, etc.)

**Unpause System:**
- ✅ Contract owner ONLY
- ❌ Authorized modules cannot unpause

This asymmetry ensures that unpausing requires explicit owner action.

## 📊 Monitoring During Pause

While system is paused, you can still:
- ✅ View system state
- ✅ Check balances
- ✅ Run diagnostics
- ✅ Monitor events
- ✅ Prepare recovery actions

Use these monitoring scripts:
```bash
npx hardhat run scripts/admin/system/SystemHealth.ts
npx hardhat run scripts/admin/system/SystemDiagnostics.ts
npx hardhat run scripts/admin/parameters/ViewParameters.ts
```

## ⚠️ Important Notes

### Before Pausing:
1. **Document the reason** - Include detailed pause reason
2. **Notify stakeholders** - Alert users about the pause
3. **Capture system state** - Take snapshots for analysis
4. **Plan resolution** - Have clear steps to resolve issue

### While Paused:
1. **Monitor continuously** - Watch for any changes
2. **Investigate root cause** - Determine what went wrong
3. **Test fixes** - Verify solutions in test environment
4. **Communicate status** - Keep stakeholders informed

### Before Unpausing:
1. **Verify fix** - Confirm issue is resolved
2. **Run safety checks** - Ensure all components operational
3. **Test operations** - Verify system behavior
4. **Prepare monitoring** - Watch system closely after unpause

### After Unpausing:
1. **Monitor closely** - Watch for any anomalies
2. **Verify normal operation** - Test small user operations
3. **Document incident** - Record what happened and resolution
4. **Review procedures** - Update response procedures if needed

## 🔗 Related Scripts

- **System Health**: `scripts/admin/system/SystemHealth.ts`
- **Emergency Control**: `scripts/admin/emergency/EmergencyControl.ts`
- **Recovery Manager**: `scripts/admin/emergency/RecoveryManager.ts`
- **Access Auditor**: `scripts/admin/access/AccessAuditor.ts`

## 📝 Incident Log Template

```
Incident #: [AUTO-INCREMENT]
Date/Time: [ISO-8601 TIMESTAMP]
Severity: [CRITICAL/HIGH/MEDIUM/LOW]

Pause Details:
- Triggered By: [ADDRESS]
- Reason: [DETAILED DESCRIPTION]
- Pause Time: [TIMESTAMP]
- Duration: [CALCULATED]

Issue Details:
- Root Cause: [DESCRIPTION]
- Affected Components: [LIST]
- User Impact: [DESCRIPTION]

Resolution:
- Actions Taken: [LIST]
- Fix Applied: [DESCRIPTION]
- Verification: [TEST RESULTS]
- Unpause Time: [TIMESTAMP]

Post-Mortem:
- Prevention Measures: [LIST]
- Process Improvements: [LIST]
- Documentation Updates: [LIST]
```

## 🔗 Related Documentation

- [Phase 2 Complete Documentation](../../../docs/PHASE2_COMPLETE_DOCUMENTATION.md)
- [ProxyGeneral Contract](../../../contracts/ProxyGeneral.sol)
- [Emergency Handler](../../../contracts/EmergencyHandler.sol)
- [Implementation Checklist](../../../docs/10_project_management/IMPLEMENTATION_CHECKLIST.md)
