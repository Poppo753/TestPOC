// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/morpho/IMorpho.sol";

/**
 * @title MockMorpho
 * @notice Mock implementation of Morpho Blue for fork testing
 * @dev Simulates supplyCollateral, withdrawCollateral, borrow, repay
 */
contract MockMorpho is IMorpho {
    using SafeERC20 for IERC20;
    using MarketParamsLib for MarketParams;

    // Storage
    mapping(bytes32 => mapping(address => Position)) private _positions;
    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => MarketParams) private _idToParams;
    mapping(address => mapping(address => bool)) private _authorizations;

    // Oracle price (settable for testing)
    uint256 public oraclePrice = 2500e36; // default: 2500 USDC per WETH, scaled by 1e36

    function setOraclePrice(uint256 _price) external {
        oraclePrice = _price;
    }

    // ==================== VIEW FUNCTIONS ====================

    function owner() external pure override returns (address) { return address(0); }
    function feeRecipient() external pure override returns (address) { return address(0); }
    function isIrmEnabled(address) external pure override returns (bool) { return true; }
    function isLltvEnabled(uint256) external pure override returns (bool) { return true; }
    function isAuthorized(address authorizer, address authorized) external view override returns (bool) {
        return _authorizations[authorizer][authorized];
    }
    function nonce(address) external pure override returns (uint256) { return 0; }

    function position(Id id, address user) external view override returns (Position memory) {
        return _positions[Id.unwrap(id)][user];
    }

    function market(Id id) external view override returns (Market memory) {
        return _markets[Id.unwrap(id)];
    }

    function idToMarketParams(Id id) external view override returns (MarketParams memory) {
        return _idToParams[Id.unwrap(id)];
    }

    // ==================== SUPPLY/WITHDRAW (Lending - stub) ====================

    function supply(MarketParams memory, uint256, uint256, address, bytes memory)
        external pure override returns (uint256, uint256) { return (0, 0); }

    function withdraw(MarketParams memory, uint256, uint256, address, address)
        external pure override returns (uint256, uint256) { return (0, 0); }

    // ==================== COLLATERAL/BORROW ====================

    function supplyCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        bytes memory
    ) external override {
        Id marketId = marketParams.id();
        bytes32 key = Id.unwrap(marketId);

        // Initialize market if needed
        if (_markets[key].lastUpdate == 0) {
            _idToParams[key] = marketParams;
            _markets[key].lastUpdate = uint128(block.timestamp);
        }

        // Transfer collateral from caller
        IERC20(marketParams.collateralToken).safeTransferFrom(msg.sender, address(this), assets);

        // Update position
        _positions[key][onBehalf].collateral += uint128(assets);

        _markets[key].lastUpdate = uint128(block.timestamp);
    }

    function withdrawCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        address receiver
    ) external override {
        require(msg.sender == onBehalf || _authorizations[onBehalf][msg.sender], "unauthorized");

        Id marketId = marketParams.id();
        bytes32 key = Id.unwrap(marketId);

        require(_positions[key][onBehalf].collateral >= uint128(assets), "insufficient collateral");

        _positions[key][onBehalf].collateral -= uint128(assets);

        // Transfer collateral to receiver
        IERC20(marketParams.collateralToken).safeTransfer(receiver, assets);

        _markets[key].lastUpdate = uint128(block.timestamp);
    }

    function borrow(
        MarketParams memory marketParams,
        uint256 assets,
        uint256,
        address onBehalf,
        address receiver
    ) external override returns (uint256, uint256) {
        require(msg.sender == onBehalf || _authorizations[onBehalf][msg.sender], "unauthorized");

        Id marketId = marketParams.id();
        bytes32 key = Id.unwrap(marketId);

        // Simple 1:1 share ratio for mock
        uint128 shares = uint128(assets);

        _positions[key][onBehalf].borrowShares += shares;
        _markets[key].totalBorrowAssets += uint128(assets);
        _markets[key].totalBorrowShares += shares;

        // Ensure we have enough liquidity (for mock, just mint from thin air if needed)
        uint256 balance = IERC20(marketParams.loanToken).balanceOf(address(this));
        if (balance >= assets) {
            IERC20(marketParams.loanToken).safeTransfer(receiver, assets);
        }

        _markets[key].lastUpdate = uint128(block.timestamp);

        return (assets, shares);
    }

    function repay(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory
    ) external override returns (uint256, uint256) {
        Id marketId = marketParams.id();
        bytes32 key = Id.unwrap(marketId);

        uint256 repayAssets;
        uint128 repayShares;

        if (shares > 0) {
            // Full repay by shares
            repayShares = uint128(shares);
            repayAssets = uint256(shares); // 1:1 ratio in mock
        } else {
            repayAssets = assets;
            repayShares = uint128(assets);
        }

        // Cap to actual debt
        if (repayShares > _positions[key][onBehalf].borrowShares) {
            repayShares = _positions[key][onBehalf].borrowShares;
            repayAssets = uint256(repayShares);
        }

        if (repayAssets > 0) {
            IERC20(marketParams.loanToken).safeTransferFrom(msg.sender, address(this), repayAssets);
        }

        _positions[key][onBehalf].borrowShares -= repayShares;
        _markets[key].totalBorrowAssets -= uint128(repayAssets);
        _markets[key].totalBorrowShares -= repayShares;

        _markets[key].lastUpdate = uint128(block.timestamp);

        return (repayAssets, repayShares);
    }

    // ==================== MISC ====================

    function liquidate(MarketParams memory, address, uint256, uint256, bytes memory)
        external pure override returns (uint256, uint256) { return (0, 0); }

    function flashLoan(address, uint256, bytes calldata) external pure override {}

    function setAuthorization(address authorized, bool newIsAuthorized) external override {
        _authorizations[msg.sender][authorized] = newIsAuthorized;
    }

    function accrueInterest(MarketParams memory) external pure override {}

    function createMarket(MarketParams memory marketParams) external override {
        Id marketId = marketParams.id();
        bytes32 key = Id.unwrap(marketId);
        _idToParams[key] = marketParams;
        _markets[key].lastUpdate = uint128(block.timestamp);
    }

    // ==================== HELPER: Fund mock with loan tokens ====================

    function fundLoanToken(address token, uint256 amount) external {
        // For testing: allow external funding of loan tokens
        // The test should transfer tokens to this contract first
    }
}

/**
 * @title MockMorphoOracle
 * @notice Mock oracle for testing
 */
contract MockMorphoOracle is IMorphoOracle {
    uint256 private _price;

    constructor(uint256 initialPrice) {
        _price = initialPrice;
    }

    function setPrice(uint256 newPrice) external {
        _price = newPrice;
    }

    function price() external view override returns (uint256) {
        return _price;
    }
}
