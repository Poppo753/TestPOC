Frase per un bambino:

> Ho messo tutti i vecchi attrezzi in magazzino e ho costruito un unico telecomando sicuro per comandare tutto il sistema DeFi.

Aumentiamo gradualmente la difficoltà.

## Livello 1 — L’idea generale

Prima avevi centinaia di script indipendenti:

- alcuni aggiornati;
- alcuni vecchi;
- molti duplicati;
- alcuni con indirizzi scritti direttamente nel codice;
- altri pensati per una singola prova;
- altri ancora basati su versioni precedenti dei contratti.

Ora esistono due aree distinte:

```text
scripts/
├── framework/       motore comune
├── operations/      azioni realmente disponibili
├── cli.ts           telecomando da terminale
├── manifests/       descrizione dei deployment
├── core/            quattro script precedenti ancora supportati
└── legacy/          347 file storici conservati
```

Non devi più scegliere casualmente tra 300 script. Parti da `cli.ts`, oppure importi direttamente un’operazione nel tuo backend.

## Livello 2 — Cosa puoi fare

La nuova suite permette di:

- deployare il sistema core;
- deployare Aave, Euler, Morpho, MorphoVault e Uniswap;
- aggiornare un modulo tramite Beacon;
- registrare token e protocolli;
- configurare registry;
- impostare fee, limiti e rate limit;
- depositare e prelevare;
- scambiare token dentro il vault;
- usare deposit, withdraw, borrow, repay e close sui protocolli;
- controllare stato, health e posizioni;
- mettere il sistema in emergenza;
- produrre transazioni per browser, wallet o Safe;
- simulare tutto prima dell’esecuzione.

GMX e Dolomite vengono rifiutati intenzionalmente perché non sono finiti.

## Livello 3 — Un solo telecomando

Il file centrale è:

[scripts/cli.ts](E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/scripts/cli.ts)

Esempio read-only:

```powershell
npx ts-node scripts/cli.ts status `
  --manifest deployments/mainnet-latest.json
```

Esempio deposit:

```powershell
npx ts-node scripts/cli.ts deposit `
  --manifest deployments/mainnet-latest.json `
  --amount 1000000000000000000 `
  --wrap-native=true
```

Però la CLI non realizza realmente il deposito. Interpreta i parametri e chiama:

```text
operations/vault/deposit.ts
```

Questo è importante perché la stessa funzione può essere usata da:

- terminale;
- backend;
- API;
- bot;
- keeper;
- agente autonomo;
- test;
- frontend, tramite calldata prodotta dalla suite.

La logica non deve essere riscritta per ogni ambiente.

## Livello 4 — Le tre modalità di sicurezza

Una mutazione può essere trattata in tre modi.

### 1. Preparare il piano

Senza esecuzione ottieni qualcosa simile a:

```json
{
  "operation": "vault.deposit",
  "chainId": 42161,
  "calls": [
    {
      "id": "approve-liquidity",
      "target": "0x...",
      "value": "0",
      "data": "0x..."
    },
    {
      "id": "deposit",
      "target": "0x...",
      "value": "0",
      "data": "0x...",
      "dependsOn": ["approve-liquidity"]
    }
  ]
}
```

Nessuna transazione viene inviata.

### 2. Simulare

Con:

```powershell
--execute=true --dry-run=true
```

su rete locale o fork viene fatto:

```text
snapshot
   ↓
transazione 1
   ↓
transazione 2
   ↓
controllo risultato
   ↓
revert dello snapshot
```

La simulazione usa quindi stato realistico, ma alla fine annulla tutto.

Questo risolve un problema sottile: due normali `eth_call` separati non condividono lo stato. Il secondo call non vedrebbe, per esempio, l’approval effettuato dal primo.

### 3. Eseguire realmente

Soltanto questa combinazione rende persistenti le transazioni:

```powershell
--execute=true --dry-run=false
```

La scelta deve essere esplicita.

## Livello 5 — Il manifest

Il manifest è la carta d’identità del deployment.

Esempio:

```json
{
  "schemaVersion": 1,
  "network": "arbitrum",
  "chainId": 42161,
  "baseAsset": {
    "code": "WETH",
    "address": "0x...",
    "decimals": 18
  },
  "contracts": {
    "beacon": "0x...",
    "proxyGeneral": "0x...",
    "liquidityManager": "0x..."
  },
  "protocols": {
    "AaveV3": {
      "plugin": "0x...",
      "lensAdapter": "0x...",
      "registry": "0x...",
      "active": true,
      "kind": "aave"
    }
  }
}
```

Prima gli indirizzi provenivano da posti differenti:

- variabili d’ambiente;
- costanti;
- script;
- file deployment;
- valori hardcoded.

Adesso le nuove operazioni prendono gli indirizzi dal manifest.

Il loader sa anche leggere il vecchio `mainnet-latest.json` e convertirlo internamente nel nuovo formato.

Il file che gestisce tutto è:

[manifest.ts](E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/scripts/framework/manifest.ts)

Controlla:

- versione dello schema;
- chain ID;
- indirizzi;
- decimali;
- protocolli;
- transaction hash;
- duplicati;
- compatibilità del vecchio formato.

Il salvataggio è atomico: prima crea un file temporaneo, poi lo sostituisce. Un processo interrotto non dovrebbe lasciare mezzo JSON.

## Livello 6 — Il framework

La cartella `framework` è il motore.

```text
framework/
├── types.ts
├── errors.ts
├── env.ts
├── cli.ts
├── manifest.ts
├── runtime.ts
├── abis.ts
├── contracts.ts
├── preflight.ts
├── plans.ts
├── transactions.ts
└── retry.ts
```

### `types.ts`

Definisce il linguaggio comune:

- manifest;
- runtime;
- operazioni;
- piani;
- transazioni;
- risultati.

### `errors.ts`

Restituisce errori comprensibili da un programma:

```json
{
  "code": "PREFLIGHT_ERROR",
  "message": "Signer is not the contract owner",
  "context": {
    "expected": "0x...",
    "actual": "0x..."
  }
}
```

### `env.ts` e `cli.ts`

Interpretano input senza conversioni ambigue:

- boolean;
- integer;
- bigint;
- address;
- JSON.

Un importo on-chain non viene convertito in un `number` JavaScript potenzialmente impreciso.

### `runtime.ts`

Riunisce:

- provider;
- signer;
- chain ID;
- manifest;
- confirmations;
- modalità di esecuzione;
- retry RPC.

Nei test si può iniettare un runtime artificiale senza dipendere da `.env`.

### `preflight.ts`

Prima di una mutazione verifica:

- chain consentita;
- address valido;
- bytecode presente;
- signer;
- saldo gas;
- ownership;
- importo positivo.

### `plans.ts`

Trasforma una richiesta in calldata e controlla le dipendenze.

Per esempio:

```text
wrap-native
   ↓
approve-liquidity
   ↓
deposit
```

Non permette a una chiamata di dipendere da uno step inesistente o successivo.

### `transactions.ts`

Gestisce:

- piano senza invio;
- encode-only;
- simulazione;
- nonce;
- receipt;
- stop al primo errore;
- snapshot/revert.

### `retry.ts`

Riprova soltanto letture RPC fallite per cause temporanee:

- timeout;
- rate limit 429;
- socket reset;
- rete momentaneamente indisponibile.

Non riprova automaticamente una transazione, perché potrebbe essere stata accettata anche se la risposta RPC è andata persa.

## Livello 7 — Le operazioni vere

La cartella `operations` rappresenta ciò che il sistema sa fare.

### Deployment

```text
operations/deployment/
├── deployer.ts
├── deploy-core.ts
└── deploy-bundle.ts
```

`deployer.ts` salva un checkpoint dopo ogni transazione.

Se il deployment si interrompe dopo sette contratti, il manifest conserva:

- contratti già creati;
- transaction hash;
- ultimo step;
- ultimo blocco.

Al riavvio, un contratto viene riutilizzato soltanto se l’indirizzo salvato ha effettivamente bytecode.

`deploy-core.ts` rispetta l’ordine delle dipendenze:

```text
Beacon
  ↓
registrazione BASE_ASSET
  ↓
ProxyGeneral + ChainlinkAdapter
  ↓
TokenManager e moduli
  ↓
LiquidityManager
  ↓
ProtocolManager + FlashLoanService
  ↓
registrazioni Beacon
  ↓
autorizzazioni ProxyGeneral
  ↓
feed base
  ↓
setBaseAssetCode
```

L’ordine è importante: LiquidityManager legge `BASE_ASSET` nel constructor; TokenManager accetta la base asset soltanto dopo che l’oracolo la supporta.

`deploy-bundle.ts` supporta:

- Uniswap V3 Direct;
- Aave;
- Euler;
- Morpho;
- MorphoVault.

Ogni bundle viene:

1. deployato;
2. registrato nel Beacon;
3. autorizzato nella custody;
4. registrato nel ProtocolManager;
5. salvato nel manifest.

### Amministrazione

```text
operations/administration/
├── beacon.ts
├── core-policy.ts
├── protocols.ts
├── tokens.ts
├── registries.ts
└── emergency.ts
```

Qui vivono:

- upgrade;
- fee;
- limiti;
- configurazione token;
- configurazione registry;
- protocolli;
- emergenze.

La registrazione di un protocollo aggiorna sia Beacon sia ProtocolManager. Questo è essenziale perché le operazioni del manager risolvono il plugin attraverso Beacon.

### Vault

```text
operations/vault/
├── deposit.ts
├── withdraw.ts
└── swap.ts
```

Il deposit:

```text
eventuale wrapping
→ approval esatta
→ deposit
→ verifica crescita share
```

Il withdraw:

```text
lettura share
→ calcolo percentuale opzionale
→ canWithdraw
→ deadline dal blocco
→ withdraw
→ verifica share bruciate
```

Lo swap:

```text
lettura di tutti i plugin
→ selezione migliore quote
→ calcolo minAmountOut
→ swap tramite SwapManager
→ verifica diminuzione tokenIn
→ verifica aumento tokenOut
```

### Protocolli

Un dispatcher espone:

- deposit;
- withdraw;
- borrow;
- repay;
- close;
- balance;
- debt;
- health.

Il chiamante non interagisce direttamente con Aave/Euler/Morpho: passa attraverso ProtocolManager e la custody prevista dall’architettura.

### Monitoring

Restituisce oggetti strutturati per:

- moduli Beacon;
- presenza bytecode;
- pool value;
- supply;
- prezzo LP;
- pause e flag operativi;
- protocolli;
- health;
- posizioni ordinate per rischio.

Non restituisce una schermata già formattata: restituisce dati utilizzabili da sito, database o alerting system.

## Livello 8 — Perché può essere usato da un sito

Un frontend non dovrebbe importare Hardhat né conoscere private key.

Il backend può chiedere alla suite:

```typescript
const result = await depositToVault(runtime, {
  amount: 1_000_000n,
  caller: userAddress
});
```

Oppure generare un piano encode-only:

```typescript
{
  target: "0xLiquidityManager",
  value: "0",
  data: "0xCalldata..."
}
```

Il frontend:

1. mostra all’utente cosa succederà;
2. verifica chain e target;
3. chiede la firma al wallet;
4. invia la transazione;
5. conserva il piano per audit.

La private key non attraversa il framework.

## Livello 9 — Come è stato verificato

Sono stati verificati:

- parser;
- manifest legacy e v1;
- serializzazione bigint;
- encode-only senza invio;
- dipendenze;
- nonce sequenziali;
- stop-on-failure;
- retry RPC;
- dry-run con snapshot/revert;
- deposit e withdraw;
- swap custody e balance delta;
- ciclo deposit/withdraw/borrow/repay/close;
- status e health;
- Beacon upgrade e history;
- protocol registration e selector;
- token e registry;
- policy core;
- emergency;
- ownership registry;
- deploy core;
- tutti i cinque bundle;
- rifiuto GMX/Dolomite;
- 15 test dei vecchi script core;
- smoke fork Arbitrum;
- avvio reale della CLI sul fork.

Risultato finale: 37 test locali combinati, più smoke fork e CLI.

## Dove è spiegato tutto

Il documento più vicino a una spiegazione completa dell’architettura è:

[04_Architettura_Framework_Manifest_e_Sicurezza.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/04_Architettura_Framework_Manifest_e_Sicurezza.md>)

Per capire le decisioni e l’ordine di lavoro:

[01_Strategia_Espansa_Suite_Operativa.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/01_Strategia_Espansa_Suite_Operativa.md>)

Per sapere esattamente quali comandi lanciare:

[05_Guida_Comandi_CLI_Test_e_Produzione.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/05_Guida_Comandi_CLI_Test_e_Produzione.md>)

Per conoscere ogni singolo file attivo:

[06_Catalogo_File_Attivi_e_Come_Usarli.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/06_Catalogo_File_Attivi_e_Come_Usarli.md>)

Per sapere cosa è stato modificato e testato:

[03_Report_Finale_Implementazione.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/03_Report_Finale_Implementazione.md>)

Per il punto di partenza e il caos trovato:

[00_Stato_Attuale_e_Audit_Script.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/00_Stato_Attuale_e_Audit_Script.md>)

Per i vecchi file:

[07_Legacy_Conservazione_e_Recupero.md](<E:/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/docs/New_Doc/1_Documentation/script documentation/07_Legacy_Conservazione_e_Recupero.md>)

In sintesi: hai adesso una piccola piattaforma operativa sopra gli smart contract, non semplicemente una cartella di script.


__________________

Questo risolve un problema sottile: due normali eth_call separati non condividono lo stato. Il secondo call non vedrebbe, per esempio, l’approval effettuato dal primo.

spiega meglio questo sopra
____________

`eth_call` esegue una transazione “finta” contro lo stato attuale della blockchain, ma al termine cancella ogni modifica prodotta durante quella singola chiamata.

Immaginiamo un deposito composto da due transazioni:

```text
1. token.approve(LiquidityManager, 100)
2. LiquidityManager.deposit(100)
```

## Cosa succede realmente on-chain

Quando le transazioni vengono inviate normalmente:

```text
Stato iniziale
allowance = 0

        ↓ approve(100)

Nuovo stato persistente
allowance = 100

        ↓ deposit(100)

LiquidityManager vede allowance = 100
e può trasferire i token
```

La seconda transazione parte dallo stato prodotto dalla prima.

## Cosa succede con due `eth_call` separati

Prima simulazione:

```text
Stato blockchain: allowance = 0

eth_call approve(100)
    ├─ durante la simulazione: allowance = 100
    └─ fine della simulazione: modifica cancellata

Stato blockchain: allowance = ancora 0
```

Seconda simulazione:

```text
Stato blockchain: allowance = 0

eth_call deposit(100)
    └─ fallisce: allowance insufficiente
```

Il secondo `eth_call` non sa che avevamo appena simulato `approve`, perché ogni `eth_call` è una simulazione isolata.

È come fare due prove su due fotocopie identiche:

```text
Fotocopia A                       Fotocopia B
approve → allowance 100           deposit → vede allowance 0
poi viene buttata                 quindi fallisce
```

La seconda prova non usa la fotocopia modificata dalla prima.

## Perché una singola chiamata funziona

Per una sola operazione indipendente, `eth_call` è sufficiente:

```text
eth_call emergencyPause(...)
eth_call updateImplementation(...)
eth_call setProtocolActive(...)
```

La simulazione deve soltanto verificare che quella chiamata, partendo dallo stato corrente, non faccia revert.

Il problema emerge quando la seconda chiamata dipende dallo stato prodotto dalla prima:

```text
wrap WETH
    ↓
approve
    ↓
deposit
```

oppure:

```text
configure vault
    ↓
set default vault
```

oppure:

```text
registrazione nel Beacon
    ↓
registrazione nel ProtocolManager
    ↓
configurazione selector
```

## Come lo risolve la nuova suite

Su Hardhat o su un fork locale viene creato uno snapshot:

```text
Stato iniziale
    ↓
evm_snapshot
    ↓
esecuzione reale temporanea di approve
    allowance = 100
    ↓
esecuzione reale temporanea di deposit
    deposit vede allowance = 100
    ↓
controllo receipt e risultato
    ↓
evm_revert
    ↓
ritorno esatto allo stato iniziale
```

Le transazioni vengono realmente applicate alla blockchain locale temporanea. Per questo ogni passaggio vede le modifiche del passaggio precedente.

Alla fine, `evm_revert` annulla tutto.

```text
Prima della simulazione:
balance = 100
allowance = 0
LP = 0

Durante la simulazione:
balance = 0
allowance consumata
LP = 100

Dopo evm_revert:
balance = 100
allowance = 0
LP = 0
```

Quindi otteniamo entrambe le proprietà desiderate:

- la sequenza viene provata con uno stato coerente;
- nessuna modifica rimane dopo il test.

## Perché non basta `staticCall`

`staticCall` è ancora più restrittivo: esegue la funzione come chiamata statica e impedisce modifiche allo stato.

È utile per:

- quote;
- balance;
- health;
- validazioni;
- funzioni `view`;
- prevedere il valore restituito da alcune funzioni.

Non può simulare correttamente un’intera sequenza che deve realmente scrivere stato intermedio.

## Esempio completo: wrap, approve e deposit

Supponiamo che l’utente abbia ETH ma non WETH.

La sequenza è:

```text
1. WETH.deposit{value: 1 ETH}()
2. WETH.approve(LiquidityManager, 1 WETH)
3. LiquidityManager.deposit(1 WETH)
```

Tre `eth_call` separati vedrebbero sempre lo stato originale:

```text
call 1: crea temporaneamente 1 WETH → poi cancellato
call 2: approva temporaneamente 1 WETH → poi cancellato
call 3: vede balance WETH = 0 e allowance = 0 → fallisce
```

Con snapshot:

```text
snapshot

transazione 1
balance WETH = 1

transazione 2
allowance = 1

transazione 3
vede balance = 1 e allowance = 1
deposit riuscito

revert snapshot
tutto torna come prima
```

## Perché non viene fatto su una RPC mainnet normale

Metodi come:

```text
evm_snapshot
evm_revert
```

sono forniti da nodi di sviluppo come Hardhat, Anvil e Ganache. Una RPC pubblica di Arbitrum normalmente non permette di creare snapshot o modificare temporaneamente lo stato del nodo.

Perciò la suite applica questa regola:

```text
Una chiamata indipendente
    → eth_call può bastare

Sequenza dipendente
    → serve Hardhat/fork con snapshot

Provider live senza snapshot
    → errore esplicito
```

È preferibile rifiutare la simulazione rispetto a dichiarare falsamente che una sequenza non funziona o, peggio, che funziona quando non è stata provata in modo coerente.

In una frase:

> `eth_call` risponde a “questa singola transazione funzionerebbe adesso?”, mentre snapshot → transazioni → revert risponde a “questa intera sequenza funzionerebbe, rispettando tutti gli effetti intermedi?”.


_____________________________

Soltanto questa combinazione rende persistenti le transazioni:
--execute=true --dry-run=false

vuol dire che solo con questi parametri invio effettivamente una transazione verso la blockchaine e deposito ecc cc?


________________________________________

Sì, esattamente.

Per le normali operazioni gestite dalla nuova CLI, soltanto questa combinazione invia davvero le transazioni e modifica persistentemente la blockchain:

```powershell
--execute=true --dry-run=false
```

Quindi, per un deposito reale:

```powershell
npx ts-node scripts/cli.ts deposit `
  --manifest deployments/mainnet-latest.json `
  --amount 1000000000000000000 `
  --wrap-native=true `
  --execute=true `
  --dry-run=false
```

verrebbero realmente inviate, nell’ordine:

```text
1. wrapping ETH → WETH, se richiesto
2. approve del LiquidityManager
3. deposit nel vault
```

Se sei collegato ad Arbitrum mainnet, queste saranno transazioni mainnet reali, consumeranno gas e modificheranno lo stato.

Le altre combinazioni non lasciano modifiche permanenti:

| Parametri | Risultato |
|---|---|
| nessun parametro | genera soltanto il piano |
| `--execute=false` | genera soltanto il piano |
| `--encode-only=true` | genera calldata, non invia |
| `--execute=true --dry-run=true` | esegue temporaneamente su fork e poi annulla |
| `--execute=true --dry-run=false` | invia realmente e conserva le modifiche |

Attenzione però alla rete configurata:

```text
HARDHAT_NETWORK=hardhat
```

significa rete locale o fork. Anche con `dry-run=false`, le transazioni rimangono soltanto nella blockchain Hardhat locale.

```text
HARDHAT_NETWORK=arbitrum
```

significa Arbitrum mainnet. Con `execute=true` e `dry-run=false` invii transazioni reali su mainnet.

Servono anche:

- una private key configurata;
- ETH sufficiente per il gas;
- signer autorizzato;
- manifest con `chainId: 42161`;
- contratti e indirizzi corretti;
- allowance e fondi necessari.

In forma compatta:

```text
execute=false
    → non inviare

execute=true + dry-run=true
    → prova e annulla

execute=true + dry-run=false
    → invia e conserva
```

Nota importante: i comandi di deployment sono un caso particolare. `deploy-core` e `deploy-bundle` richiedono `--execute=true` e, una volta avviati sulla rete selezionata, eseguono realmente il deployment; non usano il normale `ExecutionPlan` perché ogni indirizzo dipende dalla transazione di deployment precedente. Prima di usarli su mainnet vanno provati su un fork.