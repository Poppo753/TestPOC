import React, { useMemo } from "react";

/**
 * DeFi System – Function‑Level Architecture Diagram (8 Modules)
 *
 * Production‑ready React + SVG, fully client‑side.
 * - Each module is a box with grouped functions.
 * - Every arrow is a specific function call from one module to another, labeled.
 * - Colors: blue (read), red (write), orange (external), dark red (emergency).
 * - Hover any function or arrow to see signature, params/returns, and access notes.
 * - Legend included.
 * - Access control badges on functions when known from the spec.
 *
 * Notes:
 * - The diagram is handcrafted from the provided specification.
 * - Arrow directions strictly follow Calls TO (outgoing) for each module and external flows.
 */

// Utility types
const READ = "#2563eb"; // blue-600
const WRITE = "#ef4444"; // red-500
const EXTERNAL = "#ea580c"; // orange-600
const EMERGENCY = "#991b1b"; // red-900
const BORDER = "#0f172a"; // slate-900
const BG = "#0b1020"; // deep background
const CARD = "#0f172a"; // slate-900
const TEXT = "#e5e7eb"; // gray-200
const SUBT = "#cbd5e1"; // slate-300
const MUTED = "#94a3b8"; // slate-400

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      style={{
        border: `1px solid ${color || "#64748b"}`,
        color: color || "#cbd5e1",
        borderRadius: 6,
        padding: "1px 6px",
        fontSize: 10,
        marginLeft: 6,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// Module and function inventory (from the provided spec)
const modules = [
  {
    key: "Beacon",
    title: "MODULE 1: BEACON (Central Registry)",
    x: 40,
    y: 40,
    w: 360,
    groups: [
      {
        name: "Public Functions",
        items: [
          {
            name: "getImplementation(moduleName)",
            ret: "address",
            access: "public / view",
            tooltip:
              "getImplementation(string moduleName) → address. Called by ALL modules for address resolution.",
          },
          {
            name: "updateImplementation(moduleName, newImpl)",
            access: "onlyOwner",
            tooltip:
              "updateImplementation(string moduleName, address newImpl). Only owner.",
          },
          {
            name: "transferOwnership(newOwner)",
            access: "onlyOwner",
            tooltip: "transferOwnership(address newOwner). Only owner.",
          },
          { name: "acceptOwnership()", access: "owner‑to‑be", tooltip: "acceptOwnership()." },
        ],
      },
    ],
  },
  {
    key: "ProxyGeneral",
    title: "MODULE 2: PROXYGENERAL (Asset Custodian + LP ERC20)",
    x: 460,
    y: 40,
    w: 420,
    groups: [
      {
        name: "LP Token Mgmt",
        items: [
          { name: "mint(to, amount)", access: "onlyAuthorizedModule", tooltip: "Mint LP to user (called by LiquidityManager)." },
          { name: "burn(from, amount)", access: "onlyAuthorizedModule", tooltip: "Burn LP from user (called by LiquidityManager)." },
          { name: "balanceOf(account)", ret: "uint256", access: "public view" },
          { name: "totalSupply()", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Asset Mgmt",
        items: [
          { name: "transferFunds(to, asset, amount)", access: "onlyAuthorizedModule" },
          { name: "getAssetBalance(asset)", ret: "uint256", access: "public view" },
          { name: "approveSpender(token, spender, amount)", access: "onlyAuthorizedModule" },
          { name: "transferToModule(token, module, amount)", access: "onlyAuthorizedModule" },
          { name: "transferFromModule(token, module, amount)", access: "onlyAuthorizedModule" },
        ],
      },
      {
        name: "Access Control",
        items: [
          { name: "authorizeModule(module)", access: "onlyOwner" },
          { name: "deauthorizeModule(module)", access: "onlyOwner" },
          { name: "isAuthorizedModule(module)", ret: "bool", access: "public view" },
        ],
      },
      {
        name: "Emergency",
        items: [
          { name: "pause()", access: "onlyAuthorizedEmergency" },
          { name: "unpause()", access: "owner/emergency" },
          { name: "isPaused()", ret: "bool", access: "public view" },
          { name: "emergencyTransferAll(recipient)", access: "onlyEmergency" },
        ],
      },
      {
        name: "Rate Limiting",
        items: [
          { name: "getHourlyWithdrawn(user, hour)", ret: "uint256", access: "public view" },
          { name: "setHourlyWithdrawn(user, hour, amount)", access: "onlyAuthorizedModule" },
          { name: "incrementHourlyWithdrawn(user, amount)", access: "onlyAuthorizedModule" },
        ],
      },
    ],
  },
  {
    key: "TokenManager",
    title: "MODULE 3: TOKENMANAGER (Registry + Oracle)",
    x: 930,
    y: 40,
    w: 430,
    groups: [
      {
        name: "Token Mgmt",
        items: [
          { name: "manageTokenData(code, addr, feed, dec, hb)", access: "onlyOwner" },
          { name: "removeToken(code)", access: "onlyOwner" },
          { name: "updateHeartbeat(code, newHb)", access: "onlyOwner" },
        ],
      },
      {
        name: "Token Queries",
        items: [
          { name: "isTokenActive(code)", ret: "bool", access: "public view" },
          { name: "getTokenAddress(code)", ret: "address", access: "public view" },
          { name: "getTokenInfo(code)", ret: "TokenInfo", access: "public view" },
          { name: "getActiveTokens()", ret: "string[]", access: "public view" },
          { name: "getTokenCount()", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Price Feeds",
        items: [
          { name: "getTokenPrice(code)", ret: "(price, updatedAt, isStale)", access: "public view" },
          { name: "getTokenPriceWithEvents(code)", ret: "(price, updatedAt)", access: "public view" },
          { name: "validatePriceFeed(code)", ret: "bool", access: "public view" },
        ],
      },
      {
        name: "Error Mgmt",
        items: [
          { name: "getTokenErrors(code)", ret: "uint256", access: "public view" },
          { name: "resetTokenErrors(code)", access: "onlyOwner" },
        ],
      },
    ],
  },
  {
    key: "ValueCalculator",
    title: "MODULE 4: VALUECALCULATOR (Valuation + Cache)",
    x: 40,
    y: 360,
    w: 460,
    groups: [
      {
        name: "Calculations",
        items: [
          { name: "calculateTokenValue(code)", ret: "uint256", access: "public" },
          { name: "calculateTokenValueView(code)", ret: "uint256", access: "public view" },
          { name: "getTotalPoolValue()", ret: "PoolValueInfo", access: "public" },
          { name: "getTotalPoolValueView()", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Cache Mgmt",
        items: [
          { name: "getCachedTokenValue(code)", ret: "(value, isValid)", access: "public view" },
          { name: "getCachedTokenPrice(code)", ret: "(price, isValid)", access: "public view" },
          { name: "invalidateCache(code)", access: "onlyOwner/ops" },
          { name: "invalidateAllCache()", access: "onlyOwner/ops" },
        ],
      },
      {
        name: "Utility",
        items: [
          { name: "getTokenValueInfo(code)", ret: "TokenValueInfo", access: "public view" },
          { name: "selectTokenForSwap(target)", ret: "(code, amount)", access: "public" },
          { name: "validatePoolValue()", ret: "(isValid, reason)", access: "public view" },
        ],
      },
    ],
  },
  {
    key: "LiquidityManager",
    title: "MODULE 5: LIQUIDITYMANAGER (Deposit/Withdraw)",
    x: 560,
    y: 360,
    w: 450,
    groups: [
      {
        name: "Deposit",
        items: [
          { name: "deposit() payable", ret: "uint256 lpTokens", access: "public" },
          { name: "calculateDepositShares(ethAmount)", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Withdraw",
        items: [
          { name: "withdraw(lpTokens)", ret: "uint256 ethReceived", access: "public" },
          { name: "calculateWithdrawAmount(lpTokens)", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Withdraw Limits",
        items: [
          { name: "setWithdrawLimits(hourly,daily,min,max)", access: "onlyOwner" },
          { name: "checkWithdrawLimits(user, amount)", ret: "(can, reason)", access: "public view" },
          { name: "getRemainingHourlyLimit(user)", ret: "uint256", access: "public view" },
          { name: "getRemainingDailyLimit(user)", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Fees & State",
        items: [
          { name: "setDepositFee(newFee)", access: "onlyOwner" },
          { name: "setWithdrawFee(newFee)", access: "onlyOwner" },
          { name: "setFeeRecipient(recipient)", access: "onlyOwner" },
          { name: "setDepositsEnabled(enabled)", access: "onlyOwner" },
          { name: "setWithdrawsEnabled(enabled)", access: "onlyOwner" },
        ],
      },
    ],
  },
  {
    key: "SwapManager",
    title: "MODULE 6: SWAPMANAGER (DEX Integration)",
    x: 1040,
    y: 360,
    w: 430,
    groups: [
      {
        name: "Swap",
        items: [
          { name: "swapTokenForWETH(code, amountIn, minOut)", ret: "uint256", access: "public" },
        ],
      },
      {
        name: "Quotes",
        items: [
          { name: "getSwapQuote(code, amountIn)", ret: "uint256", access: "public view" },
          { name: "calculateMinAmountOut(code, amountIn)", ret: "uint256", access: "public view" },
        ],
      },
      {
        name: "Config & Stats",
        items: [
          { name: "setSimpleSwapRouter(newRouter)", access: "onlyOwner" },
          { name: "setMaxSlippage(newSlippage)", access: "onlyOwner" },
          { name: "setSwapsEnabled(enabled)", access: "onlyOwner" },
          { name: "getSwapStats(code)", ret: "(count,total)", access: "public view" },
        ],
      },
    ],
  },
  {
    key: "EmergencyHandler",
    title: "MODULE 7: EMERGENCYHANDLER (Emergency)",
    x: 40,
    y: 720,
    w: 520,
    groups: [
      {
        name: "Emergency Ops",
        items: [
          { name: "triggerEmergencyPause(reason)", access: "onlyEmergency", badge: "EMERGENCY" },
          { name: "unpause()", access: "onlyEmergency/owner" },
          { name: "emergencyWithdraw(recipient)", access: "onlyEmergency", badge: "EMERGENCY" },
        ],
      },
      {
        name: "Contacts & Config",
        items: [
          { name: "addEmergencyContact(contact)", access: "onlyOwner" },
          { name: "removeEmergencyContact(contact)", access: "onlyOwner" },
          { name: "isAuthorizedForEmergency(account)", ret: "bool", access: "public view" },
          { name: "setUnpauseTimelock(newTimelock)", access: "onlyOwner" },
        ],
      },
      {
        name: "Status",
        items: [
          { name: "getEmergencyState()", ret: "EmergencyState", access: "public view" },
          { name: "canUnpause()", ret: "(bool, reason)", access: "public view" },
          { name: "getSystemHealthStatus()", ret: "(isPaused,totalValue,lpSupply,tokens[])", access: "public view" },
        ],
      },
    ],
  },
  {
    key: "ParameterManager",
    title: "MODULE 8: PARAMETERMANAGER (Config)",
    x: 600,
    y: 720,
    w: 420,
    groups: [
      {
        name: "Parameter Mgmt",
        items: [
          { name: "registerParameter(name, initial,min,max,requiresTimelock)", access: "onlyOwner" },
          { name: "proposeParameterChange(name, newValue)", access: "onlyOwner" },
          { name: "executeParameterChange(name)", access: "onlyOwner" },
          { name: "emergencySetParameter(name, newValue)", access: "onlyOwner", badge: "EMERGENCY" },
        ],
      },
      {
        name: "Queries",
        items: [
          { name: "getCurrentParameterValue(name)", ret: "uint256", access: "public view" },
          { name: "getParameterInfo(name)", ret: "Parameter", access: "public view" },
          { name: "getParameterHistory(name)", ret: "ParameterHistory[]", access: "public view" },
          { name: "getAllParameters()", ret: "(names[],values[])", access: "public view" },
        ],
      },
      {
        name: "Validation & Config",
        items: [
          { name: "canExecuteParameterChange(name)", ret: "(bool,reason)", access: "public view" },
          { name: "setParameterTimelock(newTimelock)", access: "onlyOwner" },
        ],
      },
    ],
  },
  {
    key: "External",
    title: "EXTERNAL INTEGRATIONS",
    x: 1040,
    y: 720,
    w: 430,
    groups: [
      {
        name: "Chainlink (by TokenManager)",
        items: [
          { name: "AggregatorV3.latestRoundData()", ret: "(roundId,price,timestamp,answeredInRound)" },
          { name: "AggregatorV3.decimals()", ret: "uint8" },
        ],
      },
      {
        name: "SimpleSwap DEX (by SwapManager)",
        items: [
          { name: "getAmountOut(tokenIn, tokenOut, amountIn)", ret: "uint256" },
          { name: "swap(tokenIn, tokenOut, amountIn, minOut, recipient)", ret: "uint256" },
        ],
      },
      {
        name: "WETH (by LiquidityManager/ValueCalculator/EmergencyHandler)",
        items: [
          { name: "deposit{value}()" },
          { name: "withdraw(amount)" },
          { name: "balanceOf(account)", ret: "uint256" },
          { name: "transfer(to, amount)", ret: "bool" },
        ],
      },
      {
        name: "Users (EOA → LiquidityManager)",
        items: [
          { name: "deposit() payable" },
          { name: "withdraw(lpTokenAmount)" },
        ],
      },
    ],
  },
];

// Arrow inventory: each arrow is a function call from a module to another module.
// label: the function invoked on the TARGET (with signature). type: READ/WRITE/EXTERNAL/EMERGENCY
const arrows = [
  // ========= PROXYGENERAL → BEACON (emergencyTransferAll helpers)
  { from: "ProxyGeneral", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ, title: "ProxyGeneral.emergencyTransferAll → Beacon.getImplementation(\"WETH\")" },
  { from: "ProxyGeneral", to: "Beacon", label: "getImplementation(\"TokenManager\")", type: READ, title: "ProxyGeneral.emergencyTransferAll → Beacon.getImplementation(\"TokenManager\")" },

  // ========= TOKENMANAGER → BEACON & EXTERNAL (price feeds)
  { from: "TokenManager", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ, title: "manageTokenData WETH exclusion check" },
  { from: "TokenManager", to: "External", label: "AggregatorV3.latestRoundData()", type: EXTERNAL, title: "Chainlink oracle read" },
  { from: "TokenManager", to: "External", label: "AggregatorV3.decimals()", type: EXTERNAL, title: "Chainlink oracle decimals" },

  // ========= VALUECALCULATOR → BEACON, TOKENMANAGER, PROXYGENERAL, WETH
  { from: "ValueCalculator", to: "Beacon", label: "getImplementation(\"TokenManager\")", type: READ },
  { from: "ValueCalculator", to: "Beacon", label: "getImplementation(\"ProxyGeneral\")", type: READ },
  { from: "ValueCalculator", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ },
  { from: "ValueCalculator", to: "TokenManager", label: "getActiveTokens()", type: READ },
  { from: "ValueCalculator", to: "TokenManager", label: "getTokenAddress(code)", type: READ },
  { from: "ValueCalculator", to: "TokenManager", label: "getTokenPriceWithEvents(code)", type: READ },
  { from: "ValueCalculator", to: "TokenManager", label: "getTokenPrice(code)", type: READ },
  { from: "ValueCalculator", to: "TokenManager", label: "getTokenInfo(code)", type: READ },
  { from: "ValueCalculator", to: "ProxyGeneral", label: "IERC20(token).balanceOf(proxyGeneral)", type: READ },
  { from: "ValueCalculator", to: "External", label: "WETH.balanceOf(proxyGeneral)", type: READ },

  // ========= LIQUIDITYMANAGER → BEACON, PROXYGENERAL, VALUECALCULATOR, SWAPMANAGER, WETH
  { from: "LiquidityManager", to: "Beacon", label: "getImplementation(\"ProxyGeneral\")", type: READ },
  { from: "LiquidityManager", to: "Beacon", label: "getImplementation(\"ValueCalculator\")", type: READ },
  { from: "LiquidityManager", to: "Beacon", label: "getImplementation(\"SwapManager\")", type: READ },
  { from: "LiquidityManager", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "mint(user, lpTokens)", type: WRITE },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "burn(user, lpTokenAmount)", type: WRITE },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "totalSupply()", type: READ },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "balanceOf(user)", type: READ },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "isPaused()", type: READ },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "getHourlyWithdrawn(user, hour)", type: READ },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "incrementHourlyWithdrawn(user, amount)", type: WRITE },
  { from: "LiquidityManager", to: "ProxyGeneral", label: "transferFunds(recipient, asset, amount)", type: WRITE },
  { from: "LiquidityManager", to: "ValueCalculator", label: "getTotalPoolValue()", type: READ },
  { from: "LiquidityManager", to: "ValueCalculator", label: "getTotalPoolValueView()", type: READ },
  { from: "LiquidityManager", to: "ValueCalculator", label: "selectTokenForSwap(targetValue)", type: READ },
  { from: "LiquidityManager", to: "SwapManager", label: "swapTokenForWETH(code, amountIn, minOut)", type: WRITE },
  { from: "LiquidityManager", to: "External", label: "WETH.deposit{value}()", type: EXTERNAL },
  { from: "LiquidityManager", to: "External", label: "WETH.withdraw(amount)", type: EXTERNAL },
  { from: "LiquidityManager", to: "External", label: "WETH.balanceOf(proxyGeneral)", type: EXTERNAL },
  { from: "LiquidityManager", to: "External", label: "WETH.transfer(to, amount)", type: EXTERNAL },

  // ========= SWAPMANAGER → BEACON, TOKENMANAGER, PROXYGENERAL, WETH, EXTERNAL DEX
  { from: "SwapManager", to: "Beacon", label: "getImplementation(\"ProxyGeneral\")", type: READ },
  { from: "SwapManager", to: "Beacon", label: "getImplementation(\"TokenManager\")", type: READ },
  { from: "SwapManager", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ },
  { from: "SwapManager", to: "ProxyGeneral", label: "isPaused()", type: READ },
  { from: "SwapManager", to: "ProxyGeneral", label: "approveSpender(token, router, amount)", type: WRITE },
  { from: "SwapManager", to: "TokenManager", label: "isTokenActive(code)", type: READ },
  { from: "SwapManager", to: "TokenManager", label: "getTokenAddress(code)", type: READ },
  { from: "SwapManager", to: "TokenManager", label: "getTokenInfo(code)", type: READ },
  { from: "SwapManager", to: "ProxyGeneral", label: "IERC20(token).balanceOf(proxyGeneral)", type: READ, title: "pre/post swap verification" },
  { from: "SwapManager", to: "External", label: "IERC20(weth).balanceOf(proxyGeneral)", type: READ, title: "pre/post swap verification" },
  { from: "SwapManager", to: "External", label: "SimpleSwap.getAmountOut(tokenIn, tokenOut, amountIn)", type: EXTERNAL },
  { from: "SwapManager", to: "External", label: "SimpleSwap.swap(tokenIn, tokenOut, amountIn, minOut, recipient)", type: EXTERNAL },

  // ========= EMERGENCYHANDLER → BEACON, PROXYGENERAL, TOKENMANAGER, VALUECALCULATOR, WETH
  { from: "EmergencyHandler", to: "Beacon", label: "getImplementation(\"ProxyGeneral\")", type: READ },
  { from: "EmergencyHandler", to: "Beacon", label: "getImplementation(\"TokenManager\")", type: READ },
  { from: "EmergencyHandler", to: "Beacon", label: "getImplementation(\"ValueCalculator\")", type: READ },
  { from: "EmergencyHandler", to: "Beacon", label: "getImplementation(\"WETH\")", type: READ },
  { from: "EmergencyHandler", to: "ProxyGeneral", label: "pause()", type: EMERGENCY },
  { from: "EmergencyHandler", to: "ProxyGeneral", label: "unpause()", type: EMERGENCY },
  { from: "EmergencyHandler", to: "ProxyGeneral", label: "isPaused()", type: READ },
  { from: "EmergencyHandler", to: "ProxyGeneral", label: "emergencyTransferAll(recipient)", type: EMERGENCY },
  { from: "EmergencyHandler", to: "ProxyGeneral", label: "totalSupply()", type: READ },
  { from: "EmergencyHandler", to: "TokenManager", label: "getActiveTokens()", type: READ },
  { from: "EmergencyHandler", to: "TokenManager", label: "getTokenAddress(code)", type: READ },
  { from: "EmergencyHandler", to: "ValueCalculator", label: "getTotalPoolValueView()", type: READ },
  { from: "EmergencyHandler", to: "External", label: "WETH.balanceOf(proxyGeneral)", type: EXTERNAL },
  { from: "EmergencyHandler", to: "External", label: "IERC20(token).balanceOf(proxyGeneral)", type: EXTERNAL },

  // ========= PARAMETERMANAGER → PROXYGENERAL (validation)
  { from: "ParameterManager", to: "Beacon", label: "getImplementation(\"ProxyGeneral\")", type: READ, title: "Resolve ProxyGeneral address" },
  { from: "ParameterManager", to: "ProxyGeneral", label: "isPaused()", type: READ, title: "emergencySetParameter validation" },
];

// Layout helpers: get module rect centers for arrow routing
function getModuleRect(m: any) {
  return {
    x: m.x,
    y: m.y,
    w: m.w,
    h: 260,
  };
}

function centerOf(rect: any) {
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
}

function edgePoint(from: any, to: any) {
  // Simple routing: from center to center, with slight curvature.
  const p1 = centerOf(getModuleRect(from));
  const p2 = centerOf(getModuleRect(to));
  const dx = p2.cx - p1.cx;
  const dy = p2.cy - p1.cy;
  const mx = p1.cx + dx * 0.5;
  const my = p1.cy + dy * 0.5;
  const c1x = p1.cx + dx * 0.25;
  const c1y = p1.cy + dy * 0.1 - 40;
  const c2x = p1.cx + dx * 0.75;
  const c2y = p1.cy + dy * 0.9 + 40;
  return { p1, p2, c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y }, mid: { x: mx, y: my } };
}

function ModuleCard({ mod }: { mod: any }) {
  return (
    <g>
      <rect
        x={mod.x}
        y={mod.y}
        width={mod.w}
        height={260}
        rx={16}
        ry={16}
        fill={CARD}
        stroke={BORDER}
        strokeWidth={1.25}
      />
      <text x={mod.x + 12} y={mod.y + 22} fontSize={14} fill={TEXT} fontWeight={600}>
        {mod.title}
      </text>
      {mod.groups.map((g: any, gi: number) => {
        const gy = mod.y + 38 + gi * 72;
        return (
          <g key={gi}>
            <text x={mod.x + 12} y={gy} fontSize={12} fill={SUBT}>
              {g.name}
            </text>
            {(g.items || []).slice(0, 3).map((it: any, ii: number) => (
              <g key={ii}>
                <text x={mod.x + 16} y={gy + 16 + ii * 16} fontSize={11} fill={TEXT}>
                  {it.name}
                </text>
                {it.badge && (
                  <text x={mod.x + mod.w - 70} y={gy + 16 + ii * 16} fontSize={10} fill={MUTED}>
                    [{it.badge}]
                  </text>
                )}
                <title>
                  {it.name}
                  {it.ret ? ` → ${it.ret}` : ""}
                  {it.access ? `\nAccess: ${it.access}` : ""}
                </title>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

export default function Diagram() {
  const modMap = useMemo(() => Object.fromEntries(modules.map((m) => [m.key, m])), []);

  return (
    <div style={{ width: "100%", height: "100%", padding: "16px", background: BG, color: TEXT, fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
          DeFi System – Function‑Level Architecture
        </div>
        <div style={{ fontSize: "14px", color: "#cbd5e1" }}>
          Each arrow is a specific function call. Hover arrows/functions for signatures, params/returns and access notes.
        </div>
      </div>

      <svg width={1520} height={1080} style={{ width: "100%", height: "auto", borderRadius: 12 }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="inherit" />
          </marker>
          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Critical Flow Highlights (bands) */}
        <g>
          {/* Deposit Flow band */}
          <rect x={24} y={320} width={1440} height={20} fill="#1d4ed8" opacity={0.12} />
          <text x={28} y={334} fontSize={11} fill={"#93c5fd"}>Flow 1: USER DEPOSIT (highlight band)</text>
          {/* Withdraw Flow band */}
          <rect x={24} y={650} width={1440} height={20} fill="#f97316" opacity={0.12} />
          <text x={28} y={664} fontSize={11} fill={"#fdba74"}>Flow 2: USER WITHDRAW (highlight band)</text>
          {/* Emergency Flow band */}
          <rect x={24} y={1000} width={1440} height={20} fill="#7f1d1d" opacity={0.18} />
          <text x={28} y={1014} fontSize={11} fill={"#fecaca"}>Flow 3: EMERGENCY (highlight band)</text>
        </g>

        {/* Modules */}
        {modules.map((m, i) => (
          <g key={m.key} filter="url(#cardShadow)">
            <ModuleCard mod={m} />
          </g>
        ))}

        {/* Arrows */}
        {arrows.map((a, i) => {
          const from = modMap[a.from];
          const to = modMap[a.to];
          if (!from || !to) return null;
          const { p1, p2, c1, c2, mid } = edgePoint(from, to);
          const color = a.type === READ ? READ : a.type === WRITE ? WRITE : a.type === EXTERNAL ? EXTERNAL : EMERGENCY;
          const pathId = `path-${i}`;
          return (
            <g key={i}>
              <path
                id={pathId}
                d={`M ${p1.cx} ${p1.cy} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.cx} ${p2.cy}`}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                markerEnd="url(#arrow)"
                opacity={0.92}
              >
                <title>{a.title || a.label}</title>
              </path>
              {/* Label along the path */}
              <text fontSize={10} fill={TEXT}>
                <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                  {a.label}
                </textPath>
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${24}, ${1060 - 140})`}>
          <rect x={0} y={0} width={420} height={116} rx={10} ry={10} fill={CARD} stroke={BORDER} />
          <text x={12} y={18} fontSize={13} fill={TEXT} fontWeight={600}>Legend</text>
          <g>
            <circle cx={18} cy={36} r={5} fill={READ} />
            <text x={32} y={40} fontSize={11} fill={SUBT}>Read call (view/query)</text>
          </g>
          <g>
            <circle cx={18} cy={56} r={5} fill={WRITE} />
            <text x={32} y={60} fontSize={11} fill={SUBT}>Write/state‑changing call</text>
          </g>
          <g>
            <circle cx={18} cy={76} r={5} fill={EXTERNAL} />
            <text x={32} y={80} fontSize={11} fill={SUBT}>External integration call</text>
          </g>
          <g>
            <circle cx={18} cy={96} r={5} fill={EMERGENCY} />
            <text x={32} y={100} fontSize={11} fill={SUBT}>Emergency operation</text>
          </g>
        </g>
      </svg>

      <div style={{ marginTop: "16px", fontSize: "12px", color: "#cbd5e1", lineHeight: "20px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Access Control & Hover Annotations</div>
        <div>
          Functions include access notes (e.g., onlyOwner, onlyAuthorizedModule). Hover function names or arrows to view
          signatures, parameters/returns, and contextual notes. Critical flows are highlighted by horizontal bands.
        </div>
      </div>
    </div>
  );
}
