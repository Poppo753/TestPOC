# Jethos — chiarimenti derivati dal codice

Versione 0.1 — 22 luglio 2026  
Stato: analisi statica del repository e verifica locale mirata  
Perimetro: implementazione disponibile nel repository `TestSmartContract`, senza assumere che il codice rappresenti già il comportamento desiderato per la produzione.

## 1. Scopo e criterio delle risposte

Questo documento completa il pacchetto documentale v0.1 con ciò che può essere ricostruito dall'implementazione corrente. Non trasforma automaticamente il progetto in una specifica definitiva: descrive il comportamento osservabile nel codice, negli script attivi, nei test e nei manifest locali.

Le evidenze sono classificate così:

- **CONFERMATO DAL CONTRATTO**: comportamento imposto dal codice Solidity corrente.
- **CONFERMATO DA SCRIPT/MANIFEST**: configurazione o procedura registrata localmente, ma non riletta live dalla chain durante questa analisi.
- **CONFERMATO DA TEST**: scenario verificato dalla suite selezionata; non equivale a un audit.
- **PARZIALE**: il codice chiarisce il meccanismo ma non la policy o il valore definitivo.
- **NON DETERMINABILE DAL CODICE**: richiede una decisione umana, economica, legale o di governance.
- **DISCREPANZA**: documentazione e implementazione corrente non coincidono.

Ordine di prevalenza usato nell'analisi:

1. Contratti in `contracts/`.
2. Script non legacy in `scripts/`.
3. Manifest e report in `scripts/manifests/`, `deployments/` e `reports/`.
4. Test correnti in `test/`.
5. Commenti e documentazione precedente, utilizzati soltanto come contesto.

Le cartelle `scripts/legacy/`, `test/old/`, `vari/` e `docs/Old_Documentation/` non sono considerate fonti autoritative del comportamento corrente.

## 2. Quanto può essere chiarito dal repository

### 2.1 PoC corrente

Per il perimetro concreto “vault USDC su Arbitrum, supply-only, Aave/Euler/Morpho”, il repository permette di ricostruire indicativamente:

- circa **70% delle specifiche tecniche** in modo diretto;
- un ulteriore **15–20% in modo parziale**, perché il meccanismo esiste ma la policy definitiva non è stata scelta;
- il restante **10–15%** richiede decisioni o verifiche live.

Il codice chiarisce soprattutto architettura, custodia, accounting corrente, permessi tecnici, plugin, automazione, configurazione e test. Non può decidere autonomamente profilo di rischio desiderato, fee di prodotto, governance, compliance o criteri commerciali.

### 2.2 Intera visione Jethos

Considerando anche borrowing, governance, collateralizzazione delle share, queue, cross-chain, pagamenti e servizi regolamentati, la copertura scende indicativamente a:

- **30–35% risposto dal codice**;
- **20–25% parzialmente chiarito**;
- **40–50% ancora decisionale o futuro**.

Queste percentuali sono una stima di copertura documentale, non una misura di completezza o sicurezza.

## 3. Stato implementato del sistema

### 3.1 Core

Il core corrente è composto da:

| Componente | Comportamento implementato | Evidenza principale |
|---|---|---|
| `Beacon` | Directory di moduli, storico indirizzi, freeze per modulo/globale e trasferimento ownership a due passaggi. | `contracts/Beacon.sol` |
| `ProxyGeneral` | Custodia degli asset e token LP ERC-20; autorizza moduli a mint, burn, trasferire e approvare asset. | `contracts/ProxyGeneral.sol` |
| `LiquidityManager` | Deposito ERC-20, calcolo share, prelievo sincrono, fee, limiti e recupero automatico di liquidità. | `contracts/Liquiditymanager.sol` |
| `TokenManager` | Allowlist token non-base, metadati, heartbeat e accesso all'oracle adapter. | `contracts/TokenManager.sol` |
| `ChainlinkAdapter` | Feed configurabili, validazioni round, heartbeat, conversione di denominazione e prezzo USD normalizzato. | `contracts/adapters/ChainlinkAdapter.sol` |
| `ValueCalculator` | NAV in unità atomiche del base asset: custodia + token esterni + valori dei LensAdapter. | `contracts/ValueCalculator.sol` |
| `SwapManager` | Swap autorizzati con limiti, deadline, slippage e plugin selezionabile. | `contracts/SwapManager.sol` |
| `ProtocolManager` | Orchestrazione owner-only di deposit, withdraw, borrow, repay e chiamate selector-whitelisted. | `contracts/ProtocolManager.sol` |
| `ParameterManager` | Registro parametri e timelock, con più percorsi di aggiornamento. | `contracts/ParameterManager.sol` |
| `EmergencyHandler` | Pause, contatti di emergenza, timelock di riapertura, snapshot e tentativi di recovery. | `contracts/EmergencyHandler.sol` |
| `FlashLoanService` | Flash loan Balancer utilizzabile da plugin registrati e callback controllata. | `contracts/services/FlashLoanService.sol` |

### 3.2 Base asset abstraction

**CONFERMATO DAL CONTRATTO.** `ProxyGeneral`, `LiquidityManager`, `ValueCalculator`, `SwapManager` e i plugin ricevono o risolvono `baseAssetCode`; l'indirizzo è letto dal Beacon tramite `BASE_ASSET`.

Il core riceve ERC-20 mediante `SafeERC20`. I test e gli script coprono configurazioni WETH, USDC, USDT e WBTC. Questo conferma che l'astrazione è realmente presente, pur non provando che ogni protocollo sia disponibile per ogni base asset.

`DepositHelper` implementa soltanto `depositETH()`: wrappa ETH in WETH e trasferisce le share all'utente. Non implementa `withdrawETH()`.

Evidenze: `contracts/Liquiditymanager.sol:101-213`, `contracts/DepositHelper.sol:25-52`, test `USDC.BaseAsset`, `USDT.BaseAsset`, `WETH.BaseAsset` e `WBTC.BaseAsset`.

### 3.3 Plugin effettivamente presenti

| Integrazione | Stato ricavabile dal codice |
|---|---|
| Aave V3 | Deposit, withdraw, borrow, repay, close, leverage atomica, circuit breaker, Registry e LensAdapter. |
| Euler V2 | Deposit, withdraw, borrow, repay, sub-account isolati, leverage atomica, Registry e LensAdapter. |
| Morpho Blue | Collateral, borrow, repay, close market, leverage atomica, Registry e LensAdapter. |
| Morpho ERC-4626 vault | Deposit/redeem in vault approvati, default vault e LensAdapter. |
| Uniswap V3 | Plugin di swap diretto e variante delegata. |
| InterVault | Meta-vault same-chain v1 con Registry, Plugin e LensAdapter. |
| Dolomite | Contratto presente ma esplicitamente escluso dal deployer corrente perché incompleto. |
| GMX | Non presente tra i bundle supportati; il deployer lo dichiara incompleto. |

Evidenza: `scripts/operations/deployment/deploy-bundle.ts:55-155`.

## 4. Accounting e compatibilità ERC-4626

### 4.1 Standard realmente implementato

**DISCREPANZA CRITICA.** Il vault Jethos corrente non implementa l'interfaccia ERC-4626.

`ProxyGeneral` è un ERC-20 denominato `LP Token` / `LPT`, mentre `LiquidityManager` espone:

- `deposit(uint256)`;
- `withdraw(uint256)`;
- `withdrawWithDeadline(uint256,uint256)`;
- `calculateDepositShares(uint256)`;
- `calculateWithdrawAmount(uint256)`.

Non risultano implementate le funzioni ERC-4626 obbligatorie `asset`, `totalAssets`, `convertToShares`, `convertToAssets`, `previewDeposit`, `previewMint`, `previewWithdraw`, `previewRedeem`, `mint`, `redeem`, `maxDeposit`, `maxMint`, `maxWithdraw` e `maxRedeem`.

Le interfacce ERC-4626 presenti nel repository sono usate per interagire con vault esterni Euler/Morpho, non per rendere ERC-4626 il vault Jethos.

### 4.2 Formula corrente delle share

**CONFERMATO DAL CONTRATTO.** La formula corrente è:

```text
feeDeposito = amount × depositFeeBps / 10.000
netDeposit = amount - feeDeposito

se totalSupply == 0:
    shares = netDeposit
altrimenti:
    shares = netDeposit × totalSupply / totalPoolValue
```

Per il prelievo:

```text
grossAssets = shares × totalPoolValue / totalSupply
feePrelievo = grossAssets × withdrawFeeBps / 10.000
netAssets = grossAssets - feePrelievo
```

L'arrotondamento è quello intero di Solidity, verso il basso, salvo calcoli specifici InterVault che usano `Math.mulDiv` con rounding esplicito.

Evidenza: `contracts/Liquiditymanager.sol:141-193`, `contracts/Liquiditymanager.sol:264-287`, `contracts/Liquiditymanager.sol:874-928`.

### 4.3 Decimali, offset e bootstrap

**CONFERMATO DAL CONTRATTO / DISCREPANZA.** Le share ereditano i 18 decimali standard da OpenZeppelin ERC-20, ma il primo deposito minta un numero di unità share uguale alle unità atomiche nette del base asset.

Esempio USDC senza fee:

```text
deposito: 100 USDC = 100.000.000 unità atomiche
share mintate: 100.000.000 unità share
decimali dichiarati della share: 18
```

Non esiste un decimal offset che trasformi 6 decimali USDC in 18 decimali share. Non esistono virtual assets o virtual shares. Il test `ProxyGeneral.simple` conferma `decimals() == 18`; alcuni test di `LiquidityManager` contengono inoltre commenti espliciti su un “LP shares value inflation bug”.

### 4.4 Primo deposito, ultima share e donazioni

- Primo deposito: rapporto raw 1:1 tra unità atomiche nette del base asset e unità share.
- Ultima share: non esiste un ramo speciale; il calcolo resta proporzionale e poi la share viene bruciata.
- Se rimangono dust o asset non recuperabili, non esiste una procedura contabile dedicata al vault vuoto.
- Le donazioni dirette al `ProxyGeneral` aumentano il saldo incluso nel NAV e quindi il valore economico delle share esistenti.
- Non esiste una protezione specifica donation/inflation mediante virtual accounting.
- Non esiste `minSharesOut` nel deposito utente. L'unica protezione è `shares > 0`.
- Il plugin InterVault applica invece una tolleranza sulle share ricevute quando deposita in un child vault.

I test attuali verificano che un trasferimento diretto aumenti il prezzo LP come rendimento; non risultano test specifici dell'attacco donation/inflation sul primo depositante.

### 4.5 Composizione di `totalPoolValue`

Il valore totale è:

```text
saldo base asset in ProxyGeneral
+ valore dei token attivi in TokenManager
+ valore netto restituito dai LensAdapter dei protocolli attivi
```

I debiti vengono sottratti dentro i LensAdapter, non nel `LiquidityManager`.

**DISCREPANZA DI SICUREZZA.** Per token o LensAdapter che falliscono, `ValueCalculator` usa diversi `try/catch` e può saltare la componente fallita invece di bloccare il NAV. Questo è contrario alla regola documentale “se il NAV non è affidabile, depositi e prelievi devono fallire”. Il test InterVault registra espressamente questo comportamento come deployment gate.

Evidenza: `contracts/ValueCalculator.sol:214-360`, `test/unit/metavault/InterVault.bundle.test.ts`.

## 5. Risposte alle domande P0 del PoC 1A

| Domanda | Risposta ricavata | Stato |
|---|---|---|
| Quale implementazione ERC-4626? | Nessuna per il vault Jethos: accounting custom `LiquidityManager` + share ERC-20 in `ProxyGeneral`. | CONFERMATO / DISCREPANZA |
| Quale virtual accounting? | Nessuno. | CONFERMATO / GAP |
| Quale decimal offset per share a 18 decimali? | Nessuno; la share dichiara 18 decimali ma il bootstrap usa le unità atomiche del base asset. | CONFERMATO / GAP |
| Deposito minimo? | Default `unit / 1.000.000`: per USDC a 6 decimali equivale a 1 unità atomica. È modificabile e non è una policy definitiva. | PARZIALE |
| `minSharesOut`? | Assente nel deposito utente; soltanto revert su zero share. | CONFERMATO / GAP |
| Comportamento dopo l'ultima share? | Nessun ramo speciale. Il manifest del micro-flow registra supply e pool value finali a zero, con 3 unità USDC di rounding loss nel ciclo reale. | PARZIALE |
| Oracle staleness? | Feed Arbitrum configurati a 86.400 secondi negli script; `ValueCalculator.maxPriceAge` default 1 ora per token esterni. I due livelli non sono uniformi. | PARZIALE |
| Mercati autorizzati? | Manifest PoC: Aave V3, Euler V2, Morpho Blue e MorphoVault attivi. Configurazioni locali indicano Aave USDC, Euler USDC `0x0a1e...b899`, Morpho WETH/USDC e HexaOne USDC `0xaE73...9a25`. Serve una lettura live per certificare lo stato attuale. | SCRIPT/MANIFEST |
| Cap oltre 100 USDC? | `ParameterManager` inizializza `maxDeposit = 100 × unit`, quindi 100 USDC per transazione nel deployment con 6 decimali. Il cap TVL globale non è implementato nello stesso parametro. | CONFERMATO |
| Fee deposito 0,10% in asset o share? | Le fee sono calcolate e trasferite in base asset. Tuttavia il contratto parte con fee zero e il manifest PoC non registra una configurazione a 0,10%. | CONFERMATO / DISCREPANZA |
| Fee recipient? | Configurabile solo dall'owner; default zero. Il manifest PoC non documenta una chiamata `setFeeRecipient`. | PARZIALE |
| Ruoli e indirizzi? | Contratti principalmente `Ownable`; deployer del manifest `0x8390...1C3F`. Proxy autorizza LiquidityManager, SwapManager, ProtocolManager, EmergencyHandler e plugin. Gli owner live devono essere interrogati on-chain. | PARZIALE |
| Come è implementato 2-of-3? | Non è imposto dai contratti. Gli script supportano Safe, ma la configurazione PoC è `observe` con execution disabilitata e non dimostra ownership trasferita a un Safe. | CONFERMATO / GAP |
| Pause disponibili? | Proxy global pause; toggle deposit/withdraw; swap enable; plugin circuit breaker; protocol active flag; freeze Beacon per modulo/globale. Non esiste una policy uniforme `pause borrowing` nel core. | CONFERMATO |
| Operazioni keeper? | Automazione PoC osserva e pianifica deposit/withdraw supply-only; execution è disabilitata. Le operazioni on-chain di ProtocolManager sono owner-only. | CONFERMATO |
| Operation ID e nonce? | Non esiste un operation ID on-chain generale. L'automazione usa run ID, fingerprint, config hash, lock file, controllo dello stato e Safe nonce. | CONFERMATO / GAP |
| Metriche prima settimana? | Il codice verifica NAV, reserve, debt zero, circuit breaker, cap, drift, esito transazioni e stato post-operazione; la soglia di “successo della settimana” resta una decisione di prodotto. | PARZIALE |

## 6. Flussi funzionali ricostruiti

### 6.1 Deposito

1. L'utente approva il base asset al `LiquidityManager`.
2. `LiquidityManager` verifica pausa, toggle, min/max deposit e rate limit.
3. Calcola fee e share.
4. Trasferisce il deposito netto direttamente dall'utente al `ProxyGeneral`.
5. Trasferisce la fee al recipient, se fee e recipient sono non-zero.
6. Ordina al `ProxyGeneral` di mintare share all'utente.

Il deposito non alloca automaticamente nei protocolli; l'allocazione è una successiva operazione owner-only tramite `ProtocolManager`.

### 6.2 Prelievo

1. Calcolo proporzionale sulla base di `totalPoolValue` e `totalSupply`.
2. Verifica limiti per transazione, ora, giorno e reserve ratio.
3. Se la custodia è insufficiente, tenta prima swap di token liquidi e poi chiusura di posizioni tramite `ProtocolManager`.
4. Brucia le share.
5. Trasferisce base asset dal `ProxyGeneral` al `LiquidityManager` e quindi all'utente.
6. Trasferisce eventuale fee al recipient.

Il prelievo è sincrono e atomico. Non esiste queue.

### 6.3 Allocazione nei protocolli

1. L'owner di `ProtocolManager` chiama `deposit(protocolName, tokenCode, amount)`.
2. Il manager sposta token dal `ProxyGeneral` al plugin.
3. Il plugin opera nel protocollo esterno.
4. Il LensAdapter espone posizione, valore e health.

La strategia non è applicata on-chain: il contratto verifica soprattutto registrazione, autorizzazione e vincoli propri del protocollo esterno.

## 7. Strategy Engine e keeper realmente implementati

### 7.1 Strategia

**CONFERMATO DALLO SCRIPT.** La strategia corrente non ottimizza APY. È una strategia deterministica a pesi target configurati.

Per il PoC USDC:

- reserve target 20%, minimum 15%;
- Aave target 35%, cap 40%;
- Euler target 25%, cap 30%;
- MorphoVault target 20%, cap 25%;
- Morpho Blue monitor-only, target e cap 0;
- rebalance threshold 5%;
- minimo movimento 0,1 USDC;
- massimo movimento per ciclo 10% degli asset;
- cooldown 1 ora;
- minimum health factor 1,5;
- modalità `observe`;
- esecuzione `disabled`.

Evidenza: `scripts/automation/config.arbitrum-usdc-poc-1.json`.

### 7.2 Controlli del risk engine off-chain

Il risk engine blocca:

- contesto vault/chain/base asset errato;
- vault in pausa;
- depositi o prelievi disabilitati;
- oracle telemetry mancante quando richiesta;
- autonomia non esplicitamente riconosciuta;
- protocollo non previsto o inattivo;
- circuit breaker attivo o non leggibile;
- debito diverso da zero in supply-only;
- health factor sotto soglia;
- movimenti oltre budget;
- riserva prevista sotto minimo;
- allocazioni oltre cap.

Questi vincoli appartengono al controller off-chain. Non sono tutti duplicati nei contratti.

### 7.3 Concorrenza, replay e approvazione

L'automazione implementa:

- stato persistito con transizioni ammesse;
- lock esclusivo per vault e recupero dei lock scaduti;
- fingerprint dell'osservazione;
- config hash;
- invalidazione di piani vecchi o con drift materiale;
- simulazione prima dell'esecuzione diretta;
- verifica post-esecuzione;
- modalità observe, advisory e autonomous;
- integrazione Safe tramite Protocol Kit e Transaction Service;
- heartbeat del servizio e arresto dopo fallimenti consecutivi.

Non implementa un nonce on-chain trasversale alle operazioni di `ProtocolManager`.

## 8. Borrowing e leverage: cosa è già deciso dal codice

### 8.1 Capacità presenti

Aave, Euler e Morpho espongono borrow/repay. Tutti e tre contengono anche flussi leverage atomici mediante `FlashLoanService`.

I parametri delle aperture leverage includono collaterale, asset borrowed, importo, leverage target, health factor minimo e deadline. Il leverage accettato è compreso tra 1,10x e 5,00x.

### 8.2 Limiti effettivi

- Costante plugin `MIN_HEALTH_FACTOR = 1,05`.
- Il chiamante può fornire `minHealthFactor`; il codice usa il valore fornito quando maggiore di zero, senza imporre esplicitamente che sia almeno 1,05.
- Il semplice `borrow` non applica i profili Conservativo/Bilanciato/Avanzato né debt-ratio Jethos; si affida alla riuscita del protocollo esterno.
- Non esiste nel `ProtocolManager` un cap di debito, leva o loss budget per operazione.
- L'automazione PoC rifiuta qualsiasi debito perché `supplyOnly = true`.

### 8.3 Domande P1 ancora aperte

Il codice non sceglie quale strategia di borrowing usare per prima. La configurazione Morpho WETH/USDC suggerisce tecnicamente WETH come collaterale e USDC come loan token, ma non costituisce una decisione di prodotto per PoC 1B.

Restano da decidere:

- protocollo iniziale;
- asset borrowed e uso economico;
- target di leva e debt ratio coerenti con il profilo;
- health factor target/rebalance/emergenza;
- loss budget;
- strategia di depeg/funding/oracle failure;
- stress test di accettazione.

Il codice chiarisce invece i percorsi tecnici di repay e close per i tre plugin.

## 9. Reward e fee

### 9.1 Reward

Non risultano funzioni di harvest o claim nel core corrente. I LensAdapter restituiscono reward APY pari a zero o placeholder. Di conseguenza:

- reward non reclamate non sono contabilizzate esplicitamente;
- non esistono haircut;
- non esiste soglia economica di harvest;
- non esistono route reward dedicate;
- non esiste trattamento definito di reward multiple o non trasferibili.

Queste domande restano aperte.

### 9.2 Fee

Sono implementate soltanto:

- deposit fee;
- withdraw fee;
- recipient unico;
- limite massimo 5% per ciascuna fee.

Le fee sono trasferite in base asset. Non risultano management fee, performance fee, high-water mark, ripartizione treasury/strategist/keeper/insurance o rimborso gas.

## 10. Ruoli, poteri e governance tecnica

### 10.1 Matrice dei poteri correnti

| Soggetto tecnico | Poteri principali |
|---|---|
| Beacon owner | Aggiornare indirizzi di qualsiasi modulo, freeze/unfreeze e trasferire ownership. |
| ProxyGeneral owner | Autorizzare moduli, unpause, limiti condivisi ed emergency transfer totale quando paused. |
| LiquidityManager owner | Fee, recipient, deposit/withdraw toggle, limiti e rate limit. |
| ProtocolManager owner | Registrare/disabilitare plugin, muovere capitale, borrow/repay, emergency withdraw e selector-whitelisted call. |
| Plugin owner | Circuit breaker; in alcuni plugin apertura leverage e recovery. |
| Registry owner | Censire token, mercati, vault e policy InterVault. |
| Emergency contact | Attivare la pausa globale tramite EmergencyHandler. |
| EmergencyHandler owner | Unpause dopo timelock, gestione contatti e funzioni di recovery. |
| Automation signer/Safe | Può operare solo se coincide con l'owner richiesto dai contratti e la configurazione abilita execution. |

### 10.2 Governance non implementata

Non risultano Governor, token di governance, snapshot, voto, delega, quorum o saldo medio temporale. “Community approval” è quindi una policy futura, non una funzione corrente.

### 10.3 Timelock

- ParameterManager: default 24 ore per parametri marcati critical.
- EmergencyHandler: default 6 ore prima dell'unpause, configurabile tra 1 ora e 7 giorni.
- ProtocolManager: operazioni immediate owner-only.
- Beacon upgrade: immediato, senza timelock interno.
- Registry e fee: aggiornamenti immediati owner-only.

**DISCREPANZA.** `ParameterManager` contiene due famiglie di funzioni. `emergencySetParameter` richiede sistema paused e rispetta i range; `setParameterEmergency(bytes)` scrive direttamente senza verificare pausa, esistenza o range. La documentazione deve descrivere entrambi i percorsi o il codice deve essere consolidato.

### 10.4 Poteri di trasferimento

**DISCREPANZA CRITICA rispetto al principio “nessuna chiave può trasferire arbitrariamente il capitale”.** `ProxyGeneral.emergencyTransferAll(recipient)` consente al suo owner, quando il sistema è paused, di trasferire tutto il base asset e l'ETH a un recipient scelto.

Questo può essere intenzionale come recovery, ma deve essere dichiarato come trust assumption e protetto operativamente. Il comportamento attuale non coincide con il principio assoluto espresso nel Master Vision.

## 11. Emergenze: capacità e limiti

### 11.1 Implementato

- Pausa da owner o emergency contact.
- Unpause solo owner dopo timelock.
- Cooldown tra attivazioni di emergenza.
- Snapshot asset e report.
- Circuit breaker per plugin.
- Freeze Beacon per modulo o globale.
- Withdraw dai protocolli tramite ProtocolManager/plugin.
- Emergency transfer totale dal ProxyGeneral, owner-only e soltanto quando paused.

### 11.2 Inconsistenza di interfaccia

**DISCREPANZA CRITICA.** `IEmergencyHandler` e `IProxyGeneral` prevedono `emergencyTransfer(token, amount, recipient)`, e `EmergencyHandler` la invoca. Il contratto concreto `ProxyGeneral` non implementa tale funzione; implementa soltanto `emergencyTransferAll(recipient)`.

Il progetto compila perché `ProxyGeneral` non dichiara di implementare formalmente l'interfaccia, ma le chiamate selettive di `EmergencyHandler` possono fallire a runtime.

### 11.3 Stato locale incoerente

`LiquidityManager` dichiara `bool public paused`, ma le funzioni operative controllano in realtà `ProxyGeneral.paused()`. La funzione `canWithdraw` controlla invece la variabile locale, che non risulta sincronizzata. Questa differenza può produrre una view preflight non coerente con l'esecuzione reale.

## 12. Multi-vault e piramide

### 12.1 Cosa è già implementato

InterVault v1 implementa un parent vault che investe in child vault Jethos attraverso share:

- child registrato con ID e manifest hash;
- verifica on-chain dei componenti del child tramite Beacon;
- stessa chain obbligatoria;
- una route canonica per vero base asset;
- cap di esposizione;
- massimo deposito;
- tolleranza sulle share ricevute;
- enable/disable separato di depositi e prelievi;
- emergency-only;
- valutazione in base asset del parent;
- blocco della rimozione finché il plugin possiede share;
- unwind e retry in caso di child fallito.

### 12.2 Limiti v1

- Il Registry accetta soltanto `level == 0`.
- Rifiuta child che espongono già `InterVaultPlugin`.
- Impedisce quindi annidamento e piramide multilivello nella versione corrente.
- È same-chain; non esistono bridge, share wrapped o messaging.
- L'automazione integra InterVault soltanto in monitor-only e blocca il funding finché resta aperto il gate di valutazione.

Il codice risponde quindi a molte domande P3 sul primo meta-vault, ma non implementa ancora la piramide generale descritta nella visione.

## 13. Multi-chain e cross-chain

### 13.1 Multi-chain

Il framework di manifest e deployment è parametrico per chain ID, base asset e indirizzi. Tuttavia le configurazioni attive incluse nel repository coprono:

- localhost;
- Arbitrum Sepolia;
- Arbitrum One.

Non risultano configurazioni attive complete per Base o BNB Chain. La portabilità architetturale è presente, ma la readiness per tali chain non è dimostrata.

### 13.2 Cross-chain

Non risultano bridge, messaging layer, share remote, accounting asincrono o recovery di messaggi. Tutte le domande P3 cross-chain restano decisioni future.

## 14. Deployment Arbitrum USDC documentato localmente

Il manifest `scripts/manifests/arbitrum-usdc-poc-1.json` registra:

- chain ID 42161;
- base asset USDC nativo, 6 decimali;
- 22 contratti;
- Aave V3, Euler V2, Morpho e MorphoVault attivi;
- transazioni di deployment, wiring e micro-flow;
- deposito e prelievo reali di piccola entità;
- cicli Aave, Euler e MorphoVault;
- supply finale e pool value finali a zero;
- allowance residue zero;
- rounding loss registrata di 3 unità atomiche USDC;
- automation preflight observe passato e stato `NO_ACTION`.

Il report `reports/verification/arbitrum-usdc-poc-1.json` registra 22/22 contratti verificati sull'explorer e corrispondenza del deployment input.

Queste sono evidenze storiche locali del 14 luglio 2026. Non sostituiscono una lettura live degli owner, parametri, saldi e moduli correnti.

## 15. Frontend

Il repository contiene una dashboard con wallet connection, deposit, withdraw, statistiche e cronologia. Tuttavia il frontend appare riferito al vecchio flusso ETH:

- ABI `deposit()` payable senza parametro;
- messaggi e min deposit espressi in ETH;
- invio di `msg.value` al `LiquidityManager`.

Il contratto corrente richiede invece `deposit(uint256)` ERC-20 con approval. Il frontend non può quindi essere considerato documentazione affidabile del PoC USDC corrente senza refactoring.

Le domande UX su profili, rischio, riserva, fonti APY, incidenti, pending/claimable, ecosistema ufficiale e sandbox restano in gran parte aperte.

## 16. Test e verifiche eseguite in questa analisi

Sono state eseguite:

- compilazione Hardhat: completata con successo;
- suite mirata su LiquidityManager, ParameterManager, EmergencyHandler, TokenManager, InterVault, automazione e share accounting;
- risultato suite mirata: **344 test passanti**.

Comando di riferimento:

```text
npx hardhat test test/unit/LiquidityManager.test.ts test/unit/ParameterManager.test.ts test/unit/EmergencyHandler.test.ts test/unit/TokenManager.test.ts test/unit/metavault/InterVault.bundle.test.ts test/automation/VaultAutomationController.test.ts test/automation/InterVaultAutomation.test.ts test/invariants/ShareAccounting.invariant.test.ts
```

Non è stata eseguita in questa analisi l'intera suite fork/e2e. I test passanti confermano i casi testati, non assenza di vulnerabilità.

## 17. Risposte aggregate al backlog restante

### 17.1 Risk scoring

Il codice implementa cap, reserve, debt-zero, health factor e circuit breaker nell'automazione, ma non implementa:

- scoring pesato smart contract/oracle/governance;
- rating storico;
- aggiornamento automatico del cap da score;
- soglie Conservativo/Bilanciato/Avanzato;
- pubblicazione della motivazione del rating.

Queste restano scelte metodologiche.

### 17.2 Withdrawal queue ERC-7540/7887

Nessuna queue implementata. Non esistono epoche, request ID, pending/claimable, cancellazione o prezzo fissato alla richiesta. Tutte le relative domande restano aperte.

### 17.3 Share come collaterale

Le share sono trasferibili ERC-20, ma non esistono oracle della share, lending market ufficiale, LTV, liquidation threshold o blocco dei loop di lending. InterVault blocca cicli di vault nella propria v1, ma ciò non risolve la collateralizzazione esterna.

### 17.4 Governance

Non implementata oltre a ownership e timelock parametrici. Quorum, voto, delega, snapshot, veto e token separato restano aperti.

### 17.5 Modello economico

Il codice chiarisce soltanto deposit/withdraw fee. Performance fee, management fee, high-water mark, distribuzione ricavi, gas, capitale minimo sostenibile, audit e fondo emergenza non sono determinabili.

### 17.6 Frontend e comunicazione

Il frontend corrente mostra deposito, prelievo, statistiche, APY stimato e cronologia, ma è tecnicamente disallineato e non risponde alle domande di comunicazione del rischio.

### 17.7 Servizi finanziari futuri

Smart account, carta, pagamenti, KYC, restrizioni geografiche, RWA e partner regolamentati non risultano implementati e non possono essere decisi dal codice DeFi corrente.

## 18. Principali discrepanze da risolvere prima di una documentazione “as-built”

Ordine di priorità documentale e tecnica:

1. **ERC-4626 dichiarato ma non implementato.**
2. **Share a 18 decimali senza decimal offset o virtual accounting.**
3. **Donation/inflation protection assente.**
4. **NAV può saltare componenti in errore invece di fallire chiuso.**
5. **EmergencyHandler invoca una funzione assente dal ProxyGeneral concreto.**
6. **Emergency transfer totale contraddice il principio di assenza di destinatari arbitrari.**
7. **Due percorsi emergency parameter con controlli differenti.**
8. **Hard limit di rischio documentati ma non uniformemente applicati on-chain a borrow/leverage.**
9. **Nessun operation ID/nonce on-chain generale.**
10. **Automation PoC observe-only e target-weight, non APY optimizer.**
11. **DepositHelper non supporta withdraw ETH nativo.**
12. **Frontend non compatibile con il deposito ERC-20 corrente.**
13. **InterVault v1 non consente ancora una piramide multilivello.**
14. **Configurazioni operative complete soltanto per Arbitrum.**

Questi punti non significano necessariamente che il codice sia inutilizzabile; significano che la documentazione corrente attribuisce al sistema proprietà più ampie o differenti da quelle verificabili nell'implementazione.

## 19. Cosa il codice non può decidere

Richiedono risposta esplicita del fondatore/team:

- standard target: mantenere accounting custom o migrare a ERC-4626 reale;
- modello anti-inflation e decimal offset;
- policy di fee pubblica;
- profili di rischio e relativi hard limit;
- prima strategia borrowing;
- loss budget accettabile;
- governance e soggetti indipendenti;
- trust model dell'emergency recipient;
- audit, bug bounty e capitale massimo pubblico;
- chain successive e criteri di selezione;
- bridge/messaging;
- collateralizzazione delle share;
- queue e UX asincrona;
- modello economico sostenibile;
- compliance, partner e servizi regolamentati.

## 20. Documenti che possono ora essere prodotti dal repository

Sulla base del codice corrente è possibile produrre con buona affidabilità:

1. Specifica dei flussi deposit/withdraw/allocazione.
2. Diagramma delle chiamate e della custodia.
3. Matrice ruoli e permessi tecnici.
4. Specifica dell'accounting corrente, dichiarandolo non ERC-4626.
5. Specifiche Aave, Euler, Morpho, MorphoVault e InterVault.
6. Specifica del controller di automazione observe/advisory/autonomous.
7. Deployment record Arbitrum USDC.
8. Catalogo delle pause e dei circuit breaker.
9. Matrice requisito–codice–test per il PoC.
10. Registro delle discrepanze tra visione e implementazione.

Per ottenere documentazione completa occorre prima decidere se documentare fedelmente il comportamento corrente oppure modificare il codice affinché rispetti la v0.1. Per i punti critici sopra elencati, scrivere soltanto nuova documentazione senza questa decisione consoliderebbe ambiguità invece di eliminarle.
