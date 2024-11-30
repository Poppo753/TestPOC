// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityPoolETH is ERC20, ReentrancyGuard, Ownable {
    uint256 public totalLiquidity; // Totale liquidità in ETH nel pool
    uint256 public constant MAX_DEPOSIT = 100 ether; // Limite massimo per singolo deposito
    uint256 public constant MAX_WITHDRAW_PER_TX = 50 ether; // Limite massimo per prelievo singolo
    uint256 public withdrawLimitPerHour = 100 ether; // Limite totale di prelievo per ora
    bool public paused = false; // Circuit breaker per emergenze

    uint256 public lastWithdrawTime; // Timestamp dell'ultimo reset del limite orario
    uint256 public withdrawAmountThisHour; // Quantità totale prelevata in questa ora

    mapping(address => uint256) public lastAction; // Timestamp dell'ultima azione per ogni utente
    mapping(address => uint256) public pendingWithdrawals; // Fondi in attesa di prelievo per ogni utente

    event Deposit(address indexed user, uint256 amount, uint256 shares); // Evento per i depositi
    event Withdraw(address indexed user, uint256 amount, uint256 shares); // Evento per i prelievi
    event EmergencyWithdrawal(address indexed user, uint256 amount); // Evento per prelievi di emergenza

    constructor() ERC20("Liquidity Pool Token", "LPT") {}

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // Funzione per aggiungere liquidità con un limite temporale
    function timedDeposit(uint256 deadline) external payable nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Transaction expired");
        require(msg.value > 0, "Deposit amount must be greater than zero");
        require(msg.value <= MAX_DEPOSIT, "Deposit exceeds maximum limit");
        require(block.timestamp > lastAction[msg.sender] + 1 minutes, "Wait before next action"); // Previene azioni frequenti

        uint256 shares;
        if (totalLiquidity == 0 || totalSupply() == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalSupply()) / totalLiquidity;
        }

        _mint(msg.sender, shares); // Coniazione token LP
        totalLiquidity += msg.value;
        lastAction[msg.sender] = block.timestamp; // Aggiorna l'ultima azione dell'utente

        emit Deposit(msg.sender, msg.value, shares); // Registra l'evento
    }

    // Funzione normale di deposito (senza limite temporale)
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than zero");
        require(msg.value <= MAX_DEPOSIT, "Deposit exceeds maximum limit");
        require(block.timestamp > lastAction[msg.sender] + 1 minutes, "Wait before next action"); // Previene azioni frequenti

        uint256 shares;
        if (totalLiquidity == 0 || totalSupply() == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalSupply()) / totalLiquidity;
        }

        _mint(msg.sender, shares);
        totalLiquidity += msg.value;
        lastAction[msg.sender] = block.timestamp; // Aggiorna l'ultima azione dell'utente

        emit Deposit(msg.sender, msg.value, shares); // Registra l'evento
    }

    // Funzione per iniziare un prelievo (rate-limitato e a rate)
    function initiateWithdraw(uint256 shares) external nonReentrant whenNotPaused {
        require(shares > 0, "Shares must be greater than zero");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");

        uint256 amount = (shares * totalLiquidity) / totalSupply();
        require(amount <= MAX_WITHDRAW_PER_TX, "Withdraw exceeds maximum per transaction");

        // Aggiorna il limite orario
        if (block.timestamp > lastWithdrawTime + 1 hours) {
            lastWithdrawTime = block.timestamp;
            withdrawAmountThisHour = 0;
        }
        require(
            withdrawAmountThisHour + amount <= withdrawLimitPerHour,
            "Exceeds hourly withdraw limit"
        );

        _burn(msg.sender, shares); // Brucia i token LP
        totalLiquidity -= amount;
        withdrawAmountThisHour += amount;

        pendingWithdrawals[msg.sender] += amount; // Aggiunge l'importo ai prelievi in attesa

        emit Withdraw(msg.sender, amount, shares); // Registra l'evento
    }

    // Completa il prelievo
    function completeWithdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // Circuit breaker per emergenze
    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    // Modalità di emergenza per prelevare tutti i fondi degli utenti
    function emergencyWithdraw() external nonReentrant {
        require(paused, "Not in emergency mode");

        uint256 shares = balanceOf(msg.sender);
        require(shares > 0, "No shares to withdraw");

        uint256 amount = (shares * totalLiquidity) / totalSupply();
        _burn(msg.sender, shares);
        totalLiquidity -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit EmergencyWithdrawal(msg.sender, amount); // Registra l'evento di emergenza
    }

    function getLPTValue() external view returns (uint256) {
        if (totalSupply() == 0) {
            return 0;
        }
        return (totalLiquidity * 1e18) / totalSupply();
    }

    fallback() external payable {
        revert("Use the deposit function");
    }

    receive() external payable {
        revert("Use the deposit function");
    }
}
