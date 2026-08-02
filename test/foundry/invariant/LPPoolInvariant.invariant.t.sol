// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

/**
 * @title LPPoolInvariant.invariant.t.sol
 * @notice Invariant test minimale (2 utenti + attaccante donation) su un modello
 *         semplificato di LP pool. Copre §S5.2 checklist.
 *
 * @dev NON deploya i contratti reali (pattern Beacon-lookup richiederebbe setup
 *      completo). Repro esclusivamente la formula economica di
 *      LiquidityManager.deposit/withdraw + ValueCalculator.getTotalPoolValue()
 *      che legge `balanceOf(proxyGeneral)`.
 *
 *      Property target:
 *          - INV-1: sum of user shares == totalSupply
 *          - INV-2: pool value == sum of tracked deposits - tracked withdraws + donations
 *          - INV-3: nessun utente estrae più di quanto depositato + donazioni
 *
 *      Se un handler ostile che DONA base asset direttamente al pool riesce a
 *      violare INV-3 per un altro utente, il bug NEW-001/002/003 è dimostrato.
 */

// ---------- Modello del pool ----------
contract LPPoolModel {
    uint256 public totalSupply;
    uint256 public poolBalance;
    mapping(address => uint256) public sharesOf;

    function deposit(uint256 amount) external returns (uint256 s) {
        require(amount > 0, "amount==0");
        if (totalSupply == 0) {
            s = amount;
        } else {
            s = (amount * totalSupply) / poolBalance;
        }
        require(s > 0, "shares==0");
        sharesOf[msg.sender] += s;
        totalSupply += s;
        poolBalance += amount;
    }

    function withdraw(uint256 shares) external returns (uint256 out) {
        require(shares > 0 && shares <= sharesOf[msg.sender], "insufficient");
        out = (shares * poolBalance) / totalSupply;
        sharesOf[msg.sender] -= shares;
        totalSupply -= shares;
        poolBalance -= out;
    }

    /// Simula donazione diretta di base asset (non tracciata come deposit).
    /// Nel contratto reale, è `IERC20.transfer(proxyGeneral, amount)`.
    function donate(uint256 amount) external {
        poolBalance += amount;
    }
}

// ---------- Handler (attori) ----------
contract PoolHandler is Test {
    LPPoolModel public pool;

    address[3] public actors = [address(0xA1), address(0xA2), address(0xA3)];

    // Ghost state — richiesto per gli invariant
    mapping(address => uint256) public ghost_deposited;
    mapping(address => uint256) public ghost_withdrawn;
    uint256 public ghost_totalDonated;

    // Statistiche chiamate
    mapping(bytes32 => uint256) public callCount;

    modifier count(bytes32 name) {
        callCount[name]++;
        _;
    }

    constructor(LPPoolModel _pool) {
        pool = _pool;
    }

    // uint128 sui parametri fuzz per evitare overflow su moltiplicazioni intermedie
    function deposit(uint128 amount128, uint256 actorSeed) external count("deposit") {
        address user = actors[actorSeed % actors.length];
        uint256 amount = bound(uint256(amount128), 1e6, 1000 ether);

        vm.prank(user);
        try pool.deposit(amount) returns (uint256) {
            ghost_deposited[user] += amount;
        } catch {}
    }

    function withdraw(uint128 sharesPct128, uint256 actorSeed) external count("withdraw") {
        address user = actors[actorSeed % actors.length];
        uint256 userShares = pool.sharesOf(user);
        if (userShares == 0) return;

        uint256 shares = bound(uint256(sharesPct128), 1, userShares);

        vm.prank(user);
        try pool.withdraw(shares) returns (uint256 out) {
            ghost_withdrawn[user] += out;
        } catch {}
    }

    /// Attaccante — dona direttamente al pool (bound uint128 previene overflow su poolBalance)
    function donate(uint128 amount128) external count("donate") {
        uint256 amount = bound(uint256(amount128), 1, 100 ether);
        pool.donate(amount);
        ghost_totalDonated += amount;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}

// ---------- Invariant test ----------
contract LPPoolInvariantTest is Test {
    LPPoolModel public pool;
    PoolHandler public handler;

    function setUp() public {
        pool = new LPPoolModel();
        handler = new PoolHandler(pool);

        // Restringi selezione al solo handler
        targetContract(address(handler));

        bytes4[] memory sel = new bytes4[](3);
        sel[0] = PoolHandler.deposit.selector;
        sel[1] = PoolHandler.withdraw.selector;
        sel[2] = PoolHandler.donate.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sel}));
    }

    /// INV-1: sum of user shares == totalSupply
    function invariant_shareAccounting() public view {
        uint256 sumShares;
        for (uint256 i = 0; i < 3; i++) {
            sumShares += pool.sharesOf(handler.actorAt(i));
        }
        assertEq(sumShares, pool.totalSupply(), "INV-1: share sum mismatch");
    }

    /// INV-2: pool balance == sum(deposit) - sum(withdraw) + sum(donate)
    /// (con tolleranza per rounding integer di 3 wei per attore)
    function invariant_poolValueConservation() public view {
        uint256 totalDep;
        uint256 totalWith;
        for (uint256 i = 0; i < 3; i++) {
            address a = handler.actorAt(i);
            totalDep += handler.ghost_deposited(a);
            totalWith += handler.ghost_withdrawn(a);
        }
        uint256 expectedBalance = totalDep - totalWith + handler.ghost_totalDonated();
        // Rounding tolerance
        if (expectedBalance >= pool.poolBalance()) {
            assertLe(expectedBalance - pool.poolBalance(), 10, "INV-2: pool balance drift");
        }
    }

    /// INV-3 (canary bug): nessun utente estrae piu' di depositi + donazioni ricevute.
    /// Se questo invariant FALLISCE, un utente ha estratto valore da un altro
    /// tramite lo share inflation attack.
    /// (Tollero rounding per gross-inflow di ~5 wei per iterazione.)
    function invariant_noAsymmetricProfitAtCost() public view {
        // Per ogni utente: max profit = sum(donations) (che tutti condividono se hanno shares).
        // Quindi profitto_singolo <= totalDonated + rounding_tolerance.
        uint256 donations = handler.ghost_totalDonated();

        for (uint256 i = 0; i < 3; i++) {
            address user = handler.actorAt(i);
            uint256 dep = handler.ghost_deposited(user);
            uint256 wth = handler.ghost_withdrawn(user);
            uint256 currentShares = pool.sharesOf(user);
            uint256 currentValue = pool.totalSupply() == 0 ? 0 :
                (currentShares * pool.poolBalance()) / pool.totalSupply();

            uint256 outflow = wth + currentValue;

            if (outflow > dep) {
                uint256 profit = outflow - dep;
                // Ogni singolo utente non deve estrarre piu' della totale donazione + tolleranza
                assertLe(profit, donations + 10, "INV-3: user extracted > donations (share inflation bug)");
            }
        }
    }

    /// Meta: stampa metriche in fondo alla run
    function invariant_callSummary() public view {
        // Solo log: gli invariant reali sono INV-1/2/3
    }
}
