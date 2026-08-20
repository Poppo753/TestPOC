// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

/**
 * @title HFScaleMath.t.sol
 * @notice Canary test — dimostra il bug PLG-005 / NEW-007 (MorphoPlugin + MorphoLensAdapter)
 *         a livello matematico, senza richiedere il deploy dei contratti reali.
 *
 * @dev Sorgente della formula bugosa:
 *      - contracts/plugins/MorphoPlugin.sol:1005-1009 (`_computeHealthFactor`)
 *      - contracts/adapters/MorphoLensAdapter.sol:178 (`_computeMarketHF`)
 *
 *      Formula BUGGY (identica in entrambi):
 *          uint256 collateralValue = (collateral * oraclePrice) / ORACLE_PRICE_SCALE;
 *          return (collateralValue * lltv) / (debtAssets * WAD);
 *
 *      Formula CORRETTA (per HF in WAD, dove 1e18 = 1.0):
 *          return (collateralValue * lltv) / debtAssets;
 *
 *      Il divisore extra * WAD scala il risultato di 1e18x. Es. HF reale = 1.72e18
 *      diventa 1 (int). MIN_HEALTH_FACTOR = 1.05e18 non viene mai raggiunto →
 *      openLeverageAtomic revert sempre.
 */
contract HFScaleMathTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant ORACLE_PRICE_SCALE = 1e36;
    uint256 constant MIN_HEALTH_FACTOR = 1.05e18; // MorphoPlugin.sol:82

    /// Buggy formula (replica esatta del codice production)
    function _hfBuggy(
        uint256 collateral,
        uint256 oraclePrice,
        uint256 lltv,
        uint256 debtAssets
    ) internal pure returns (uint256) {
        uint256 collateralValue = (collateral * oraclePrice) / ORACLE_PRICE_SCALE;
        return (collateralValue * lltv) / (debtAssets * WAD);
    }

    /// Correct formula (proposta di fix)
    function _hfFixed(
        uint256 collateral,
        uint256 oraclePrice,
        uint256 lltv,
        uint256 debtAssets
    ) internal pure returns (uint256) {
        uint256 collateralValue = (collateral * oraclePrice) / ORACLE_PRICE_SCALE;
        return (collateralValue * lltv) / debtAssets;
    }

    // =========================================================================
    // Canary: la formula corrente NON produce HF in scala WAD.
    // Se questo test PASSA con la formula buggy, il bug è confermato.
    // =========================================================================

    /// @notice Setup: WETH/USDC leverage sana con HF atteso 1.72
    /// - collateral = 1e18 WETH = 1e18 unità (18 dec)
    /// - oraclePrice = 2000 USDC/WETH * 1e36 / 1e18 (Morpho ORACLE_PRICE_SCALE definisce
    ///   il prezzo di 1 unit collateral in loan units, scaled by 1e36)
    ///   Per WETH(18) / USDC(6): price scaled = (2000 * 1e6) * 1e36 / 1e18 = 2000e24
    /// - lltv = 0.86e18 (86%)
    /// - debtAssets = 1000e6 (1000 USDC)
    /// Expected maxBorrow = 1e18 * 2000e24 / 1e36 = 2000e6 USDC
    /// Expected HF_WAD = (2000e6 * 0.86e18) / 1000e6 = 1.72e18
    function test_bug_MorphoHF_notInWAD() public {
        uint256 collateral = 1e18;
        uint256 oraclePrice = 2000e24;
        uint256 lltv = 0.86e18;
        uint256 debtAssets = 1000e6;

        uint256 hfBuggy = _hfBuggy(collateral, oraclePrice, lltv, debtAssets);
        uint256 hfFixed = _hfFixed(collateral, oraclePrice, lltv, debtAssets);

        emit log_named_uint("HF (buggy)", hfBuggy);
        emit log_named_uint("HF (fixed, expected 1.72e18)", hfFixed);

        // FIXED formula: HF in WAD, circa 1.72e18
        assertApproxEqRel(hfFixed, 1.72e18, 0.001e18, "fixed formula must return HF in WAD");

        // BUGGY formula: HF = fixed / WAD → ratio raw ≈ 1 (integer, scala persa)
        assertLt(hfBuggy, MIN_HEALTH_FACTOR, "buggy formula returns value below MIN_HEALTH_FACTOR");
        assertEq(hfBuggy, hfFixed / WAD, "buggy = fixed / WAD (dimostra il fattore 1e18 mancante)");
    }

    /// @notice openLeverageAtomic ha `require(hf >= minHF)` con minHF default = 1.05e18.
    ///         Dimostra che con la formula buggy, ANCHE posizioni molto sicure falliscono.
    function test_bug_openLeverageAlwaysRevertsOnSafePositions() public pure {
        // Posizione ULTRA-sicura: HF reale = 5.0 (collateral vale 5x il debt/lltv)
        uint256 collateral = 5e18;
        uint256 oraclePrice = 2000e24;
        uint256 lltv = 0.86e18;
        uint256 debtAssets = 1000e6;

        uint256 hfBuggy = _hfBuggy(collateral, oraclePrice, lltv, debtAssets);

        // hfBuggy = (5e18 * 2000e24 / 1e36) * 0.86e18 / (1000e6 * 1e18)
        //         = 10000e6 * 0.86e18 / 1000e24
        //         = 8.6e27 / 1e27
        //         = 8 (integer division floor)
        //
        // MIN_HEALTH_FACTOR = 1.05e18 = 1050000000000000000
        // 8 < 1.05e18 → openLeverageAtomic revert SEMPRE
        require(hfBuggy < 1.05e18, "buggy HF must be < MIN_HEALTH_FACTOR");
        require(hfBuggy == 8, "specific numeric proof: buggy HF = 8 (integer)");
    }

    // =========================================================================
    // Fuzz: nessuna combinazione di parametri sensati produce HF >= 1.05e18
    // con la formula buggy → openLeverageAtomic è sempre revertata.
    // =========================================================================
    function testFuzz_bug_buggyHFAlwaysBelowMinHF(
        uint256 collateral,
        uint256 debtAssets
    ) public pure {
        collateral = bound(collateral, 1e17, 1000e18);      // 0.1 - 1000 WETH
        debtAssets = bound(debtAssets, 100e6, 100000e6);    // 100 - 100k USDC
        uint256 oraclePrice = 2000e24;                       // 2000 USDC/WETH
        uint256 lltv = 0.86e18;

        // Vincolo economico: la posizione DEVE essere formalmente sicura,
        // cioè collateral * price * lltv / (ORACLE_PRICE_SCALE * WAD) > debtAssets.
        uint256 maxBorrow = (collateral * oraclePrice / 1e36) * lltv / 1e18;
        vm.assume(maxBorrow > debtAssets);

        uint256 hfBuggy = (collateral * oraclePrice / 1e36) * lltv / (debtAssets * 1e18);

        // Fix atteso: hfBuggy DEVE essere >= 1.05e18 quando la posizione è sicura.
        // Se questo assert FALLISCE, il bug è confermato.
        // Attualmente il test PASSA (dimostrando il bug) — il require sotto è
        // scritto per REGISTRARE l'esistenza del bug con un'assertion negata.
        assertLt(hfBuggy, 1.05e18, "BUG PLG-005 confirmed: buggy formula returns HF << 1.05e18");
    }
}
