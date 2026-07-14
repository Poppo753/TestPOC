// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ILensAdapter} from "../interfaces/ILensAdapter.sol";
import {IProtocolAdapter} from "../interfaces/IProtocolAdapter.sol";

interface IMockOperationalToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * Test-only adapter used to exercise ProtocolManager's complete operational API.
 * It intentionally models accounting and custody transfers but no external DeFi
 * protocol. Production deployments must never register this contract.
 */
contract MockOperationalProtocol {
    address public immutable proxyGeneral;
    address public immutable token;
    uint256 public supplied;
    uint256 public debt;

    constructor(address _proxyGeneral, address _token) {
        proxyGeneral = _proxyGeneral;
        token = _token;
    }

    function deposit(string calldata, uint256 amount) external returns (bool) {
        supplied += amount;
        return true;
    }

    function withdraw(string calldata, uint256 amount) external returns (bool) {
        require(amount <= supplied, "insufficient supplied");
        supplied -= amount;
        return IMockOperationalToken(token).transfer(proxyGeneral, amount);
    }

    function borrow(string calldata, uint256 amount) external returns (bool) {
        debt += amount;
        IMockOperationalToken(token).mint(proxyGeneral, amount);
        return true;
    }

    function repay(string calldata, uint256 amount) external returns (bool) {
        uint256 repaid = amount > debt ? debt : amount;
        debt -= repaid;
        IMockOperationalToken(token).burn(address(this), amount);
        return true;
    }

    function closePosition(string calldata, string calldata) external returns (bool) {
        debt = 0;
        uint256 returned = supplied;
        supplied = 0;
        if (returned > 0) IMockOperationalToken(token).transfer(proxyGeneral, returned);
        return true;
    }

    function getBalance(string calldata) external view returns (uint256) { return supplied; }
    function getDebt(string calldata) external view returns (uint256) { return debt; }
    function getHealthFactor() external view returns (uint256) { return debt == 0 ? type(uint256).max : supplied * 1e18 / debt; }
    function getTotalValue() external view returns (uint256) { return supplied > debt ? supplied - debt : 0; }
    function isCircuitBreakerActive() external pure returns (bool) { return false; }
    function circuitBreakerTripped() external pure returns (bool) { return false; }
    function getNetAPY() external pure returns (int256) { return 0; }

    // Lens-compatible summary lets ProtocolManager monitoring exercise the
    // same ABI as production adapters while remaining strictly test-only.
    function getProtocolSummary() external view returns (ILensAdapter.ProtocolSummary memory summary) {
        uint256 health = debt == 0 ? type(uint256).max : supplied * 1e18 / debt;
        return ILensAdapter.ProtocolSummary({
            name: "OperationalMock",
            protocolType: IProtocolAdapter.ProtocolType.LENDING,
            totalCollateral: supplied,
            totalDebt: debt,
            netValue: supplied > debt ? supplied - debt : 0,
            activePositionCount: supplied == 0 && debt == 0 ? 0 : 1,
            lowestHealthFactor: health,
            isHealthy: debt == 0 || health >= 1e18
        });
    }
}
