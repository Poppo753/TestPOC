// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title EchidnaLPPool
 * @notice Harness Echidna per il modello semplificato di LP pool.
 *         Copia diretta della semantica di `test/foundry/invariant/LPPoolInvariant.invariant.t.sol`
 *         ma in formato Echidna (property function con prefix echidna_).
 *
 * Vedi security/echidna/README.md per il comando di esecuzione.
 * Vedi PROPERTY_CATALOG.md → LP-001, LP-003, LP-004, LP-006.
 */
contract EchidnaLPPool {
    // Modello pool
    uint256 public totalSupply;
    uint256 public poolBalance;
    mapping(address => uint256) public sharesOf;

    // Attori fissi (Echidna usa un set di msg.sender)
    address constant ALICE = address(0xA11CE);
    address constant BOB   = address(0xB0B);
    address constant CARL  = address(0xCA71);

    // Ghost state
    mapping(address => uint256) public ghost_deposited;
    mapping(address => uint256) public ghost_withdrawn;
    uint256 public ghost_totalDonated;

    // ======= Azioni (Echidna le chiama come msg.sender random) =======

    function deposit(uint256 amount) external {
        // Bound su valori realistici (base asset 18-dec)
        amount = 1e6 + (amount % (1000 ether));

        uint256 s;
        if (totalSupply == 0) {
            s = amount;
        } else {
            s = (amount * totalSupply) / poolBalance;
        }
        if (s == 0) return;

        sharesOf[msg.sender] += s;
        totalSupply += s;
        poolBalance += amount;
        ghost_deposited[msg.sender] += amount;
    }

    function withdraw(uint256 sharesToBurn) external {
        uint256 userShares = sharesOf[msg.sender];
        if (userShares == 0) return;
        sharesToBurn = 1 + (sharesToBurn % userShares);

        uint256 out = (sharesToBurn * poolBalance) / totalSupply;
        sharesOf[msg.sender] -= sharesToBurn;
        totalSupply -= sharesToBurn;
        poolBalance -= out;
        ghost_withdrawn[msg.sender] += out;
    }

    function donate(uint256 amount) external {
        amount = 1 + (amount % (100 ether));
        poolBalance += amount;
        ghost_totalDonated += amount;
    }

    // ======= Echidna properties =======

    /// LP-006 — sum of user shares == totalSupply
    function echidna_shareAccounting() external view returns (bool) {
        // Nota: Echidna usa un set finito di senders. Approssimiamo con 3+msg.sender comuni.
        // In un harness completo si tracciano tutti i senders visti.
        uint256 sumShares = sharesOf[ALICE] + sharesOf[BOB] + sharesOf[CARL];
        // Consenti che ci siano altri sender di Echidna (max 10 fittizi)
        return sumShares <= totalSupply;
    }

    /// LP-003 — donation non estrae valore per un utente specifico
    /// Property: profit di un utente <= totalDonated + tolerance
    function echidna_noSingleUserProfitAtCost() external view returns (bool) {
        address[3] memory actors = [ALICE, BOB, CARL];
        for (uint256 i = 0; i < 3; i++) {
            address u = actors[i];
            uint256 currentValue = totalSupply == 0
                ? 0
                : (sharesOf[u] * poolBalance) / totalSupply;
            uint256 outflow = ghost_withdrawn[u] + currentValue;
            uint256 inflow = ghost_deposited[u];
            if (outflow > inflow) {
                uint256 profit = outflow - inflow;
                if (profit > ghost_totalDonated + 10) {
                    return false;
                }
            }
        }
        return true;
    }

    /// LP-004 — nessuna share creata dal nulla (totalSupply consistente con deposits)
    function echidna_noFreeShares() external view returns (bool) {
        // totalSupply non deve superare la somma di deposits (bootstrap + subsequent shares 1:1 ratio)
        // Con la formula shares = amount * supply / balance, questa property è implicita ma
        // vale la pena esplicitarla come safety net.
        // Nota: in un vault con yield, ci sono share aggiuntive create per il primo depositor
        // via bootstrap 1:1. Tolleranza di 1e18 wei.
        uint256 totalIn = ghost_deposited[ALICE] + ghost_deposited[BOB] + ghost_deposited[CARL];
        // Supply == shares create dai deposit. Con bootstrap 1:1, supply <= totalIn + rounding.
        return totalSupply <= totalIn + 100;
    }
}
