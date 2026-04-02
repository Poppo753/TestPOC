// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILensAdapter.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IMorphoRegistry.sol";
import "../interfaces/morpho/IERC4626.sol";

/**
 * @title IMorphoVaultPluginView
 * @notice Minimal interface to query MorphoVaultPlugin view methods
 */
interface IMorphoVaultPluginView {
    function getAllVaultPositions() external view returns (address[] memory vaults, uint256[] memory balances);
    function getActiveVaultCount() external view returns (uint256);
    function circuitBreakerTripped() external view returns (bool);
}

/**
 * @title MorphoVaultLensAdapter
 * @notice LensAdapter per MetaMorpho Vaults — monitoring e value calculation
 * @dev Querya il MorphoVaultPlugin per le posizioni vault attive,
 *      e il MorphoRegistry condiviso per la configurazione vault.
 * 
 * REGISTRY CONDIVISO:
 * - Vault config lives in MorphoRegistry (shared with MorphoPlugin)
 * - Runtime state (active positions) lives in MorphoVaultPlugin
 * 
 * DIFFERENZE VS MorphoLensAdapter:
 * - NO health factor (vault = supply-only, no liquidation risk)
 * - NO debt tracking
 * - Posizioni = shares in vault ERC-4626 → convertToAssets → ETH
 * - Sempre SAFE (no borrow risk)
 * 
 * @author Project4 Team
 * @custom:version 1.1.0
 */
contract MorphoVaultLensAdapter is ILensAdapter, Ownable {

    /// @notice WETH on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    /// @notice Beacon for module resolution
    address public immutable beacon;

    error InvalidBeacon();

    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidBeacon();
        beacon = _beacon;
    }

    // ==================== INTERNAL HELPERS ====================

    function _getPlugin() private view returns (address) {
        return IBeacon(beacon).getImplementation("MorphoVaultPlugin");
    }

    function _getRegistry() private view returns (IMorphoRegistry) {
        return IMorphoRegistry(IBeacon(beacon).getImplementation("MorphoRegistry"));
    }

    function _toEth(address token, uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;
        if (token == WETH) return amount;

        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        uint256 ethPriceUsd = ITokenManagerForModules(tokenManager).getTokenPriceForModule("WETH");
        if (ethPriceUsd == 0) return 0;

        // Get token price and convert to ETH
        // For stablecoins (USDC, USDT): 1 token ≈ $1, so amount / ethPriceUsd
        return (amount * 1e18) / ethPriceUsd;
    }

    /**
     * @dev Get total value of all vault positions in ETH
     */
    function _getTotalVaultValueEth() private view returns (uint256 totalEth) {
        address plugin = _getPlugin();
        (address[] memory vaults, uint256[] memory balances) = IMorphoVaultPluginView(plugin).getAllVaultPositions();

        for (uint256 i = 0; i < vaults.length; i++) {
            if (balances[i] > 0) {
                address asset = IERC4626(vaults[i]).asset();
                totalEth += _toEth(asset, balances[i]);
            }
        }
    }

    // ==================== ILensAdapter: IDENTIFICATION ====================

    function protocolName() external pure override returns (string memory) {
        return "MorphoVault";
    }

    function protocolType() external pure override returns (IProtocolAdapter.ProtocolType) {
        return IProtocolAdapter.ProtocolType.YIELD;
    }

    function isCircuitBreakerActive() external view override returns (bool) {
        address plugin = _getPlugin();
        return IMorphoVaultPluginView(plugin).circuitBreakerTripped();
    }

    function getPlugin() external view override returns (address) {
        return _getPlugin();
    }

    // ==================== ILensAdapter: VALUE FUNCTIONS ====================

    function getTotalValue() external view override returns (uint256 netValueEth) {
        return _getTotalVaultValueEth();
    }

    function getValueBreakdown() external view override returns (ValueBreakdown memory breakdown) {
        uint256 totalEth = _getTotalVaultValueEth();
        breakdown.totalCollateralEth = totalEth; // Supply-only = "collateral" in ETH terms
        breakdown.totalDebtEth = 0;              // No debt in vaults
        breakdown.netValueEth = totalEth;
        breakdown.availableToWithdrawEth = totalEth; // All can be withdrawn
    }

    // ==================== ILensAdapter: HEALTH MONITORING ====================

    function getHealthFactor() external pure override returns (uint256) {
        // Vaults are supply-only — infinite health factor (no liquidation risk)
        return type(uint256).max;
    }

    function getPositionHealth(uint256 /* positionId */) external pure override returns (HealthInfo memory info) {
        info.healthFactor = type(uint256).max;
        info.liquidationThreshold = 0;
        info.timeToLiquidation = type(int256).max;
        info.riskLevel = "SAFE";
        info.isHealthy = true;
    }

    function getAccountHealth() external pure override returns (HealthInfo memory info) {
        info.healthFactor = type(uint256).max;
        info.liquidationThreshold = 0;
        info.timeToLiquidation = type(int256).max;
        info.riskLevel = "SAFE";
        info.isHealthy = true;
    }

    // ==================== ILensAdapter: POSITION QUERIES ====================

    function getActivePositionCount() external view override returns (uint256) {
        address plugin = _getPlugin();
        return IMorphoVaultPluginView(plugin).getActiveVaultCount();
    }

    function getProtocolSummary() external view override returns (ProtocolSummary memory summary) {
        address plugin = _getPlugin();
        uint256 totalEth = _getTotalVaultValueEth();
        uint256 activeCount = IMorphoVaultPluginView(plugin).getActiveVaultCount();

        summary.name = "MorphoVault";
        summary.protocolType = IProtocolAdapter.ProtocolType.YIELD;
        summary.totalCollateralEth = totalEth;
        summary.totalDebtEth = 0;
        summary.netValueEth = totalEth;
        summary.activePositionCount = activeCount;
        summary.lowestHealthFactor = type(uint256).max;
        summary.isHealthy = true;
    }

    // ==================== ILensAdapter: RISK ASSESSMENT ====================

    function getPositionsAtRisk(uint256 /* minHealthFactor */)
        external
        pure
        override
        returns (PositionWithRisk[] memory)
    {
        // Vaults have no liquidation risk — never at risk
        return new PositionWithRisk[](0);
    }

    function getPositionsSortedByRisk()
        external
        view
        override
        returns (PositionWithRisk[] memory positions)
    {
        address plugin = _getPlugin();
        (address[] memory vaults, uint256[] memory balances) = IMorphoVaultPluginView(plugin).getAllVaultPositions();

        uint256 activeCount;
        for (uint256 i = 0; i < vaults.length; i++) {
            if (balances[i] > 0) activeCount++;
        }
        if (activeCount == 0) return new PositionWithRisk[](0);

        positions = new PositionWithRisk[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < vaults.length; i++) {
            if (balances[i] > 0) {
                address asset = IERC4626(vaults[i]).asset();
                uint256 valueEth = _toEth(asset, balances[i]);
                positions[idx] = PositionWithRisk({
                    positionId: i,
                    protocolName: "MorphoVault",
                    healthFactor: type(uint256).max,
                    timeToLiquidation: type(int256).max,
                    riskLevel: "SAFE",
                    collateralEth: valueEth,
                    debtEth: 0,
                    shouldAutoClose: false
                });
                idx++;
            }
        }
    }

    // ==================== ILensAdapter: YIELD INFORMATION ====================

    function getYieldInfo(string memory /* tokenCode */) external pure override returns (YieldInfo memory info) {
        // Vault APY is dynamic — would need off-chain data or vault-specific queries
        // Return 0 for now; can be enhanced to query vault-specific APY
        info.supplyAPY = 0;
        info.borrowAPY = 0;
        info.netAPY = 0;
        info.rewardsAPY = 0;
    }

    function getNetAPY() external pure override returns (int256) {
        return 0;
    }

    // ==================== ILensAdapter: UTILITY FUNCTIONS ====================

    function getVaultForToken(string memory tokenCode) external view override returns (address) {
        return _getRegistry().getDefaultVault(tokenCode);
    }

    function estimateWethFromCloseAll() external view override returns (uint256) {
        return _getTotalVaultValueEth();
    }

    function getLiquidationThreshold(uint256 /* positionId */) external pure override returns (uint256) {
        return 0; // No liquidation in vaults
    }

    function estimatePositionAfterSwap(
        uint256, address, address, uint256
    ) external pure override returns (uint256, uint256, uint256) {
        return (0, 0, 0); // Not applicable for vaults
    }

    function getProtocolLimits()
        external
        pure
        override
        returns (uint256 minHealthFactor, uint256 maxLeverage)
    {
        minHealthFactor = type(uint256).max; // No liquidation risk
        maxLeverage = 100; // 1x only (no leverage in vaults)
    }
}
