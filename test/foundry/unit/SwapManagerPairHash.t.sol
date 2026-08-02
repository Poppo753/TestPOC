// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {SwapManager} from "../../../contracts/SwapManager.sol";

/**
 * @title SwapManagerPairHash.t.sol
 * @notice Regression test per C1-09 (encode-packed-collision in SwapManager).
 *
 * @dev Il bug: SwapManager calcolava la chiave dei mapping swapSuccesses/swapErrors
 *      con `keccak256(abi.encodePacked(codeA, codeB))` in 7 punti. Con due `string`
 *      dinamiche, abi.encodePacked concatena senza delimitatori, quindi:
 *          abi.encodePacked("AB","CD") == abi.encodePacked("ABC","D") == "ABCD"
 *      → collisione di chiave tra coppie logicamente distinte.
 *
 *      Il fix (DEC-approvato): helper `_pairHash` che usa `abi.encode` (size-prefixed,
 *      iniettivo sulla tupla) → nessuna collisione possibile.
 *
 *      Documento: docs/.../12-remediation-waves/Sprint0/C1-09_encode-packed-collision/
 */

/// @dev Harness che espone l'helper internal `_pairHash` del contratto reale.
///      Il costruttore di SwapManager richiede solo beacon != 0 e baseAssetCode
///      non vuoto, e NON interagisce col beacon → deploy a costo trascurabile.
contract SwapManagerHarness is SwapManager {
    constructor() SwapManager(address(0xBEEF), "WETH") {}

    function pairHash(string memory a, string memory b) external pure returns (bytes32) {
        return _pairHash(a, b);
    }
}

contract SwapManagerPairHashTest is Test {
    SwapManagerHarness internal h;

    function setUp() public {
        h = new SwapManagerHarness();
    }

    /// @dev Documenta la classe di bug: il vecchio schema encodePacked COLLIDEVA.
    ///      Questo test resta verde anche dopo il fix perché verifica l'operatore
    ///      abi in astratto (non il contratto) — serve da documentazione storica.
    function test_OldEncodePacked_WasColliding() public pure {
        assertEq(
            keccak256(abi.encodePacked("AB", "CD")),
            keccak256(abi.encodePacked("ABC", "D")),
            "encodePacked avrebbe DOVUTO collidere (bug class C1-09)"
        );
    }

    /// @dev Regression guard vero: il codice reale (via _pairHash) NON collide.
    function test_PairHash_NoCollision_KnownCase() public view {
        assertTrue(
            h.pairHash("AB", "CD") != h.pairHash("ABC", "D"),
            "pairHash non deve collidere su shift di caratteri"
        );
    }

    /// @dev Altri casi noti di "spostamento" di caratteri tra i due argomenti.
    function test_PairHash_NoCollision_MoreCases() public view {
        assertTrue(h.pairHash("A", "BC") != h.pairHash("AB", "C"), "caso A|BC vs AB|C");
        assertTrue(h.pairHash("USD", "CETH") != h.pairHash("USDC", "ETH"), "caso USD|CETH vs USDC|ETH");
        assertTrue(h.pairHash("", "ABCD") != h.pairHash("ABCD", ""), "caso vuoto|ABCD vs ABCD|vuoto");
        assertTrue(h.pairHash("WET", "HUSDC") != h.pairHash("WETH", "USDC"), "caso WET|HUSDC vs WETH|USDC");
    }

    /// @dev Stesso input → stessa chiave (necessario: read/reset devono ritrovare
    ///      lo slot scritto durante gli swap).
    function test_PairHash_Deterministic() public view {
        assertEq(h.pairHash("WETH", "USDC"), h.pairHash("WETH", "USDC"), "deve essere deterministico");
    }

    /// @dev La direzione conta: (a,b) != (b,a). Uno swap WETH->USDC non è USDC->WETH.
    function test_PairHash_OrderMatters() public view {
        assertTrue(
            h.pairHash("WETH", "USDC") != h.pairHash("USDC", "WETH"),
            "l'ordine degli argomenti deve produrre chiavi diverse"
        );
    }

    /// @dev Fuzz: se le tuple (a,b) e (c,d) differiscono, le chiavi devono differire
    ///      (iniettività di abi.encode sulla tupla, modulo collisione keccak infeasible).
    function testFuzz_PairHash_NoAccidentalCollision(
        string memory a,
        string memory b,
        string memory c,
        string memory d
    ) public view {
        // considera solo tuple effettivamente diverse
        bool sameTuple = _strEq(a, c) && _strEq(b, d);
        vm.assume(!sameTuple);
        assertTrue(
            h.pairHash(a, b) != h.pairHash(c, d),
            "tuple diverse non devono produrre la stessa chiave"
        );
    }

    function _strEq(string memory x, string memory y) private pure returns (bool) {
        return keccak256(bytes(x)) == keccak256(bytes(y));
    }
}
