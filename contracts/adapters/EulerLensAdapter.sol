// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IEulerLensAdapter.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/euler/IAccountLens.sol";
import "../interfaces/euler/IEVault.sol";
import "../interfaces/euler/IEVC.sol";

// Forward declaration per EulerVaultRegistry
interface IEulerVaultRegistry {
    function getVault(string memory tokenCode) external view returns (address);
    function getVaultSafe(string memory tokenCode) external view returns (address);
    function getTokenCode(address vault) external view returns (string memory);
    function isRegistered(string memory tokenCode) external view returns (bool);
    function getAllRegisteredTokens() external view returns (string[] memory);
    function getAllVaults() external view returns (string[] memory tokenCodes, address[] memory vaults);
}

// Forward declaration per EulerV2Plugin
interface IEulerV2PluginView {
    struct LeveragePosition {
        uint256 positionId;
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    function nextPositionId() external view returns (uint256);
    function getPosition(uint256 positionId) external view returns (LeveragePosition memory);
    function getAllPositions() external view returns (LeveragePosition[] memory);
    function getDebt(string memory tokenCode) external view returns (uint256);
    function getBalance(string memory tokenCode) external view returns (uint256);
}

/**
 * @title EulerLensAdapter
 * @notice Adapter per Euler V2 Lens - Health monitoring e value calculation
 * @dev Integrato con:
 *      - ValueCalculator: getTotalEulerValue() per calcolo valore pool
 *      - LiquidityManager: getEulerPositionsAtRisk() per auto-close
 *      - EulerV2Plugin: monitoring posizioni leverage
 * 
 * EULER LENS CONTRACTS (Arbitrum):
 * - AccountLens: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
 * - VaultLens: 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380
 * - UtilsLens: 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE
 * 
 * ARCHITECTURE:
 * - Query Euler vaults via EulerVaultRegistry
 * - Query liquidity info via AccountLens
 * - Convert values to ETH via TokenManager prices
 * - Support for both simple deposits and leverage positions
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract EulerLensAdapter is IEulerLensAdapter, Ownable {
    
    // ==================== CONSTANTS ====================
    
    /// @notice AccountLens address on Arbitrum
    address public constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    
    /// @notice VaultLens address on Arbitrum
    address public constant VAULT_LENS = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
    
    /// @notice UtilsLens address on Arbitrum
    address public constant UTILS_LENS = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
    
    /// @notice EVC address on Arbitrum
    address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    
    /// @notice WETH address on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    /// @notice Time to liquidation constants
    int256 public constant TTL_LIQUIDATION = -1;
    int256 public constant TTL_INFINITY = type(int256).max;
    int256 public constant TTL_MORE_THAN_ONE_YEAR = type(int256).max - 1;
    int256 public constant TTL_ERROR = type(int256).max - 2;
    
    /// @notice Safe health factor threshold (default 1.5)
    uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18;
    
    // ==================== STATE ====================
    
    /// @notice Beacon for module resolution
    address public immutable beacon;
    
    // ==================== ERRORS ====================
    
    error InvalidBeacon();
    error EulerV2PluginNotFound();
    error EulerVaultRegistryNotFound();
    error TokenManagerNotFound();
    error PositionNotFound(uint256 positionId);
    
    // ==================== EVENTS ====================
    
    event HealthFactorQueried(address indexed account, address indexed vault, uint256 healthFactor);
    event PositionsAtRiskFound(uint256[] positionIds, uint256 threshold);
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Constructs the EulerLensAdapter
     * @param _beacon Beacon address for module resolution
     */
    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidBeacon();
        beacon = _beacon;
    }
    
    // ==================== HEALTH MONITORING ====================
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getHealthFactor(address account) 
        external 
        view 
        override 
        returns (uint256 healthFactor) 
    {
        IEVC evc = IEVC(EVC_ADDRESS);
        address[] memory controllers = evc.getControllers(account);
        
        if (controllers.length == 0) {
            // No controller = no debt = infinitely safe
            return type(uint256).max;
        }
        
        // Use first controller for query
        address controllerVault = controllers[0];
        
        IAccountLens lens = IAccountLens(ACCOUNT_LENS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(account, controllerVault);
        
        if (liquidity.queryFailure) {
            return type(uint256).max;
        }
        
        if (liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        // Health Factor = collateralValue / liabilityValue (scaled to 1e18)
        healthFactor = (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getSubAccountHealth(address subAccount, address controllerVault) 
        external 
        view 
        override 
        returns (uint256 healthFactor) 
    {
        IAccountLens lens = IAccountLens(ACCOUNT_LENS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(subAccount, controllerVault);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        healthFactor = (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getTimeToLiquidation(address account, address vault) 
        external 
        view 
        override 
        returns (int256 ttl, string memory status) 
    {
        IAccountLens lens = IAccountLens(ACCOUNT_LENS);
        ttl = lens.getTimeToLiquidation(account, vault);
        
        if (ttl == TTL_LIQUIDATION) {
            status = "LIQUIDATABLE";
        } else if (ttl == TTL_INFINITY) {
            status = "SAFE_NO_DEBT";
        } else if (ttl == TTL_MORE_THAN_ONE_YEAR) {
            status = "SAFE_OVER_1_YEAR";
        } else if (ttl == TTL_ERROR) {
            status = "ERROR";
        } else if (ttl > 0) {
            status = "AT_RISK";
        } else {
            status = "UNKNOWN";
        }
    }
    
    // ==================== VALUE FUNCTIONS ====================
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getTotalEulerValue() 
        external 
        view 
        override 
        returns (uint256 netValue) 
    {
        (uint256 totalCollateral, uint256 totalDebt, ) = _calculateTotalValues();
        
        // Net value = collateral - debt (underflow protection)
        if (totalCollateral > totalDebt) {
            netValue = totalCollateral - totalDebt;
        } else {
            netValue = 0;
        }
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getEulerPositionValues() 
        external 
        view 
        override 
        returns (
            uint256 totalCollateral, 
            uint256 totalDebt, 
            uint256 netValue
        ) 
    {
        (totalCollateral, totalDebt, netValue) = _calculateTotalValues();
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getPositionCollateralInEth(uint256 positionId) 
        external 
        view 
        override 
        returns (uint256 ethValue) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        IEulerV2PluginView.LeveragePosition memory pos = plugin.getPosition(positionId);
        
        if (!pos.isActive) {
            return 0;
        }
        
        // Get collateral vault
        address collateralVault = pos.collateralVault;
        address asset = IEVault(collateralVault).asset();
        
        // Get collateral amount in vault (shares → assets)
        // Note: For leverage positions, collateral is held in sub-account
        // We use initialCollateral * leverage as approximation for current collateral
        uint256 collateralAmount = pos.initialCollateral;
        
        // If leverage was applied, estimate total collateral
        if (pos.borrowedAmount > 0 && pos.initialCollateral > 0) {
            // Estimate based on initial leverage: total = initial + borrowed value in collateral terms
            // This is an approximation - precise value would need sub-account query
            address borrowAsset = IEVault(pos.borrowVault).asset();
            
            // Get price ratio between collateral and borrow asset
            uint256 borrowValueInEth = _convertToEthValue(borrowAsset, pos.borrowedAmount);
            uint256 initialInEth = _convertToEthValue(asset, pos.initialCollateral);
            
            // Total collateral ≈ initial + borrowed (converted)
            ethValue = initialInEth + borrowValueInEth;
            return ethValue;
        }
        
        // Simple case: just convert collateral to ETH
        ethValue = _convertToEthValue(asset, collateralAmount);
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getWithdrawableAmount(string memory tokenCode) 
        external 
        view 
        override 
        returns (uint256 amount) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        
        // Get current balance and debt
        uint256 balance = plugin.getBalance(tokenCode);
        uint256 debt = plugin.getDebt(tokenCode);
        
        // If no debt, all balance is withdrawable
        if (debt == 0) {
            return balance;
        }
        
        // If has debt, need to maintain health factor
        // Get health factor
        address pluginAddr = _getEulerV2Plugin();
        IEVC evc = IEVC(EVC_ADDRESS);
        address[] memory controllers = evc.getControllers(pluginAddr);
        
        if (controllers.length == 0) {
            return balance;
        }
        
        IAccountLens lens = IAccountLens(ACCOUNT_LENS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(pluginAddr, controllers[0]);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            return balance;
        }
        
        // Calculate max withdrawable maintaining minimum health factor
        // Current HF = collateralValue / debtValue
        // Target HF = 1.05 (MIN_HEALTH_FACTOR)
        // Max withdraw = collateralValue - (debtValue * 1.05)
        uint256 minCollateralNeeded = (liquidity.liabilityValueBorrowing * 105) / 100;
        
        if (liquidity.collateralValueBorrowing > minCollateralNeeded) {
            uint256 excessCollateralValue = liquidity.collateralValueBorrowing - minCollateralNeeded;
            // Convert excess value back to token amount (rough estimate)
            // This is an approximation - precise calculation needs LTV consideration
            uint256 excessRatio = (excessCollateralValue * 1e18) / liquidity.collateralValueBorrowing;
            amount = (balance * excessRatio) / 1e18;
        } else {
            amount = 0;
        }
    }
    
    // ==================== AUTO-CLOSE SUPPORT ====================
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getEulerPositionsAtRisk(uint256 minHealthFactor) 
        external 
        view 
        override 
        returns (uint256[] memory positionIds) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        
        // Get all positions
        IEulerV2PluginView.LeveragePosition[] memory allPositions = plugin.getAllPositions();
        
        // First pass: count positions at risk
        uint256 atRiskCount = 0;
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (allPositions[i].isActive) {
                uint256 hf = _getPositionHealthFactor(allPositions[i]);
                if (hf < minHealthFactor) {
                    atRiskCount++;
                }
            }
        }
        
        // Second pass: collect position IDs
        positionIds = new uint256[](atRiskCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (allPositions[i].isActive) {
                uint256 hf = _getPositionHealthFactor(allPositions[i]);
                if (hf < minHealthFactor) {
                    positionIds[idx] = allPositions[i].positionId;
                    idx++;
                }
            }
        }
        
        // Note: Event removed as this is a view function
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function shouldAutoClosePosition(uint256 positionId, uint256 healthThreshold) 
        external 
        view 
        override 
        returns (bool shouldClose) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        IEulerV2PluginView.LeveragePosition memory pos = plugin.getPosition(positionId);
        
        if (!pos.isActive) {
            return false;
        }
        
        uint256 hf = _getPositionHealthFactor(pos);
        shouldClose = hf < healthThreshold;
    }
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getPrimaryControllerVault(address plugin) 
        external 
        view 
        override 
        returns (address vault) 
    {
        IEVC evc = IEVC(EVC_ADDRESS);
        address[] memory controllers = evc.getControllers(plugin);
        
        if (controllers.length > 0) {
            vault = controllers[0];
        }
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     */
    function getVaultForToken(string memory tokenCode) 
        external 
        view 
        override 
        returns (address vault) 
    {
        IEulerVaultRegistry registry = IEulerVaultRegistry(_getEulerVaultRegistry());
        vault = registry.getVaultSafe(tokenCode);
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     * @dev APY calculation requires VaultLens - simplified version based on utilization
     *      For precise APY, use VaultLens.getVaultInfoFull()
     */
    function getVaultAPYs(address vault) 
        external 
        view 
        override 
        returns (uint256 borrowAPY, uint256 supplyAPY) 
    {
        IEVault eulerVault = IEVault(vault);
        
        // Get utilization
        uint256 totalBorrows = eulerVault.totalBorrows();
        uint256 totalAssets = eulerVault.totalAssets();
        
        if (totalAssets == 0) {
            return (0, 0);
        }
        
        // Utilization = borrows / assets
        uint256 utilization = (totalBorrows * 1e18) / totalAssets;
        
        // Estimate APYs based on utilization (simplified model)
        // Real APY would come from VaultLens
        // Base rate ~3%, max rate ~15% at 100% utilization
        uint256 baseRateAPY = 0.03e18; // 3%
        uint256 maxRateAPY = 0.15e18;  // 15%
        
        // Linear interpolation based on utilization
        borrowAPY = baseRateAPY + ((maxRateAPY - baseRateAPY) * utilization) / 1e18;
        
        // Supply APY = borrow APY * utilization (minus protocol fee)
        supplyAPY = (borrowAPY * utilization * 90) / (1e18 * 100); // 90% goes to suppliers
    }
    
    // ==================== POSITION SORTING ====================
    
    /**
     * @inheritdoc IEulerLensAdapter
     * @dev Gets all positions, calculates health factor for each, and sorts by HF ascending
     *      Used by LiquidityManager to close riskiest positions first
     */
    function getPositionsSortedByHealth() 
        external 
        view 
        override 
        returns (IEulerLensAdapter.PositionWithHealth[] memory positions) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        
        // Get all active positions
        IEulerV2PluginView.LeveragePosition[] memory allPositions;
        try plugin.getAllPositions() returns (IEulerV2PluginView.LeveragePosition[] memory p) {
            allPositions = p;
        } catch {
            return positions; // Empty array
        }
        
        if (allPositions.length == 0) {
            return positions;
        }
        
        // Build array with health factors
        positions = new IEulerLensAdapter.PositionWithHealth[](allPositions.length);
        for (uint256 i = 0; i < allPositions.length; i++) {
            positions[i].positionId = allPositions[i].positionId;
            positions[i].healthFactor = _getPositionHealthFactor(allPositions[i]);
        }
        
        // Sort by health factor (bubble sort - fine for small arrays)
        // Lowest HF first = riskiest positions first
        for (uint256 i = 0; i < positions.length; i++) {
            for (uint256 j = i + 1; j < positions.length; j++) {
                if (positions[j].healthFactor < positions[i].healthFactor) {
                    // Swap
                    IEulerLensAdapter.PositionWithHealth memory temp = positions[i];
                    positions[i] = positions[j];
                    positions[j] = temp;
                }
            }
        }
        
        return positions;
    }
    
    /**
     * @inheritdoc IEulerLensAdapter
     * @dev Gets health factor for a specific position by ID
     */
    function getPositionHealthFactor(uint256 positionId) 
        external 
        view 
        override 
        returns (uint256 healthFactor) 
    {
        IEulerV2PluginView plugin = IEulerV2PluginView(_getEulerV2Plugin());
        
        try plugin.getPosition(positionId) returns (IEulerV2PluginView.LeveragePosition memory pos) {
            if (!pos.isActive) {
                return type(uint256).max; // Inactive = no risk
            }
            return _getPositionHealthFactor(pos);
        } catch {
            return type(uint256).max; // Not found = no risk
        }
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    /**
     * @notice Calculate total collateral, debt, and net values
     * @return totalCollateral Total collateral value in ETH
     * @return totalDebt Total debt value in ETH
     * @return netValue Net value (collateral - debt) in ETH
     */
    function _calculateTotalValues() 
        internal 
        view 
        returns (
            uint256 totalCollateral, 
            uint256 totalDebt, 
            uint256 netValue
        ) 
    {
        address pluginAddr = _getEulerV2Plugin();
        IEulerV2PluginView plugin = IEulerV2PluginView(pluginAddr);
        IEulerVaultRegistry registry = IEulerVaultRegistry(_getEulerVaultRegistry());
        
        // Get all registered tokens
        string[] memory tokens = registry.getAllRegisteredTokens();
        
        // Calculate simple deposit values
        for (uint256 i = 0; i < tokens.length; i++) {
            string memory tokenCode = tokens[i];
            
            // Get balance and debt
            uint256 balance = plugin.getBalance(tokenCode);
            uint256 debt = plugin.getDebt(tokenCode);
            
            // Get token address
            address vault = registry.getVaultSafe(tokenCode);
            if (vault == address(0)) continue;
            
            address asset = IEVault(vault).asset();
            
            // Convert to ETH
            if (balance > 0) {
                totalCollateral += _convertToEthValue(asset, balance);
            }
            if (debt > 0) {
                totalDebt += _convertToEthValue(asset, debt);
            }
        }
        
        // Add leverage positions value
        (uint256 leverageCollateral, uint256 leverageDebt) = _calculateLeverageValues(plugin);
        totalCollateral += leverageCollateral;
        totalDebt += leverageDebt;
        
        // Calculate net value
        if (totalCollateral > totalDebt) {
            netValue = totalCollateral - totalDebt;
        } else {
            netValue = 0;
        }
    }
    
    /**
     * @notice Calculate values from leverage positions
     * @param plugin EulerV2Plugin instance
     * @return collateral Total collateral from leverage positions in ETH
     * @return debt Total debt from leverage positions in ETH
     */
    function _calculateLeverageValues(IEulerV2PluginView plugin)
        internal
        view
        returns (uint256 collateral, uint256 debt)
    {
        IEulerV2PluginView.LeveragePosition[] memory positions = plugin.getAllPositions();
        
        for (uint256 i = 0; i < positions.length; i++) {
            if (!positions[i].isActive) continue;
            
            IEulerV2PluginView.LeveragePosition memory pos = positions[i];
            
            // Get assets
            address collateralAsset = IEVault(pos.collateralVault).asset();
            address borrowAsset = IEVault(pos.borrowVault).asset();
            
            // Calculate estimated total collateral
            // For leverage: total collateral ≈ initial + (borrowed converted to collateral)
            uint256 borrowInEth = _convertToEthValue(borrowAsset, pos.borrowedAmount);
            uint256 initialInEth = _convertToEthValue(collateralAsset, pos.initialCollateral);
            
            // Leverage collateral = initial + borrowed value
            collateral += initialInEth + borrowInEth;
            
            // Leverage debt = borrowed amount
            debt += borrowInEth;
        }
    }
    
    /**
     * @notice Convert token amount to ETH value
     * @param token Token address
     * @param amount Amount in token decimals
     * @return ethValue Value in ETH (18 decimals)
     */
    function _convertToEthValue(address token, uint256 amount)
        internal
        view
        returns (uint256 ethValue)
    {
        if (amount == 0) return 0;
        
        // If token is WETH, return directly (1 WETH = 1 ETH)
        if (token == WETH) {
            return amount;
        }
        
        // Get token price from TokenManager
        ITokenManagerForModules tokenManager = ITokenManagerForModules(_getTokenManager());
        
        // Try to get token code from registry
        IEulerVaultRegistry registry = IEulerVaultRegistry(_getEulerVaultRegistry());
        
        // Get all vaults to find token code
        (string[] memory tokenCodes, address[] memory vaults) = registry.getAllVaults();
        
        string memory tokenCode;
        bool found = false;
        
        for (uint256 i = 0; i < vaults.length; i++) {
            address vaultAsset = IEVault(vaults[i]).asset();
            if (vaultAsset == token) {
                tokenCode = tokenCodes[i];
                found = true;
                break;
            }
        }
        
        if (!found) {
            // Token not found in registry, return 0
            return 0;
        }
        
        // Get price from TokenManager - returns price in ETH directly via ChainlinkAdapter
        // ChainlinkAdapter converts from USD to ETH automatically using reference feed
        try tokenManager.getTokenPriceForModule(tokenCode) returns (uint256 priceInEth) {
            if (priceInEth == 0) {
                return 0;
            }
            
            // Get token decimals
            ITokenManagerForModules.TokenInfo memory info = tokenManager.getTokenInfo(tokenCode);
            
            // Calculate ETH value
            // priceInEth is already in ETH with 18 decimals (from ChainlinkAdapter conversion)
            // ethValue = amount * priceInEth / 10^tokenDecimals
            ethValue = (amount * priceInEth) / (10**info.tokenDecimals);
        } catch {
            return 0;
        }
    }
    
    /**
     * @notice Get health factor for a specific leverage position
     * @param pos Position data
     * @return hf Health factor in 1e18
     */
    function _getPositionHealthFactor(IEulerV2PluginView.LeveragePosition memory pos)
        internal
        view
        returns (uint256 hf)
    {
        if (!pos.isActive) {
            return type(uint256).max;
        }
        
        // Get plugin sub-account address for this position
        address pluginAddr = _getEulerV2Plugin();
        address subAccount = _getSubAccountAddress(pluginAddr, pos.subAccountId);
        
        // Query health factor from AccountLens
        IAccountLens lens = IAccountLens(ACCOUNT_LENS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        hf = (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @notice Calculate sub-account address from main account and sub-account ID
     * @dev Euler V2 sub-account: main XOR subAccountId (matching EulerV2Plugin)
     * @param main Main account address
     * @param subAccountId Sub-account ID (0-255)
     * @return Sub-account address
     */
    function _getSubAccountAddress(address main, uint8 subAccountId)
        internal
        pure
        returns (address)
    {
        // Sub-account = main XOR subAccountId (Euler V2 formula)
        return address(uint160(main) ^ uint160(subAccountId));
    }
    
    // ==================== BEACON RESOLUTION ====================
    
    /**
     * @notice Get EulerV2Plugin address from Beacon
     */
    function _getEulerV2Plugin() internal view returns (address) {
        address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
        if (plugin == address(0)) revert EulerV2PluginNotFound();
        return plugin;
    }
    
    /**
     * @notice Get EulerVaultRegistry address from Beacon
     */
    function _getEulerVaultRegistry() internal view returns (address) {
        address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
        if (registry == address(0)) revert EulerVaultRegistryNotFound();
        return registry;
    }
    
    /**
     * @notice Get TokenManager address from Beacon
     */
    function _getTokenManager() internal view returns (address) {
        address tm = IBeacon(beacon).getImplementation("TokenManager");
        if (tm == address(0)) revert TokenManagerNotFound();
        return tm;
    }
}
