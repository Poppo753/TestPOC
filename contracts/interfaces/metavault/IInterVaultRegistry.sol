// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IInterVaultRegistry {
    struct ChildVault {
        bytes32 childId;
        string tokenCode;
        bytes32 assetId;
        address childBeacon;
        address liquidityManager;
        address shareToken;
        address valueCalculator;
        address baseAsset;
        bytes32 manifestHash;
        uint256 chainId;
        uint8 assetDecimals;
        uint16 maxExposureBps;
        uint16 maxShareDeviationBps;
        uint16 exitPriority;
        uint128 maxDepositAssets;
        bool active;
        bool depositsEnabled;
        bool withdrawalsEnabled;
        bool emergencyOnly;
    }

    function getChild(bytes32 childId) external view returns (ChildVault memory child);
    function getChildForToken(string calldata tokenCode) external view returns (ChildVault memory child);
    function getChildIds() external view returns (bytes32[] memory childIds);
    function getChildCount() external view returns (uint256);
    function getPositionHolder() external view returns (address);
    function isChildRegistered(bytes32 childId) external view returns (bool);
}
