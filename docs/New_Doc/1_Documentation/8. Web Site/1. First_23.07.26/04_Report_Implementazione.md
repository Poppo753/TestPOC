# Jethos Website — report di implementazione

Versione 1.0 — 23 luglio 2026

## Risultato

`dapp-new` è stato trasformato da landing monolitica centrata sul rendimento a sito multi-pagina centrato sulla **self-custodial financial home**, con una console PoC USDC separata e moduli web3 organizzati.

## Cosa è stato realizzato

### Sito pubblico

- nuova landing in `index.html`;
- How it works;
- Vaults;
- Risk & Transparency;
- Vision;
- Roadmap;
- Security;
- Protocol;
- Developers;
- Docs;
- header/footer condivisi e URL legacy compatibili.

### Nuova narrazione

- wallet e vault rappresentati come stati distinti;
- asset nel wallet dichiarati non investiti automaticamente;
- deposito descritto come autorizzazione esplicita;
- vault descritti come trasparenti ma non privi di rischio;
- rendimento netto corretto per rischio al posto di “maximum yield”;
- Protocol, App e Future Services separati;
- PoC, implemented, planned, vision, illustrative e live distinti;
- confronto con la finanza tradizionale espresso attraverso proprietà e verificabilità, senza promesse assolute o polemica eccessiva.

### Design

- design system CSS locale;
- palette originale viola/blu preservata;
- hero basata su una dashboard finanziaria;
- tipografia più contenuta;
- diagrammi wallet/vault, flusso, allocazione e architettura;
- mobile navigation;
- responsive layout;
- focus visibile, skip link e reduced motion;
- eliminazione di Vanta, Three.js e Tailwind CDN dalla nuova esperienza.

### Console PoC

- letture pubbliche senza wallet;
- connessione wallet esplicita;
- restore senza popup;
- controllo/switch di Arbitrum;
- saldo gas, USDC, share e allowance;
- pool value, reserve, supply, fee e pause;
- registry protocolli e breakdown parziali;
- estimate di deposito/prelievo tramite view helper del contratto;
- approval esatto;
- revoca approval;
- deposito ERC-20 `deposit(uint256)`;
- prelievo `withdrawWithDeadline`;
- gas estimate;
- mutex anti doppio click;
- stato awaiting-wallet/pending/confirmed/failed;
- link Arbiscan;
- storico Deposit/Withdrawn in finestra limitata.

## Correzioni tecniche principali

1. Rimossi dai moduli attivi gli indirizzi del vecchio deployment ETH.
2. Sostituita la vecchia ABI `deposit() payable` con `deposit(uint256)`.
3. Inserito il deployment USDC dal manifest `arbitrum-usdc-poc-1.json`.
4. Rimossi fee e APY inventati dalla UI.
5. Gli errori RPC non diventano più valori zero silenziosi.
6. Le stime non sono presentate come preview ERC-4626.
7. Le azioni amministrative e dirette ai plugin non sono esposte all'utente.
8. Approval infinito sostituito da approval esatto e revoca.
9. Aggiunta provenienza live/record/illustrative.
10. Corretto il conflitto CSS che rendeva visibili controlli con `hidden`.
11. Corretto il layout inline delle metriche nella console.

## Stato live verificato il 23 luglio 2026

La lettura RPC diretta ha confermato bytecode agli indirizzi di:

- USDC;
- LiquidityManager;
- ProxyGeneral;
- ValueCalculator;
- ProtocolManager.

Stato osservato:

- depositi abilitati;
- prelievi abilitati;
- deposit fee 0;
- withdraw fee 0;
- pool value 0;
- total share supply 0;
- ProxyGeneral non paused;
- quattro nomi registrati attivi: AaveV3, EulerV2, Morpho, MorphoVault.

Questa fotografia non è una garanzia dello stato futuro.

## Verifiche eseguite

- 18 file JavaScript analizzati con `node --check`;
- 5 file JSON parsati;
- validatore locale: 15 HTML e 5 file dati validati;
- link e asset locali risolti;
- ID duplicati controllati;
- vecchi indirizzi ETH esclusi dai moduli attivi;
- tutte le pagine restituite con HTTP 200;
- landing ispezionata a 1440×1000 e 500×900;
- console ispezionata a 1440×1000 con dati live;
- bytecode e letture core verificati via RPC Arbitrum;
- `npm run compile` completato: nulla da ricompilare.

## Limiti della verifica

- nessuna transazione mainnet è stata inviata;
- nessun test con wallet reale è stato automatizzato;
- nessun audit di sicurezza frontend o Solidity è implicato;
- la finestra eventi dipende dai limiti del provider pubblico;
- Ethers viene caricato da CDN;
- lo stato PoC può cambiare dopo questa verifica;
- le discrepanze contrattuali già documentate non sono state corrette.

