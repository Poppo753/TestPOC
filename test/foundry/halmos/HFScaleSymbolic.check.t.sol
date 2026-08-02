// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

/**
 * @title HFScaleSymbolic.check.t.sol
 * @notice Halmos symbolic check — dimostra il bug PLG-005 / NEW-007 con prova
 *         matematica (non solo fuzz).
 *
 * @dev Halmos esplora simbolicamente tutti i valori di (collateral, debt, lltv, oraclePrice)
 *      entro i bound dichiarati e cerca controesempio all'assertion.
 *
 *      Comando:
 *          halmos --contract HFScaleSymbolic --function check_hf_alwaysInWAD
 *
 *      Atteso: Halmos trova un counterexample (proprietà FALSA con la formula buggy),
 *      dimostrando che il bug esiste per TUTTI gli input che soddisfano i constraint.
 */

contract HFScaleSymbolic is Test {
    uint256 constant WAD = 1e18;
    uint256 constant ORACLE_PRICE_SCALE = 1e36;
    uint256 constant MIN_HEALTH_FACTOR = 1.05e18;

    /// Buggy formula (replica MorphoPlugin.sol:1005-1009 + MorphoLensAdapter.sol:178)
    function _hfBuggy(
        uint256 collateral,
        uint256 oraclePrice,
        uint256 lltv,
        uint256 debtAssets
    ) internal pure returns (uint256) {
        uint256 collateralValue = (collateral * oraclePrice) / ORACLE_PRICE_SCALE;
        return (collateralValue * lltv) / (debtAssets * WAD);
    }

    /// Correct formula
    function _hfFixed(
        uint256 collateral,
        uint256 oraclePrice,
        uint256 lltv,
        uint256 debtAssets
    ) internal pure returns (uint256) {
        uint256 collateralValue = (collateral * oraclePrice) / ORACLE_PRICE_SCALE;
        return (collateralValue * lltv) / debtAssets;
    }

    /**
     * @notice CHECK: se la posizione è formalmente sicura (maxBorrow >= debt),
     *         l'HF ritornato dalla formula DEVE essere >= 1e18 (WAD scale).
     *
     *         Con la formula BUGGY, Halmos trova un counterexample.
     *
     *         Bound stretti per limitare l'esplosione dello state:
     *         - collateral ∈ [1e17, 100e18]     (0.1 to 100 WETH)
     *         - debt      ∈ [100e6, 10000e6]    (100 to 10k USDC)
     *         - lltv      ∈ [0.5e18, 0.95e18]
     *         - oraclePrice = 2000e24 (fisso per evitare esplosione)
     */
    function check_hf_alwaysInWAD(
        uint256 collateral,
        uint256 debtAssets,
        uint256 lltv
    ) public pure {
        vm.assume(collateral >= 1e17 && collateral <= 100e18);
        vm.assume(debtAssets >= 100e6 && debtAssets <= 10000e6);
        vm.assume(lltv >= 5e17 && lltv <= 95e16);
        uint256 oraclePrice = 2000e24;

        // Precondizione economica: la posizione è formalmente sicura.
        uint256 maxBorrow = (collateral * oraclePrice / ORACLE_PRICE_SCALE) * lltv / WAD;
        vm.assume(maxBorrow >= debtAssets);
        vm.assume(maxBorrow < type(uint128).max);  // evita overflow simbolico

        uint256 hfBuggy = _hfBuggy(collateral, oraclePrice, lltv, debtAssets);

        // ASSERT: HF DEVE essere in scala WAD (>= 1e18) se la posizione è sicura.
        // Halmos deve trovare un counterexample (il bug PLG-005 è dimostrato).
        assert(hfBuggy >= WAD);
    }

    /**
     * @notice CHECK companion — la formula corretta soddisfa la proprietà.
     *         Halmos deve confermare che il fixed non ha counterexample.
     */
    function check_hf_fixed_alwaysInWAD(
        uint256 collateral,
        uint256 debtAssets,
        uint256 lltv
    ) public pure {
        vm.assume(collateral >= 1e17 && collateral <= 100e18);
        vm.assume(debtAssets >= 100e6 && debtAssets <= 10000e6);
        vm.assume(lltv >= 5e17 && lltv <= 95e16);
        uint256 oraclePrice = 2000e24;

        uint256 maxBorrow = (collateral * oraclePrice / ORACLE_PRICE_SCALE) * lltv / WAD;
        vm.assume(maxBorrow >= debtAssets);
        vm.assume(maxBorrow < type(uint128).max);

        uint256 hfFixed = _hfFixed(collateral, oraclePrice, lltv, debtAssets);
        assert(hfFixed >= WAD);
    }
}
