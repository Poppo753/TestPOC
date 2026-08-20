// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IERC4626
 * @notice Minimal ERC-4626 interface for MetaMorpho vault interaction
 */
interface IERC4626 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner_) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256 assets);
    function balanceOf(address account) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function maxDeposit(address) external view returns (uint256);
    function maxWithdraw(address owner_) external view returns (uint256);
}
