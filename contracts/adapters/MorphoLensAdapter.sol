// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/ILensAdapter.sol";
import "../interfaces/IProtocolAdapter.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IMorphoRegistry.sol";
import {IMorpho, IMorphoOracle, MarketParams, MarketParamsLib, Market, Id} from "../interfaces/morpho/IMorpho.sol";
import {Position as MorphoPosition} from "../interfaces/morpho/IMorpho.sol";

/**
 * @title MorphoLensAdapter
 * @notice Adapter per Morpho Blue - Health monitoring e value calculation
 * @dev Integrato con:
 *      - ValueCalculator: getTotalValue() per calcolo valore pool
 *      - LiquidityManager: getPositionsAtRisk() per auto-close
 *      - MorphoPlugin: monitoring posizioni
 * 
 * MORPHO BLUE (Arbitrum):
 * - 0x6c247b1F6182318877311737BaC0844bAa518F5e
 * 
 * ARCHITETTURA:
 * - Query posizioni direttamente da Morpho.position(id, user)
 * - NO health factor nativo → calcolo manuale:
 *   HF = (collateral * oraclePrice * lltv) / (debt * ORACLE_PRICE_SCALE)
 * - Iterazione su tutti i mercati registrati per aggregazione
 * - Conversione valori a ETH via TokenManager (Chainlink)
 * 
 * DIFFERENZA VS AAVE LENS:
 * - Aave: getUserAccountData() ritorna tutto aggregato in un colpo + HF nativo
 * - Morpho: serve iterare ogni mercato, query posizione + oracle + calcolo manuale HF
 * - Morpho: ogni mercato è isolato (non cross-margined)
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract MorphoLensAdapter is ILensAdapter, Ownable {
    using MarketParamsLib for MarketParams;

    // ==================== CONSTANTS ====================

    /// @notice Oracle price scale (1e36)
    uint256 public constant ORACLE_PRICE_SCALE = 1e36;

    /// @notice WAD (1e18)
    uint256 public constant WAD = 1e18;

    /// @notice Safe health factor threshold (default 1.5)
    uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18;

    // ==================== STATE ====================

    /// @notice Beacon for module resolution
    address public immutable beacon;

    /// @notice Morpho Blue address (chain-specific, injected at deploy time)
    address public immutable morpho;

    /// @notice Base asset code for value denomination
    string public baseAssetCode;

    // ==================== ERRORS ====================

    error InvalidBeacon();
    error MorphoPluginNotFound();
    error MorphoRegistryNotFound();
    error TokenManagerNotFound();

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress) Ownable() {
        if (_beacon == address(0)) revert InvalidBeacon();
        if (_morphoAddress == address(0)) revert InvalidBeacon();
        beacon = _beacon;
        morpho = _morphoAddress;
        baseAssetCode = _baseAssetCode;
    }

    // ==================== INTERNAL HELPERS ====================

    function _getMorpho() private view returns (IMorpho) {
        return IMorpho(morpho);
    }

    function _getRegistry() private view returns (IMorphoRegistry) {
        address registry = IBeacon(beacon).getImplementation("MorphoRegistry");
        return IMorphoRegistry(registry);
    }

    function _getPlugin() private view returns (address) {
        return IBeacon(beacon).getImplementation("MorphoPlugin");
    }

    /**
     * @dev Convert a token amount to base asset using TokenManager (Chainlink prices)
     * @param token Token address
     * @param tokenCode Token code for TokenManager lookup
     * @param amount Amount in token units
     * @return Value in base asset decimals
     */
    function _toBaseAsset(address token, string memory tokenCode, uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;

        address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
        if (token == baseAsset) return amount;

        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");

        uint256 tokenPrice = ITokenManagerForModules(tokenManager).getTokenPriceForModule(tokenCode);
        if (tokenPrice == 0) return 0;

        uint256 baseAssetPrice = ITokenManagerForModules(tokenManager).getBaseAssetPrice();
        if (baseAssetPrice == 0) return 0;

        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        uint8 baseDecimals = IERC20Metadata(baseAsset).decimals();

        // Cross-rate: valueInBaseAsset = amount * tokenPrice * 10^baseDecimals / (baseAssetPrice * 10^tokenDecimals)
        return (amount * tokenPrice * (10 ** baseDecimals)) / (baseAssetPrice * (10 ** tokenDecimals));
    }

    /**
     * @dev Get position value in base asset for a specific market
     */
    function _getPositionValue(
        address plugin,
        MarketParams memory params,
        Id marketId,
        string memory loanCode
    ) private view returns (uint256 collateralVal, uint256 debtVal) {
        MorphoPosition memory pos = _getMorpho().position(marketId, plugin);

        if (pos.collateral == 0 && pos.borrowShares == 0) return (0, 0);

        // Convert collateral to loan token units using oracle price
        if (pos.collateral > 0) {
            uint256 oraclePrice = IMorphoOracle(params.oracle).price();
            uint256 collateralValueInLoan = (uint256(pos.collateral) * oraclePrice) / ORACLE_PRICE_SCALE;
            collateralVal = _toBaseAsset(params.loanToken, loanCode, collateralValueInLoan);
        }

        // Convert debt from shares to assets
        if (pos.borrowShares > 0) {
            Market memory mkt = _getMorpho().market(marketId);
            if (mkt.totalBorrowShares > 0) {
                uint256 debtAssets = (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets) + uint256(mkt.totalBorrowShares) - 1) / uint256(mkt.totalBorrowShares);
                debtVal = _toBaseAsset(params.loanToken, loanCode, debtAssets);
            }
        }
    }

    /**
     * @dev Compute health factor for a specific market position
     */
    function _computeMarketHF(
        address plugin,
        MarketParams memory params,
        Id marketId
    ) private view returns (uint256) {
        MorphoPosition memory pos = _getMorpho().position(marketId, plugin);

        if (pos.borrowShares == 0) return type(uint256).max;

        Market memory mkt = _getMorpho().market(marketId);
        if (mkt.totalBorrowShares == 0) return type(uint256).max;

        uint256 debtAssets = (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets) + uint256(mkt.totalBorrowShares) - 1) / uint256(mkt.totalBorrowShares);
        if (debtAssets == 0) return type(uint256).max;

        uint256 oraclePrice = IMorphoOracle(params.oracle).price();
        uint256 collateralValue = (uint256(pos.collateral) * oraclePrice) / ORACLE_PRICE_SCALE;

        // HF = collateralValue * lltv / debtAssets  (lltv già in WAD → HF in WAD). C1-05: rimosso `* WAD` errato.
        return (collateralValue * params.lltv) / debtAssets;
    }

    // ==================== ILensAdapter: IDENTIFICATION ====================

    /// @inheritdoc ILensAdapter
    function protocolName() external pure override returns (string memory) {
        return "Morpho";
    }

    /// @inheritdoc ILensAdapter
    function protocolType() external pure override returns (IProtocolAdapter.ProtocolType) {
        return IProtocolAdapter.ProtocolType.LENDING;
    }

    /// @inheritdoc ILensAdapter
    function isCircuitBreakerActive() external view override returns (bool) {
        address plugin = _getPlugin();
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
     * @dev Net value across all Morpho markets (collateral - debt) in ETH
     */
    function getTotalValue() external view override returns (uint256 netValue) {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        uint256 totalCollateral;
        uint256 totalDebt;

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);
            totalCollateral += cVal;
            totalDebt += dVal;
        }

        netValue = totalCollateral > totalDebt ? totalCollateral - totalDebt : 0;
    }

    /// @inheritdoc ILensAdapter
    function getValueBreakdown() external view override returns (ValueBreakdown memory breakdown) {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);
            breakdown.totalCollateral += cVal;
            breakdown.totalDebt += dVal;
        }

        breakdown.netValue = breakdown.totalCollateral > breakdown.totalDebt
            ? breakdown.totalCollateral - breakdown.totalDebt
            : 0;
        // Available to withdraw = approximate remaining borrowing capacity
        breakdown.availableToWithdraw = breakdown.netValue > breakdown.totalDebt
            ? breakdown.netValue - breakdown.totalDebt
            : 0;
    }

    // ==================== ILensAdapter: HEALTH MONITORING ====================

    /**
     * @inheritdoc ILensAdapter
     * @dev Returns the LOWEST health factor across all Morpho market positions
     */
    function getHealthFactor() external view override returns (uint256 healthFactor) {
        healthFactor = type(uint256).max;
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            uint256 mktHF = _computeMarketHF(plugin, params, marketId);
            if (mktHF < healthFactor) {
                healthFactor = mktHF;
            }
        }
    }

    /// @inheritdoc ILensAdapter
    function getPositionHealth(uint256 positionId) external view override returns (HealthInfo memory info) {
        // positionId = market index
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        if (positionId >= collCodes.length) {
            info.healthFactor = type(uint256).max;
            info.riskLevel = "SAFE";
            info.isHealthy = true;
            info.timeToLiquidation = type(int256).max;
            return info;
        }

        MarketParams memory params = registry.getMarketParams(collCodes[positionId], lnCodes[positionId]);
        Id marketId = params.id();
        uint256 hf = _computeMarketHF(plugin, params, marketId);

        info = _buildHealthInfo(hf, params.lltv);
    }

    /// @inheritdoc ILensAdapter
    function getAccountHealth() external view override returns (HealthInfo memory info) {
        // Aggregate: use lowest HF across all markets
        uint256 lowestHF = type(uint256).max;
        uint256 lowestLLTV;

        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            uint256 hf = _computeMarketHF(plugin, params, marketId);
            if (hf < lowestHF) {
                lowestHF = hf;
                lowestLLTV = params.lltv;
            }
        }

        info = _buildHealthInfo(lowestHF, lowestLLTV);
    }

    function _buildHealthInfo(uint256 hf, uint256 lltv) private pure returns (HealthInfo memory info) {
        info.healthFactor = hf;
        info.liquidationThreshold = lltv;

        if (hf == type(uint256).max) {
            info.timeToLiquidation = type(int256).max;
            info.riskLevel = "SAFE";
            info.isHealthy = true;
        } else if (hf < 1e18) {
            info.riskLevel = "LIQUIDATABLE";
            info.timeToLiquidation = -1;
            info.isHealthy = false;
        } else if (hf < 1.1e18) {
            info.riskLevel = "DANGER";
            info.timeToLiquidation = 0;
            info.isHealthy = false;
        } else if (hf < 1.5e18) {
            info.riskLevel = "WARNING";
            info.timeToLiquidation = 3600;
            info.isHealthy = false;
        } else {
            info.riskLevel = "SAFE";
            info.timeToLiquidation = type(int256).max;
            info.isHealthy = true;
        }
    }

    // ==================== ILensAdapter: POSITION QUERIES ====================

    /// @inheritdoc ILensAdapter
    function getActivePositionCount() external view override returns (uint256 count) {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.collateral > 0 || pos.borrowShares > 0) {
                count++;
            }
        }
    }

    /// @inheritdoc ILensAdapter
    function getProtocolSummary() external view override returns (ProtocolSummary memory summary) {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        uint256 lowestHF = type(uint256).max;
        uint256 activeCount;

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();

            (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);
            summary.totalCollateral += cVal;
            summary.totalDebt += dVal;

            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.collateral > 0 || pos.borrowShares > 0) {
                activeCount++;
                uint256 hf = _computeMarketHF(plugin, params, marketId);
                if (hf < lowestHF) lowestHF = hf;
            }
        }

        summary.name = "Morpho";
        summary.protocolType = IProtocolAdapter.ProtocolType.LENDING;
        summary.netValue = summary.totalCollateral > summary.totalDebt
            ? summary.totalCollateral - summary.totalDebt
            : 0;
        summary.activePositionCount = activeCount;
        summary.lowestHealthFactor = lowestHF;
        summary.isHealthy = lowestHF >= DEFAULT_SAFE_HEALTH_FACTOR;
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
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        // First pass: count at-risk positions
        uint256 atRiskCount;
        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.borrowShares > 0) {
                uint256 hf = _computeMarketHF(plugin, params, marketId);
                if (hf < minHealthFactor) {
                    atRiskCount++;
                }
            }
        }

        if (atRiskCount == 0) return new PositionWithRisk[](0);

        // Second pass: populate array
        positions = new PositionWithRisk[](atRiskCount);
        uint256 idx;
        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.borrowShares > 0) {
                uint256 hf = _computeMarketHF(plugin, params, marketId);
                if (hf < minHealthFactor) {
                    (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);
                    positions[idx] = PositionWithRisk({
                        positionId: i,
                        protocolName: "Morpho",
                        healthFactor: hf,
                        timeToLiquidation: hf < 1e18 ? int256(-1) : int256(0),
                        riskLevel: hf < 1e18 ? "LIQUIDATABLE" : "DANGER",
                        collateral: cVal,
                        debt: dVal,
                        shouldAutoClose: hf < minHealthFactor
                    });
                    idx++;
                }
            }
        }
    }

    /// @inheritdoc ILensAdapter
    function getPositionsSortedByRisk()
        external
        view
        override
        returns (PositionWithRisk[] memory positions)
    {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        // Count active positions
        uint256 activeCount;
        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.collateral > 0 || pos.borrowShares > 0) activeCount++;
        }

        if (activeCount == 0) return new PositionWithRisk[](0);

        positions = new PositionWithRisk[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = _getMorpho().position(marketId, plugin);
            if (pos.collateral > 0 || pos.borrowShares > 0) {
                uint256 hf = _computeMarketHF(plugin, params, marketId);
                (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);

                string memory riskLevel;
                if (pos.borrowShares == 0) {
                    riskLevel = "SAFE";
                } else if (hf < 1e18) {
                    riskLevel = "LIQUIDATABLE";
                } else if (hf < 1.5e18) {
                    riskLevel = "WARNING";
                } else {
                    riskLevel = "SAFE";
                }

                positions[idx] = PositionWithRisk({
                    positionId: i,
                    protocolName: "Morpho",
                    healthFactor: hf,
                    timeToLiquidation: pos.borrowShares == 0 ? type(int256).max : (hf < 1e18 ? int256(-1) : int256(3600)),
                    riskLevel: riskLevel,
                    collateral: cVal,
                    debt: dVal,
                    shouldAutoClose: pos.borrowShares > 0 && hf < DEFAULT_SAFE_HEALTH_FACTOR
                });
                idx++;
            }
        }

        // Simple insertion sort by health factor (ascending = riskiest first)
        for (uint256 i = 1; i < positions.length; i++) {
            PositionWithRisk memory key = positions[i];
            uint256 j = i;
            while (j > 0 && positions[j - 1].healthFactor > key.healthFactor) {
                positions[j] = positions[j - 1];
                j--;
            }
            positions[j] = key;
        }
    }

    // ==================== ILensAdapter: YIELD INFORMATION ====================

    /// @inheritdoc ILensAdapter
    function getYieldInfo(string memory /* tokenCode */) external pure override returns (YieldInfo memory info) {
        // Morpho collateral doesn't earn yield
        // Borrow APY varies per market and requires IRM query
        info.supplyAPY = 0;
        info.borrowAPY = 0;
        info.netAPY = 0;
        info.rewardsAPY = 0;
    }

    /// @inheritdoc ILensAdapter
    function getNetAPY() external pure override returns (int256) {
        // Would require querying each market's IRM for borrow rates
        return 0;
    }

    // ==================== ILensAdapter: UTILITY FUNCTIONS ====================

    /// @inheritdoc ILensAdapter
    function getVaultForToken(string memory tokenCode) external view override returns (address) {
        // Morpho doesn't have "vaults" — return the Morpho singleton
        // But check if there's a market configured for this token
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, ) = registry.getRegisteredMarkets();

        bytes32 tokenHash = keccak256(bytes(tokenCode));
        for (uint256 i = 0; i < collCodes.length; i++) {
            if (keccak256(bytes(collCodes[i])) == tokenHash) {
                return morpho;
            }
        }
        return address(0);
    }

    /// @inheritdoc ILensAdapter
    function estimateBaseAssetFromCloseAll() external view override returns (uint256 amount) {
        address plugin = _getPlugin();
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            (uint256 cVal, uint256 dVal) = _getPositionValue(plugin, params, marketId, lnCodes[i]);
            if (cVal > dVal) {
                amount += cVal - dVal;
            }
        }
    }

    /// @inheritdoc ILensAdapter
    function getLiquidationThreshold(uint256 positionId)
        external
        view
        override
        returns (uint256 threshold)
    {
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();
        if (positionId >= collCodes.length) return 0;

        MarketParams memory params = registry.getMarketParams(collCodes[positionId], lnCodes[positionId]);
        return params.lltv;
    }

    /// @inheritdoc ILensAdapter
    function estimatePositionAfterSwap(
        uint256 /* positionId */,
        address /* tokenIn */,
        address /* tokenOut */,
        uint256 /* amountIn */
    ) external pure override returns (uint256, uint256, uint256) {
        // Not implemented for Morpho (no swap within protocol)
        return (0, 0, 0);
    }

    /// @inheritdoc ILensAdapter
    function getProtocolLimits()
        external
        pure
        override
        returns (uint256 minHealthFactor, uint256 maxLeverage)
    {
        minHealthFactor = 1.05e18;
        maxLeverage = 500; // 5x
    }
}
