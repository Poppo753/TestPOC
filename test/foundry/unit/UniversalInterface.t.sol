// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IProtocolAdapter} from "../../../contracts/interfaces/IProtocolAdapter.sol";
import {MorphoVaultPlugin} from "../../../contracts/plugins/MorphoVaultPlugin.sol";
import {InterVaultPlugin} from "../../../contracts/plugins/InterVaultPlugin.sol";
import {AaveV3Plugin} from "../../../contracts/plugins/AaveV3Plugin.sol";
import {MorphoPlugin} from "../../../contracts/plugins/MorphoPlugin.sol";
import {EulerV2Plugin} from "../../../contracts/plugins/EulerV2Plugin.sol";
import {ProtocolManager} from "../../../contracts/ProtocolManager.sol";

/**
 * @title UniversalInterface.t.sol
 * @notice Verifica le NUOVE behavior introdotte da C1-08/C1-04 (pair-based + operatori + supply-only).
 * @dev Test unit senza fork: costruttori dei plugin richiedono solo indirizzi (dummy) → deploy leggero.
 *      Il full user-journey E2E (deposit→borrow→repay via ProtocolManager con routing reale) resta
 *      nei test Hardhat/fork (Sub-fase G1).
 */
contract UniversalInterfaceTest is Test {
    address constant DUMMY = address(0xBEEF);

    // ==================== protocolType() per ogni plugin ====================

    function test_ProtocolType_All() public {
        assertEq(new MorphoVaultPlugin(DUMMY).protocolType(), "MORPHO_VAULT");
        assertEq(new AaveV3Plugin(DUMMY, "USDC", DUMMY).protocolType(), "AAVE_V3");
        assertEq(new MorphoPlugin(DUMMY, "USDC", DUMMY).protocolType(), "MORPHO_BLUE");
        assertEq(new EulerV2Plugin(DUMMY, "USDC", DUMMY, DUMMY).protocolType(), "EULER_V2");
        // InterVault: beacon+registry devono avere code → uso address(this).
        assertEq(new InterVaultPlugin(address(this), address(this), "USDC").protocolType(), "INTERVAULT");
    }

    // ==================== supply-only: borrow/repay revertano ====================

    function test_MorphoVault_BorrowRepay_Unsupported() public {
        MorphoVaultPlugin mv = new MorphoVaultPlugin(DUMMY);
        vm.expectRevert(IProtocolAdapter.UnsupportedOperation.selector);
        mv.borrow("WETH", "USDC", 1e18);
        vm.expectRevert(IProtocolAdapter.UnsupportedOperation.selector);
        mv.repay("WETH", "USDC", 1e18);
    }

    function test_InterVault_BorrowRepay_Unsupported() public {
        InterVaultPlugin iv = new InterVaultPlugin(address(this), address(this), "USDC");
        vm.expectRevert(IProtocolAdapter.UnsupportedOperation.selector);
        iv.borrow("WETH", "USDC", 1e18);
        vm.expectRevert(IProtocolAdapter.UnsupportedOperation.selector);
        iv.repay("WETH", "USDC", 1e18);
    }

    // ==================== supply-only: nessun debito → HF infinito ====================

    function test_SupplyOnly_NoDebt_InfiniteHF() public {
        MorphoVaultPlugin mv = new MorphoVaultPlugin(DUMMY);
        assertEq(mv.getDebt("WETH", "USDC"), 0, "supply-only ha debito 0");
        assertEq(mv.getHealthFactor("WETH", "USDC"), type(uint256).max, "supply-only HF = max");
    }

    // ==================== ProtocolManager: sistema operatori (DEC-008 A2) ====================

    function test_Operator_AddRemove_State() public {
        ProtocolManager pm = new ProtocolManager(DUMMY); // owner = this
        address alice = address(0xA11CE);

        assertFalse(pm.authorizedOperators(alice), "non operatore inizialmente");
        pm.addOperator(alice);
        assertTrue(pm.authorizedOperators(alice), "operatore dopo add");
        pm.removeOperator(alice);
        assertFalse(pm.authorizedOperators(alice), "revocato dopo remove");
    }

    function test_Operator_AddOperator_OnlyOwner() public {
        ProtocolManager pm = new ProtocolManager(DUMMY);
        vm.prank(address(0xB0B));
        vm.expectRevert(); // OZ Ownable: caller is not the owner
        pm.addOperator(address(0xB0B));
    }

    function test_Operator_OnlyOperator_RejectsNonOperator() public {
        ProtocolManager pm = new ProtocolManager(DUMMY);
        vm.prank(address(0xB0B));
        vm.expectRevert("ProtocolManager: not operator");
        pm.supplyCollateral("Aave", "WETH", "USDC", 1e18);
    }
}
