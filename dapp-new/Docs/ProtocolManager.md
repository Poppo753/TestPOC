# ProtocolManager

## Introduzione
Il `ProtocolManager` è un contratto chiave che gestisce i depositi e i prelievi di token in diversi protocolli. Utilizza il `Beacon` per risolvere i plugin dei protocolli e verificare l'identità del plugin prima di eseguire le operazioni.

## Funzioni
### deposit
- **Descrizione**: Deposita token in un protocollo specifico.
- **Parametri**:
  - `protocolName`: Nome del protocollo (es. "DolomitePlugin").
  - `tokenCode`: Codice del token (es. "WETH", "USDC").
  - `amount`: Importo da depositare (in wei).
- **Access Control**: Solo il proprietario del contratto può chiamare questa funzione.
- **Validations**:
  - L'importo deve essere maggiore di 0.
  - Il codice del token non può essere vuoto.
  - Il plugin deve essere risolto correttamente dal Beacon.
- **Eventi**: `ProtocolOperationExecuted`.
- **Gas Cost**: ~120,000–140,000 gas.
- **Esempio**:
  ```solidity
  protocolManager.deposit("DolomitePlugin", "WETH", 1 ether);
  ```
- **Note di Sicurezza**:
  - Solo il proprietario può eseguire il deposito.
  - Vengono effettuate verifiche per prevenire depositi di 0 token o codici di token vuoti.
  - Il plugin viene verificato tramite il Beacon per assicurare che sia corretto.
  - Se il deposito del plugin fallisce, la transazione viene annullata per proteggere i fondi.

### withdraw
- **Descrizione**: Preleva token da un protocollo specifico.
- **Parametri**:
  - `protocolName`: Nome del protocollo (es. "DolomitePlugin").
  - `tokenCode`: Codice del token (es. "WETH", "USDC").
  - `amount`: Importo da prelevare (in wei).
- **Access Control**: Solo il proprietario del contratto può chiamare questa funzione.
- **Validations**:
  - L'importo deve essere maggiore di 0.
  - Il codice del token non può essere vuoto.
  - Il plugin deve essere risolto correttamente dal Beacon.
- **Eventi**: `ProtocolOperationExecuted`.
- **Gas Cost**: ~110,000–130,000 gas.
- **Esempio**:
  ```solidity
  protocolManager.withdraw("DolomitePlugin", "USDC", 1000 * 10**6);
  ```
- **Note di Sicurezza**:
  - Solo il proprietario può eseguire il prelievo.
  - Vengono effettuate verifiche per prevenire prelievi di 0 token o codici di token vuoti.
  - Il plugin viene verificato tramite il Beacon per assicurare che sia corretto.
  - Se il prelievo del plugin fallisce, la transazione viene annullata per proteggere il chiamante.

## Note
- Questo contratto fa parte del modello di registrazione dei moduli e del proxy che indirizza i depositi e i prelievi attraverso `ProxyGeneral` e il plugin selezionato.


____________________________

versione lunga completa:

# ProtocolManager

## Introduzione
Il `ProtocolManager` è un contratto chiave che gestisce i depositi e i prelievi di token in diversi protocolli. Utilizza il `Beacon` per risolvere i plugin dei protocolli e verificare l'identità del plugin prima di eseguire le operazioni.

## Funzioni
### deposit
- **Descrizione**: Deposita token in un protocollo specifico.
- **Parametri**:
  - `protocolName`: Nome del protocollo (es. "DolomitePlugin").
  - `tokenCode`: Codice del token (es. "WETH", "USDC").
  - `amount`: Importo da depositare (in wei).
- **Access Control**: Solo il proprietario del contratto può chiamare questa funzione.
- **Validations**:
  - L'importo deve essere maggiore di 0.
  - Il codice del token non può essere vuoto.
  - Il plugin deve essere risolto correttamente dal Beacon.
- **Eventi**: `ProtocolOperationExecuted`.
- **Gas Cost**: ~120,000–140,000 gas.
- **Esempio**:
  ```solidity
  protocolManager.deposit("DolomitePlugin", "WETH", 1 ether);
  ```
- **Note di Sicurezza**:
  - Solo il proprietario può eseguire il deposito.
  - Vengono effettuate verifiche per prevenire depositi di 0 token o codici di token vuoti.
  - Il plugin viene verificato tramite il Beacon per assicurare che sia corretto.
  - Se il deposito del plugin fallisce, la transazione viene annullata per proteggere i fondi.

### withdraw
- **Descrizione**: Preleva token da un protocollo specifico.
- **Parametri**:
  - `protocolName`: Nome del protocollo (es. "DolomitePlugin").
  - `tokenCode`: Codice del token (es. "WETH", "USDC").
  - `amount`: Importo da prelevare (in wei).
- **Access Control**: Solo il proprietario del contratto può chiamare questa funzione.
- **Validations**:
  - L'importo deve essere maggiore di 0.
  - Il codice del token non può essere vuoto.
  - Il plugin deve essere risolto correttamente dal Beacon.
- **Eventi**: `ProtocolOperationExecuted`.
- **Gas Cost**: ~110,000–130,000 gas.
- **Esempio**:
  ```solidity
  protocolManager.withdraw("DolomitePlugin", "USDC", 1000 * 10**6);
  ```
- **Note di Sicurezza**:
  - Solo il proprietario può eseguire il prelievo.
  - Vengono effettuate verifiche per prevenire prelievi di 0 token o codici di token vuoti.
  - Il plugin viene verificato tramite il Beacon per assicurare che sia corretto.
  - Se il prelievo del plugin fallisce, la transazione viene annullata per proteggere il chiamante.

## Note
- Questo contratto fa parte del modello di registrazione dei moduli e del proxy che indirizza i depositi e i prelievi attraverso `ProxyGeneral` e il plugin selezionato.
```

---

### 2. **File CSV**
Questo file sarà un elenco tabellare di tutte le funzioni, con le seguenti colonne:

| Nome Funzione | Modulo | Descrizione | Parametri | Tipo di Ritorno | Access Control | Validations | Eventi | Gas Cost | Esempio | Note di Sicurezza | Note |
|---------------|--------|-------------|-----------|------------------|----------------|-------------|--------|----------|---------|------------------|------|
| deposit       | protocol_manager | Deposita token in un protocollo specifico | protocolName, tokenCode, amount | Nessun ritorno | external onlyOwner | amount > 0, tokenCode non vuoto, plugin risolto | ProtocolOperationExecuted | ~120,000–140,000 gas | protocolManager.deposit("DolomitePlugin", "WETH", 1 ether); | Solo il proprietario può eseguire il deposito | Parte del modello di registrazione dei moduli e del proxy che indirizza i depositi attraverso ProxyGeneral e il plugin selezionato |
| withdraw      | protocol_manager | Preleva token da un protocollo specifico | protocolName, tokenCode, amount | Nessun ritorno | external onlyOwner | amount > 0, tokenCode non vuoto, plugin risolto | ProtocolOperationExecuted | ~110,000–130,000 gas | protocolManager.withdraw("DolomitePlugin", "USDC", 1000 * 10**6); | Solo il proprietario può eseguire il prelievo | Progettato per indirizzare i prelievi attraverso il sistema dei plugin e tornare al ProtocolManager, emettendo un evento per l'auditabilità |

---

### 3. **File JSON**
Questo file sarà una versione estesa e strutturata del file `api_reference_beacon.json`, aggiornando la struttura e aggiungendo ulteriori informazioni se necessario.

Esempio iniziale:
```json
{
  "version": "3.0.0",
  "modules": {
    "protocol_manager": {
      "name": "ProtocolManager",
      "id": "protocol_manager",
      "displayOrder": 1,
      "functions": {
        "protocol_manager-deposit": {
          "name": "deposit",
          "id": "protocol_manager-deposit",
          "module": "protocol_manager",
          "description": "Deposit tokens into a specified protocol. The function resolves the protocol plugin via the Beacon, verifies the plugin, forwards the token deposit from ProxyGeneral to the plugin, calls the plugin’s deposit function, and emits a ProtocolOperationExecuted event.",
          "signature": "function deposit(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
          "parameters": [
            {
              "name": "protocolName",
              "type": "string memory",
              "description": "Nome del protocollo (es. \"DolomitePlugin\")"
            },
            {
              "name": "tokenCode",
              "type": "string memory",
              "description": "Codice del token (es. \"WETH\", \"USDC\")"
            },
            {
              "name": "amount",
              "type": "uint256",
              "description": "Importo da depositare (in wei)"
            }
          ],
          "returns": [],
          "accessControl": "external onlyOwner – callable exclusively by the contract owner.",
          "validations": [
            "✅ amount > 0 – enforced by if (amount == 0) revert InvalidAmount(amount);",
            "✅ tokenCode non‑empty – enforced by if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);",
            "✅ protocol plugin resolution – if the plugin address is 0, the contract reverts with ProtocolNotFound.",
            "✅ plugin address non‑zero – checked by _validateProtocol() which reverts with InvalidProtocol if zero.",
            "✅ plugin.deposit must return true – otherwise the function reverts with OperationFailed(\"deposit\", \"Plugin deposit failed\")."
          ],
          "events": "ProtocolOperationExecuted",
          "gasCost": "≈ 120,000–140,000 gas (cold storage reads, beacon lookup, low‑level plugin call, SafeERC20 withdrawal).",
          "usageExample": "// Example usage by the contract owner\nprotocolManager.deposit(\"DolomitePlugin\", \"WETH\", 1 ether);",
          "calledBy": "external caller – only the contract owner can execute this function.",
          "securityNotes": [
            "⚙️ Only the owner can call deposit; any other address is rejected by the onlyOwner modifier.",
            "🔒 Sufficient checks prevent accidental zero‑amount deposits or empty token codes.",
            "🛡️ The beacon lookup ensures the correct plugin contract is used; an invalid plugin triggers a revert.",
            "🛠️ The function relies on the plugin’s deposit() returning true; failure leads to a revert to protect funds."
          ],
          "notes": "Part of the core module‑registration and proxy pattern that routes deposits through ProxyGeneral and the selected plugin.",
          "_complete": true,
          "_missingFields": []
        },
        "protocol_manager-withdraw": {
          "name": "withdraw",
          "id": "protocol_manager-withdraw",
          "module": "protocol_manager",
          "description": "Withdraw tokens from a specified protocol. The function resolves the protocol plugin via the Beacon, verifies the plugin and then delegates the withdrawal to the plugin, which returns the tokens to ProxyGeneral. A ProtocolOperationExecuted event is emitted.",
          "signature": "function withdraw(string memory protocolName, string memory tokenCode, uint256 amount) external onlyOwner",
          "parameters": [
            {
              "name": "protocolName",
              "type": "string memory",
              "description": "Nome del protocollo (es. \"DolomitePlugin\")"
            },
            {
              "name": "tokenCode",
              "type": "string memory",
              "description": "Codice del token (es. \"WETH\", \"USDC\")"
            },
            {
              "name": "amount",
              "type": "uint256",
              "description": "Importo da prelevare (in wei)"
            }
          ],
          "returns": [],
          "accessControl": "external onlyOwner – callable exclusively by the contract owner.",
          "validations": [
            "✅ amount > 0 – enforced by if (amount == 0) revert InvalidAmount(amount);",
            "✅ tokenCode non‑empty – enforced by if (bytes(tokenCode).length == 0) revert InvalidTokenCode(tokenCode);",
            "✅ protocol plugin resolution – reverts with ProtocolNotFound if plugin address is 0.",
            "✅ plugin address non‑zero – _validateProtocol() reverts with InvalidProtocol.",
            "✅ plugin.withdraw must return true – otherwise the transaction reverts with OperationFailed(\"withdraw\", \"Plugin withdraw failed\")."
          ],
          "events": "ProtocolOperationExecuted",
          "gasCost": "≈ 110,000–130,000 gas (cold storage reads, beacon lookup, low‑level plugin call, SafeERC20 transfer).",
          "usageExample": "// Example usage by the contract owner\nprotocolManager.withdraw(\"DolomitePlugin\", \"USDC\", 1000 * 10**6);",
          "calledBy": "external caller – only the contract owner can execute this function.",
          "securityNotes": [
            "⚙️ Only the owner can call withdraw; unauthorized callers are rejected by the onlyOwner modifier.",
            "🔒 Input validations prevent zero amount or empty token codes.",
            "🛡️ The plugin is verified via the beacon and address checks, ensuring the token is returned to the correct proxy.",
            "🛠️ A failed plugin return leads to a revert, protecting the caller from loss."
          ],
          "notes": "Designed to route withdrawals through the plugin system and back to the ProtocolManager, emitting an event for auditability.",
          "_complete": true,
          "_missingFields": []
        }
      }
    }
  }
}