# Guida corretta al primo deployment POC USDC

## Decisione operativa

Il POC viene creato da zero su Arbitrum One (`chainId 42161`) con USDC nativo come base asset. I vecchi contratti non vengono riutilizzati. Dai file storici si recuperano soltanto candidati relativi a protocolli esterni, poi verificati tramite fonte ufficiale, bytecode e chiamate read-only.

Protocolli inclusi:

- Aave V3;
- Euler;
- Morpho;
- Morpho Vault.

Dolomite, GMX e Uniswap non fanno parte di questo deployment.

## Dati già accertati il 14 luglio 2026

- RPC: endpoint Alchemy Arbitrum autenticato, configurato in `.env`;
- deployer: `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- saldo osservato: circa `0.003691 ETH` e `5.460207 USDC`;
- USDC nativo: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`, 6 decimali;
- feed USDC/USD: `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3`, 8 decimali;
- Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`;
- Euler EVC/Lens/Vault candidati: quelli della generazione già coperta dalla suite fork;
- Morpho singleton: `0x6c247b1F6182318877311737BaC0844bAa518F5e`;
- Morpho WETH/USDC oracle: `0x282FEB10549fde52bD61A6979424Ddf18A4971A2`;
- Morpho IRM: `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA`;
- LLTV candidato: `860000000000000000` (86%);
- Morpho Vault USDC candidato iniziale: `0xaE73875437c86abb60cD7fA77286D63cb94F9a25`.

La presenza di bytecode non certifica da sola la semantica. Prima del deploy reale devono passare chiamate funzionali e il rehearsal fork.

## Cosa significa RPC sicura

Per questo POC non serve gestire un nodo Arbitrum. L'endpoint Alchemy attuale è adeguato se:

- la URL completa e la API key restano soltanto nel `.env` non versionato;
- non vengono copiate in documenti, screenshot o log;
- la chiave ha limiti/rate limit e può essere ruotata;
- il piano supporta la quantità di richieste del fork;
- il deploy usa lo stesso endpoint verificato dal preflight;
- il blocco di certificazione viene fissato.

La RPC non protegge la chiave privata. La `PRIVATE_KEY` nel `.env` è accettabile per un POC a capitale minimo, ma non è il modello finale: il deployer deve contenere solo gas e fondi POC, e le ownership devono poi passare a Safe.

## Perché 5 USDC bastano ma non per ogni flow

Cinque USDC sono sufficienti per:

- un deposito minimo nel vault;
- un supply/withdraw piccolo su Aave, Euler o Morpho Vault;
- verificare accounting e persistenza;
- eseguire observe su uno stato reale non vuoto.

Non bastano, da soli, per borrow e leverage realistici che richiedono collaterale differente. Tali flow si certificano prima sul fork con whale impersonate e snapshot/revert. Sul POC reale si usa soltanto capitale che si accetta di perdere.

## Sequenza vincolante

1. Compilazione, typecheck e test locali.
2. Validazione read-only di chain, signer, saldi e dipendenze esterne.
3. Rehearsal completo su nodo fork persistente a blocco fissato.
4. Deploy reale del core in un nuovo manifest.
5. Deploy Aave, Euler, Morpho e Morpho Vault.
6. Configurazione token, registry, market, vault, policy e selector.
7. Preflight e health check senza capitale.
8. Fissaggio del primo blocco post-configurazione.
9. Fork degli esatti indirizzi POC e suite completa.
10. Deposito reale massimo iniziale: 5 USDC.
11. Deposit/withdraw per protocollo, uno alla volta, con verifica dei saldi.
12. Controller in `observe`, senza signer operativo.
13. Safe advisory e trasferimento delle ownership solo dopo l'osservazione.

## Manifest distinti

- `scripts/manifests/rehearsal-*.json`: indirizzi effimeri del fork, mai validi su mainnet;
- `scripts/manifests/arbitrum-usdc-poc-1.json`: unico manifest reale del POC;
- `scripts/automation/config.arbitrum-usdc-poc-1.json`: policy del controller che punta al manifest reale.

Il manifest non contiene private key, API key o seed phrase.

## Regola di arresto

Non si prosegue al checkpoint successivo se:

- chain ID diverso da 42161;
- bytecode assente;
- asset/decimali/oracle discordanti;
- owner inatteso;
- simulazione o stima gas fallisce;
- registry non configurato;
- posizione precedente non è stata chiusa;
- manifest e stato on-chain divergono.

