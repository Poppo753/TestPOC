## 📄 Generate `api_reference.json` for an entire Solidity module

**Objective**  
Read a Solidity contract file and return **one** `api_reference.json` file that follows the exact schema used in the Beacon example (`api_reference_beacon.json`).  
Each function must be fully described: signature, parameters, return values, access rules, validations, events, gas cost estimate, usage examples, callers, security notes, and other metadata.

---

### 1️⃣ Input
The contract code is supplied inline between `<<<CONTRACT_START` and `CONTRACT_END`.  
Everything outside those markers is whitespace or comments only.

```solidity
<<<CONTRACT_START
{CONTRACT_CONTENT}
CONTRACT_END
```

**Example**  
(In practice you replace `{CONTRACT_CONTENT}` with the actual Solidity source.)

---

### 2️⃣ Expected Output  
Return a single JSON object **exactly** matching the Beacon schema.  
Keys that are omitted in the input contract should be omitted in the output as well.

```json
{
  "version": "3.0.0",
  "modules": {
    "<module-id>": {
      "name": "<ModuleName>",
      "id": "<module-id>",
      "displayOrder": <int>,
      "functions": {
        "<function-id>": {
          "name": "<functionName>",
          "id": "<function-id>",
          "module": "<module-id>",
          "description": "<detailed description>",
          "signature": "function <name>(<params>) <visibility> <stateMutability> <modifiers>",
          "parameters": [
            { "name": "...", "type": "...", "description": "..." },
            ...
          ],
          "returns": [
            { "name": "...", "type": "...", "description": "..." },
            ...
          ],
          "accessControl": "<callability notes>",
          "validations": [
            "✅ <condition>",
            "❌ <condition> and corresponding revert reason"
          ],
          "events": "<list of events emitted, or 'None'>",
          "gasCost": "<estimate e.g. '≈ 3,500–4,000 gas'>",
          "usageExample": "<one or more Solidity snippets that demonstrate the function>",
          "calledBy": "<list of internal/external callers, if obvious>",
          "securityNotes": [
            "<bullet 1>",
            "<bullet 2>"
          ],
          "notes": "<miscellaneous notes, architectural context>",
          "_complete": true,
          "_missingFields": []
        }
      }
    }
  }
}
```

- All string values must be **JSON‑escaped**.
- If a function has no parameters, the `parameters` array should be empty.
- If there are no returns, the `returns` array should be empty.
- If no events are emitted, set `"events": "None"`.
- Include at least one “used‑by” example in `usageExample`.  
- The `<module-id>` is the lower‑case snake_case version of the contract name.
- `displayOrder` may be set to `1` for a single‑module contract.

---

### 3️⃣ Generation Rules (LLM must follow)

| Rule | Why | How to implement |
|------|-----|------------------|
| **Identify all public & external functions** | All non‑internal/private functions shape the API | Parse the Solidity AST, keep function visibility and state mutability. |
| **Construct the signature** | Enables callers to understand the exact call format | `function <name>(<Type memory ...>) <visibility> <stateMutability> <modifier names>` |
| **Parameter & return type extraction** | Needed for documentation & usage examples | Extract `parameter names`, `types`, `storage/inline` attributes. |
| **Modifiers & access control** | Public, external, or view/pure imply auditability | `accessControl` string should read: `external view - public got ...` |
| **Revert safety analysis** | Provide security notes for each `require` | Scan function body for `require` statements, record the condition and revert string. |
| **Event emission mapping** | Show observable side‑effects | For each `emit` statement, list the event name and arguments. |
| **Gas cost estimation** | Give developers a ballpark figure | Roughly add cold/warm storage (`≈ 2,100 gas` each) + instruction overhead. |
| **Usage example** | Demonstrate typical use case | Provide a minimal contract snippet that calls the function. |
| **`calledBy` section** | Identify intra‑contract callers automatically | Scan for calls to the function inside the same contract. |
| **Jargon‐free notes** | Provide context & architecture tips | Summarize once per function. |
| **Consistency with Beacon example** | Keep style uniform | Use the exact field names and bullet formatting. |

---

### 4️⃣ Sample Prompt (for the Beacon contract)

```
<<<CONTRACT_START
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
contract Beacon { /* full source here */ }
CONTRACT_END
```

Generate the JSON as per the schema above.  
Return **only** the JSON. Do NOT add any commentary, explanation, or markdown fences.

---

### 5️⃣ Example of a Completed Function Block

```json
"beacon-getimplementation": {
  "name": "getImplementation",
  "id": "beacon-getimplementation",
  "module": "beacon",
  "description": "Retrieves the implementation address for a specified module. The function enforces strict security checks via the `validModule` modifier and respects both global and per‑module freeze states to prevent module resolution during emergencies.",
  "signature": "function getImplementation(string memory module) external view validModule(module) returns (address implementation)",
  "parameters": [
    {
      "name": "module",
      "type": "string memory",
      "description": "The name of the module to resolve. Must be a registered module name exactly matching one of: 'ProxyGeneral', 'TokenManager', 'ValueCalculator', 'LiquidityManager', 'SwapManager', 'EmergencyHandler', 'ParameterManager', or 'Beacon'. The string is case‑sensitive and limited to 50 characters maximum length."
    }
  ],
  "returns": [
    {
      "name": "implementation",
      "type": "address",
      "description": "The address of the current active implementation for the requested module. Guaranteed to be non‑zero."
    }
  ],
  "accessControl": "external view – callable by any EOA or contract. The `validModule` modifier validates the input.",
  "validations": [
    "✅ Module name must be non‑empty string (length > 0) – enforced by `validModule`.",
    "✅ Module name length must be ≤ 50 characters – enforced by `validModule`.",
    "✅ Implementation address must be present in the `implementations` mapping – `require(implementation != address(0))`.",
    "✅ Module must not be frozen – `require(!globalFreeze && !moduleFrozen[module])`.",
    "❌ Reverts with 'Invalid module name' if `module` is empty.",
    "❌ Reverts with 'Module name too long' if `module` exceeds 50 characters.",
    "❌ Reverts with 'Implementation not found' if the module has never been registered.",
    "❌ Reverts with 'Module access frozen' if `globalFreeze === true` or `moduleFrozen[module] === true`."
  ],
  "events": "None – pure read operation.",
  "gasCost": "≈ 3,500–4,000 gas (cold storage reads: 2,100 gas each for `implementations`, `globalFreeze`, and `moduleFrozen`; warm reads reduce cost; overhead for string length validation).",
  "usageExample": "// Example 1: Basic module resolution during contract construction\ncontract LiquidityManager {\n  IBeacon public immutable beacon;\n  ITokenManager public tokenManager;\n  constructor(address _beaconAddress) {\n    beacon = IBeacon(_beaconAddress);\n    address tmAddr = beacon.getImplementation(\"TokenManager\");\n    tokenManager = ITokenManager(tmAddr);\n  }\n}\n\n// Example 2: Inline try/catch\ntry beacon.getImplementation(\"OptionalModule\") returns (address impl) {\n  optionalModule = IOptionalModule(impl);\n} catch {\n  // fallback behavior\n}",
  "calledBy": "Internally used by LiquidityManager, SwapManager, TokenManager, etc.",
  "securityNotes": [
    "⚠️ Critical to return correct address – wrong resolution breaks inter‑module communication.",
    "✅ Pure view – no state changes, safe against front‑running or reentrancy.",
    "🔒 Dual freeze protects against emergencies – function reverts if freezing.",
    "🛡️ Validation prevents malformed inputs and DOS with very‑long strings.",
    "📝 For audits: track all calls via block logs."
  ],
  "notes": "Part of the Service‑Locator pattern; one top‑level contract manages module addresses for the entire DAO.",
  "_complete": true,
  "_missingFields": []
}
```

---

### 6️⃣ How to Use

1. **Copy** this entire markdown block.  
2. **Replace** the `{CONTRACT_CONTENT}` placeholder with the Solidity source you wish to document.  
3. **Send** the prompt to GPT‑OSS 20B (or any LLM that can output JSON).  
4. **Receive** the JSON output – past it directly into your `api_reference.json`.

---

## 🚀 Happy Documenting!