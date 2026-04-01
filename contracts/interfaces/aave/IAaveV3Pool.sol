// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IAaveV3Pool
 * @notice Minimal interface for Aave V3 Pool contract on Arbitrum
 * @dev Based on official Aave V3 docs: https://aave.com/docs/developers/smart-contracts/pool
 *      Pool address on Arbitrum: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * 
 * @author Project4 Team
 */
interface IAaveV3Pool {

    // ==================== WRITE METHODS ====================

    /**
     * @notice Supplies an amount of underlying asset into the reserve
     * @param asset The address of the underlying asset to supply
     * @param amount The amount to be supplied
     * @param onBehalfOf The address that will receive the aTokens (should be address(this))
     * @param referralCode Referral code (pass 0, currently inactive)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraws an amount of underlying asset from the reserve
     * @param asset The address of the underlying asset to withdraw (not the aToken)
     * @param amount The underlying amount to withdraw. Use type(uint256).max for full balance
     * @param to The address that will receive the underlying asset
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Borrow a specific amount of asset, provided sufficient collateral is supplied
     * @param asset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param interestRateMode Should always be 2 (variable rate)
     * @param referralCode Referral code (pass 0, currently inactive)
     * @param onBehalfOf Address of the user who will receive the debt (should be address(this))
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    /**
     * @notice Repays a borrowed amount on a specific reserve
     * @param asset The address of the borrowed underlying asset
     * @param amount The amount to repay. Use type(uint256).max to repay full debt
     * @param interestRateMode Should always be 2 (variable rate)
     * @param onBehalfOf Address of the user who will get their debt reduced
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Allows suppliers to enable/disable a specific asset as collateral
     * @param asset The address of the underlying asset supplied
     * @param useAsCollateral true = use as collateral, false = don't
     */
    function setUserUseReserveAsCollateral(
        address asset,
        bool useAsCollateral
    ) external;

    // ==================== VIEW METHODS ====================

    /**
     * @notice Returns the user account data across all reserves
     * @param user The address of the user
     * @return totalCollateralBase Total collateral in base currency (USD, 8 decimals)
     * @return totalDebtBase Total debt in base currency (USD, 8 decimals)
     * @return availableBorrowsBase Borrowing power left in base currency
     * @return currentLiquidationThreshold The liquidation threshold of the user
     * @return ltv The loan to value of the user
     * @return healthFactor The current health factor (1e18 scale, < 1e18 = liquidatable)
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );

    /**
     * @notice Returns the list of initialized reserve underlying assets
     * @return The addresses of the underlying assets of all initialized reserves
     */
    function getReservesList() external view returns (address[] memory);

    /**
     * @notice Returns the aToken address of a reserve
     * @param asset Underlying token address
     * @return The address of the AToken
     */
    function getReserveAToken(address asset) external view returns (address);

    /**
     * @notice Returns the variableDebtToken address of a reserve
     * @param asset Underlying token address
     * @return The address of the VariableDebtToken
     */
    function getReserveVariableDebtToken(address asset) external view returns (address);

    /**
     * @notice Returns the normalized income per unit of asset (for APY calculation)
     * @param asset The address of the underlying asset
     * @return The reserve's normalized income (ray = 1e27)
     */
    function getReserveNormalizedIncome(address asset) external view returns (uint256);

    /**
     * @notice Returns the normalized variable debt per unit of asset (for APY calculation)
     * @param asset The address of the underlying asset
     * @return The reserve normalized variable debt (ray = 1e27)
     */
    function getReserveNormalizedVariableDebt(address asset) external view returns (uint256);
}
