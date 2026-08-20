// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IBeacon.sol";

/**
 * @title IDolomiteMargin
 * @notice Minimal interface for Dolomite Margin protocol
 */
interface IDolomiteMargin {
    function getMarketIdByTokenAddress(address token) external view returns (uint256);
    function getAccountWei(address account, uint256 marketId) external view returns (int256);
}

/**
 * @title IDolomiteRouter
 * @notice Minimal interface for Dolomite deposit/borrow routers
 */
interface IDolomiteRouter {
    function deposit(uint256 marketId, uint256 amount) external;
    function withdraw(uint256 marketId, uint256 amount, address recipient) external;
    function borrow(uint256 marketId, uint256 amount) external;
    function repay(uint256 marketId, uint256 amount) external;
    function openBorrowPosition(address token, uint256 amount) external returns (uint256);
    function borrowFromPosition(uint256 accountNumber, address token, uint256 amount) external;
    function repayBorrowPosition(uint256 accountNumber, address token, uint256 amount) external;
    function closeBorrowPosition(uint256 accountNumber, address[] calldata collateralTokens) external;
    function executeFlashLoan(address token, uint256 amount, address callback, bytes calldata data) external;
}

/**
 * @title DolomitePlugin
 * @notice Plugin for Dolomite Protocol integration (lending, borrowing, flash loans)
 * @dev Implements IProtocolAdapter pattern with lending extensions
 *
 * ARCHITECTURE:
 * - Managed by ProtocolManager (central orchestrator)
 * - Custody flow: ProxyGeneral -> ProtocolManager -> DolomitePlugin -> Dolomite Margin
 * - Operations: deposit, withdraw, borrow, repay, isolated borrow positions, flash loans
 *
 * @author Project4 Team
 * @custom:version 2.0.0
 */
contract DolomitePlugin is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== CUSTOM ERRORS ====================

    error CircuitBreakerActive();
    error InvalidAddress();
    error InvalidAccountNumber();

    // ==================== IMMUTABLES ====================

    /// @notice Beacon for module resolution
    address public immutable beacon;

    /// @notice Dolomite Margin contract
    address public immutable dolomiteMargin;

    /// @notice Dolomite borrow router
    address public immutable borrowRouter;

    /// @notice Dolomite deposit router
    address public immutable depositRouter;

    // ==================== STATE VARIABLES ====================

    /// @notice Circuit breaker flag (emergency stop)
    bool public circuitBreakerTripped;

    // ==================== EVENTS ====================

    event Deposited(string tokenCode, uint256 amount);
    event Withdrawn(string tokenCode, uint256 amount);
    event Borrowed(string tokenCode, uint256 amount, uint256 accountNumber);
    event Repaid(string tokenCode, uint256 amount, uint256 accountNumber);
    event CircuitBreakerChanged(bool active);
    event EmergencyWithdraw(address token, uint256 amount, address recipient);

    // ==================== MODIFIERS ====================

    modifier whenNotTripped() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _beacon,
        address _dolomiteMargin,
        address _borrowRouter,
        address _depositRouter
    ) {
        if (_beacon == address(0)) revert InvalidAddress();
        if (_dolomiteMargin == address(0)) revert InvalidAddress();
        if (_borrowRouter == address(0)) revert InvalidAddress();
        if (_depositRouter == address(0)) revert InvalidAddress();

        beacon = _beacon;
        dolomiteMargin = _dolomiteMargin;
        borrowRouter = _borrowRouter;
        depositRouter = _depositRouter;
    }

    // ==================== IProtocolAdapter: CORE OPERATIONS ====================

    function deposit(string memory tokenCode, uint256 amount) external whenNotTripped nonReentrant returns (bool) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        IERC20(token).safeApprove(depositRouter, amount);
        IDolomiteRouter(depositRouter).deposit(marketId, amount);
        emit Deposited(tokenCode, amount);
        return true;
    }

    function withdraw(string memory tokenCode, uint256 amount) external whenNotTripped nonReentrant returns (bool) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        address proxyGeneral = _getProxyGeneral();
        IDolomiteRouter(depositRouter).withdraw(marketId, amount, proxyGeneral);
        emit Withdrawn(tokenCode, amount);
        return true;
    }

    function getBalance(string memory tokenCode) external view returns (uint256) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        int256 balance = IDolomiteMargin(dolomiteMargin).getAccountWei(address(this), marketId);
        return balance > 0 ? uint256(balance) : 0;
    }

    function getTotalValue() external pure returns (uint256) {
        return 0; // Placeholder
    }

    function getProtocolInfo() external pure returns (string memory name, string memory version, bool isActive) {
        return ("Dolomite Lending", "2.0.0", true);
    }

    function emergencyWithdrawAll(string[] memory tokenCodes) external onlyOwner nonReentrant returns (bool) {
        address proxyGeneral = _getProxyGeneral();

        for (uint256 i = 0; i < tokenCodes.length; i++) {
            address token = _resolveTokenFromCode(tokenCodes[i]);
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).safeTransfer(proxyGeneral, balance);
            }
        }

        return true;
    }

    // ==================== ILendingProtocol: LENDING OPERATIONS ====================

    function borrow(string memory tokenCode, uint256 amount) external whenNotTripped nonReentrant returns (bool) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        IDolomiteRouter(borrowRouter).borrow(marketId, amount);
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, amount);
        emit Borrowed(tokenCode, amount, 0);
        return true;
    }

    function repay(string memory tokenCode, uint256 amount) external whenNotTripped nonReentrant returns (bool) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        IERC20(token).safeApprove(borrowRouter, amount);
        IDolomiteRouter(borrowRouter).repay(marketId, amount);
        emit Repaid(tokenCode, amount, 0);
        return true;
    }

    function getDebt(string memory tokenCode) external view returns (uint256) {
        address token = _resolveTokenFromCode(tokenCode);
        uint256 marketId = _getMarketId(token);
        int256 balance = IDolomiteMargin(dolomiteMargin).getAccountWei(address(this), marketId);
        return balance < 0 ? uint256(-balance) : 0;
    }

    function getHealthFactor() external pure returns (uint256) {
        return type(uint256).max; // Placeholder - no debt
    }

    function getBorrowCapacity(string memory) external pure returns (uint256) {
        return 0; // Placeholder - no collateral
    }

    // ==================== DOLOMITE-SPECIFIC: BORROW POSITIONS ====================

    function openBorrowPosition(address token, uint256 amount) external whenNotTripped nonReentrant {
        _getMarketId(token);
        IERC20(token).safeApprove(borrowRouter, amount);
        IDolomiteRouter(borrowRouter).openBorrowPosition(token, amount);
    }

    function borrowFromPosition(uint256 accountNumber, address token, uint256 amount) external whenNotTripped nonReentrant {
        if (accountNumber == 0) revert InvalidAccountNumber();
        IDolomiteRouter(borrowRouter).borrowFromPosition(accountNumber, token, amount);
    }

    function repayBorrowPosition(uint256 accountNumber, address token, uint256 amount) external whenNotTripped nonReentrant {
        IERC20(token).safeApprove(borrowRouter, amount);
        IDolomiteRouter(borrowRouter).repayBorrowPosition(accountNumber, token, amount);
    }

    function closeBorrowPosition(uint256 accountNumber, address[] calldata collateralTokens) external whenNotTripped nonReentrant {
        if (accountNumber == 0) revert InvalidAccountNumber();
        IDolomiteRouter(borrowRouter).closeBorrowPosition(accountNumber, collateralTokens);
    }

    function executeFlashLoan(address token, uint256 amount, address callback, bytes calldata data) external whenNotTripped nonReentrant {
        _getMarketId(token);
        IDolomiteRouter(borrowRouter).executeFlashLoan(token, amount, callback, data);
    }

    // ==================== ADMIN ====================

    function setCircuitBreaker(bool _active) external onlyOwner {
        circuitBreakerTripped = _active;
        emit CircuitBreakerChanged(_active);
    }

    function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(recipient, amount);
    }

    // ==================== INTERNAL ====================

    function _resolveTokenFromCode(string memory tokenCode) internal view returns (address) {
        return IBeacon(beacon).getImplementation(tokenCode);
    }

    function _getMarketId(address token) internal view returns (uint256) {
        return IDolomiteMargin(dolomiteMargin).getMarketIdByTokenAddress(token);
    }

    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }
}
