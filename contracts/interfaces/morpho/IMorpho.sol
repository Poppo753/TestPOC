// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.27;

/// @dev Custom type for Morpho market identifiers (bytes32 hash of MarketParams)
type Id is bytes32;

/// @notice Parameters that uniquely identify a Morpho Blue market
struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

/// @notice Position of a user in a specific market
struct Position {
    uint256 supplyShares;
    uint128 borrowShares;
    uint128 collateral;
}

/// @notice Aggregate state of a market
struct Market {
    uint128 totalSupplyAssets;
    uint128 totalSupplyShares;
    uint128 totalBorrowAssets;
    uint128 totalBorrowShares;
    uint128 lastUpdate;
    uint128 fee;
}

/// @title IMorpho
/// @notice Interface for the Morpho Blue singleton contract
/// @dev Deployed at 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb on all supported chains
interface IMorpho {

    // ==================== VIEW FUNCTIONS ====================

    function owner() external view returns (address);
    function feeRecipient() external view returns (address);
    function isIrmEnabled(address irm) external view returns (bool);
    function isLltvEnabled(uint256 lltv) external view returns (bool);
    function isAuthorized(address authorizer, address authorized) external view returns (bool);
    function nonce(address authorizer) external view returns (uint256);

    /// @notice Get position of a user in a market
    function position(Id id, address user) external view returns (Position memory p);

    /// @notice Get the state of a market
    function market(Id id) external view returns (Market memory m);

    /// @notice Get the market params corresponding to an id
    function idToMarketParams(Id id) external view returns (MarketParams memory);

    // ==================== SUPPLY/WITHDRAW (Lending) ====================

    /// @notice Supply assets to a market (as lender)
    function supply(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory data
    ) external returns (uint256 assetsSupplied, uint256 sharesSupplied);

    /// @notice Withdraw supplied assets from a market (as lender)
    function withdraw(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn);

    // ==================== COLLATERAL/BORROW (Borrowing) ====================

    /// @notice Supply collateral to a market (as borrower)
    function supplyCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        bytes memory data
    ) external;

    /// @notice Withdraw collateral from a market
    function withdrawCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        address receiver
    ) external;

    /// @notice Borrow assets from a market
    function borrow(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsBorrowed, uint256 sharesBorrowed);

    /// @notice Repay borrowed assets
    function repay(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory data
    ) external returns (uint256 assetsRepaid, uint256 sharesRepaid);

    // ==================== LIQUIDATION ====================

    function liquidate(
        MarketParams memory marketParams,
        address borrower,
        uint256 seizedAssets,
        uint256 repaidShares,
        bytes memory data
    ) external returns (uint256, uint256);

    // ==================== FLASH LOAN ====================

    /// @notice Execute a flash loan (0% fee, access to full contract balance)
    function flashLoan(address token, uint256 assets, bytes calldata data) external;

    // ==================== AUTHORIZATION ====================

    function setAuthorization(address authorized, bool newIsAuthorized) external;

    // ==================== INTEREST ====================

    function accrueInterest(MarketParams memory marketParams) external;

    // ==================== MARKET CREATION ====================

    function createMarket(MarketParams memory marketParams) external;
}

/// @title IMorphoOracle
/// @notice Interface for Morpho-compatible oracles
/// @dev Returns price scaled by 1e36 (ORACLE_PRICE_SCALE)
interface IMorphoOracle {
    /// @notice Returns the price of 1 unit of collateral token in loan token units
    /// @dev Price is scaled by 1e36
    function price() external view returns (uint256);
}

/// @title MarketParamsLib
/// @notice Library to compute market Id from MarketParams
library MarketParamsLib {
    function id(MarketParams memory marketParams) internal pure returns (Id) {
        return Id.wrap(keccak256(abi.encode(marketParams)));
    }
}
