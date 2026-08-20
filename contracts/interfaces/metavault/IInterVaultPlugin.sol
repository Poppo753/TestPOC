// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../IProtocolAdapter.sol";

interface IInterVaultPlugin is IProtocolAdapter {
    function circuitBreakerTripped() external view returns (bool);
    function getActiveChildIds() external view returns (bytes32[] memory childIds);
    function getChildShares(bytes32 childId) external view returns (uint256 shares);
    function getChildAssets(bytes32 childId) external view returns (uint256 assets);
    function deactivateCircuitBreaker() external;
}
