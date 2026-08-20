# EulerV2Plugin

| Campo | Valore |
|-------|--------|
| File | contracts/plugins/EulerV2Plugin.sol |
| Tipo | contract |
| Solidity | ^0.8.x |
| Eredita da | Ownable |
| Implementa | IPlugin |

## Scopo
Il contratto `EulerV2Plugin` implementa l'integrazione con Euler V2. Permette depositi e prelievi di token in questa piattaforma.

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| _owner | address | public | Indirizzo del proprietario del contratto |
| _eulerManager | address | private | Indirizzo del manager Euler V2 |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | — | — | onlyOwner | Inizializza il plugin con privilegi di proprietario |
| deposit | external | token: address, amount: uint256 | — | onlyOwner | Deposita token in Euler V2 |
| withdraw | external | token: address, amount: uint256 | — | onlyOwner | Preleva token da Euler V2 |

## Eventi

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| Deposit | token: address, amount: uint256 | Emesso quando viene effettuato un deposito in Euler V2 |
| Withdraw | token: address, amount: uint256 | Emesso quando viene effettuato un prelievo da Euler V2 |