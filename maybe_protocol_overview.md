api reference protocolmanager
{
  "functions": {
    "deposit": {
      "name": "deposit",
      "id": "0xe8c031b0",
      "module": "Liquidity",
      "description": "Deposit a specified amount of a token into the chosen plugin. The token is first withdrawn from the ProxyGeneral contract, then deposited into the plugin via its `deposit` function.",
      "signature": "deposit(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Human readable name of the plugin (e.g. `DolomitePlugin`)."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Short code for the ERC20 token (e.g. `WETH`)."
        },
        {
          "name": "amount",
          "type": "uint256",
          "description": "Token amount to deposit, expressed in wei."
        }
      ],
      "returns": [],
      "accessControl": "onlyOwner",
      "validations": [
        "amount > 0",
        "bytes(tokenCode).length > 0",
        "plugin address != address(0)",
        "success of IProtocolManager(plugin).deposit() == true"
      ],
      "events": "ProtocolOperationExecuted(protocolName, \"deposit\", tokenCode, amount)",
      "gasCost": "≈ 350k – 450k (varies with token)",
      "usageExample": "protocolManager.deposit(\"DolomitePlugin\", \"WETH\", 1 ether);",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only operation – ensure safe governance.",
        "Reentrancy mitigated by direct `call` to plugin after ProxyGeneral transfer."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "withdraw": {
      "name": "withdraw",
      "id": "0x9f5e5c01",
      "module": "Liquidity",
      "description": "Withdraw a specified amount of a token from the chosen plugin back to the caller via ProxyGeneral.",
      "signature": "withdraw(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin name (e.g. `DolomitePlugin`)."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Token code (e.g. `USDC`)."
        },
        {
          "name": "amount",
          "type": "uint256",
          "description": "Amount to withdraw, expressed in wei."
        }
      ],
      "returns": [],
      "accessControl": "onlyOwner",
      "validations": [
        "amount > 0",
        "bytes(tokenCode).length > 0",
        "plugin address != address(0)",
        "success of IProtocolManager(plugin).withdraw() == true"
      ],
      "events": "ProtocolOperationExecuted(protocolName, \"withdraw\", tokenCode, amount)",
      "gasCost": "≈ 330k – 440k",
      "usageExample": "protocolManager.withdraw(\"DolomitePlugin\", \"USDC\", 500e6);",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only – governed by contract owner.",
        "No direct transfer to caller – goes through ProxyGeneral."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "getBalance": {
      "name": "getBalance",
      "id": "0x9333f84d",
      "module": "Pricing",
      "description": "Query the current balance of a particular token held in the plugin.",
      "signature": "getBalance(string memory protocolName, string memory tokenCode) external view returns (uint256 balance)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin identifier."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Token identifier."
        }
      ],
      "returns": [
        {
          "name": "balance",
          "type": "uint256",
          "description": "Balance amount in wei."
        }
      ],
      "accessControl": "public view",
      "validations": [
        "plugin address != address(0)"
      ],
      "events": "none",
      "gasCost": "≈ 60k – 80k",
      "usageExample": "uint256 bal = protocolManager.getBalance(\"DolomitePlugin\", \"USDC\");",
      "calledBy": "none",
      "securityNotes": [],
      "_complete": true,
      "_missingFields": []
    },

    "getTotalValue": {
      "name": "getTotalValue",
      "id": "0x4c7be8e3",
      "module": "Pricing",
      "description": "Return the total value (in ETH) of all deposits managed by a particular plugin.",
      "signature": "getTotalValue(string memory protocolName) external view returns (uint256 totalValueETH)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin identifier."
        }
      ],
      "returns": [
        {
          "name": "totalValueETH",
          "type": "uint256",
          "description": "Sum of all deposit values expressed in wei of ETH."
        }
      ],
      "accessControl": "public view",
      "validations": [
        "plugin address != address(0)"
      ],
      "events": "none",
      "gasCost": "≈ 70k – 90k",
      "usageExample": "uint256 tv = protocolManager.getTotalValue(\"DolomitePlugin\");",
      "calledBy": "none",
      "securityNotes": [],
      "_complete": true,
      "_missingFields": []
    },

    "borrow": {
      "name": "borrow",
      "id": "0xb186d096",
      "module": "Protocols",
      "description": "Borrow a specified amount of a token from a lending plugin. The borrowed tokens are transferred to the ProxyGeneral contract.",
      "signature": "borrow(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Name of lending plugin."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Token to borrow."
        },
        {
          "name": "amount",
          "type": "uint256",
          "description": "Borrow amount in wei."
        }
      ],
      "returns": [],
      "accessControl": "onlyOwner",
      "validations": [
        "amount > 0",
        "bytes(tokenCode).length > 0",
        "plugin address != address(0)",
        "success of ILendingProtocol(plugin).borrow() == true"
      ],
      "events": "LendingOperationExecuted(protocolName, \"borrow\", tokenCode, amount)",
      "gasCost": "≈ 250k – 350k",
      "usageExample": "protocolManager.borrow(\"DolomitePlugin\", \"USDC\", 1000e6);",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only.",
        "All state changes are executed in a single transaction – no external calls after the commit."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "repay": {
      "name": "repay",
      "id": "0x7e0ebc76",
      "module": "Protocols",
      "description": "Repay a previously borrowed amount to the lending plugin. Tokens are first withdrawn from ProxyGeneral and then sent to the plugin.",
      "signature": "repay(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin name."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Token to repay."
        },
        {
          "name": "amount",
          "type": "uint256",
          "description": "Repayment amount in wei."
        }
      ],
      "returns": [],
      "accessControl": "onlyOwner",
      "validations": [
        "amount > 0",
        "bytes(tokenCode).length > 0",
        "plugin address != address(0)",
        "success of ILendingProtocol(plugin).repay() == true"
      ],
      "events": "LendingOperationExecuted(protocolName, \"repay\", tokenCode, amount)",
      "gasCost": "≈ 300k – 420k",
      "usageExample": "protocolManager.repay(\"DolomitePlugin\", \"USDC\", 500e6);",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only.",
        "Transfer of repayment tokens occurs via ProxyGeneral."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "getDebt": {
      "name": "getDebt",
      "id": "0xfbed12a7",
      "module": "Protocols",
      "description": "Return current debt amount for a token in the specified lending plugin.",
      "signature": "getDebt(string memory protocolName, string memory tokenCode) external view returns (uint256 debtAmount)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin identifier."
        },
        {
          "name": "tokenCode",
          "type": "string",
          "description": "Token identifier."
        }
      ],
      "returns": [
        {
          "name": "debtAmount",
          "type": "uint256",
          "description": "Debt in wei."
        }
      ],
      "accessControl": "public view",
      "validations": [
        "plugin address != address(0)"
      ],
      "events": "none",
      "gasCost": "≈ 50k – 70k",
      "usageExample": "uint256 debt = protocolManager.getDebt(\"DolomitePlugin\", \"USDC\");",
      "calledBy": "none",
      "securityNotes": [],
      "_complete": true,
      "_missingFields": []
    },

    "getHealthFactor": {
      "name": "getHealthFactor",
      "id": "0x1bf48186",
      "module": "Protocols",
      "description": "Return the health factor for the caller’s position in a lending plugin.",
      "signature": "getHealthFactor(string memory protocolName) external view returns (uint256 healthFactor)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin name."
        }
      ],
      "returns": [
        {
          "name": "healthFactor",
          "type": "uint256",
          "description": "Health factor (18 decimals)."
        }
      ],
      "accessControl": "public view",
      "validations": [
        "plugin address != address(0)"
      ],
      "events": "none",
      "gasCost": "≈ 55k – 75k",
      "usageExample": "uint256 hf = protocolManager.getHealthFactor(\"DolomitePlugin\");",
      "calledBy": "none",
      "securityNotes": [],
      "_complete": true,
      "_missingFields": []
    },

    "setAllowedSelectors": {
      "name": "setAllowedSelectors",
      "id": "0x275c53e4",
      "module": "Governance",
      "description": "Add or remove selector(s) from the whitelist for a particular plugin.",
      "signature": "setAllowedSelectors(string memory protocolName, bytes4[] memory selectors, bool allowed) external onlyOwner",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Plugin to modify."
        },
        {
          "name": "selectors",
          "type": "bytes4[]",
          "description": "Array of selector hashes."
        },
        {
          "name": "allowed",
          "type": "bool",
          "description": "True to allow, false to revoke."
        }
      ],
      "returns": [],
      "accessControl": "onlyOwner",
      "validations": [
        "plugin address != address(0)"
      ],
      "events": "SelectorAllowanceChanged(plugin, selector, allowed) for each selector",
      "gasCost": "≈ 80k – 120k per selector",
      "usageExample": "bytes4[] memory sel = new bytes4[](1); sel[0] = bytes4(keccak256(\"openBorrowPosition(uint256,uint256)\")); protocolManager.setAllowedSelectors(\"DolomitePlugin\", sel, true);",
      "calledBy": "none",
      "securityNotes": [
        "Strict owner-only access.",
        "Reverting if plugin address is zero."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "executeProtocolCall": {
      "name": "executeProtocolCall",
      "id": "0x22ef1e7b",
      "module": "Governance",
      "description": "Perform a low‑level call to a plugin after ensuring the selector is whitelisted.",
      "signature": "executeProtocolCall(string memory protocolName, bytes memory data) external onlyOwner returns (bool success, bytes memory returnData)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Target plugin."
        },
        {
          "name": "data",
          "type": "bytes",
          "description": "Calldata including selector and parameters."
        }
      ],
      "returns": [
        {
          "name": "success",
          "type": "bool",
          "description": "Whether the call succeeded."
        },
        {
          "name": "returnData",
          "type": "bytes",
          "description": "Raw bytes returned by the plugin."
        }
      ],
      "accessControl": "onlyOwner",
      "validations": [
        "data.length >= 4",
        "plugin address != address(0)",
        "selector extracted from data is present in allowedSelectors."
      ],
      "events": "ProtocolSpecificCallExecuted(protocolName, selector, data)",
      "gasCost": "≈ 300k – 450k (depends on plugin logic)",
      "usageExample": "bytes memory dest = abi.encodeWithSignature(\"openBorrowPosition(uint256,uint256)\", 1e18, 0); protocolManager.executeProtocolCall(\"DolomitePlugin\", dest);",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only, but delegate-call could be exploited if selectors are not properly validated.",
        "Reverts if the called function fails."
      ],
      "_complete": true,
      "_missingFields": []
    },

    "emergencyWithdrawAll": {
      "name": "emergencyWithdrawAll",
      "id": "0xc12e0a5f",
      "module": "Emergency",
      "description": "Pulls all token balances from a plugin to the ProxyGeneral contract during an emergency.",
      "signature": "emergencyWithdrawAll(string memory protocolName, string[] memory tokenCodes) external onlyOwner returns (bool success)",
      "parameters": [
        {
          "name": "protocolName",
          "type": "string",
          "description": "Target plugin."
        },
        {
          "name": "tokenCodes",
          "type": "string[]",
          "description": "Array of token identifiers to withdraw."
        }
      ],
      "returns": [
        {
          "name": "success",
          "type": "bool",
          "description": "Whether the emergency withdrawal succeeded."
        }
      ],
      "accessControl": "onlyOwner",
      "validations": [
        "plugin address != address(0)",
        "success of IProtocolManager(plugin).emergencyWithdrawAll(tokenCodes) == true"
      ],
      "events": "ProtocolOperationExecuted(protocolName, \"emergencyWithdrawAll\", \"\", 0)",
      "gasCost": "≈ 350k – 500k",
      "usageExample": "protocolManager.emergencyWithdrawAll(\"DolomitePlugin\", new string[](0));",
      "calledBy": "none",
      "securityNotes": [
        "Owner-only.",
        "All withdrawals happen within a single transaction – mitigates flash‑loan exploits."
      ],
      "_complete": true,
      "_missingFields": []
    }
  }
}






  per ogni funzione di protocolmanager, compilami uno schema come questo essendo il piu dettagliato possibile:



"functions": {

        "<NameFunction>": {

          "name": "",

          "id": "",

          "module": "",

          "description": "",

          "signature": "",

          "parameters": [

            {

              "name": "",

              "type": "",

              "description": ""

            }

          ],

          "returns": [

            {

              "name": "",

              "type": "",

              "description": ""

            }

          ],

          "accessControl": "",

          "validations": [],

          "events": "",

          "gasCost": "",

          "usageExample": "",

          "calledBy": "",

          "securityNotes": [          ],

          "notes": "",

          "_complete": true/false,

          "_missingFields": []

        },



un esempio:

"beacon-getimplementation": {

          "name": "getImplementation",

          "id": "beacon-getimplementation",

          "module": "beacon",

          "description": "Retrieves the implementation contract address for a specified module name. This is the core registry function that enables dynamic dependency resolution throughout the entire protocol architecture. Every module in the system calls this function to discover the current addresses of other modules they need to interact with, making it the central point of coordination for inter-module communication. The function enforces strict security checks through the validModule modifier and respects both module-specific and global freeze states to enable emergency circuit breakers.",

          "signature": "function getImplementation(string memory module) external view validModule(module) returns (address implementation)",

          "parameters": [

            {

              "name": "module",

              "type": "string memory",

              "description": "The name of the module to resolve. Must be a registered module name exactly matching one of: 'ProxyGeneral', 'TokenManager', 'ValueCalculator', 'LiquidityManager', 'SwapManager', 'EmergencyHandler', 'ParameterManager', or 'Beacon'. The string is case-sensitive and limited to 50 characters maximum length."

            }

          ],

          "returns": [

            {

              "name": "implementation",

              "type": "address",

              "description": "The contract address of the current active implementation for the requested module. This address is guaranteed to be non-zero and points to a deployed contract that implements the module's interface. The address can change over time through updateImplementation() calls."

            }

          ],

          "accessControl": "external view - Publicly callable by any address, both EOA and contracts. The validModule modifier performs input validation on the module name parameter.",

          "validations": [

            "✅ Module name must be non-empty string (length > 0) - enforced by validModule modifier",

            "✅ Module name length must be <= 50 characters - enforced by validModule modifier to prevent excessively long strings",

            "✅ Implementation address must exist in the implementations mapping - checked with require statement",

            "✅ Module must not be in frozen state - checked by reading moduleFrozen mapping",

            "✅ Global freeze must not be active - checked by reading globalFreeze boolean",

            "❌ Reverts with 'Invalid module name' if module parameter is empty string",

            "❌ Reverts with 'Module name too long' if module string exceeds 50 characters",

            "❌ Reverts with 'Implementation not found' if the module has never been registered or implementations[module] == address(0)",

            "❌ Reverts with 'Module access frozen' if either globalFreeze is true OR moduleFrozen[module] is true"

          ],

          "events": "None - This is a pure read operation that queries state variables without modifying blockchain state or emitting any events. Being view-only makes it gas-efficient and safe to call repeatedly.",

          "gasCost": "Approximately 3,500-4,000 gas under normal conditions. Gas breakdown: (1) SLOAD for implementations mapping lookup (~2,100 gas), (2) SLOAD for globalFreeze boolean (~2,100 gas for cold access, ~100 gas for warm), (3) SLOAD for moduleFrozen[module] mapping (~2,100 gas cold, ~100 warm), (4) String length validation overhead (~200-500 gas), (5) Return data preparation (~100-200 gas). Total varies based on EIP-2929 warm/cold storage access patterns.",

          "usageExample": "// Example 1: Basic module resolution in contract initialization\ncontract LiquidityManager {\n    IBeacon public immutable beacon;\n    ITokenManager public tokenManager;\n    \n    constructor(address _beaconAddress) {\n        beacon = IBeacon(_beaconAddress);\n        address tmAddress = beacon.getImplementation(\"TokenManager\");\n        tokenManager = ITokenManager(tmAddress);\n    }\n}\n\n// Example 2: Dynamic resolution with interface casting\nIBeacon beacon = IBeacon(0x123...);\naddress proxyAddr = beacon.getImplementation(\"ProxyGeneral\");\nIProxyGeneral proxy = IProxyGeneral(proxyAddr);\nuint256 balance = proxy.balanceOf(msg.sender);\n\n// Example 3: Multiple module lookups\nfunction initializeModules(address _beacon) internal {\n    IBeacon b = IBeacon(_beacon);\n    tokenManager = ITokenManager(b.getImplementation(\"TokenManager\"));\n    valueCalculator = IValueCalculator(b.getImplementation(\"ValueCalculator\"));\n    swapManager = ISwapManager(b.getImplementation(\"SwapManager\"));\n}\n\n// Example 4: Error handling with try-catch\ntry beacon.getImplementation(\"OptionalModule\") returns (address impl) {\n    optionalModule = IOptionalModule(impl);\n} catch {\n    // Module not available, use fallback behavior\n    emit ModuleNotAvailable(\"OptionalModule\");\n}",

          "calledBy": "Called extensively throughout the protocol by all modules during initialization and runtime operations. Specific callers include: ProxyGeneral (resolves TokenManager, ValueCalculator, LiquidityManager for deposit/withdraw operations), TokenManager (resolves oracle adapter addresses and Beacon self-reference), LiquidityManager (resolves TokenManager for price feeds, ValueCalculator for portfolio valuation, SwapManager for rebalancing), SwapManager (resolves TokenManager for token validation and price queries), ValueCalculator (resolves TokenManager for price data), EmergencyHandler (resolves all modules for emergency operations), ParameterManager (resolves all modules for parameter updates), and any external contracts or EOAs performing module discovery.",

          "securityNotes": [

            "⚠️ CRITICAL IMPORTANCE: This function is the absolute cornerstone of the protocol's modular architecture. Returning an incorrect address would completely break inter-module communication and could lead to catastrophic failures including loss of funds, incorrect calculations, or locked assets.",

            "✅ SAFE VIEW FUNCTION: Being declared as 'view', this function is guaranteed not to modify blockchain state. It can be safely called from other view/pure functions and doesn't consume gas when called externally (off-chain queries).",

            "🔒 DUAL FREEZE MECHANISM: The freeze protection operates at two levels: (1) Global freeze (globalFreeze boolean) affects ALL modules simultaneously - used for system-wide emergencies, (2) Per-module freeze (moduleFrozen mapping) allows surgical freezing of individual problematic modules without affecting the entire protocol.",

            "⚡ PERFORMANCE CRITICAL: This function is in the hot path of almost every protocol operation. It's called during every deposit, withdrawal, swap, and calculation. Gas optimization is paramount - consider caching results in calling contracts when the same module is accessed multiple times in a single transaction.",

            "🛡️ INPUT VALIDATION: The validModule modifier provides defense-in-depth against malformed inputs. It prevents: (1) Empty string attacks that might bypass mapping lookups, (2) Excessively long strings that could cause out-of-gas errors or DOS attacks, (3) Potential encoding exploits through string validation.",

            "📝 MONITORING RECOMMENDED: In production environments, consider implementing off-chain monitoring for: (1) Unusual access patterns (sudden spike in calls might indicate attack or bug), (2) Failed calls (reverts could indicate integration issues or attempted exploits), (3) Module resolution paths (understanding call graphs helps with upgrades and debugging).",

            "🔄 UPGRADE AWARE: Contracts calling this function should be designed to handle address changes gracefully. When updateImplementation() is called, all subsequent getImplementation() calls return the new address. Calling contracts should either: (1) Re-query on each use, (2) Implement their own upgrade mechanism, or (3) Use immutable references for gas efficiency but accept no upgradability.",

            "🚨 FREEZE BEHAVIOR: During a freeze (either global or module-specific), this function will REVERT, not return address(0). This is intentional - it forces calling contracts to handle the emergency state explicitly rather than accidentally proceeding with a zero address that would cause failures later in execution."

          ],

          "notes": "Architecture Pattern: This function implements the Service Locator pattern, where the Beacon contract acts as a central registry and dependency injection container. This design provides several key benefits: (1) UPGRADEABILITY: Modules can be upgraded by calling updateImplementation() - all contracts automatically use the new version without redeployment, (2) LOOSE COUPLING: Modules don't need to know each other's addresses at compile time, reducing interdependencies, (3) CENTRALIZED CONTROL: One owner can manage the entire system's module addresses from a single point, (4) AUDITABILITY: All module resolutions go through this single function, making it easy to trace dependencies. Implementation Details: The function accesses three storage slots: implementations[module] mapping, globalFreeze boolean, and moduleFrozen[module] mapping. The require checks are ordered for gas efficiency - cheapest checks first (string validation via modifier), then mapping lookups, and finally the address validation. The freeze checks use short-circuit evaluation: 'require(!globalFreeze && !moduleFrozen[module])' will skip the second check if globalFreeze is true, saving gas. Emergency Scenarios: The dual freeze mechanism enables two response strategies: (1) SURGICAL: If one module (e.g., SwapManager) has a critical bug, call freezeModule('SwapManager') - this prevents that module from being discovered while allowing other operations (deposits, withdrawals, calculations) to continue normally, (2) NUCLEAR: If there's a protocol-wide threat, call activateGlobalFreeze() - this immediately halts ALL module discovery, effectively pausing the entire protocol across all functions and modules. Historical Context: This design evolved from earlier versions where modules had hardcoded addresses. The registry pattern was introduced to enable upgradeability without requiring proxy patterns for every module. The freeze mechanism was added after security audits identified the need for granular emergency controls.",

          "_complete": true,

          "_missingFields": []

        },