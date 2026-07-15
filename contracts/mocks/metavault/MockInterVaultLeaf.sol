// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/** Test-only leaf combining the minimal LiquidityManager, share token and value views. */
contract MockInterVaultLeaf is ERC20 {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IERC20 public immutable asset;
    bool public depositsEnabled = true;
    bool public withdrawalsEnabled = true;
    bool public failReads;
    uint16 public shareHaircutBps;

    constructor(address _asset, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        asset = IERC20(_asset);
    }

    function setStatus(bool deposits, bool withdrawals) external { depositsEnabled = deposits; withdrawalsEnabled = withdrawals; }
    function setFailReads(bool value) external { failReads = value; }
    function setShareHaircutBps(uint16 value) external { require(value <= 10_000); shareHaircutBps = value; }

    function deposit(uint256 amount) external returns (uint256 shares) {
        require(depositsEnabled && amount > 0, "deposit disabled");
        shares = calculateDepositShares(amount);
        shares = Math.mulDiv(shares, 10_000 - shareHaircutBps, 10_000);
        require(shares > 0, "zero shares");
        asset.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, shares);
    }

    function withdraw(uint256 shares) external returns (uint256 amount) {
        require(withdrawalsEnabled && shares > 0, "withdraw disabled");
        amount = calculateWithdrawAmount(shares);
        _burn(msg.sender, shares);
        asset.safeTransfer(msg.sender, amount);
    }

    function calculateDepositShares(uint256 amount) public view returns (uint256) {
        if (failReads) revert("mock read failure");
        uint256 supply = totalSupply();
        uint256 assets = asset.balanceOf(address(this));
        return supply == 0 || assets == 0 ? amount : Math.mulDiv(amount, supply, assets);
    }

    function calculateWithdrawAmount(uint256 shares) public view returns (uint256) {
        if (failReads) revert("mock read failure");
        uint256 supply = totalSupply();
        return supply == 0 ? 0 : Math.mulDiv(shares, asset.balanceOf(address(this)), supply);
    }

    function canWithdraw(address user, uint256 shares) external view returns (bool, string memory) {
        if (failReads) revert("mock read failure");
        if (!withdrawalsEnabled) return (false, "withdraw disabled");
        if (balanceOf(user) < shares) return (false, "insufficient shares");
        return (true, "");
    }

    function getTotalPoolValueView() external view returns (uint256) {
        if (failReads) revert("mock read failure");
        return asset.balanceOf(address(this));
    }

    function donate(uint256 amount) external { asset.safeTransferFrom(msg.sender, address(this), amount); }
}
