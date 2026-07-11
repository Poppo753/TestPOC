# AaveV3Plugin

| Campo | Valore |
|-------|--------|
| File | contracts/plugins/AaveV3Plugin.sol |
| Tipo | contract |
| Solidity | ^0.8.x |
| Eredita da | Ownable |
| Implementa | IPlugin |

## Scopo
Il contratto `AaveV3Plugin` implementa l'integrazione con Aave V3. Permette depositi e prelievi di token in questa piattaforma.

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| _owner | address | public | Indirizzo del proprietario del contratto |
| _aavePool | address | private | Indirizzo del pool Aave V3 |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | — | — | onlyOwner | Inizializza il plugin con privilegi di proprietario |
| deposit | external | token: address, amount: uint256 | — | onlyOwner | Deposita token in Aave V3 |
| withdraw | external | token: address, amount: uint256 | — | onlyOwner | Preleva token da Aave V3 |

## Eventi

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| Deposit | token: address, amount: uint256 | Emesso quando viene effettuato un deposito in Aave V3 |
| Withdraw | token: address, amount: uint256 | Emesso quando viene effettuato un prelievo da Aave V3 |