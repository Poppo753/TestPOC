# Visione completa dell'architettura MetaVault gerarchica

## 0. Stato, scopo e autorità del documento

Questo documento definisce la visione architetturale di lungo periodo per
trasformare l'attuale sistema di vault mono-chain e mono-base-asset in una rete
gerarchica di vault componibili, senza introdurre partecipazioni circolari e
senza confondere capitale esterno, quote interne, debito e capitale in transito
fra chain.

È il primo documento fondativo della cartella `metavault`. Non è ancora:

- una checklist di implementazione;
- una specifica Solidity definitiva;
- un'autorizzazione a modificare il POC attualmente deployato;
- una scelta definitiva del bridge o del sistema di messaging;
- una promessa di supporto multi-chain immediato;
- una strategia finanziaria pronta per capitale significativo.

Le decisioni qui marcate come **invariante** devono sopravvivere alle future
revisioni, salvo una motivazione formale e una nuova analisi di rischio. Le
decisioni marcate come **proposta** dovranno essere validate tramite documenti
successivi, threat model, checklist, test e fork rehearsal.

## 1. Sintesi esecutiva

La visione finale è una gerarchia aciclica a livelli. Il capitale può essere
allocato soltanto dal livello superiore al livello immediatamente inferiore;
stato, valore e rischio vengono invece aggregati dal basso verso l'alto.

```text
L2 — Global MetaVault USDC (futuro cross-chain)
 ├── L1 — MetaVault USDC Arbitrum, unico aggregatore locale
 │     ├── L0 — Leaf USDC / Aave
 │     ├── L0 — Leaf ETH / Aave o altro protocollo
 │     └── L0 — Leaf BTC / protocollo autorizzato
 ├── L1 — MetaVault USDC Base, unico aggregatore locale
 └── L1 — MetaVault USDC Ethereum, unico aggregatore locale
```

Per ogni chain esiste **un solo MetaVault locale con base asset USDC**. È
l'unico vault che riceve il bundle InterVault dei Tre Moschettieri e quindi
l'unico autorizzato a comprare quote dei vault foglia locali. I leaf rimangono
mono-asset e mono-strategia; non possiedono il bundle e non possono investire
nel MetaVault, in un peer o in qualunque altro nostro vault.

Il MetaVault USDC può assumere esposizione a leaf USDC, ETH, BTC o ad altri
asset espressamente autorizzati. Per i child con asset diverso da USDC deve
convertire l'asset attraverso una rotta di swap censita, con oracle, slippage,
cap e procedura di uscita. Non può usare borrow nella prima versione.

Il sistema non deve consentire relazioni inverse o circolari. Un vault foglia
non può possedere quote del proprio MetaVault; un MetaVault di chain non può
possedere quote di un proprio antenato o di un peer; un vault globale non può
essere posseduto da un suo discendente.

La prima implementazione realistica sarà molto più piccola della visione
finale: un solo MetaVault USDC Arbitrum, inizialmente collegato a leaf USDC e
poi esteso a un leaf WETH canary. Rimane senza bridge e senza debito; la seconda
estensione a WETH serve a certificare la conversione cross-asset prima di BTC.

## 2. Terminologia

### 2.1 Vault foglia

Vault specializzato in una singola chain, un singolo base asset e una strategia
o famiglia di strategie esterne. Interagisce con protocolli come Aave, Euler o
Morpho attraverso il pattern dei tre moschettieri. Non investe in altri vault
proprietari del sistema.

### 2.2 MetaVault locale di chain

Unico vault aggregatore di una chain. Ha base asset USDC, accetta depositi e
paga riscatti in USDC, mantiene una riserva USDC e distribuisce capitale fra
vault foglia locali anche con base asset differente. Solo questo tipo di vault
possiede il bundle InterVault.

### 2.3 Global MetaVault USDC cross-chain

Vault logico che aggrega i MetaVault USDC locali di chain diverse. È composto
da un hub contabile e da uno o più satelliti operativi. Depositi, prelievi e
riallocazioni possono essere asincroni.

### 2.4 Livelli superiori eventuali

Non vengono progettati ora tre MetaVault locali USDC/ETH/BTC e neppure tre
linee globali obbligatorie. Poiché ogni MetaVault locale USDC è già
multi-asset, il Global MetaVault USDC può aggregarli direttamente. Un ulteriore
livello superiore verrà introdotto soltanto se nasceranno più prodotti globali
realmente distinti; non è un requisito dell'architettura corrente.

### 2.5 Parent, child, ancestor e descendant

- `parent`: vault che possiede quote di un vault al livello immediatamente
  inferiore;
- `child`: vault le cui quote sono detenute dal parent;
- `ancestor`: parent diretto o indiretto;
- `descendant`: child diretto o indiretto.

### 2.6 Quota interna

Token rappresentativo della partecipazione in un altro nostro vault. È un asset
reale per il detentore, ma deve essere eliminato nella contabilità consolidata
dell'intero ecosistema.

### 2.7 Capitale esterno consolidato

Valore degli asset che provengono dall'esterno del sistema, meno debiti esterni,
dopo aver eliminato tutte le partecipazioni fra vault proprietari.

### 2.8 Piramide e DAG

Il termine colloquiale "piramide" descrive soltanto la forma gerarchica. Il
termine tecnico adottato è **Directed Acyclic Graph**, o DAG: un grafo diretto
senza cicli. Non esiste alcun meccanismo economico basato sull'ingresso di nuovi
partecipanti per pagare i precedenti.

## 3. Principi architetturali

### 3.1 Separazione delle responsabilità

Ogni livello risponde a una domanda differente:

| Livello | Domanda primaria |
|---|---|
| L0 | Quale protocollo o strategia usa questo capitale mono-asset? |
| L1 | Come distribuiamo USDC fra asset e strategie della stessa chain? |
| L2 | Come distribuiamo il portafoglio USDC globale fra chain diverse? |
| L3 | Riservato: esiste soltanto se nasceranno più prodotti globali distinti. |

Un contratto che rispondesse contemporaneamente a tutte le domande avrebbe una
superficie di rischio, governance e test eccessiva.

### 3.2 Capitale verso il basso, informazione verso l'alto

```text
allocazione: L2 → L1 → L0 → protocolli esterni
reporting:    protocolli → L0 → L1 → L2
```

Nessun componente inferiore può allocare capitale verso un antenato.

### 3.3 Un solo salto per operazione inter-vault

Un parent può interagire soltanto con child diretti. Non può saltare un livello
e depositare direttamente in un discendente remoto. Questo mantiene leggibili
policy, accounting, autorizzazioni e responsabilità.

### 3.4 Asset dei leaf e unità di conto del parent

Ogni leaf L0 resta omogeneo: un solo base asset canonico, identificato con
chain, contract address, issuer/representation e decimali. Il parent L1 usa
USDC come asset di deposito, riscatto e unità di conto, ma può detenere quote di
leaf con asset differente.

La differenza di asset non viene nascosta. Ogni edge cross-asset dichiara
asset di ingresso, asset del child, oracle, route di conversione, slippage,
exposure cap e unwind route. Il NAV del parent converte in USDC tutte le
posizioni tramite prezzi validi e conservativi.

### 3.5 Nessun debito nei livelli aggregatori iniziali

L1, L2 e L3 non prendono in prestito asset nella prima architettura. Un
eventuale debito è confinato in un vault foglia progettato specificamente per
gestirlo e deve essere visibile look-through a tutti gli antenati.

Questa regola impedisce leva sopra leva e permette di localizzare health factor,
liquidazione e responsabilità dell'unwind.

### 3.6 Fail-closed

Asset sconosciuto, chain non finalizzata, NAV stale, messaggio non riconciliato,
target in pausa, oracle scaduto o grafo non valido bloccano nuove allocazioni.
Non vengono interpretati come valori zero o condizioni temporaneamente sicure.

### 3.7 Governance separata dall'operatività

La Safe approva struttura e limiti; l'automazione opera eventualmente dentro il
recinto approvato. Aggiungere un child, cambiare livello, aumentare un cap,
selezionare un bridge o consentire debito non è un normale rebalance.

### 3.8 Contabilità esplicita e non promozionale

Il sistema deve distinguere sempre:

- NAV del singolo vault;
- gross managed value;
- capitale esterno consolidato;
- debito consolidato;
- capitale cross-chain pending;
- capitale claimable;
- valore stale o soggetto a haircut.

La somma dei NAV di tutti i livelli non viene pubblicizzata come capitale
esterno dell'ecosistema.

### 3.9 Decisione definitiva sulla variante locale

Sono state considerate due strutture.

**Variante A — un MetaVault USDC multi-asset per ogni chain:**

```text
MetaVault USDC Arbitrum
  ├── leaf USDC
  ├── leaf ETH
  └── leaf BTC
```

Questa è la variante scelta. Combina a livello L1 selezione dei protocolli,
scelta degli asset, swap e rischio direzionale, ma lo fa intenzionalmente in un
solo punto governato e osservabile. Il suo base asset e la sua unità di conto
restano USDC.

**Variante B — MetaVault distinti per asset a ogni chain:**

```text
MetaUSDC Arbitrum → leaf USDC Arbitrum
MetaETH Arbitrum  → leaf ETH Arbitrum
MetaBTC Arbitrum  → leaf BTC Arbitrum
```

Questa variante è respinta per l'architettura corrente. Creerebbe più
aggregatori locali quando l'obiettivo è avere un solo decisore di portafoglio
per chain. I leaf ETH e BTC continuano a esistere, ma sono child del MetaVault
USDC e non diventano a loro volta MetaVault.

La regola che rende sicura la variante scelta è di **capability**, non soltanto
documentale: solo il MetaVault USDC riceve InterVaultRegistry,
InterVaultPlugin e InterVaultLensAdapter. I leaf non dispongono delle funzioni
necessarie a comprare quote proprietarie. La direzione L1 → L0 è quindi
possibile; L0 → L1 e L0 → L0 sono impossibili.

## 4. Invarianti strutturali

Le seguenti proprietà devono essere applicate on-chain dove possibile e
ricontrollate off-chain da deployment, preflight e observer.

1. `parent != child`.
2. `parent.level == child.level + 1`.
3. Un edge può essere creato soltanto dalla governance autorizzata.
4. L'aggiunta di un edge non può creare un ciclo.
5. Un vault L0 non può avere child proprietari.
6. Un vault L1 può avere soltanto child L0 sulla stessa chain.
7. Un vault L2 può avere soltanto child L1 USDC autorizzati, uno per chain.
8. Un eventuale L3 non è abilitato finché una specifica futura non ne dimostra
   la necessità e ridefinisce i child ammessi.
9. Ogni child deve avere un manifest verificato e un'identità stabile.
10. Ogni edge deve avere cap individuale e stato operativo.
11. La somma dei target del parent, inclusa la riserva, deve essere 10.000 bps.
12. Nessun livello aggregatore può occultare il debito di un discendente.
13. Un valore remoto stale non può essere usato per mintare quote a prezzo
    ottimistico.
14. Il capitale pending non può essere simultaneamente considerato disponibile
    sulla chain sorgente e investito sulla chain destinazione.
15. Una quota inter-vault non può essere contata anche come token generico dal
    ValueCalculator dello stesso parent.

## 5. Architettura logica completa

```text
Utente USDC
   │
   ▼
L2 Global MetaVault USDC Hub                  contabilità globale
   ├── Satellite Arbitrum
   ├── Satellite Base
   └── Satellite Ethereum
          │
          ▼
L1 unico MetaVault USDC locale
   ├── riserva USDC
   ├── quota Leaf USDC
   ├── quota Leaf ETH
   └── quota Leaf BTC
          │
          ▼
L0 Leaf Vault
   ├── custody
   ├── ProtocolManager
   ├── Plugin
   ├── LensAdapter
   └── Registry
          │
          ▼
Protocollo DeFi esterno
```

Ogni blocco ha accounting e quote proprie. Il consolidamento elimina le quote
interne e conserva soltanto asset e debiti verso soggetti esterni al sistema.

## 6. Livello L0 — vault foglia

### 6.1 Responsabilità

Il vault foglia:

- accetta un solo base asset;
- esegue una strategia locale e chiaramente nominata;
- mantiene custody, riserva e accounting delle proprie quote;
- interagisce con protocolli esterni attraverso moduli autorizzati;
- espone valore, posizione, debito, health e stato operativo;
- supporta chiusura ordinaria ed emergency unwind;
- non conosce né chiama MetaVault parent.

### 6.2 Esempi di identità

```text
leaf/arbitrum/usdc/aave-supply/v1
leaf/arbitrum/usdc/euler-supply/v1
leaf/arbitrum/usdc/morpho-vault/v1
leaf/arbitrum/eth/aave-supply/v1
leaf/base/usdc/aave-supply/v1
```

Nome e simbolo ERC-20 non bastano per identificare un vault. L'identità include
almeno `vaultId`, chain ID, base asset address, manifest hash e versione.

### 6.3 Debito

Un leaf può supportare borrow soltanto se la strategia lo dichiara. In tal caso
deve esportare:

- collateral per asset;
- debt per asset;
- health factor;
- liquidation threshold rilevante;
- costo del debito;
- liquidità necessaria all'unwind;
- stress result configurati;
- massima perdita stimata prima della liquidazione.

Il valore del leaf è sempre netto del debito. Un parent non può sommare asset
lordi del leaf come se il debito non esistesse.

### 6.4 Compatibilità con il sistema corrente

L'attuale `ProxyGeneral` è contemporaneamente custody e token LPT, mentre
`LiquidityManager` espone deposit e withdraw proprietari. Non è necessario
convertire immediatamente tutto il core in ERC-4626: un futuro
`InterVaultPlugin` può adattare le API esistenti, detenere LPT e verificare
shares/assets ricevuti.

Per nuovi vault conviene tuttavia valutare un'interfaccia compatibile con
ERC-4626 o un adapter formale. ERC-4626 standardizza il rapporto tra asset e
quote tramite deposit, mint, withdraw e redeem.

## 7. Livello L1 — unico MetaVault USDC per chain

### 7.1 Scopo

Un L1 risponde a una sola domanda: come distribuire il capitale conferito in
USDC fra asset e strategie locali della stessa chain?

Esempio:

```text
MetaUSDC Arbitrum
  15% riserva USDC
  35% Leaf USDC
  30% Leaf WETH
  20% Leaf WBTC
```

Ogni leaf può a sua volta usare Aave, Euler, Morpho o un'altra strategia, ma
non può comprare quote di altri vault. Il nome `MetaUSDC` identifica il token
di ingresso/uscita e l'unità di conto, non l'obbligo di restare esposto al 100%
a USDC.

### 7.2 Proprietà

- stesso chain ID di tutti i child;
- base asset del parent sempre USDC;
- child L0 mono-asset con asset esplicitamente censito;
- depositi e riscatti sincroni quando la liquidità lo consente;
- nessun bridge;
- swap cross-asset solo attraverso route e limiti censiti;
- nessun borrow nel MetaVault;
- nessun bundle InterVault installato sui leaf;
- target e cap distinti;
- cap sia per child sia per asset economico aggregato;
- unwind dei child secondo una exit priority esplicita;
- riserva minima non investita.

### 7.3 Rebalance

Il rebalance L1 segue una sequenza withdraw-first:

1. osservare child, riserva e stato;
2. calcolare NAV di ogni child convertito in USDC tramite oracle valido;
3. identificare eccessi e deficit;
4. prelevare dagli eccessi;
5. verificare capitale effettivamente rientrato;
6. eseguire gli swap necessari entro slippage e price-deviation limit;
7. depositare nei deficit e verificare le quote child ricevute;
8. riosservare e verificare target, cap e riserva;
9. registrare swap, quote, prezzi e ciclo nel journal.

Il planner non presume che `previewWithdraw` equivalga a liquidità disponibile.
Ogni child deve esporre limiti e stato di uscita.

### 7.4 Prelievi utenti

Un prelievo usa nell'ordine:

1. riserva liquida L1;
2. child più liquido e meno costoso da chiudere;
3. altri child secondo exit priority;
4. conversione dell'asset riscattato verso USDC con `minAmountOut`;
5. eventuale coda se non è sicuro completare atomicamente.

Un'uscita non deve forzare una perdita non limitata pur di restare sincrona.

## 8. Livello L2 — Global MetaVault USDC cross-chain

### 8.1 Un solo vault logico, più componenti fisici

Il Global USDC MetaVault è un'unica entità economica, ma non un singolo
contratto capace di chiamare atomicamente tutte le chain.

Proposta hub-and-spoke:

```text
Global USDC Hub
  ├── USDC Satellite Arbitrum → MetaUSDC Arbitrum
  ├── USDC Satellite Base     → MetaUSDC Base
  └── USDC Satellite Ethereum → MetaUSDC Ethereum
```

L'hub:

- emette le quote globali;
- mantiene contabilità e richieste;
- decide target per chain;
- verifica report remoti;
- controlla nonce, replay, finalità e staleness;
- gestisce pending, claimable e claimed;
- può mettere in quarantena un satellite.

Il satellite:

- custodisce asset sulla propria chain;
- interagisce soltanto con il MetaVault L1 locale autorizzato;
- applica cap e selector locali;
- invia report firmati/verificati al hub;
- non può cambiare governance o target globali;
- dispone di un emergency stop locale.

### 8.2 Asincronia

Il cross-chain non deve fingere atomicità. Il ciclo minimo è:

```text
REQUESTED
  → SOURCE_CONFIRMED
  → MESSAGE_IN_FLIGHT
  → DESTINATION_CONFIRMED
  → ACCOUNTED
  → CLAIMABLE
  → CLAIMED
```

Depositi o riscatti che dipendono da una chain remota devono poter rimanere
pending. ERC-7540 formalizza request asincrone con stati Pending, Claimable e
Claimed ed è un riferimento utile per la futura interfaccia.

### 8.3 Asset in transito

Durante un trasferimento, il capitale è registrato in una categoria separata:

```text
pendingOutbound
pendingBridge
pendingInbound
confirmedRemote
claimable
```

La stessa quantità non può comparire contemporaneamente in due categorie
spendibili. Un messaggio ricevuto senza prova del movimento asset, o asset
ricevuti senza messaggio riconciliato, producono quarantena e intervento.

### 8.4 NAV remoto

Ogni report remoto contiene almeno:

- chain ID;
- satellite ID;
- asset address;
- block number e block hash/finality reference;
- timestamp;
- liquidità;
- quote L1 detenute;
- NAV netto;
- debito look-through;
- stato pause/circuit breaker;
- sequence number;
- config hash.

Un report stale viene escluso dalle nuove allocazioni. Per mint e redeem può
essere applicato un haircut conservativo oppure il flusso può essere bloccato.

## 9. Perché non servono tre MetaVault locali o tre globali per asset

### 9.1 Identità economica scelta

Il MetaVault locale riceve e paga USDC, ma assume esposizione deliberata a quote
di leaf USDC, ETH e BTC. È quindi un portafoglio multi-asset denominato in USDC,
non un semplice vault di rendimento stablecoin. La scelta degli asset avviene
già nel solo L1 autorizzato.

Esempio:

```text
50% leaf USDC locali
30% leaf ETH locali
15% leaf BTC locali
 5% riserva USDC
```

### 9.2 Responsabilità

- allocazione strategica fra asset e leaf locali;
- swap e limiti di slippage;
- oracle cross-asset;
- esposizione e volatilità;
- riserva USDC;
- tracking del costo medio;
- policy di rebalance meno frequente;
- reporting del contributo di ogni asset a rendimento e rischio.

### 9.3 Cosa non deve fare il livello globale

Il futuro L2 globale non seleziona direttamente Aave, Euler o un singolo leaf.
Seleziona soltanto il MetaVault USDC autorizzato di ogni chain; è il MetaVault
locale a scegliere i propri leaf. L2 non salta la gerarchia.

### 9.4 Debito

Il MetaVault locale e quello globale non usano borrow nella prima architettura.
Comprare ETH o BTC significa effettuare uno swap finanziato da USDC, non
collateralizzare USDC per prendere in prestito l'asset. Strategie con debito
richiederebbero un prodotto separato e una nuova analisi di liquidazione
consolidata.

### 9.5 Conseguenza sulla gerarchia

Non vengono creati `MetaETH` e `MetaBTC`. ETH e BTC sono asset dei leaf, non
base asset di aggregatori paralleli. Se in futuro più prodotti globali distinti
rendessero utile un ulteriore MetaVault dei MetaVault, quel livello richiederà
una nuova decisione architetturale; oggi aggiungerlo sarebbe ridondante.

## 10. Il pattern dei tre moschettieri nei MetaVault

La regola esistente resta valida: ogni nuovo dominio operativo ha una mappa, un
braccio e degli occhi.

### 10.1 InterVaultRegistry — la mappa locale

Responsabilità:

- censire esclusivamente child L0 autorizzati sulla stessa chain;
- verificare livello, chain, base asset del child e conversion policy da USDC;
- memorizzare manifest hash e versione;
- gestire active state, cap, target eligibility ed exit priority;
- impedire self-reference e cicli;
- esporre enumerazione deterministica;
- distinguere approved, paused, deprecated e emergency-only.

### 10.2 InterVaultPlugin — il braccio locale

Responsabilità:

- ricevere dalla custody parent l'asset esatto richiesto dal child;
- approvare importi esatti al child;
- depositare e detenere quote child;
- calcolare e verificare un minimo conservativo di quote ricevute;
- verificare un minimo conservativo di asset riscattati;
- restituire asset alla custody parent;
- azzerare allowance residue;
- emettere eventi completi;
- supportare exit di uno o tutti i child senza chiamate arbitrarie.

Il plugin non decide target e non aggiorna il Registry.

### 10.3 InterVaultLensAdapter — gli occhi locali

Responsabilità:

- leggere quote detenute per child;
- convertirle in asset base;
- leggere liquidità riscattabile;
- aggregare NAV netto;
- propagare debito e health look-through;
- esporre stato e staleness;
- evitare doppio conteggio nel ValueCalculator;
- fornire breakdown per automazione e UI.

### 10.3.1 Decisione di deployment: il bundle esiste soltanto sul MetaVault

I Tre Moschettieri InterVault sono tre componenti di un unico dominio, non tre
plugin esecutivi equivalenti:

1. `InterVaultRegistry`: configurazione e policy;
2. `InterVaultPlugin`: esecuzione e custodia delle quote child;
3. `InterVaultLensAdapter`: lettura, valutazione e reporting.

Il bundle viene deployato e registrato **solo** nel Beacon del MetaVault USDC
locale. I vault foglia non ricevono questi alias, non registrano il protocollo
`INTER_VAULT` nel proprio `ProtocolManager` e non autorizzano alcun modulo a
comprare quote proprietarie. La sola presenza di un `SwapManager` in un leaf
non basta a creare un edge: può cambiare token per le esigenze interne del
leaf, ma non può chiamare il LiquidityManager di un altro vault.

Questa separazione realizza on-chain la direzione:

```text
MetaVault USDC L1  ── può possedere ──>  Leaf L0
Leaf L0            ── non può possedere ──> MetaVault o altri leaf
```

### 10.3.2 Perimetro della prima implementazione

La prima implementazione dei Tre Moschettieri deve supportare:

- una sola chain;
- un solo parent L1 con base asset USDC;
- più child L0 locali;
- child con base USDC in prima milestone;
- un child WETH canary nella milestone cross-asset;
- quote child detenute esclusivamente dall'`InterVaultPlugin` del parent;
- deposito, riscatto, lettura NAV, cap, pause ed emergency exit;
- nessun bridge, borrow, flash loan, target L1 o calldata arbitraria.

WBTC viene aggiunto soltanto dopo la certificazione completa del percorso
WETH, perché introduce anche rischio specifico della rappresentazione BTC.

### 10.3.3 File previsti

```text
contracts/interfaces/metavault/IInterVaultRegistry.sol
contracts/interfaces/metavault/IInterVaultPlugin.sol
contracts/interfaces/metavault/IInterVaultLensAdapter.sol
contracts/metavault/InterVaultRegistry.sol
contracts/plugins/InterVaultPlugin.sol
contracts/adapters/InterVaultLensAdapter.sol
contracts/mocks/metavault/MockLeafVault.sol
test/unit/metavault/
test/integration/metavault/
test/security/metavault/
test/e2e/metavault/
scripts/deployment/metavault/
scripts/config/metavault/
```

Non è corretto chiamare tutti e tre i contratti "plugin": il Plugin è il
braccio; Registry e Lens non devono poter muovere fondi.

### 10.3.4 Struttura dati del Registry

Ogni child è identificato da un `bytes32 childId`, non dal simbolo della quota.
Il record minimo proposto è:

```solidity
struct ChildVault {
    bytes32 childId;
    address beacon;
    address liquidityManager;
    address proxyGeneral;       // custody e share token del child corrente
    address valueCalculator;
    address baseAsset;
    bytes32 assetId;            // identità economica canonica
    bytes32 manifestHash;
    uint8 assetDecimals;
    uint8 level;                // deve essere L0
    uint16 maxExposureBps;
    uint16 exitPriority;
    bool active;
    bool depositsEnabled;
    bool withdrawalsEnabled;
    bool emergencyOnly;
}
```

Per i child cross-asset il Registry associa inoltre una `ConversionPolicy`:

```solidity
struct ConversionPolicy {
    string parentTokenCode;     // USDC
    string childTokenCode;      // WETH, WBTC, ...
    address oracleAdapter;
    bytes32 routeId;            // route censita nel sistema swap
    uint16 maxSlippageBps;
    uint16 maxOracleDeviationBps;
    uint32 maxPriceAge;
    uint128 maxSingleTradeUSDC;
    bool entryEnabled;
    bool exitEnabled;
}
```

Il Registry non contiene fondi, non esegue swap e non chiama child. Conserva
soltanto identità, limiti e stato approvati dalla Safe.

### 10.3.5 Validazioni di registrazione di un child

`registerChild` deve fallire se almeno una delle condizioni seguenti non è
rispettata:

- indirizzi nulli o senza bytecode;
- `childId` o indirizzo già censito;
- chain diversa da `block.chainid`;
- livello diverso da L0;
- child uguale al parent;
- componenti dichiarati diversi da quelli risolti dal Beacon del child;
- `proxyGeneral` diverso dal token quota effettivamente mintato dal child;
- base asset o decimali differenti dal manifest;
- hash manifest assente o non approvato;
- exposure cap superiore a 10.000 bps;
- asset cross-asset senza oracle e conversion policy completa;
- route di entrata senza corrispondente possibilità di uscita;
- leaf che espone a sua volta il bundle InterVault.

L'ultimo controllo rende la profondità massima pari a uno nella prima versione
e impedisce che un presunto leaf sia in realtà un altro aggregatore.

### 10.3.6 Lifecycle e access control del Registry

Solo la Safe owner può:

- registrare un child;
- cambiare cap e limiti di conversione;
- abilitare nuovi depositi;
- deprecare o rimuovere un child;
- sostituire manifest, oracle o route.

L'automazione può al massimo ridurre rischio: mettere in pausa nuovi ingressi o
proporre una riduzione del cap. Non può aggiungere un child, aumentare un cap o
riabilitare autonomamente una route.

Un child viene rimosso soltanto quando le quote detenute dal Plugin sono zero e
non esistono operazioni pending. Se mantiene un saldo, può essere `paused` o
`deprecated`, ma il Lens continua obbligatoriamente a valutarlo.

Eventi minimi:

```text
ChildRegistered
ChildStatusChanged
ChildLimitsUpdated
ChildDeprecated
ChildRemoved
ConversionPolicyUpdated
```

### 10.3.7 API standard dell'InterVaultPlugin

La superficie canonica verso il core resta esattamente `IProtocolAdapter`:

```solidity
deposit(tokenCode, amount)
withdraw(tokenCode, amount)
getBalance(tokenCode)
getTotalValue()
closePositionsForBaseAsset(amountNeeded)
emergencyWithdrawAll(tokenCodes)
```

Il `tokenCode` è un codice asset reale, non un child ID mascherato. Il Registry
mantiene `defaultChildByTokenCode`: nella prima versione può esistere un solo
child canonico abilitato all'ingresso per `USDC`, uno per `WETH` e uno per
`WBTC`. Il Plugin risolve internamente il child e applica la policy. È lo stesso
schema già usato da `MorphoVaultPlugin`, che risolve
`getDefaultVault(tokenCode)` senza modificare il `ProtocolManager`.

Non esiste una funzione con target address o calldata arbitrari. Le funzioni
normali sono chiamabili soltanto dal `ProtocolManager` del MetaVault; quelle
emergency hanno ruoli separati e non possono inviare fondi a un destinatario
scelto dal caller. Funzioni interne come `_depositIntoChild` e
`_redeemFromChild` possono usare `childId`, ma non ampliano l'API del core.

La fonte di verità delle quote è
`IERC20(child.proxyGeneral).balanceOf(address(InterVaultPlugin))`, non un
contatore interno modificabile. Un array di child attivi può essere mantenuto
solo per enumerazione e deve rimuovere il child quando il saldo torna a zero.

### 10.3.7.1 Dove vengono custodite le quote

Le quote del child vengono detenute dall'`InterVaultPlugin`, non dal
`ProtocolManager` e non dalla `ProxyGeneral` parent. Questo replica il modello
degli adapter esistenti:

- Aave accredita gli aToken al relativo Plugin;
- Euler minta le share eVault al relativo Plugin;
- Morpho registra la posizione usando il Plugin come account;
- Morpho Vault minta le share ERC-4626 al relativo Plugin.

La `ProxyGeneral` custodisce gli asset liquidi del vault e rappresenta le quote
utente del vault stesso; il Plugin custodisce o rappresenta la posizione nel
dominio esterno che gestisce. Il Lens legge la posizione sul Plugin e il
Registry conserva soltanto configurazione. In uscita il Plugin riscatta le
quote e restituisce l'underlying alla `ProxyGeneral` parent.

### 10.3.8 Deposito same-asset: USDC parent verso leaf USDC

Il percorso atomico è:

```text
owner/executor autorizzato
  → ProtocolManager.deposit("InterVault", "USDC", amount)
  → trasferisce USDC dalla ProxyGeneral parent al Plugin
  → Plugin risolve il child USDC canonico nel Registry
  → approval esatta al LiquidityManager child
  → LiquidityManager child.deposit(assets)
  → child minta LPT all'InterVaultPlugin
  → Plugin verifica le share contro preview e limiti configurati
  → Plugin azzera l'allowance residua
```

Il Plugin confronta i balance prima e dopo; non si fida unicamente del valore
di ritorno. Se cap, pause, quantità ricevuta o allowance cleanup non sono
coerenti, l'intera transazione reverte.

### 10.3.9 Deposito cross-asset: USDC parent verso leaf WETH/WBTC

L'`InterVaultPlugin` non deve contenere un DEX router generico. La conversione
usa il `SwapManager` già dedicato del MetaVault e una route autorizzata. Il
percorso logico è:

```text
USDC nella ProxyGeneral parent
  → verifica oracle, price age, cap e max trade
  → SwapManager parent: USDC → asset del child
  → asset ricevuto resta nella ProxyGeneral parent
  → ProtocolManager tipizzato lo trasferisce all'InterVaultPlugin
  → InterVaultPlugin deposita nel child indicato
  → quote child restano nell'InterVaultPlugin
```

La prima versione può eseguire swap e deposito in due transazioni controllate:
l'asset intermedio rimane nella custody parent e viene rilevato dall'observer.
Una futura facade atomica può coordinare i due manager, ma non deve duplicare la
logica di swap dentro il Plugin.

Lo swap riceve `minAssetOut` e `deadline`. Il successivo deposito usa le policy
on-chain del Registry per calcolare il minimo di share accettabile, perché
l'interfaccia core standard non riceve `minSharesOut`. L'oracle serve da limite
indipendente: una quote del router da sola non basta.

### 10.3.10 Riscatto e ritorno a USDC

Il percorso inverso è:

```text
InterVaultPlugin
  → riscatta LPT dal LiquidityManager child
  → riceve l'asset base del child
  → lo trasferisce alla ProxyGeneral parent
  → se l'asset non è USDC, SwapManager esegue asset → USDC
  → verifica minUSDCOut, oracle deviation, riserva e cap
```

Il riscatto delle quote e lo swap possono inizialmente essere due transazioni.
Un fallimento dello swap non perde capitale: WETH/WBTC resta nella custody del
MetaVault e la posizione viene marcata `pendingConversion`, non come USDC
disponibile. L'automazione non può ignorare questo stato.

### 10.3.11 Compatibilità completa con il ProtocolManager esistente

Il core non viene modificato. I tre parametri esistenti hanno già tutte le
responsabilità necessarie:

```text
protocolName = quale famiglia operativa usare: "InterVault"
tokenCode    = quale asset reale e quindi quale leaf canonico: USDC/WETH/WBTC
amount       = quanti asset trasferire o riscattare
```

Il flusso resta quello standard: il `ProtocolManager` trasferisce al Plugin
solo l'importo esatto dalla `ProxyGeneral`, quindi chiama
`deposit(tokenCode, amount)`. In withdraw il Plugin riscatta dal child risolto
e restituisce l'asset alla `ProxyGeneral`.

Questa scelta è corretta finché vale l'invariante **un solo leaf di ingresso
canonico per tokenCode per MetaVault**. Il Registry può censire configurazioni
storiche o deprecated, ma non due destinazioni di deposito simultaneamente
attive per lo stesso codice.

Se un giorno servissero due leaf WETH concorrenti, non si modifica
automaticamente il core. Le alternative da riesaminare saranno:

1. registrare due integrazioni/plugin distinti con `protocolName` differenti e
   ciascuno vincolato a un solo child;
2. usare un allocator esterno che scelga fra strategie senza cambiare l'ABI
   comune;
3. soltanto come ultima opzione, proporre una nuova versione del core dopo una
   specifica e una migrazione formali.

Non si deve codificare il child dentro falsi token code, cambiare un default
immediatamente prima del deposito o usare stato temporaneo `nextTarget`: queste
soluzioni introdurrebbero ambiguità e race condition.

In particolare, alias come `ETH1` e `ETH2` associati entrambi all'indirizzo
WETH non sono adottati. Il `ProtocolManager` passa il codice alla
`ProxyGeneral` prima di chiamare il Plugin; la `ProxyGeneral` lo risolve come
token reale tramite `TokenManager`. Registrare alias richiederebbe anche oracle
compatibili con i nomi artificiali e farebbe enumerare più volte lo stesso
saldo al `ValueCalculator`, con rischio di doppio conteggio. Per l'asset base
USDC l'alias è inoltre incompatibile con l'esclusione che impedisce di
registrare nel `TokenManager` l'indirizzo già configurato come `BASE_ASSET`.

Se esistono due leaf con lo stesso underlying, la soluzione core-compatible è:

```text
ProtocolManager.deposit("InterVaultWETH1", "WETH", amount)
ProtocolManager.deposit("InterVaultWETH2", "WETH", amount)
```

`InterVaultWETH1` e `InterVaultWETH2` risolvono due istanze Plugin leggere,
ciascuna vincolata nel Registry a un solo `childId`; il codice `WETH` continua
a indicare il vero asset trasferito. Il Registry può essere condiviso, mentre
Plugin e Lens devono mantenere accounting non sovrapposto per evitare che la
stessa posizione venga aggregata due volte.

### 10.3.12 Requisiti di sicurezza del Plugin

- `nonReentrant` su ogni movimento;
- allowance zero → importo esatto → zero;
- nessun `approve(type(uint256).max)`;
- nessun recipient fornito dal caller;
- nessuna external call a indirizzi non censiti;
- delta balance prima/dopo su asset e share;
- minimi calcolati on-chain da preview/oracle e deadline obbligatoria per gli
  swap;
- cap child e cap asset controllati prima dell'ingresso;
- circuit breaker globale e per child;
- deposito disabilitato se Lens/oracle è stale;
- uscita consentita anche da child deprecated, salvo impossibilità tecnica;
- rescue limitato a token estranei, mai alle quote child contabilizzate;
- eventi con child ID, asset, quantità, quote e caller.

### 10.3.13 Valutazione del Lens in USDC

Per ogni child il Lens legge:

```text
sharesOwned = childShare.balanceOf(InterVaultPlugin)
childNAV    = child.ValueCalculator.getTotalPoolValueView()
childSupply = child.ProxyGeneral.totalSupply()
assetValue  = sharesOwned × childNAV / childSupply
usdcValue   = oracle(assetValue, childAsset → USDC)
```

Se `sharesOwned == 0`, il valore è zero. Se le quote sono positive ma supply,
oracle o manifest sono incoerenti, la lettura fallisce chiusa: non restituisce
zero, perché ciò sottostimerebbe il NAV del parent e permetterebbe mint
ingiusto. Il Lens usa `mulDiv` full-precision e regole esplicite di rounding.

Il breakdown per child espone almeno:

- quote possedute;
- asset sottostante lordo e netto;
- valore USDC;
- liquidità riscattabile conservativa;
- esposizione in bps;
- prezzo, timestamp e staleness;
- stato deposit/withdraw/emergency;
- debito e health look-through del leaf;
- eventuale asset `pendingConversion` nella custody parent.

### 10.3.14 Integrazione con ValueCalculator

Le quote child non devono essere registrate anche come normale token liquido
del parent, altrimenti verrebbero contate due volte. Il `ValueCalculator` del
MetaVault include il totale fornito dall'InterVaultLensAdapter una sola volta.

Per questo dominio, un errore Lens non può essere catturato e trasformato in
"protocollo da saltare": con share reali, saltarlo significherebbe NAV
artificialmente basso. La policy deve distinguere plugin esterni opzionali da
posizioni inter-vault contabilmente critiche e bloccare mint/redeem quando la
valutazione critica non è disponibile.

### 10.3.15 Errori custom ed eventi minimi

Errori rappresentativi:

```text
ChildNotFound
ChildInactive
DepositsDisabled
WithdrawalsDisabled
InvalidChildLevel
InvalidManifest
BaseAssetMismatch
ConversionPolicyMissing
OracleStale
PriceDeviationExceeded
ExposureCapExceeded
InsufficientSharesOut
InsufficientAssetsOut
ResidualAllowance
UnauthorizedCaller
ChildStillHasBalance
CriticalValuationUnavailable
```

Eventi esecutivi:

```text
ChildDepositStarted / ChildDeposited
ChildRedeemStarted / ChildRedeemed
ChildEmergencyRedeemed
ActiveChildAdded / ActiveChildRemoved
PendingConversionCreated / PendingConversionSettled
CircuitBreakerChanged
```

### 10.3.16 Suite minima obbligatoria

**Registry unit test:** registrazione valida, duplicati, indirizzi senza code,
manifest incoerente, child non L0, leaf con bundle InterVault, cap invalidi,
conversion policy incompleta, pause/deprecate/remove con saldo.

**Plugin unit test:** deposit/redeem, share e balance delta, rounding, dust,
allowance cleanup, reentrancy, child malevolo, min-out, caller non autorizzato,
destinazione non arbitraria, active list e full unwind.

**Lens unit test:** conversione USDC e WETH, decimali 6/8/18, supply zero,
oracle stale, prezzo anomalo, child deprecated con saldo, debito/health
look-through, pending conversion e assenza di doppio conteggio.

**Integration test:** MetaVault → ProtocolManager → Plugin → LiquidityManager
child → LPT, quindi percorso inverso fino alla custody parent. Devono essere
provati sia child USDC sia WETH con SwapManager.

**Security/invariant test:** nessun edge inverso, nessun leaf capace di chiamare
InterVault, capitale non creato dalla composizione, consolidated NAV invariato
da un deposito interno salvo costi reali, cap sempre rispettati, nessuna quota
persa e nessuna allowance residua.

**Fork test:** router/oracle reali, leaf reali, blocco fissato, whale stabile,
snapshot/revert, slippage reale, partial liquidity, emergency unwind e ritorno
finale a USDC entro tolleranza documentata.

### 10.3.17 Ordine di implementazione consentito ora

1. congelare interfacce e `VaultDescriptor`;
2. creare mock di leaf USDC e WETH;
3. implementare Registry e relativi test;
4. implementare Plugin same-asset e relativi test;
5. implementare Lens e contabilità critica;
6. provare l'integrazione attraverso l'API invariata del ProtocolManager;
7. integrare ValueCalculator senza doppio conteggio;
8. integrare SwapManager per WETH con due-step custody-safe;
9. completare unit, integration, security, invariant ed E2E locali;
10. eseguire fork deterministico;
11. creare script e manifest di deployment;
12. soltanto dopo, proposta Safe e canary separato dal POC in observe.

Questo è il primo blocco MetaVault concretamente implementabile adesso. Non è
però composto soltanto da tre file Solidity: per essere reale richiede anche
interfacce, integrazione con il routing esistente, accounting critico, mock,
test e script. Non è
ancora il momento di implementare bridge, Global MetaVault, debito, L3 o di
modificare il deployment POC attualmente sotto osservazione.

### 10.4 CrossChainRegistry — la mappa globale

Responsabilità aggiuntive:

- chain e domain ID supportati;
- hub e satellite autorizzati;
- router/messaging adapter;
- token pool o bridge autorizzato;
- asset canonico e representation per chain;
- finality policy;
- cap per chain, bridge e messaggi pending;
- timeout, quarantine e recovery policy.

### 10.5 CrossChainAllocatorPlugin — il braccio globale

Non espone calldata generica. Crea richieste tipizzate, usa nonce monotoni,
verifica destinazione e importo, limita fee e registra lo stato della richiesta.
La ricezione sul satellite è idempotente e replay-protected.

### 10.6 CrossChainLensAdapter — gli occhi globali

Aggrega report confermati, capitale pending e stato dei satelliti. Non presenta
un valore remoto come corrente se supera la soglia di staleness.

## 11. Censimento canonico dei vault

### 11.1 Perché serve

Indirizzo e simbolo non sono un'identità sufficiente. Più `ProxyGeneral`
possono chiamarsi `LP Token` e usare il simbolo `LPT`; inoltre lo stesso nome di
asset può indicare token differenti su chain differenti.

Il censimento canonico è la fonte autorevole per stabilire che cosa rappresenta
un vault e dove si colloca nel DAG.

### 11.2 Modello concettuale `VaultDescriptor`

```text
VaultDescriptor
  vaultId
  version
  level
  chainId
  baseAssetId
  baseAssetAddress
  baseAssetDecimals
  shareToken
  beacon
  liquidityManager
  proxyGeneral
  valueCalculator
  protocolManager
  emergencyHandler
  manifestHash
  deploymentBlock
  governance
  status
  debtPolicy
  accountingMode
```

Gli indirizzi non applicabili a un livello devono essere esplicitamente nulli o
assenti secondo schema, non valorizzati con placeholder.

### 11.3 Modello concettuale `VaultEdge`

```text
VaultEdge
  parentVaultId
  childVaultId
  enabled
  targetBps
  maximumExposureBps
  minimumLiquidityBps
  exitPriority
  maximumStalenessSeconds
  depositEnabled
  withdrawEnabled
  emergencyOnly
  approvedAt
  approvedBy
```

Un edge è una policy economica e di sicurezza, non soltanto un collegamento
tecnico.

### 11.4 Registrazione

La registrazione deve:

1. caricare il manifest verificato;
2. controllare bytecode a ogni indirizzo;
3. verificare chain ID;
4. confrontare base asset e decimali;
5. leggere relazioni Beacon/moduli;
6. verificare owner e stato pause;
7. verificare livello child;
8. simulare l'aggiunta dell'edge;
9. dimostrare assenza di ciclo;
10. registrare manifest hash e deployment block;
11. richiedere approvazione Safe;
12. emettere evento indicizzabile.

### 11.5 Stati lifecycle

```text
CANDIDATE
  → VERIFIED
  → ACTIVE
  → PAUSED
  → DEPRECATED
  → EMERGENCY_ONLY
  → REMOVED_AFTER_ZERO_BALANCE
```

Un child con quote ancora detenute non può essere eliminato dal censimento. Può
essere disattivato per nuovi depositi e mantenuto per osservazione e uscita.

## 12. Identità canonica degli asset

### 12.1 `AssetId`

Proposta:

```text
AssetId
  economicCode       // USDC, ETH, BTC
  chainId
  tokenAddress
  decimals
  issuerOrOrigin
  representationType // native, wrapped, canonical-bridged, third-party-bridged
  originChain
  riskClass
```

### 12.2 USDC

USDC nativo e una rappresentazione bridged non sono automaticamente
intercambiabili. La policy cross-chain specifica quale contratto è ammesso su
ogni chain e quale meccanismo effettua burn/mint o lock/mint.

### 12.3 ETH

ETH nativo e WETH sono economicamente correlati ma operativamente distinti. Il
vault dichiara se il proprio asset è ETH nativo o WETH ERC-20 e quale gateway è
autorizzato.

### 12.4 BTC

Ogni rappresentazione BTC introduce rischio di custodian, bridge o protocollo.
Il simbolo WBTC, tBTC o BTC non viene astratto senza una risk policy specifica.

## 13. Contabilità e valorizzazione

### 13.1 NAV individuale

Per un vault `v`:

```text
NAV(v) = liquidAssets(v)
       + externalProtocolNetValue(v)
       + childShareNetValue(v)
       + confirmedReceivables(v)
       - externalDebt(v)
       - accruedFees(v)
       - recognizedLosses(v)
```

Il valore di una quota è:

```text
sharePrice(v) = NAV(v) / totalSupply(v)
```

con normalizzazione rigorosa dei decimali e regole definite per bootstrap,
rounding e supply zero.

### 13.2 Gross managed value

Somma dei NAV o degli asset gestiti a ogni livello, utile per misurare il carico
operativo ma non il capitale esterno:

```text
GMV = Σ NAV(vault)
```

GMV contiene le partecipazioni interne più volte.

### 13.3 Capitale esterno consolidato

```text
ConsolidatedExternalNAV
  = Σ externalAssets
  - Σ externalDebt
  - Σ externalLossesAndFees
```

Le quote emesse da un nostro vault e detenute da un altro nostro vault vengono
eliminate insieme alla relativa partecipazione interna.

Esempio puramente contabile:

```text
L2 NAV: 95
L1 NAV: 90
L0 NAV: 85
GMV:    270
capitale esterno: non 270, ma il valore netto immesso dall'esterno
```

### 13.4 Capitale cross-chain pending

Il capitale pending non riceve automaticamente valore pieno. La policy può:

- bloccare mint/redeem fino alla conferma;
- applicare haircut;
- usare ultimo valore confermato con limite temporale;
- mantenere una riserva che assorba richieste ordinarie.

La scelta deve essere esplicita per ogni flusso e non modificabile dal worker.

### 13.5 Debito look-through

Ogni livello aggrega il debito dei discendenti senza duplicarlo:

```text
lookThroughDebt(parent)
  = directDebt(parent)
  + Σ ownershipFraction(child) × lookThroughDebt(child)
```

Metriche minime:

- debito totale per asset;
- debito / capitale esterno;
- worst health factor;
- collateral e debt concentration;
- liquidation distance sotto shock;
- costo del debito e interest coverage.

### 13.6 Evitare ricorsione

Il DAG rende possibile una valutazione topologica:

```text
prima L0
poi L1
poi L2
```

Nessun LensAdapter deve entrare in un parent mentre ne sta calcolando un child.
Un eventuale ciclo rilevato dal preflight blocca il sistema prima della lettura
economica.

### 13.7 Doppio conteggio nel ValueCalculator

Le quote child detenute dall'`InterVaultPlugin` vengono valutate dal relativo
LensAdapter. Non devono contemporaneamente essere aggiunte come token ERC-20
generico dal `TokenManager`.

## 14. Flussi operativi locali

### 14.1 Deposito utente in L1

```text
utente
  → trasferisce base asset
  → L1 calcola e minta quote
  → mantiene la quota di riserva
  → il controller osserva
  → un rebalance separato alloca ai child
```

Il deposito utente non deve obbligatoriamente eseguire un intero rebalance
multi-child nella stessa transazione. Separare ingresso e allocazione riduce gas,
fragilità e dipendenza dalla disponibilità dei protocolli.

### 14.2 Deposito L1 in un child L0

```text
L1 ProxyGeneral
  → ProtocolManager L1
  → InterVaultPlugin
  → approve esatto
  → LiquidityManager child.deposit(amount)
  → child LPT al plugin
  → verifica shares e NAV
  → allowance a zero
```

Post-condizioni:

- asset L1 diminuito dell'importo netto;
- quote child aumentate almeno del minimo calcolato da preview e policy;
- child censito e attivo;
- cap prospettico rispettato;
- nessuna allowance inattesa;
- accounting parent riconciliato.

### 14.3 Riscatto di un child

```text
InterVaultPlugin
  → child.withdraw(shares)
  → riceve base asset
  → verifica il minimo di asset calcolato on-chain
  → trasferisce alla custody L1
  → aggiorna accounting
```

Una failure deve revertire atomicamente il singolo salto. Il planner può poi
scegliere un altro child o mettere il run in stato di intervento.

### 14.4 Rebalance L1

Il piano contiene dipendenze esplicite. Nessun deposit di deficit viene eseguito
prima che i withdraw necessari siano confermati nello stesso stato simulato.

### 14.5 Emergency exit

L'emergency exit:

- disabilita nuovi depositi nel child;
- tenta il redeem secondo limiti e disponibilità;
- non usa calldata arbitraria;
- conserva quote residue se il child non è interamente liquidabile;
- marca perdita o capitale bloccato senza valorizzarlo ottimisticamente;
- non rimuove il child dal Registry finché balance e receivable non sono zero.

## 15. Flussi cross-chain

### 15.1 Deposito globale

Caso semplificato con quote emesse sull'hub:

```text
utente richiede deposito
  → asset bloccati/ricevuti sull'hub
  → request PENDING
  → eventuale allocazione al satellite
  → messaggio e asset confermati
  → NAV di settlement determinato
  → request CLAIMABLE
  → utente reclama quote
```

Il prezzo delle quote può cambiare tra richiesta e claim. I termini economici
devono specificare quale epoch o snapshot determina il tasso.

### 15.2 Riscatto globale

```text
utente richiede redeem
  → quote bloccate o bruciate
  → hub usa riserva disponibile
  → se necessario richiede unwind ai satelliti
  → satelliti riscattano L1
  → asset tornano o diventano disponibili
  → request CLAIMABLE
  → utente reclama asset
```

Non deve esistere una promessa di liquidità immediata se il capitale è remoto.

### 15.3 Rebalance fra chain

```text
Hub osserva target e report finalizzati
  → riduce esposizione chain sovrappeso
  → attende conferma dell'unwind
  → sposta asset
  → attende finalità destinazione
  → aumenta esposizione chain sottopeso
  → verifica NAV e stato
```

È una state machine multi-transazione, non una multicall atomica.

### 15.4 Idempotenza e replay protection

Ogni istruzione include:

- operation ID globale;
- source e destination domain;
- nonce monotono per route;
- vault e config hash;
- asset e importo massimo;
- deadline;
- expected previous state;
- retry policy;
- stato terminale.

Ricevere due volte lo stesso messaggio non deve duplicare il movimento.

### 15.5 Timeout

Un timeout non prova che l'operazione non sia avvenuta. Prima di riprovare si
riconciliano source transaction, message ID, bridge state, destination receipt e
saldo. Il retry cieco è vietato.

## 16. Liquidità e riscatti

### 16.1 Riserve a ogni livello

Ogni livello mantiene una riserva coerente con la propria latenza:

- L0: operatività e prelievi locali;
- L1: assorbire depositi/prelievi senza unwind continuo;
- L2 hub: pagare riscatti ordinari senza attendere il bridge;

La riserva non è rendimento perso per errore: è capitale che compra liquidità e
riduce il rischio di forced exit.

### 16.2 Waterfall di liquidità

```text
riserva locale
  → child liquidi
  → child meno liquidi
  → satellite locale
  → satellite remoto
  → coda asincrona
```

L'ordine considera costo, slippage, tax, health e tempo, non soltanto APY.

### 16.3 Limiti

Servono almeno:

- maximum instant redemption;
- maximum daily outflow;
- minimum reserve;
- maximum child concentration;
- maximum chain concentration;
- maximum pending bridge;
- maximum stale NAV contribution;
- minimum liquid coverage ratio.

## 17. Debito e leva

### 17.1 Policy iniziale

```text
L0: debito ammesso solo per leaf esplicitamente leverage-enabled
L1: debito vietato
L2: debito vietato
```

### 17.2 Motivazione

Se ogni livello potesse collateralizzare le quote del livello inferiore e
prendere nuovo debito, la leva diventerebbe ricorsiva e difficile da osservare.
Inoltre il protocollo di lending locale non riconoscerebbe automaticamente la
copertura economica detenuta altrove.

### 17.3 Stress look-through

Prima di allocare in un leaf con debito, il parent valuta almeno:

- shock prezzo collateral;
- shock prezzo debt asset;
- aumento borrow APY;
- riduzione liquidità;
- oracle delay;
- impossibilità di riscattare;
- liquidation bonus;
- chain congestionata.

Un health factor nominalmente sopra uno non costituisce da solo una policy
prudente.

## 18. Governance, Safe e ruoli

### 18.1 Governance globale e locale

Proposta:

- una governance/Safe principale approva architettura globale, versioni,
  bridge, hub, asset e cap massimi;
- Safe locali controllano componenti e recovery sulle singole chain;
- un emergency role locale può soltanto ridurre rischio: pause, revoke,
  quarantine e unwind entro policy;
- nessun satellite può aumentare autonomamente cap o autorizzazioni.

### 18.2 Operazioni sempre Safe

- registrare o rimuovere un vault;
- creare un edge;
- cambiare livello;
- abilitare un nuovo asset o bridge;
- aumentare cap;
- abilitare borrow;
- aggiornare implementation;
- cambiare oracle;
- sostituire hub/satellite;
- recuperare capitale con destinazione straordinaria;
- modificare accounting o fee policy.

### 18.3 Operazioni delegabili all'automazione

In una fase matura:

- rebalance entro target e cap;
- deposit/withdraw da child già censiti;
- spostamenti cross-chain entro route e budget approvati;
- claim di request già verificate;
- riduzione esposizione;
- emergency de-risk con sole destinazioni autorizzate.

### 18.4 Principio di autorità monotona

I ruoli automatici possono mantenere o ridurre il rischio, non ampliare il
perimetro. Un'azione che aumenta cap, leva, asset, chain o destinazioni richiede
governance.

## 19. Integrazione con il Vault Automation Controller

### 19.1 Observer gerarchico

Ogni snapshot contiene:

- vault ID, livello, chain e asset;
- quote child;
- NAV diretto e look-through;
- riserva;
- debt e worst health;
- pending cross-chain;
- config hash;
- staleness per componente;
- graph version;
- pause e circuit breaker.

### 19.2 Decisione per livello

Il controller non usa una strategia universale:

- L1 produce delta per child locali;
- L2 produce delta per chain;
- L0 produce operazioni protocol-specifiche.

Il formato può essere comune, ma scoring e risk policy restano separati.

### 19.3 Observe

Registra cosa avrebbe riallocato, inclusi motivazione, valore stale, costi e
blocchi. Non invia messaggi né transazioni.

### 19.4 Advisory

Produce piani locali o workflow cross-chain, li simula per quanto possibile e
li lega a una proposta Safe. Un piano cross-chain è una state machine con più
checkpoint, non un singolo batch dichiarato atomicamente sicuro.

### 19.5 Autonomous

Richiede ruoli limitati, cap on-chain, pause indipendente, alert, riconciliazione
e capitale canary. Un worker compromesso non può creare nuovi edge o cambiare
route.

### 19.6 Journal

Ogni run conserva:

- graph/config version;
- snapshot di ogni nodo coinvolto;
- decisione e risk findings;
- piano e dipendenze;
- simulazioni locali;
- request/message/transaction ID;
- transizioni pending/confirmed/claimable;
- verifica finale;
- eccezioni e recovery.

## 20. Oracle e dati

### 20.1 Fonti

Servono fonti separate per:

- prezzo asset/USD;
- conversione asset/base asset;
- share price child;
- NAV remoto;
- block/finality;
- APY e costo debito, che restano metriche secondarie.

### 20.2 Staleness

Ogni dato porta timestamp, block reference e soglia massima. L'età ammessa per
un semplice report non implica che lo stesso dato sia abbastanza fresco per
mint, redeem o rebalance.

### 20.3 Share price

La share price deriva dal NAV verificabile del child, non da un prezzo DEX delle
quote salvo una policy distinta. Donazioni, bootstrap, rounding e supply quasi
zero devono essere protetti e testati.

### 20.4 APY

L'APY non è una verità on-chain unica. Deve indicare finestra, fonte, fee,
costo debito e affidabilità. Non viene usato come unico criterio di allocazione.

## 21. Sicurezza e threat model preliminare

### 21.1 Ciclo nel grafo

**Rischio:** valorizzazione ricorsiva, prelievi circolari, TVL duplicato e
possibile out-of-gas.

**Controlli:** livelli immutabili o governati, edge solo verso `level - 1`,
cycle check prima della registrazione, preflight completo e test di proprietà.

### 21.2 Child malevolo o compromesso

**Rischio:** quote manipolate, drain tramite allowance, falsa valorizzazione,
revert su withdraw.

**Controlli:** manifest verificato, bytecode hash, allowance esatta, cap,
minimi conservativi calcolati da preview/oracle, circuit breaker, quarantena e
nessuna chiamata arbitraria.

### 21.3 Share inflation e donation

**Rischio:** un deposito riceve zero o troppe poche quote a causa di exchange
rate manipolato, specialmente vicino al bootstrap.

**Controlli:** bootstrap deterministico, minimum liquidity/virtual shares se
adottati, preview conservativa, post-check atomico e deposit minimum. Le
considerazioni note per vault tokenizzati devono essere riesaminate per il
modello LPT corrente.

### 21.4 Double counting

**Rischio:** quote child contate dal LensAdapter e dal token inventory.

**Controlli:** asset classification esclusiva e test di consolidamento.

### 21.5 NAV stale

**Rischio:** mint economico o redeem eccessivo contro valore remoto vecchio.

**Controlli:** epoch, staleness bounds, haircut, queue e blocco fail-closed.

### 21.6 Replay cross-chain

**Rischio:** una richiesta viene eseguita due volte.

**Controlli:** nonce per route, operation ID, consumed mapping, expected state,
idempotenza e riconciliazione.

### 21.7 Message/asset mismatch

**Rischio:** arriva il messaggio ma non l'asset, o viceversa.

**Controlli:** accounting a due prove, pending state, quarantine e nessuna
emissione di quote fino a settlement.

### 21.8 Bridge compromise

**Rischio:** asset wrapped non più riscattabile o messaggio fraudolento.

**Controlli:** cap per bridge, più route solo dopo audit, pause separata,
haircut, diversificazione consapevole e governance delay per aumentare limiti.

### 21.9 Chain halt o reorg

**Rischio:** stato remoto non finalizzato o capitale irraggiungibile.

**Controlli:** finality policy per chain, report con block reference, satellite
quarantine, riserva hub e withdrawal queue.

### 21.10 Oracle manipulation

**Rischio:** mint, redeem o rebalance a prezzo errato.

**Controlli:** fonti allowlisted, freshness, deviation check, circuit breaker,
limiti per ciclo e nessun fallback a zero.

### 21.11 Fee stacking

**Rischio:** lo stesso rendimento paga fee a L0, L1 e L2.

**Controlli:** fee waterfall esplicita, look-through reporting e preferenza per
fee applicate a un solo livello o con rebate interno.

### 21.12 Worker compromesso

**Rischio:** allocazioni ripetute entro protocolli esistenti.

**Controlli:** rate limit, cap per action/day, cooldown, recipient fissi,
selector minimi, no governance, Safe revoke e emergency pause.

### 21.13 Governance compromise

**Rischio:** edge malevolo, upgrade, bridge o cap pericoloso.

**Controlli:** Safe multi-owner, hardware wallet separati, simulazione fork,
timelock sulle azioni non urgenti, emergency path distinto e monitor eventi.

## 22. Emergency management

### 22.1 Stati

```text
NORMAL
DEGRADED
DEPOSIT_PAUSED
WITHDRAW_ONLY
QUARANTINED
EMERGENCY_UNWIND
SETTLEMENT_ONLY
```

### 22.2 Isolamento

Un problema su una chain o un child non deve obbligare a bloccare ogni livello.
Il parent può:

- disabilitare nuovi depositi verso il nodo;
- mantenere reporting;
- consentire soltanto withdraw;
- applicare haircut;
- riallocare capitale non coinvolto;
- preservare i claim degli utenti.

### 22.3 Emergency unwind

L'unwind procede dal basso verso l'alto:

```text
protocollo → leaf → L1 → satellite/L2
```

Non si tenta di riscattare un parent prima di conoscere la liquidità dei child
necessari. Ogni perdita viene riconosciuta al livello nel quale si manifesta e
propagata nel NAV.

### 22.4 Kill switch

La Safe può revocare executor e route. Un emergency operator limitato può
soltanto ridurre rischio; non può trasferire a recipient nuovi né cambiare cap.

## 23. Fee e incentivi

### 23.1 Principio

La gerarchia non deve monetizzare più volte lo stesso rendimento senza una
giustificazione trasparente.

### 23.2 Modelli possibili

1. Fee soltanto al livello utente finale.
2. Fee nei leaf per strategia e rebate ai parent.
3. Fee per livello, ma con cap consolidato e disclosure completa.

La proposta preferita per il primo sistema è fee semplice al livello che emette
quote agli utenti esterni, con costi operativi interni contabilizzati ma non
duplicati come performance fee.

### 23.3 Performance

L'high-water mark deve usare capitale esterno e NAV consolidato. Spostare asset
tra nostri vault non genera profitto realizzato e non resetta l'high-water mark.

### 23.4 Costi cross-chain

Gas, bridge fee, slippage e relayer cost vengono attribuiti alla richiesta o al
vault secondo policy esplicita. Non vengono nascosti nell'errore di NAV.

## 24. Osservabilità e dati storici

### 24.1 Metriche per nodo

- NAV e share price;
- liquidità e riserva;
- inflow/outflow;
- child allocations;
- debt e health;
- rendimento lordo/netto;
- staleness;
- pause e circuit breaker;
- errori e latency RPC.

### 24.2 Metriche per edge

- target e current exposure;
- cap utilizzato;
- ultimo deposit/withdraw;
- slippage;
- quote e valore;
- exit liquidity;
- failure count;
- stato operativo.

### 24.3 Metriche cross-chain

- capitale pending per stato;
- message age;
- finality latency;
- bridge volume e cap;
- reconciliation failures;
- satellite heartbeat;
- ultimo block/report confermato;
- quarantene e recovery time.

### 24.4 Retention

Il journal locale JSON è adeguato al POC single-host. Una gerarchia multi-worker
e multi-chain richiederà storage transazionale, backup, immutabilità logica,
query consolidate e alert indipendenti dal worker.

## 25. Testing richiesto

### 25.1 Unit test del grafo

- livelli validi;
- self-edge respinto;
- edge che salta livello respinto;
- ciclo diretto e indiretto respinto;
- chain/asset mismatch respinto;
- cap e target;
- lifecycle child;
- enumerazione deterministica.

### 25.2 Accounting

- NAV per ogni livello;
- eliminazione quote interne;
- debito look-through;
- decimali USDC/ETH/BTC;
- rounding e dust;
- supply zero/bootstrap;
- fee e high-water mark;
- pending non duplicato;
- haircut stale.

### 25.3 InterVaultPlugin

- deposit e redeem happy path;
- allowance esatta e cleanup;
- min shares/assets;
- pause child;
- cap superato;
- reentrancy;
- child malevolo;
- partial liquidity;
- emergency exit;
- nessuna destinazione arbitraria.

### 25.4 LensAdapter

- quote e conversione;
- doppio conteggio assente;
- debt/health propagation;
- stale data;
- child deprecated con balance;
- nessuna ricorsione.

### 25.5 Integrazione L1

- più leaf con asset differenti e NAV consolidato in USDC;
- rebalance withdraw-first;
- deposit/withdraw utenti;
- riserva;
- child failure isolata;
- full unwind;
- zero residui oltre dust;
- snapshot/revert tra casi.

### 25.6 Fork

- protocolli reali;
- indirizzi e manifest verificati;
- liquidity limits;
- rounding reale;
- oracle e pause;
- whale stabili;
- blocco fissato;
- gas e timeout coerenti con RPC.

### 25.7 Cross-chain simulator

- ordine messaggi alterato;
- messaggio duplicato;
- messaggio perso;
- asset senza messaggio;
- messaggio senza asset;
- timeout e late confirmation;
- chain halt;
- reorg prima della finalità;
- satellite compromesso;
- bridge cap;
- retry idempotente;
- request pending/claimable/claimed.

### 25.8 Invarianti e fuzz

- capitale non creato dai trasferimenti interni;
- consolidated NAV conservato salvo fee/PnL esterno;
- nessun ciclo raggiungibile;
- nessun edge fuori livello;
- quote non riscattate senza burn/lock;
- stessa operation non settled due volte;
- total pending coerente;
- autonomia non cambia governance.

### 25.9 E2E

```text
utente deposita USDC nel Global MetaVault L2
  → messaggio satellite
  → deposito nel MetaVault USDC L1 locale
  → eventuale swap USDC/asset
  → deposito leaf
  → protocollo esterno
  → rendimento
  → unwind inverso
  → utente reclama USDC
```

Ogni step deve produrre evidenza e riconciliazione, non soltanto receipt.

## 26. Deployment, upgrade e versioning

### 26.1 Manifest per nodo

Ogni vault ha un manifest immutabile/versionato con:

- chain e deployment block;
- indirizzi proprietari ed esterni;
- transaction hash;
- constructor args;
- source verification;
- owner e role;
- base asset;
- graph level;
- implementation version;
- config hash.

### 26.2 Graph manifest

Un manifest separato descrive nodi ed edge approvati. Aggiornare una soglia non
riscrive la storia del deployment; produce una nuova policy version.

### 26.3 Upgrade

Prima di ogni upgrade:

1. diff storage/API;
2. unit e integration;
3. fork di ogni parent e child coinvolto;
4. simulazione dei flussi pending;
5. Safe proposal;
6. canary;
7. verifica explorer;
8. aggiornamento manifest;
9. observer intensificato.

### 26.4 Compatibilità

Un parent dichiara le versioni child supportate. Un upgrade incompatibile non
viene eseguito finché parent, plugin e lens non sono pronti.

## 27. Roadmap incrementale

### Fase M0 — congelare la visione

- approvare terminologia, livelli e invarianti;
- censire decisioni aperte;
- collegare la roadmap generale del progetto;
- nessuna modifica on-chain.

### Fase M1 — standardizzare identità e quote

- schema `VaultDescriptor`;
- ID asset canonico;
- manifest per livello;
- verificare compatibilità delle LPT correnti;
- decidere adapter ERC-4626 senza migrare prematuramente il core.

### Fase M2 — tre moschettieri InterVault locali

- Registry, Plugin, LensAdapter;
- interfacce e mock;
- cycle/level guard;
- accounting e cap;
- suite unit/security.

### Fase M3 — leaf locali e MetaVault USDC same-asset

- certificare almeno due leaf USDC distinti;
- policy supply-only iniziale;
- nessun debt;
- collegarli al solo MetaVault USDC Arbitrum;
- observe e canary separati.

### Fase M4 — MetaUSDC Arbitrum

- L1 reale;
- riserva;
- rebalance advisory;
- capitale minimo;
- full withdrawal;
- accounting consolidato locale.

### Fase M5 — automazione L1 limitata

- observer gerarchico;
- Safe advisory;
- canary;
- executor limitato;
- cap bassi e kill switch.

### Fase M6 — leaf WETH cross-asset sulla stessa chain

- un leaf WETH L0 certificato;
- route USDC↔WETH, oracle e slippage indipendenti;
- nessun MetaETH;
- canary e full unwind fino a USDC;
- WBTC escluso finché WETH non supera tutti i gate.

### Fase M7 — seconda chain

- replica di un solo asset, preferibilmente USDC;
- certificazione indipendente;
- manifest e Safe locale;
- nessun collegamento cross-chain iniziale.

### Fase M8 — simulatore e messaging cross-chain

- adapter astratto;
- state machine request;
- finality e replay;
- environment di test multi-chain;
- nessun capitale reale.

### Fase M9 — Global USDC MetaVault canary

- hub e due satelliti;
- quote su una sola hub chain;
- reserve elevata;
- request asincrone;
- cap bridge minimo;
- advisory e approvazione Safe.

### Fase M10 — estensione locale a WBTC e altri asset approvati

- soltanto dopo stabilità del percorso WETH;
- leaf WBTC, oracle e token risk specifici;
- cap indipendenti per asset e child;
- nessun MetaBTC.

### Fase M11 — eventuale livello superiore, solo se necessario

- richiede più prodotti globali realmente distinti;
- non viene creato per simmetria architetturale;
- nuova threat analysis e nuova decisione di governance;
- reporting di volatilità e drawdown;
- zero borrow.

### Fase M12 — autonomia progressiva

- mesi di shadow/advisory;
- audit;
- limiti on-chain;
- alert indipendenti;
- canary incrementali;
- autonomia revocabile e incapace di ampliare il perimetro.

## 28. Gate fra le fasi

Una fase non viene considerata completa perché il codice compila. Servono:

- requisiti e threat model approvati;
- checklist completa;
- test unit/integration/security/fork pertinenti;
- zero skip non giustificati;
- manifest riproducibile;
- source verification;
- ownership coerente;
- runbook deploy/upgrade/emergency;
- observe minimo;
- canary con capitale limitato;
- evidenze e rollback provato.

Per cross-chain si aggiungono:

- riconciliazione messaggio/asset;
- timeout e late delivery;
- replay test;
- chain quarantine;
- bridge cap;
- request accounting;
- recovery senza doppio settlement.

## 29. Prima versione raccomandata

La prima versione non è cross-chain. È il nucleo same-asset usato per
certificare i Tre Moschettieri:

```text
MetaUSDC Arbitrum L1
  ├── riserva USDC
  ├── Leaf USDC Aave
  ├── Leaf USDC Euler
  └── Leaf USDC Morpho Vault
```

Vincoli:

- una chain;
- un asset;
- profondità uno;
- supply-only;
- nessun bridge;
- nessun borrow nel MetaVault;
- Safe governance;
- observe prima di advisory;
- capitale canary;
- InterVault Registry/Plugin/Lens dedicati.

Questa versione dimostra la parte più importante: composizione fra nostri vault
senza ciclo, con accounting corretto e uscita completa.

Subito dopo, senza creare MetaETH o MetaBTC, lo stesso MetaUSDC aggiunge un leaf
WETH canary e certifica swap, oracle, NAV in USDC e full unwind. Soltanto questo
secondo passaggio dimostra compiutamente il MetaVault locale multi-asset.

## 30. Decisioni aperte

### 30.1 Standard quote

- mantenere LPT corrente con adapter;
- evolvere i nuovi vault verso ERC-4626;
- valutare ERC-7540 soltanto per livelli asincroni.

### 30.2 Hub chain

La chain sulla quale emettere quote L2 non è ancora scelta. Deve bilanciare
sicurezza, finalità, costi, disponibilità Safe/oracle/messaging e recovery.

### 30.3 Messaging e bridge

Non è ancora selezionato un provider. L'architettura deve usare adapter e non
incorporare assunzioni irreversibili su CCIP, canonical bridge o altri sistemi.

### 30.4 Governance

- relazione fra Safe globale e Safe locali;
- threshold;
- timelock;
- emergency council;
- recovery geografica e hardware wallet.

### 30.5 Fee

- livello di applicazione;
- high-water mark;
- cost allocation cross-chain;
- eventuale rebate fra vault proprietari.

### 30.6 NAV settlement

- real-time con staleness bound;
- epoch-based;
- haircut;
- pricing delle request pending.

### 30.7 Quote cross-chain

La prima proposta è emettere le quote globali su una sola hub chain. Rendere le
quote omnichain aggiunge supply reconciliation e non è necessario per dimostrare
il modello economico.

### 30.8 Debito leaf

Definire se i MetaVault iniziali possono investire in leaf con debito o se la
prima generazione deve essere interamente supply-only. La raccomandazione è
supply-only.

## 31. Cose da non fare

- non permettere investimenti reciproci;
- non usare simboli token come identità;
- non sommare NAV multilivello e chiamarlo capitale esterno;
- non trattare cross-chain come atomico;
- non emettere quote contro messaggi non finalizzati;
- non abilitare debito a ogni livello;
- non scegliere un bridge soltanto per costo;
- non consentire calldata arbitraria ai satellite executor;
- non rimuovere child con balance residuo;
- non fare retry ciechi;
- non introdurre un ulteriore livello prima di averne dimostrato la necessità;
- non modificare il POC attuale durante la finestra observe per anticipare questa
  visione.

## 32. Criteri di successo finali

La visione può dirsi realizzata quando:

1. ogni vault ha identità e manifest verificabili;
2. il grafo è aciclico e vincolato per livello;
3. NAV individuale e consolidato sono riconciliabili;
4. il debito è visibile look-through;
5. depositi e riscatti locali sono verificati;
6. request cross-chain sono idempotenti e riconciliate;
7. una chain può essere isolata senza perdere il controllo globale;
8. il capitale pending non viene duplicato;
9. Safe e ruoli minimi sono provati;
10. l'automazione non può ampliare il proprio perimetro;
11. ogni livello ha emergency exit e runbook;
12. test e audit coprono failure locali e cross-chain;
13. le fee non duplicano impropriamente il rendimento;
14. l'utente comprende asset, chain, leva, liquidità e tempi di uscita;
15. l'aumento del capitale avviene soltanto per gate progressivi.

## 33. Conclusione

L'architettura MetaVault non deve essere un unico contratto onnipotente. Deve
essere una gerarchia di responsabilità verificabili:

```text
leaf = strategia
L1   = unico portafoglio locale multi-asset con base USDC
L2   = allocazione cross-chain fra MetaVault USDC locali
L3   = non previsto oggi; eventuale solo con una necessità futura concreta
```

La modularità permette di costruire e certificare un livello alla volta. La
regola più importante è che la composizione rimanga unidirezionale: i parent
possono possedere child, mai il contrario. Questo rende valore, liquidità,
governance e rischio calcolabili senza ricorsione.

Il prossimo documento dovrà trasformare questa visione in un audit dello stato
attuale e in un confronto puntuale fra ciò che il repository già supporta e ciò
che manca per il primo `MetaUSDC Arbitrum`.

## 34. Riferimenti

- Pattern interno dei tre moschettieri:
  `docs/New_Doc/27_docs_folders/04_pattern_3_musketeers/README.md`.
- Controller di automazione:
  `docs/New_Doc/1_Documentation/Vault Automation Controller/`.
- Manifest e POC reale:
  `scripts/manifests/arbitrum-usdc-poc-1.json`.
- Control file observe:
  `scripts/automation/config.arbitrum-usdc-poc-1.json`.
- ERC-4626 Tokenized Vaults: <https://eips.ethereum.org/EIPS/eip-4626>.
- ERC-7540 Asynchronous ERC-4626 Tokenized Vaults:
  <https://eips.ethereum.org/EIPS/eip-7540>.
- Chainlink CCIP, riferimento candidato e non decisione architetturale:
  <https://docs.chain.link/ccip>.
