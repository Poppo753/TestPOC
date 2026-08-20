# MorphoPlugin

| Campo | Valore |
|-------|--------|
| File | contracts/plugins/MorphoPlugin.sol |
| Tipo | contract |
| Solidity | ^0.8.x |
| Eredita da | Ownable |
| Implementa | IPlugin |

## Scopo
Il contratto `MorphoPlugin` implementa l'integrazione con Morpho. Permette depositi e prelievi di token in questa piattaforma.

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| _owner | address | public | Indirizzo del proprietario del contratto |
| _morphoManager | address | private | Indirizzo del manager Morpho |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | — | — | onlyOwner | Inizializza il plugin con privilegi di proprietario |
| deposit | external | token: address, amount: uint256 | — | onlyOwner | Deposita token in Morpho |
| withdraw | external | token: address, amount: uint256 | — | onlyOwner | Preleva token da Morpho |

## Eventi

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| Deposit | token: address, amount: uint256 | Emesso quando viene effettuato un deposito in Morpho |
| Withdraw | token: address, amount: uint256 | Emesso quando viene effettuato un prelievo da Morpho |