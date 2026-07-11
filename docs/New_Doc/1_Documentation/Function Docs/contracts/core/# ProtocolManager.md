# ProtocolManager

| Campo | Valore |
|-------|--------|
| File | contracts/ProtocolManager.sol |
| Tipo | contract |
| Solidity | ^0.8.x |
| Eredita da | Ownable |
| Implementa | IProtocolManager |

## Scopo
Il contratto `ProtocolManager` è il punto di ingresso principale del sistema. Gestisce le operazioni di deposito, prelievo e l'esecuzione di operazioni flash loan. Interagisce con i plugin per le diverse piattaforme finanziarie.

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| _owner | address | public | Indirizzo del proprietario del contratto |
| _plugins | mapping(string => address) | private | Mappa dei plugin registrati per protocollo |
| _protocols | mapping(string => address) | private | Mappa dei protocolli registrati |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | — | — | onlyOwner | Inizializza il manager con privilegi di proprietario |
| deposit | external | protocolName: string, tokenCode: string, amount: uint256 | — | onlyOwner | Deposita token in un protocollo specifico |
| withdraw | external | protocolName: string, tokenCode: string, amount: uint256 | — | onlyOwner | Preleva token da un protocollo specifico |
| executeOperation | external | amount: uint256, fee: uint256 | — | onlyOwner | Esegue un'operazione flash loan |

## Eventi

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| Deposit | protocolName: string, tokenCode: string, amount: uint256 | Emesso quando viene effettuato un deposito |
| Withdraw | protocolName: string, tokenCode: string, amount: uint256 | Emesso quando viene effettuato un prelievo |
| FlashLoanExecuted | amount: uint256, fee: uint256 | Emesso quando viene eseguita un'operazione flash loan |