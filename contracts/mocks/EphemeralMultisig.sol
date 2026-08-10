// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title EphemeralMultisig
 * @notice Multisig M-of-N minimale usato SOLO dalla rehearsal Fase 4
 *         (`test/deployment/OwnershipTransfer.fork.test.ts`).
 * @dev QUESTO NON E' LA SAFE DI PRODUZIONE. Non viene mai deployato da uno
 * script di produzione e non deve mai comparire in `scripts/manifests/*.json`.
 * Esiste soltanto per rieseguire in modo deterministico, su un fork locale,
 * la meccanica operativa di instradare chiamate owner-only attraverso un
 * quorum di firmatari indipendenti, prima che la Fase 3 crei la vera Gnosis
 * Safe. Vedi `docs/New_Doc/1_Documentation/4. First Deployment/10_Phase_4_Fork/00_Architettura_e_Perimetro.md`.
 *
 * Design: pattern classico submit -> confirm -> execute. Ogni owner conferma
 * inviando una propria transazione (nessuna aggregazione di firme ECDSA
 * off-chain). Questo mantiene la rehearsal deterministica e non dipende da
 * indirizzi canonici della Safe reale sul fork.
 *
 * Semantica del quorum: ogni `confirmTransaction` di un owner distinto
 * rappresenta una "firma" nel senso della checklist Fase 4 (raccolta quorum,
 * rifiuto sotto soglia, esecuzione al raggiungimento soglia, recovery con un
 * owner indisponibile).
 */
contract EphemeralMultisig {
    event TransactionSubmitted(uint256 indexed txId, address indexed proposer, address to, uint256 value, bytes data);
    event TransactionConfirmed(uint256 indexed txId, address indexed owner);
    event TransactionRevoked(uint256 indexed txId, address indexed owner);
    event TransactionExecuted(uint256 indexed txId, bool success, bytes returnData);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    /// @notice Owner del multisig, ordine di inserimento nel costruttore.
    address[] public owners;
    mapping(address => bool) public isOwner;

    /// @notice Numero di conferme richieste per eseguire una transazione.
    uint256 public threshold;

    /// @notice Contatore delle transazioni eseguite con successo (equivalente al nonce Safe).
    uint256 public nonce;

    Transaction[] private transactions;
    mapping(uint256 => mapping(address => bool)) private confirmedBy;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "EphemeralMultisig: caller is not an owner");
        _;
    }

    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length > 0, "EphemeralMultisig: no owners");
        require(_threshold > 0 && _threshold <= _owners.length, "EphemeralMultisig: invalid threshold");
        for (uint256 i = 0; i < _owners.length; i++) {
            address ownerAddr = _owners[i];
            require(ownerAddr != address(0), "EphemeralMultisig: zero owner");
            require(!isOwner[ownerAddr], "EphemeralMultisig: duplicate owner");
            isOwner[ownerAddr] = true;
            owners.push(ownerAddr);
        }
        threshold = _threshold;
    }

    function ownerCount() external view returns (uint256) {
        return owners.length;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function transactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getConfirmationCount(uint256 txId) external view returns (uint256) {
        require(txId < transactions.length, "EphemeralMultisig: unknown transaction");
        return transactions[txId].confirmations;
    }

    function isExecuted(uint256 txId) external view returns (bool) {
        require(txId < transactions.length, "EphemeralMultisig: unknown transaction");
        return transactions[txId].executed;
    }

    function isConfirmedBy(uint256 txId, address ownerAddr) external view returns (bool) {
        return confirmedBy[txId][ownerAddr];
    }

    /**
     * @notice Propone una nuova transazione. Il proponente la conferma
     * automaticamente (equivale alla prima firma).
     */
    function submitTransaction(address to, uint256 value, bytes calldata data) external onlyOwner returns (uint256 txId) {
        txId = transactions.length;
        transactions.push(Transaction({ to: to, value: value, data: data, executed: false, confirmations: 0 }));
        emit TransactionSubmitted(txId, msg.sender, to, value, data);
        _confirm(txId, msg.sender);
    }

    /// @notice Conferma una transazione esistente (equivalente a una firma owner aggiuntiva).
    function confirmTransaction(uint256 txId) external onlyOwner {
        require(txId < transactions.length, "EphemeralMultisig: unknown transaction");
        require(!transactions[txId].executed, "EphemeralMultisig: already executed");
        require(!confirmedBy[txId][msg.sender], "EphemeralMultisig: already confirmed");
        _confirm(txId, msg.sender);
    }

    /// @notice Revoca una conferma precedente prima dell'esecuzione.
    function revokeConfirmation(uint256 txId) external onlyOwner {
        require(txId < transactions.length, "EphemeralMultisig: unknown transaction");
        require(!transactions[txId].executed, "EphemeralMultisig: already executed");
        require(confirmedBy[txId][msg.sender], "EphemeralMultisig: not confirmed");
        confirmedBy[txId][msg.sender] = false;
        transactions[txId].confirmations -= 1;
        emit TransactionRevoked(txId, msg.sender);
    }

    /**
     * @notice Esegue la transazione se e solo se il quorum (`threshold`) e'
     * stato raggiunto. Incrementa `nonce` solo in caso di esecuzione riuscita,
     * cosi' da rispecchiare il nonce Safe della checklist Fase 4.
     */
    function executeTransaction(uint256 txId) external onlyOwner returns (bytes memory returnData) {
        require(txId < transactions.length, "EphemeralMultisig: unknown transaction");
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "EphemeralMultisig: already executed");
        require(transaction.confirmations >= threshold, "EphemeralMultisig: quorum not reached");
        transaction.executed = true;
        nonce += 1;
        bool success;
        (success, returnData) = transaction.to.call{ value: transaction.value }(transaction.data);
        emit TransactionExecuted(txId, success, returnData);
        require(success, "EphemeralMultisig: call reverted");
    }

    function _confirm(uint256 txId, address ownerAddr) private {
        confirmedBy[txId][ownerAddr] = true;
        transactions[txId].confirmations += 1;
        emit TransactionConfirmed(txId, ownerAddr);
    }

    /// @notice Permette al multisig di ricevere ETH (usato dal test di trasferimento innocuo).
    receive() external payable {}
}
