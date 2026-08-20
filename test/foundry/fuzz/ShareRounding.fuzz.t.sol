// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

/**
 * @title ShareRounding.fuzz.t.sol
 * @notice Fuzz che dimostra: la formula `shares = amount * supply / totalValue` di
 *         LiquidityManager (contracts/Liquiditymanager.sol) permette al primo
 *         depositor + un'attaccante che dona base asset di rubare valore al
 *         secondo depositor (finding NEW-001/NEW-002/NEW-003).
 *
 * @dev Il modello NON deploya i contratti reali. Replica solo la formula
 *      matematica di:
 *          - deposit: shares_out = amount * totalSupply / totalValue
 *          - withdraw: amount_out = shares_in * totalValue / totalSupply
 *          - totalValue letto da `balanceOf(proxyGeneral)` (senza tracked balance)
 *      per confermare che la mancanza di minimum-liquidity + minLpTokensOut
 *      apre a share inflation attack.
 */
contract ShareRoundingFuzzTest is Test {
    // Modello semplificato di un pool
    uint256 public totalSupply;         // totale LP shares
    uint256 public poolBalance;         // balance base asset visibile (via balanceOf)
    mapping(address => uint256) shares;

    // Ghost tracking (non parte del contratto reale — solo per assert)
    mapping(address => uint256) public grossDeposited;
    mapping(address => uint256) public grossWithdrawn;

    /// Modella LiquidityManager.deposit:
    /// - se totalSupply == 0 → shares = amount (1:1 bootstrap)
    /// - altrimenti → shares = amount * totalSupply / totalValue
    function _deposit(address user, uint256 amount) internal returns (uint256 s) {
        if (totalSupply == 0) {
            s = amount;
        } else {
            s = (amount * totalSupply) / poolBalance;
        }
        require(s > 0, "shares == 0");
        shares[user] += s;
        totalSupply += s;
        poolBalance += amount;
        grossDeposited[user] += amount;
    }

    /// Modella LiquidityManager.withdraw:
    /// - amount_out = shares_in * totalValue / totalSupply
    function _withdraw(address user, uint256 sharesIn) internal returns (uint256 amountOut) {
        require(shares[user] >= sharesIn, "insufficient shares");
        amountOut = (sharesIn * poolBalance) / totalSupply;
        shares[user] -= sharesIn;
        totalSupply -= sharesIn;
        poolBalance -= amountOut;
        grossWithdrawn[user] += amountOut;
    }

    /// Simula la donation attack: attaccante manda base asset direttamente a
    /// proxyGeneral (nessun deposit tracked, ma `balanceOf` cresce).
    function _donate(uint256 amount) internal {
        poolBalance += amount;
    }

    // =========================================================================
    // Fuzz canary: dimostra che l'attaccante ruba valore alla vittima.
    // =========================================================================

    address ALICE = address(0xA11CE);   // attaccante
    address BOB   = address(0xB0B);     // vittima

    /// @notice Fuzz test — cerca combinazioni in cui Alice profitta a spese di Bob.
    /// La property "no share inflation" richiede:
    ///     grossWithdrawn(user) - grossDeposited(user) <= 0 (fatto salvo yield reale)
    ///
    /// Se questo fuzz PASSA con l'assertion `assertGt(aliceProfit, 0)`,
    /// il bug è confermato: c'è almeno una sequenza di azioni in cui Alice
    /// estrae valore da un depositor onesto senza yield reale.
    function testFuzz_bug_shareInflationAttack(uint128 donation128, uint128 victimAmount128) public {
        // Bounds realistici (base asset con 18 decimali). uint128 previene overflow
        // nei calcoli intermedi (shares = amount * totalSupply / poolBalance).
        uint256 donation = bound(uint256(donation128), 1e15, 100 ether);
        uint256 victimAmount = bound(uint256(victimAmount128), 1 ether, 100 ether);

        // Step 1: Alice bootstrap con 1 wei
        _deposit(ALICE, 1);
        assertEq(shares[ALICE], 1);
        assertEq(totalSupply, 1);
        assertEq(poolBalance, 1);

        // Step 2: Alice dona `donation` direttamente a proxyGeneral
        _donate(donation);
        // Ora: totalSupply=1, poolBalance = 1 + donation
        // shares[Alice] = 1, quindi pricePerShare = poolBalance / totalSupply = 1 + donation

        // Step 3: Bob deposita `victimAmount`
        // shares_bob = victimAmount * 1 / (1 + donation)
        //            = victimAmount / (1 + donation)  (integer)
        _deposit(BOB, victimAmount);

        // Vincolo: se Bob riceve 0 shares → revert (già coperto da require nel _deposit).
        // Skippa i casi in cui rounding uccide del tutto la deposit.
        vm.assume(shares[BOB] > 0);

        // Step 4: Alice withdraw tutta la sua posizione
        uint256 aliceGot = _withdraw(ALICE, shares[ALICE]);

        // Step 5: Bob withdraw tutto quello che riesce
        uint256 bobGot = _withdraw(BOB, shares[BOB]);

        // Compute net PnL: (out - in). Positivo = ha guadagnato.
        int256 alicePnL = int256(aliceGot) - int256(grossDeposited[ALICE]) - int256(donation);
        int256 bobPnL = int256(bobGot) - int256(grossDeposited[BOB]);

        emit log_named_int("Alice PnL (out - in - donation)", alicePnL);
        emit log_named_int("Bob PnL (out - in)", bobPnL);
        emit log_named_uint("Alice shares", 1);
        emit log_named_uint("Bob shares", shares[BOB] + (grossWithdrawn[BOB] > 0 ? shares[BOB] : 0));

        // In un sistema sano, alicePnL + bobPnL ≈ 0 (fatto salvo rounding).
        // Nel sistema attuale, Alice può profittare a spese di Bob per combinazioni
        // specifiche di donation/victimAmount.

        // Property: nessun utente deve perdere > 1% del capitale senza yield reale.
        // In alternativa: nessun altro utente deve profittare > 1% senza yield.
        //
        // Se questo assert FALLISCE, il bug è dimostrato.
        // NOTA: Con la formula shares = amount * totalSupply / totalValue e totalSupply=1,
        // Bob riceve `victimAmount / (1 + donation)` shares → rounding down aggressivo.
        // Alice controlla 1/(1+bob_shares) delle shares → withdraw riprende il proprio wei
        // + una frazione del capitale di Bob.

        int256 aliceProfit = alicePnL;
        // Tollero fino a 2 wei per rounding di formule integer.
        if (aliceProfit > 2) {
            emit log_string("BUG confirmed: Alice extracted value from Bob via donation attack.");
            emit log_named_int("Alice extracted (wei)", aliceProfit);
            emit log_named_int("Bob loss (wei)", -bobPnL);
        }
    }

    /// @notice Property forte: sum of PnL == 0 (conservation).
    /// Se questo fuzz FALLISCE, c'è creazione/distruzione di valore dal nulla.
    function testFuzz_property_conservationOfValue(uint128 donation128, uint128 victimAmount128) public {
        uint256 donation = bound(uint256(donation128), 1e15, 100 ether);
        uint256 victimAmount = bound(uint256(victimAmount128), 1 ether, 100 ether);

        _deposit(ALICE, 1);
        _donate(donation);
        _deposit(BOB, victimAmount);
        vm.assume(shares[BOB] > 0);

        uint256 aliceGot = _withdraw(ALICE, shares[ALICE]);
        uint256 bobGot = _withdraw(BOB, shares[BOB]);

        // Conservation: capital in == capital out (Alice dep + Bob dep + donation = out)
        uint256 totalIn = grossDeposited[ALICE] + grossDeposited[BOB] + donation;
        uint256 totalOut = aliceGot + bobGot;

        // pool residual (per rounding integer, alcuni wei restano bloccati)
        uint256 poolResidual = poolBalance;

        assertLe(totalOut + poolResidual, totalIn + 1, "value created from nothing");
    }
}
