# Fasi 0–1 — Strategia espansa e revisionata

## 1. Separare identità del deployment e lavoro successivo

La baseline deve descrivere il codice già deployato e deve anche poter essere installata da zero. La prima strategia prevedeva un tag direttamente su `8f53e98`; il clean-room `npm ci` ha dimostrato che quel commit non soddisfa il gate di riproducibilità a causa di un peer conflict nel lockfile.

La strategia revisionata tagga quindi il commit di certificazione contenente `.npmrc`, Prompt, tooling e report, ma impone una prova separata che l'albero `contracts/` sia identico a `8f53e98`. Il tag rappresenta la baseline riproducibile; `8f53e98` resta il commit storico dell'esecuzione del deploy.

Lo spostamento di Prompt, i report di verifica e l'eventuale tooling aggiunto appartengono a un commit successivo. Questa separazione consente di rispondere a due domande diverse:

- quale codice ha prodotto il deployment?
- quale documentazione/tooling è stato aggiunto per certificarlo?

## 2. Audit prima del tag

Prima di creare il tag occorre:

1. controllare branch e commit;
2. controllare che il manifest sia contenuto nel commit;
3. validare manifest e control file;
4. verificare che `.env` non sia tracciato;
5. elencare i file sensibili eventualmente tracciati;
6. ricompilare usando la configurazione del commit;
7. eseguire typecheck e suite rilevanti;
8. acquisire hash di commit, manifest, lockfile e build-info.

Il tag viene creato solo dopo questi controlli e dopo avere dimostrato che `contracts/` non è cambiato rispetto al commit storico.

## 3. Riproducibilità

Un clone pulito ideale dovrebbe usare `npm ci`. Nel worktree corrente è possibile certificare:

- lockfile coerente;
- compile ripetibile;
- test passanti;
- manifest valido;
- bytecode on-chain presente;
- constructor arguments deterministici.

La prova più forte sarebbe una seconda directory pulita creata dal commit taggato, seguita da `npm ci` e suite completa. Va evitato qualsiasi uso di `.env` dentro l'archivio.

## 4. Archivio baseline

L'archivio preparato localmente è un pacchetto da copiare offline, non è già un backup offline. Deve contenere almeno:

- source tree del tag;
- manifest reale;
- package-lock;
- hardhat config;
- build-info rilevanti;
- checksum SHA-256;
- commit e tag;
- istruzioni di ripristino.

Non deve contenere:

- `.env`;
- private key;
- RPC URL autenticati;
- API key explorer;
- `.automation-state`;
- node_modules.

## 5. Ricostruzione constructor arguments

Gli argomenti non devono essere dedotti dall'intuizione. La fonte è il codice di `deploy-core.ts` e `deploy-bundle.ts`, incrociato col manifest.

### Core

- Beacon: nessun argomento.
- ProxyGeneral: Beacon, `USDC`.
- ChainlinkAdapter: nessun argomento.
- TokenManager: Beacon, ChainlinkAdapter.
- ValueCalculator: Beacon, `USDC`.
- SwapManager: Beacon, `USDC`.
- ParameterManager: Beacon, `6`.
- EmergencyHandler: Beacon.
- LiquidityManager: Beacon, `USDC`.
- ProtocolManager: Beacon.
- FlashLoanService: Beacon.

### Aave

- Registry: nessun argomento.
- Plugin/Lens: Beacon, `USDC`, Aave Pool.

### Euler

- Registry: nessun argomento.
- Plugin: Beacon, `USDC`, EVC, AccountLens.
- Lens: Beacon, `USDC`, AccountLens, VaultLens, UtilsLens, EVC.

### Morpho

- Registry: nessun argomento.
- Plugin/Lens: Beacon, `USDC`, Morpho Blue.

### Morpho Vault

- Plugin: Beacon.
- Lens: Beacon, `USDC`.

## 6. Ordine di verifica explorer

Ordine consigliato:

1. contratti senza constructor args;
2. core con dipendenze interne;
3. Aave;
4. Euler;
5. Morpho;
6. Morpho Vault;
7. controllo finale URL e stato.

Questo ordine riduce la superficie diagnostica: prima si verifica che compiler/API funzionino su un caso semplice.

## 7. Tooling di verifica

È preferibile un file TypeScript che descriva in modo dichiarativo:

```text
manifestKey -> fully qualified contract -> constructor arguments
```

e chiami il task Hardhat `verify:verify`. Vantaggi:

- nessun copia/incolla di 22 comandi;
- indirizzi sempre letti dal manifest;
- risultati uniformi;
- possibilità di rerun idempotente;
- report JSON generabile senza segreti.

Il runner deve distinguere:

- verified;
- already verified;
- failed;
- skipped per indirizzo mancante;
- API/network failure.

Un errore su un contratto non deve impedire di raccogliere i risultati degli altri; il processo finale deve però uscire non-zero se esiste almeno un failure.

## 8. Controllo bytecode

La verifica explorer è la prova principale della corrispondenza tra source e bytecode. In aggiunta, prima dell'invio si controllano:

- presenza bytecode a ogni indirizzo;
- chain ID 42161;
- receipt di deployment dal manifest;
- runtime size SwapManager;
- assenza di indirizzi duplicati imprevisti.

Per contratti con immutable, un confronto byte-a-byte ingenuo con `deployedBytecode` non è sufficiente perché i valori constructor sono inseriti nel runtime. Il verifier gestisce correttamente questa ricostruzione.

## 9. Strategia GitHub

Il branch esistente `dev-26` viene mantenuto. Non serve creare un branch `agent/*` perché non siamo sul default branch.

Sequenza:

1. commit separato dello spostamento Prompt;
2. commit di documenti/tooling/evidenze fasi 0–1;
3. verifica che `git diff 8f53e98 -- contracts` sia vuoto;
4. creazione tag sul commit finale certificato;
5. push branch;
6. push tag;
7. rilevazione o apertura draft PR verso il default branch.

Il workflow richiede `gh` autenticato. In sua assenza non si improvvisano token o credenziali alternative.

## 10. Revisione critica della strategia

### Scelta revisionata dopo prova negativa: tag sul commit certificato

Taggare direttamente `8f53e98` avrebbe mantenuto l'identità storica ma avrebbe pubblicato una baseline per cui `npm ci` fallisce. Il tag viene spostato sul commit certificato, accompagnato da:

- hash storico `8f53e98`;
- confronto invariato dell'albero `contracts/`;
- `.npmrc` che rende deterministica la policy peer dependency;
- report di verifica explorer.

### Scelta confermata: verifica dichiarativa

Riduce errori manuali ed è riutilizzabile per deployment futuri.

### Scelta corretta: non usare private key

La source verification non richiede firma blockchain. Il runner deve funzionare con RPC e API key explorer soltanto.

### Correzione rispetto a una prima idea: non includere artifact indiscriminatamente in Git

Gli artifact possono essere archiviati fuori Git con checksum. Committare l'intera directory `artifacts` aumenterebbe molto il repository ed è inutile se la build è riproducibile.

### Correzione: archivio locale non equivale a backup offline

Il task prepara il pacchetto, ma il gate “offline” resta parziale finché l'utente non lo copia su storage separato.

### Correzione: non segnare fase 1 completa con verification parziale

Un'API key non valida, un constructor mismatch o un contratto non verificato mantiene il gate aperto anche se gli altri 21 passano.

## 11. Criteri di completamento

Fase 0 completa quando:

- test e build passano;
- tag corretto creato;
- branch/tag pubblicati;
- archivio e checksum prodotti;
- nessun segreto incluso;
- hash documentati.

Fase 1 completa quando:

- tutti i 22 indirizzi sono verified/already verified;
- URL registrati;
- settings e constructor args documentati;
- nessuna eccezione aperta.

Se GitHub CLI manca, la certificazione tecnica può proseguire ma la fase 0 resta formalmente incompleta sul gate di pubblicazione.
