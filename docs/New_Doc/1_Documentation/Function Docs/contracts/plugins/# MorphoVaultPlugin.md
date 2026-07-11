# MorphoVaultPlugin

| Campo | Valore |
|-------|--------|
| File | contracts/plugins/MorphoVaultPlugin.sol |
| Tipo | contract |
| Solidity | ^0.8.x |
| Eredita da | Ownable |
| Implementa | IPlugin |

## Scopo
Il contratto `MorphoVaultPlugin` implementa l'integrazione con Morpho Vault. Permette depositi e prelievi di token in questa piattaforma.

## Storage Variables

| Nome | Tipo | Visibilità | Descrizione |
|------|------|------------|-------------|
| _owner | address | public | Indirizzo del proprietario del contratto |
| _vaultManager | address | private | Indirizzo del manager Morpho Vault |

## Costanti e Immutabili

| Nome | Tipo | Valore / Descrizione |
|------|------|----------------------|

## Funzioni

| Funzione | Visibility | Params | Returns | Modifiers | Descrizione |
|----------|------------|--------|---------|-----------|-------------|
| constructor | public | — | — | onlyOwner | Inizializza il plugin con privilegi di proprietario |
| deposit | external | token: address, amount: uint256 | — | onlyOwner | Deposita token in Morpho Vault |
| withdraw | external | token: address, amount: uint256 | — | onlyOwner | Preleva token da Morpho Vault |

## Eventi

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| Deposit | token: address, amount: uint256 | Emesso quando viene effettuato un deposito in Morpho Vault |
| Withdraw | token: address, amount: uint256 | Emesso quando viene effettuato un prelievo da Morpho Vault |