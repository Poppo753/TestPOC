# 1 — Motivazioni dei cambiamenti a contratti, interfacce e test

## Scopo e perimetro

Questo documento spiega i problemi emersi durante la validazione completa della
suite, perché i setup precedenti producevano risultati falsi o instabili e quale
comportamento viene ora garantito. La certificazione di riferimento usa un fork
Arbitrum fissato al blocco `483105327`.

Le suite fork/full-cycle dedicate a Dolomite e GMX non fanno parte del perimetro:
i due plugin non sono ancora completi. I test unitari Dolomite basati su mock
esistono e sono separati dai test di integrazione con il protocollo reale.

## 1. Custody e registry nei flow Aave, cross-protocol ed emergency

### Problema originario

`AaveV3Plugin` non lavora soltanto con l'indirizzo dell'Aave Pool. Per risolvere
correttamente una posizione deve conoscere, per ogni underlying:

- indirizzo del token sottostante;
- aToken della reserve;
- variable debt token;
- associazione fra codice logico (`WETH`, `USDC`) e indirizzi Aave.

I vecchi test registravano il plugin nel Beacon ma omettevano
`AaveV3Registry`. Il setup sembrava completo, ma il primo deposito reale
richiedeva dati che non esistevano. In altri casi i fondi erano trasferiti a un
account utente mentre il plugin opera con custody propria: il saldo controllato
dal protocollo e il saldo dal quale Aave eseguiva `transferFrom` non coincidevano.

### Correzione del registry

Nei flow cross-protocol, emergency e benchmark vengono interrogati gli indirizzi
reali della reserve Aave tramite:

- `getReserveAToken(underlying)`;
- `getReserveVariableDebtToken(underlying)`.

Viene quindi deployato `AaveV3Registry`, configurato con
`configureToken(...)` e registrato nel Beacon come `AaveV3Registry`. Questo
rende il test sensibile alla stessa configurazione richiesta in produzione.

### Correzione della custody

Per i test che devono finanziare direttamente il plugin WETH viene usato il
deposito nativo nel contratto WETH dalla prospettiva dell'indirizzo del plugin:

1. `hardhat_setBalance` assegna ETH all'indirizzo del plugin;
2. `hardhat_impersonateAccount` permette di firmare come plugin;
3. viene chiamato `WETH.deposit()` con ETH;
4. l'impersonation viene sempre terminata.

Il WETH nasce così esattamente nell'account che eseguirà l'operazione Aave. Non
si dipende da allowance o trasferimenti laterali non rappresentativi.

### Emergency flow

Il test emergency è stato allineato all'API corrente:

- `activateCircuitBreaker()` al posto del vecchio `tripCircuitBreaker()`;
- `deactivateCircuitBreaker()` al posto del vecchio `resetCircuitBreaker()`.

La posizione viene aperta realmente prima dell'emergenza, viene verificato che
il circuit breaker blocchi nuovi depositi e infine viene ripristinato lo stato.

### Garanzia ottenuta

I test non verificano più un plugin isolato e artificialmente finanziato:
verificano registry, custody, reserve Aave, posizione live, debito e blocco di
emergenza come un unico sistema.

## 2. Share accounting e borrow limit Euler

### Due account possibili per una posizione

Euler EVC può mantenere una posizione:

- sull'account principale del plugin;
- su un sub-account derivato mediante XOR con il `subAccountId`.

Il registry poteva già assegnare un ID a una posizione aperta prima che tutto il
percorso operativo fosse migrato ai sub-account. Assumere sempre il sub-account
portava a leggere zero share e zero debt pur esistendo una posizione reale sul
plugin principale.

### Risoluzione dell'account effettivo

`EulerV2Plugin._getPositionAccount(...)` ora controlla:

- `debtOf(subAccount)` sul borrow vault;
- `balanceOf(subAccount)` sul collateral vault.

Se il sub-account contiene una liability o share reali viene usato; altrimenti
si usa `address(this)`. `addCollateralToPosition` e
`removeCollateralFromPosition` operano quindi sull'account che possiede davvero
la posizione.

### Allowance e chiamate EVC

Per l'account principale viene aumentata l'allowance verso il collateral vault.
Per un sub-account il token viene trasferito al sub-account e l'approve viene
eseguito attraverso `evc.call`. Deposit e withdraw vengono anch'essi inviati con
`evc.call`, preservando i controlli Euler sul proprietario della posizione e
sulla solvibilità.

### Health factor coerente

`EulerLensAdapter` interroga prima il sub-account. Se la query fallisce o non
trova liability, ripete la lettura sull'account principale del plugin. La lens
non restituisce più `MaxUint256` come falso “nessun debito” quando il debito è
semplicemente custodito nell'altro account.

### Registry sincronizzato alla chiusura

`closeLeverageAtomic` ora cerca la posizione attiva corrispondente alla coppia
`collateralVault/borrowVault` e chiude il record. I chiamanti di livello più alto
controllano `isPositionActive(positionId)` prima di chiuderlo di nuovo. Questo
evita sia record fantasma sia double-close.

### Calcolo dell'importo ottenuto

Il vecchio `currentBalance - balBefore` poteva underfloware se una parte del
saldo iniziale veniva consumata durante il close. Il calcolo è ora saturato a
zero quando `currentBalance <= balBefore`.

### Borrow limit

Nei test full-cycle l'importo preso a prestito non è più una costante arbitraria.
È limitato dalla capacità effettiva del vault/mercato e dalla liquidità al blocco
fissato. Le asserzioni controllano share, debt e health factor reali, anziché
presumere che qualunque importo sia disponibile.

## 3. Configurazione market Morpho

### Perché il market ID non può essere implicito

Un mercato Morpho Blue è identificato dai suoi parametri completi:

- loan token;
- collateral token;
- oracle;
- interest-rate model;
- LLTV.

Indicare soltanto `WETH` e `USDC` non identifica un mercato. Il plugin interroga
il registry per ricostruire i parametri e calcolare il market ID; un registry
vuoto produce inevitabilmente “market not configured”.

### Setup corretto

Il full-cycle configura esplicitamente il market WETH/USDC con:

- Morpho Blue Arbitrum;
- oracle del mercato;
- IRM;
- `LLTV = 0.86e18`;
- indirizzi reali WETH e USDC.

Per MetaMorpho/MorphoVault viene prima chiamato `configureVault(vault,
tokenCode)` e soltanto dopo `setDefaultVault(tokenCode, vault)`. Anche
`MorphoVaultLensAdapter` riceve il codice della base asset richiesto dal
costruttore corrente.

### Garanzia ottenuta

Deposit, collateral, borrow/repay dove supportati, lens e withdraw usano un
market/vault realmente risolvibile. Un errore di configurazione fallisce nel
setup e non viene trasformato in uno skip.

## 4. Automatic withdrawal e isolamento dello stato

### Problema della dipendenza da deployment esterni

Alcuni diagnostic e withdrawal test si collegavano a indirizzi di deployment
hardcoded e richiedevano `PRIVATE_KEY`, LP già esistenti e pool già finanziati.
Il risultato dipendeva dallo stato esterno del momento e non era riproducibile.

### Deployment fresco

I test automatic-withdraw ora costruiscono il protocollo necessario nel fork:
Beacon, ProxyGeneral, TokenManager, ValueCalculator, LiquidityManager,
SwapManager, oracle e plugin Uniswap. Il test crea LP, finanzia USDC/WBTC,
consuma intenzionalmente il WETH disponibile e verifica:

- necessità dello swap;
- eventi di automatic swap;
- token effettivamente consumati;
- WETH ricevuto dall'utente;
- burn delle share e stato finale del pool.

### Fallback multi-asset in `LiquidityManager`

`selectTokenForSwap(stillNeeded)` può revertire quando nessun singolo asset
copre tutto il deficit. Questo non significa che il pool non possa pagare: più
asset liquidi, sommati, possono essere sufficienti.

La chiamata è ora protetta con `try/catch`. In caso di mancata selezione singola
si passa al percorso aggregato, che può consumare più token. Non vengono
silenziati errori finali: il withdraw continua a fallire se il valore aggregato
non basta.

### Snapshot di suite e di test

Le suite che avanzano il tempo, aprono posizioni reali o consumano whale usano
`evm_snapshot` e `evm_revert`. A seconda del caso:

- snapshot per test: ogni `it` parte dallo stesso stato;
- snapshot esterno di suite: l'intera suite viene annullata prima della
  successiva.

Questo è stato applicato ai base asset WETH/USDC/USDT, ai cicli Euler/Morpho,
ai multi-user flow, ai borrow/repay e ai flow flash-loan più invasivi.

## 5. Diagnostic test deterministici

### Cosa non andava

I vecchi file `TokenConfigurationDiagnostic`, `PoolValueBreakdown` e
`LPPriceBreakdown` erano script di osservazione mascherati da test:

- leggevano contratti hardcoded;
- stampavano valori senza asserzioni forti;
- potevano passare pur non verificando nulla;
- dipendevano dal contenuto corrente di un pool esterno.

### Nuovo modello

Usano `deployFullProtocolFixture()` con token e oracle deterministici. Il setup
registra base asset, USDC e WBTC, assegna decimali/prezzi noti e crea custody
controllata. Le asserzioni verificano:

- indirizzo, decimali, heartbeat e supporto oracle dei token;
- conversione WETH/USDC/WBTC nella base asset;
- totale pool come somma dei componenti;
- LP price come `totalPoolValue * 1e18 / totalSupply`;
- bootstrap 1:1 in un pool vuoto sano.

## 6. Benchmark migrati dalla vecchia API Beacon

### API precedente

I benchmark chiamavano `setImplementation`, leggevano
`globalFreezeActive` e registravano EOA come implementazioni. Il Beacon corrente
usa `updateImplementation`, espone `globalFreeze()` e richiede bytecode per una
implementazione valida.

### Migrazione

- tutte le registrazioni usano `updateImplementation`;
- per misurare l'update viene deployato un vero `MockBeacon`;
- `ProtocolManager` di test punta a un contratto, non a `owner.address`;
- i costruttori Aave/Euler ricevono tutti gli argomenti correnti;
- i benchmark Aave configurano prima `AaveV3Registry`;
- le soglie gas sono state riallineate alla bytecode reale, mantenendo margini
  espliciti e snapshot anti-regressione.

Non si è “allargato” un limite per far passare un errore: le nuove baseline
misurano l'implementazione attuale e `assertGasSnapshot` continua a fallire oltre
il 5% di regressione.

## 7. Whale stabili e prevenzione della contaminazione

### Perché una whale può rendere un test order-dependent

Su un singolo processo Hardhat fork i trasferimenti modificano lo stato locale.
Se più suite usano la stessa whale senza revert, il suo saldo si riduce. Un test
isolato passa, mentre lo stesso test nella matrice completa può fallire.

### Strategie adottate

1. Per WETH, quando possibile, ogni signer chiama direttamente `WETH.deposit()`
   usando l'ETH locale di Hardhat.
2. Per USDC viene usato un holder con saldo adeguato al blocco fissato.
3. Quando è necessario impersonare una whale, le viene assegnato ETH per il gas
   e l'impersonation viene terminata.
4. Snapshot/revert ripristinano saldi, timestamp, nonce logici e posizioni.
5. I deadline derivano dal timestamp dell'ultimo blocco fork, non da
   `Date.now()`.

## 8. Timeout fork coerenti con i retry RPC

### Distinzione fra timeout applicativo e trasporto

La RPC pubblica può rispondere `429 Too Many Requests`. Il provider effettua
backoff e retry; un hook Mocha da 40 secondi poteva però scadere mentre il
provider stava ancora tentando una lettura valida.

Le suite oracle, performance e invarianti più esposte hanno timeout da 180
secondi; i flow fork complessi arrivano a 300/600 secondi. Le asserzioni non sono
state indebolite: è stato esteso soltanto il tempo concesso al trasporto.

Una RPC privata/stabile resta il requisito corretto per CI. Il timeout più alto
riduce falsi negativi ma non rende affidabile una RPC congestionata.

## 9. Concorrenza e bootstrap iniziale delle share

### Bootstrap scorretto

Il vecchio test inseriva 20 WETH direttamente nella custody quando
`totalSupply == 0`. Il primo depositor diventava proprietario economico anche di
quel valore preesistente, ricevendo share a un prezzo diverso dagli utenti
successivi. Il test arrivava persino ad aspettarsi questo privilegio.

### Bootstrap corretto

La donazione iniziale è stata rimossa. Tre utenti depositano lo stesso importo e
devono ricevere esattamente lo stesso numero di share. Sono verificati:

- `shareUser1 == shareUser2 == shareUser3 == depositAmount`;
- `totalSupply == somma delle share utenti`;
- custody balance uguale alla somma dei depositi;
- nessuna share duplicata o persa;
- consistenza dopo burst e operazioni miste.

### Significato economico

Il test ora difende l'invariante corretto: in un pool vuoto senza valore
pregresso, l'ordine di inclusione non deve cambiare il prezzo di ingresso. Una
donazione a supply zero è invece un caso economico separato che deve essere
gestito esplicitamente dal protocollo, non usato come fixture implicita.

## 10. Principi generali applicati

- Un fallimento di setup non viene convertito in `this.skip()`.
- Un test diagnostico deve avere asserzioni, non soltanto log.
- Il fork è fissato per rendere stabili prezzi, liquidità e indirizzi.
- Le API testate sono quelle correnti dei contratti.
- Registry, Beacon e authorization fanno parte del comportamento, non sono
  dettagli opzionali della fixture.
- Ogni suite invasiva deve lasciare lo stato come lo ha trovato.
- Gli errori RPC vengono distinti dalle failure di logica e verificati con rerun
  completo del file interessato.

