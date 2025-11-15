# 🔧 DeFi System Configuration
# Sostituisci questi indirizzi con quelli dei tuoi contratti deployati

# ==================== CONTRACT ADDRESSES ====================
# Indirizzo del contratto Beacon (centro di coordinamento)
BEACON_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# Indirizzi dei moduli principali
LIQUIDITY_MANAGER_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
VALUE_CALCULATOR_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
TOKEN_MANAGER_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
PARAMETER_MANAGER_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
PROXY_GENERAL_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
SWAP_MANAGER_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F
EMERGENCY_HANDLER_ADDRESS=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853

# ==================== NETWORK CONFIGURATION ====================
# Network su cui eseguire gli script
NETWORK=localhost
RPC_URL=http://127.0.0.1:8545

# ==================== TRANSACTION SETTINGS ====================
# Gas limit per le transazioni (sicurezza)
DEFAULT_GAS_LIMIT=500000

# ==================== OPERATIONAL PARAMETERS ====================
# Importi di default per i test
DEFAULT_DEPOSIT_AMOUNT=1.0
DEFAULT_WITHDRAW_PERCENTAGE=50

# ==================== SECURITY SETTINGS ====================
# Conferme necessarie per le transazioni critiche
REQUIRED_CONFIRMATIONS=1

# ==================== LOGGING ====================
# Livello di logging (info, debug, error)
LOG_LEVEL=info
VERBOSE_LOGGING=true