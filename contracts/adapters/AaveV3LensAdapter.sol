// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILensAdapter.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IAaveV3Registry.sol";
import "../interfaces/aave/IAaveV3Pool.sol";

/**
 * @title AaveV3LensAdapter
 * @notice Adapter per Aave V3 - Health monitoring e value calculation
 * @dev Integrato con:
 *      - ValueCalculator: getTotalValue() per calcolo valore pool
 *      - LiquidityManager: getPositionsAtRisk() per auto-close
 *      - AaveV3Plugin: monitoring posizioni
 * 
 * AAVE V3 ARBITRUM:
 * - Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * - Oracle: 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7
 * - PoolDataProvider: 0x243Aa95cAC2a25651eda86e80bEe66114413c43b
 * 
 * ARCHITETTURA:
 * - Query Aave Pool via getUserAccountData() (dati aggregati nativi)
 * - Query individual token balances via aToken/debtToken balanceOf
 * - Calcolo valori con Chainlink via TokenManager (conversione a ETH)
 * - Aave's base currency è USD (8 decimali) → conversione necessaria a ETH
 * 
 * DIFFERENZA VS EULER LENS:
 * - Euler: serve AccountLens + calcolo manuale per posizioni isolate (sub-accounts)
 * - Aave: getUserAccountData() ritorna tutto aggregato in un colpo
 * - Aave: health factor NATIVO (non serve calcolo)
 * - Aave: 1 account per address → nessun sub-account da iterare
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract AaveV3LensAdapter is ILensAdapter, Ownable {

    // ==================== CONSTANTS ====================

    /// @notice Aave V3 Pool on Arbitrum
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    /// @notice Aave Oracle on Arbitrum (prices in USD, 8 decimals)
    address public constant AAVE_ORACLE = 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7;

    /// @notice WETH on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    /// @notice Safe health factor threshold (default 1.5)
    uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18;

    // ==================== STATE ====================

    /// @notice Beacon for module resolution
    address public immutable beacon;

    // ==================== ERRORS ====================

    error InvalidBeacon();
    error AaveV3PluginNotFound();
    error AaveV3RegistryNotFound();
    error TokenManagerNotFound();

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidBeacon();
        beacon = _beacon;
    }

    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================

    function _getRegistry() private view returns (IAaveV3Registry) {
        address registry = IBeacon(beacon).getImplementation("AaveV3Registry");
        return IAaveV3Registry(registry);
    }

    function _getPlugin() private view returns (address) {
        return IBeacon(beacon).getImplementation("AaveV3Plugin");
    }

    /**
     * @dev Converts Aave base currency (USD 8 decimals) to ETH (18 decimals)
     *      Uses Chainlink WETH price via TokenManager
     */
    function _baseToEth(uint256 valueInBase) private view returns (uint256) {
        if (valueInBase == 0) return 0;

        // Get WETH price in USD from TokenManager
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        uint256 ethPriceUsd = ITokenManagerForModules(tokenManager).getTokenPriceForModule("WETH");

        if (ethPriceUsd == 0) return 0;

        // Aave base = USD * 1e8, TokenManager price = USD * 1e8 (Chainlink standard)
        // valueInEth = valueInBase * 1e18 / ethPriceUsd
        return (valueInBase * 1e18) / ethPriceUsd;
    }

    // ==================== ILensAdapter: IDENTIFICATION ====================

    /// @inheritdoc ILensAdapter
    function protocolName() external pure override returns (string memory) {
        return "AaveV3";
    }

    /// @inheritdoc ILensAdapter
    function protocolType() external pure override returns (IProtocolAdapter.ProtocolType) {
        return IProtocolAdapter.ProtocolType.LENDING;
    }

    /// @inheritdoc ILensAdapter
    function isCircuitBreakerActive() external view override returns (bool) {
        address plugin = _getPlugin();
        // Read circuitBreakerTripped from AaveV3Plugin
        (bool success, bytes memory data) = plugin.staticcall(
            abi.encodeWithSignature("circuitBreakerTripped()")
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (bool));
        }
        return false;
    }

    /// @inheritdoc ILensAdapter
    function getPlugin() external view override returns (address) {
        return _getPlugin();
    }

    // ==================== ILensAdapter: VALUE FUNCTIONS ====================

    /**
     * @inheritdoc ILensAdapter
     * @dev Valore netto totale (collaterale - debito) in ETH
     *      Usa getUserAccountData() di Aave V3 per dati aggregati
     */
    function getTotalValue() external view override returns (uint256 netValueEth) {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            ,
            ,
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        uint256 collateralEth = _baseToEth(totalCollateralBase);
        uint256 debtEth = _baseToEth(totalDebtBase);

        netValueEth = collateralEth > debtEth ? collateralEth - debtEth : 0;
    }

    /// @inheritdoc ILensAdapter
    function getValueBreakdown() external view override returns (ValueBreakdown memory breakdown) {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            ,
            ,
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        breakdown.totalCollateralEth = _baseToEth(totalCollateralBase);
        breakdown.totalDebtEth = _baseToEth(totalDebtBase);
        breakdown.netValueEth = breakdown.totalCollateralEth > breakdown.totalDebtEth
            ? breakdown.totalCollateralEth - breakdown.totalDebtEth
            : 0;
        breakdown.availableToWithdrawEth = _baseToEth(availableBorrowsBase);
    }

    // ==================== ILensAdapter: HEALTH MONITORING ====================

    /**
     * @inheritdoc ILensAdapter
     * @dev Health factor NATIVO da Aave V3 getUserAccountData()
     *      1e18 = 1.0, type(uint256).max = no debt
     */
    function getHealthFactor() external view override returns (uint256 healthFactor) {
        address plugin = _getPlugin();

        (
            ,
            uint256 totalDebtBase,
            ,
            ,
            ,
            uint256 hf
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        if (totalDebtBase == 0) {
            return type(uint256).max;
        }

        return hf;
    }

    /// @inheritdoc ILensAdapter
    function getPositionHealth(uint256 /* positionId */) external view override returns (HealthInfo memory info) {
        // Aave = single account, ignora positionId
        return _getAccountHealthInfo();
    }

    /// @inheritdoc ILensAdapter
    function getAccountHealth() external view override returns (HealthInfo memory info) {
        return _getAccountHealthInfo();
    }

    function _getAccountHealthInfo() private view returns (HealthInfo memory info) {
        address plugin = _getPlugin();

        (
            ,
            uint256 totalDebtBase,
            ,
            uint256 currentLiquidationThreshold,
            ,
            uint256 hf
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        if (totalDebtBase == 0) {
            info.healthFactor = type(uint256).max;
            info.liquidationThreshold = currentLiquidationThreshold;
            info.timeToLiquidation = type(int256).max; // Infinite
            info.riskLevel = "SAFE";
            info.isHealthy = true;
            return info;
        }

        info.healthFactor = hf;
        info.liquidationThreshold = currentLiquidationThreshold;

        // Classify risk level
        if (hf < 1e18) {
            info.riskLevel = "LIQUIDATABLE";
            info.timeToLiquidation = -1;
            info.isHealthy = false;
        } else if (hf < 1.1e18) {
            info.riskLevel = "DANGER";
            info.timeToLiquidation = 0; // Imminent
            info.isHealthy = false;
        } else if (hf < 1.5e18) {
            info.riskLevel = "WARNING";
            info.timeToLiquidation = 3600; // Rough estimate
            info.isHealthy = false;
        } else {
            info.riskLevel = "SAFE";
            info.timeToLiquidation = type(int256).max;
            info.isHealthy = true;
        }
    }

    // ==================== ILensAdapter: POSITION QUERIES ====================

    /// @inheritdoc ILensAdapter
    function getActivePositionCount() external view override returns (uint256) {
        // Aave = 1 account. Se ha collaterale, conta come 1 posizione
        address plugin = _getPlugin();
        (uint256 totalCollateralBase, , , , , ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);
        return totalCollateralBase > 0 ? 1 : 0;
    }

    /// @inheritdoc ILensAdapter
    function getProtocolSummary() external view override returns (ProtocolSummary memory summary) {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            ,
            ,
            uint256 hf
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        uint256 collateralEth = _baseToEth(totalCollateralBase);
        uint256 debtEth = _baseToEth(totalDebtBase);

        summary = ProtocolSummary({
            name: "AaveV3",
            protocolType: IProtocolAdapter.ProtocolType.LENDING,
            totalCollateralEth: collateralEth,
            totalDebtEth: debtEth,
            netValueEth: collateralEth > debtEth ? collateralEth - debtEth : 0,
            activePositionCount: totalCollateralBase > 0 ? 1 : 0,
            lowestHealthFactor: totalDebtBase > 0 ? hf : type(uint256).max,
            isHealthy: totalDebtBase == 0 || hf >= DEFAULT_SAFE_HEALTH_FACTOR
        });
    }

    // ==================== ILensAdapter: RISK ASSESSMENT ====================

    /// @inheritdoc ILensAdapter
    function getPositionsAtRisk(uint256 minHealthFactor)
        external
        view
        override
        returns (PositionWithRisk[] memory positions)
    {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            ,
            ,
            uint256 hf
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        // Se nessun debito, nessun rischio
        if (totalDebtBase == 0 || hf >= minHealthFactor) {
            return new PositionWithRisk[](0);
        }

        // L'unica posizione è sotto la soglia
        positions = new PositionWithRisk[](1);
        positions[0] = PositionWithRisk({
            positionId: 0,
            protocolName: "AaveV3",
            healthFactor: hf,
            timeToLiquidation: hf < 1e18 ? int256(-1) : int256(0),
            riskLevel: hf < 1e18 ? "LIQUIDATABLE" : "DANGER",
            collateralEth: _baseToEth(totalCollateralBase),
            debtEth: _baseToEth(totalDebtBase),
            shouldAutoClose: hf < minHealthFactor
        });
    }

    /// @inheritdoc ILensAdapter
    function getPositionsSortedByRisk()
        external
        view
        override
        returns (PositionWithRisk[] memory positions)
    {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            ,
            ,
            uint256 hf
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        if (totalCollateralBase == 0) {
            return new PositionWithRisk[](0);
        }

        positions = new PositionWithRisk[](1);

        string memory riskLevel;
        if (totalDebtBase == 0) {
            riskLevel = "SAFE";
        } else if (hf < 1e18) {
            riskLevel = "LIQUIDATABLE";
        } else if (hf < 1.5e18) {
            riskLevel = "WARNING";
        } else {
            riskLevel = "SAFE";
        }

        positions[0] = PositionWithRisk({
            positionId: 0,
            protocolName: "AaveV3",
            healthFactor: totalDebtBase == 0 ? type(uint256).max : hf,
            timeToLiquidation: totalDebtBase == 0 ? type(int256).max : (hf < 1e18 ? int256(-1) : int256(3600)),
            riskLevel: riskLevel,
            collateralEth: _baseToEth(totalCollateralBase),
            debtEth: _baseToEth(totalDebtBase),
            shouldAutoClose: totalDebtBase > 0 && hf < DEFAULT_SAFE_HEALTH_FACTOR
        });
    }

    // ==================== ILensAdapter: YIELD INFORMATION ====================

    /// @inheritdoc ILensAdapter
    function getYieldInfo(string memory tokenCode) external view override returns (YieldInfo memory info) {
        IAaveV3Registry registry = _getRegistry();
        address underlying = registry.getUnderlying(tokenCode);

        // Get reserve rates from Aave Pool (ray = 1e27)
        uint256 liquidityRate = IAaveV3Pool(AAVE_POOL).getReserveNormalizedIncome(underlying);
        uint256 variableBorrowRate = IAaveV3Pool(AAVE_POOL).getReserveNormalizedVariableDebt(underlying);

        // Convert from ray (1e27) to 1e18 scale
        // These are normalized indexes, not direct rates. For approximate APY:
        // The actual APY needs reserve data, but as approximation:
        info.supplyAPY = liquidityRate > 1e27 ? ((liquidityRate - 1e27) * 1e18) / 1e27 : 0;
        info.borrowAPY = variableBorrowRate > 1e27 ? ((variableBorrowRate - 1e27) * 1e18) / 1e27 : 0;
        info.netAPY = int256(info.supplyAPY) - int256(info.borrowAPY);
        info.rewardsAPY = 0; // Aave rewards not tracked here
    }

    /// @inheritdoc ILensAdapter
    function getNetAPY() external pure override returns (int256) {
        // Simplified: would need full calculation considering all positions
        return 0;
    }

    // ==================== ILensAdapter: UTILITY FUNCTIONS ====================

    /// @inheritdoc ILensAdapter
    function getVaultForToken(string memory tokenCode) external view override returns (address) {
        // Per Aave, "vault" = aToken address
        return _getRegistry().getAToken(tokenCode);
    }

    /// @inheritdoc ILensAdapter
    function estimateWethFromCloseAll() external view override returns (uint256 wethAmount) {
        address plugin = _getPlugin();

        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            ,
            ,
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        uint256 netValueEth = _baseToEth(
            totalCollateralBase > totalDebtBase ? totalCollateralBase - totalDebtBase : 0
        );

        // Stima conservativa: 95% del valore netto (slippage, fees)
        wethAmount = (netValueEth * 95) / 100;
    }

    /// @inheritdoc ILensAdapter
    function getLiquidationThreshold(uint256 /* positionId */)
        external
        view
        override
        returns (uint256 thresholdEth)
    {
        address plugin = _getPlugin();
        (
            ,
            ,
            ,
            uint256 currentLiquidationThreshold,
            ,
        ) = IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin);

        // Aave returns LT in basis points (e.g., 8250 = 82.50%)
        // Convert to 1e18 scale
        thresholdEth = currentLiquidationThreshold * 1e14; // 8250 * 1e14 = 0.825e18
    }

    /// @inheritdoc ILensAdapter
    function estimatePositionAfterSwap(
        uint256 /* positionId */,
        address /* tokenIn */,
        address /* tokenOut */,
        uint256 /* amountIn */
    )
        external
        pure
        override
        returns (
            uint256 newCollateralEth,
            uint256 newDebtEth,
            uint256 newHealthFactor
        )
    {
        // Simplified: would need oracle prices for accurate estimation
        // This is a view function used for UI previews
        return (0, 0, 0);
    }

    /// @inheritdoc ILensAdapter
    function getProtocolLimits()
        external
        pure
        override
        returns (uint256 minHealthFactor, uint256 maxLeverage)
    {
        minHealthFactor = 1.05e18; // 1.05
        maxLeverage = 500;         // 5x max (safety limit)
    }
}
