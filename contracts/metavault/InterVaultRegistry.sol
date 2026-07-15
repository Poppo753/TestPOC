// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/metavault/IInterVaultRegistry.sol";

interface IInterVaultBeaconDirectory is IBeacon {
    function checkModuleExists(string memory moduleName) external view returns (bool);
}

/**
 * @title InterVaultRegistry
 * @notice Governance-owned map of the only leaf vaults that a local MetaVault may use.
 * @dev The registry never holds funds and never calls a child.  The token code is
 *      always the real underlying asset code.  V1 deliberately permits exactly
 *      one canonical deposit destination for each token code.
 */
contract InterVaultRegistry is IInterVaultRegistry, Ownable {
    uint16 public constant BPS = 10_000;

    address public immutable parentBeacon;
    bytes32 public immutable parentVaultId;
    address private positionHolder;

    mapping(bytes32 => ChildVault) private children;
    mapping(bytes32 => bool) private registered;
    mapping(bytes32 => bytes32) private childByTokenKey;
    mapping(address => bytes32) private childByShareToken;
    mapping(address => bytes32) private childByBaseAsset;
    bytes32[] private childIds;

    error InvalidAddress();
    error InvalidChildId();
    error InvalidManifest();
    error InvalidChain(uint256 supplied, uint256 expected);
    error InvalidLevel(uint8 supplied);
    error InvalidPolicy();
    error ContractCodeMissing(address target);
    error ChildAlreadyRegistered(bytes32 childId);
    error TokenAlreadyAssigned(string tokenCode);
    error ShareTokenAlreadyAssigned(address shareToken);
    error AssetAlreadyAssigned(address baseAsset);
    error ChildNotFound(bytes32 childId);
    error ComponentMismatch(string component, address supplied, address resolved);
    error ChildHasInterVaultCapability();
    error PositionHolderNotConfigured();
    error ChildHasBalance(bytes32 childId, uint256 shares);

    event PositionHolderUpdated(address indexed oldHolder, address indexed newHolder);
    event ChildRegistered(bytes32 indexed childId, string tokenCode, address indexed shareToken, bytes32 manifestHash);
    event ChildPolicyUpdated(bytes32 indexed childId, uint16 maxExposureBps, uint128 maxDepositAssets, uint16 maxShareDeviationBps, uint16 exitPriority);
    event ChildStatusUpdated(bytes32 indexed childId, bool active, bool depositsEnabled, bool withdrawalsEnabled, bool emergencyOnly);
    event ChildRemoved(bytes32 indexed childId, string tokenCode, address indexed shareToken);

    constructor(address _parentBeacon, bytes32 _parentVaultId) Ownable() {
        if (_parentBeacon == address(0) || _parentBeacon.code.length == 0) revert InvalidAddress();
        if (_parentVaultId == bytes32(0)) revert InvalidChildId();
        parentBeacon = _parentBeacon;
        parentVaultId = _parentVaultId;
    }

    function setPositionHolder(address newHolder) external onlyOwner {
        if (newHolder == address(0) || newHolder.code.length == 0) revert InvalidAddress();
        address oldHolder = positionHolder;
        positionHolder = newHolder;
        emit PositionHolderUpdated(oldHolder, newHolder);
    }

    function registerChild(ChildVault calldata child, uint8 level) external onlyOwner {
        if (child.childId == bytes32(0) || child.childId == parentVaultId) revert InvalidChildId();
        if (registered[child.childId]) revert ChildAlreadyRegistered(child.childId);
        if (bytes(child.tokenCode).length == 0 || child.assetId == bytes32(0)) revert InvalidPolicy();
        if (child.manifestHash == bytes32(0)) revert InvalidManifest();
        if (child.chainId != block.chainid) revert InvalidChain(child.chainId, block.chainid);
        if (level != 0) revert InvalidLevel(level);
        _validatePolicy(child.maxExposureBps, child.maxShareDeviationBps, child.maxDepositAssets);
        _requireContract(child.childBeacon);
        _requireContract(child.liquidityManager);
        _requireContract(child.shareToken);
        _requireContract(child.valueCalculator);
        _requireContract(child.baseAsset);

        bytes32 tokenKey = keccak256(bytes(child.tokenCode));
        if (childByTokenKey[tokenKey] != bytes32(0)) revert TokenAlreadyAssigned(child.tokenCode);
        if (childByShareToken[child.shareToken] != bytes32(0)) revert ShareTokenAlreadyAssigned(child.shareToken);
        // A differently-cased/synthetic tokenCode must not create a second
        // route for the same economic asset. V1 has one canonical leaf per
        // real ERC-20 address on the current chain.
        if (childByBaseAsset[child.baseAsset] != bytes32(0)) revert AssetAlreadyAssigned(child.baseAsset);

        IInterVaultBeaconDirectory directory = IInterVaultBeaconDirectory(child.childBeacon);
        _requireComponent(directory, "LiquidityManager", child.liquidityManager);
        _requireComponent(directory, "ProxyGeneral", child.shareToken);
        _requireComponent(directory, "ValueCalculator", child.valueCalculator);
        _requireComponent(directory, "BASE_ASSET", child.baseAsset);
        if (directory.checkModuleExists("InterVaultPlugin")) revert ChildHasInterVaultCapability();

        children[child.childId] = child;
        registered[child.childId] = true;
        childByTokenKey[tokenKey] = child.childId;
        childByShareToken[child.shareToken] = child.childId;
        childByBaseAsset[child.baseAsset] = child.childId;
        childIds.push(child.childId);
        emit ChildRegistered(child.childId, child.tokenCode, child.shareToken, child.manifestHash);
    }

    function updatePolicy(
        bytes32 childId,
        uint16 maxExposureBps,
        uint128 maxDepositAssets,
        uint16 maxShareDeviationBps,
        uint16 exitPriority
    ) external onlyOwner {
        ChildVault storage child = _requireChild(childId);
        _validatePolicy(maxExposureBps, maxShareDeviationBps, maxDepositAssets);
        child.maxExposureBps = maxExposureBps;
        child.maxDepositAssets = maxDepositAssets;
        child.maxShareDeviationBps = maxShareDeviationBps;
        child.exitPriority = exitPriority;
        emit ChildPolicyUpdated(childId, maxExposureBps, maxDepositAssets, maxShareDeviationBps, exitPriority);
    }

    function updateStatus(
        bytes32 childId,
        bool active,
        bool depositsEnabled,
        bool withdrawalsEnabled,
        bool emergencyOnly
    ) external onlyOwner {
        ChildVault storage child = _requireChild(childId);
        if (emergencyOnly && depositsEnabled) revert InvalidPolicy();
        if (!active && depositsEnabled) revert InvalidPolicy();
        child.active = active;
        child.depositsEnabled = depositsEnabled;
        child.withdrawalsEnabled = withdrawalsEnabled;
        child.emergencyOnly = emergencyOnly;
        emit ChildStatusUpdated(childId, active, depositsEnabled, withdrawalsEnabled, emergencyOnly);
    }

    function removeChild(bytes32 childId) external onlyOwner {
        ChildVault storage child = _requireChild(childId);
        if (positionHolder == address(0)) revert PositionHolderNotConfigured();
        uint256 shares = IERC20(child.shareToken).balanceOf(positionHolder);
        if (shares != 0) revert ChildHasBalance(childId, shares);
        string memory tokenCode = child.tokenCode;
        address shareToken = child.shareToken;
        delete childByTokenKey[keccak256(bytes(tokenCode))];
        delete childByShareToken[shareToken];
        delete childByBaseAsset[child.baseAsset];
        delete children[childId];
        delete registered[childId];
        for (uint256 i = 0; i < childIds.length; i++) {
            if (childIds[i] == childId) {
                childIds[i] = childIds[childIds.length - 1];
                childIds.pop();
                break;
            }
        }
        emit ChildRemoved(childId, tokenCode, shareToken);
    }

    function getChild(bytes32 childId) external view override returns (ChildVault memory child) {
        if (!registered[childId]) revert ChildNotFound(childId);
        return children[childId];
    }

    function getChildForToken(string calldata tokenCode) external view override returns (ChildVault memory child) {
        bytes32 childId = childByTokenKey[keccak256(bytes(tokenCode))];
        if (!registered[childId]) revert ChildNotFound(childId);
        return children[childId];
    }

    function getChildIds() external view override returns (bytes32[] memory) { return childIds; }
    function getChildCount() external view override returns (uint256) { return childIds.length; }
    function getPositionHolder() external view override returns (address) { return positionHolder; }
    function isChildRegistered(bytes32 childId) external view override returns (bool) { return registered[childId]; }

    function _requireChild(bytes32 childId) private view returns (ChildVault storage child) {
        if (!registered[childId]) revert ChildNotFound(childId);
        return children[childId];
    }

    function _validatePolicy(uint16 cap, uint16 deviation, uint128 maxDeposit) private pure {
        if (cap == 0 || cap > BPS || deviation > BPS || maxDeposit == 0) revert InvalidPolicy();
    }

    function _requireContract(address target) private view {
        if (target == address(0)) revert InvalidAddress();
        if (target.code.length == 0) revert ContractCodeMissing(target);
    }

    function _requireComponent(IInterVaultBeaconDirectory directory, string memory name, address supplied) private view {
        address resolved = directory.getImplementation(name);
        if (resolved != supplied) revert ComponentMismatch(name, supplied, resolved);
    }
}
