// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../ILensAdapter.sol";

interface IInterVaultLensAdapter is ILensAdapter {
    struct ChildPosition {
        bytes32 childId;
        string tokenCode;
        address shareToken;
        uint256 shares;
        uint256 underlyingAssets;
        uint256 valueInParentBase;
        uint256 availableInParentBase;
        uint256 exposureBps;
        bool active;
        bool depositsEnabled;
        bool withdrawalsEnabled;
    }

    function getChildPosition(bytes32 childId) external view returns (ChildPosition memory position);
    function getAllChildPositions() external view returns (ChildPosition[] memory positions);
}
