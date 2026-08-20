# Fasi 0–1 — Stato attuale e audit iniziale

## Obiettivo

Questo ciclo congela la versione che ha prodotto il POC USDC reale e verifica sull'explorer i sorgenti dei 22 contratti proprietari. Non modifica configurazioni o ownership on-chain e non muove capitale.

## Stato Git osservato

- repository: `Poppo753/TestSmartContract`;
- branch: `dev-26`;
- commit del deployment: `8f53e98`;
- stato remoto iniziale: branch locale avanti di un commit rispetto a `origin/dev-26`;
- tag `arbitrum-usdc-poc-1`: non ancora esistente all'inizio del ciclo;
- unica modifica successiva al commit: spostamento e generalizzazione di `Prompt.md`, autorizzata dall'utente come commit separato.

La prima ipotesi era far puntare il tag direttamente a `8f53e98`. La prova su worktree pulito ha però rilevato che `npm ci` fallisce per un peer conflict già presente nel lockfile (`ethers 6.13.4` contro il requisito `>=6.14` di `hardhat-chai-matchers 2.1.0`).

La baseline certificata deve quindi includere una `.npmrc` con `legacy-peer-deps=true`. Il tag punterà al commit di certificazione che contiene questa correzione e la documentazione, mentre l'albero `contracts/` dovrà essere dimostrato identico a `8f53e98`. In questo modo il tag è realmente installabile senza affermare falsamente che il primo commit fosse già riproducibile.

## Stato del deployment

- chain ID: 42161;
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- deployer: `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- contratti proprietari unici: 22;
- base asset: USDC;
- protocolli: Aave, Euler, Morpho, Morpho Vault;
- GMX e Dolomite: esclusi;
- micro-flow reali: completati e ripuliti;
- post-deploy fork: completato;
- automation: observe, execution disabilitata.

## Configurazione di compilazione da preservare

- Solidity: `0.8.27`;
- optimizer: abilitato;
- runs: 100;
- `viaIR`: true;
- EIP-170 applicato anche sul fork;
- Sourcify: disabilitato;
- explorer API key: presente in ambiente, valore non documentato.

## Censimento dei 22 contratti

### Core — 11

1. Beacon;
2. ProxyGeneral;
3. ChainlinkAdapter;
4. TokenManager;
5. ValueCalculator;
6. SwapManager;
7. ParameterManager;
8. EmergencyHandler;
9. LiquidityManager;
10. ProtocolManager;
11. FlashLoanService.

### Aave — 3

12. AaveV3Registry;
13. AaveV3Plugin;
14. AaveV3LensAdapter.

### Euler — 3

15. EulerRegistry;
16. EulerV2Plugin;
17. EulerLensAdapter.

### Morpho — 3

18. MorphoRegistry;
19. MorphoPlugin;
20. MorphoLensAdapter.

### Morpho Vault — 2

21. MorphoVaultPlugin;
22. MorphoVaultLensAdapter.

MorphoRegistry non viene contato due volte perché è condiviso intenzionalmente dai due bundle.

## Dipendenze esterne che non devono essere verificate come nostre

- USDC e WETH;
- feed Chainlink;
- Aave Pool e token di reserve;
- Euler EVC, Lens e vault;
- Morpho Blue, oracle e IRM;
- HexaOne USDC Vault.

## Rischi specifici

1. Tag creato sul commit sbagliato.
2. Inclusione accidentale di `.env` o segreti.
3. Constructor arguments ricostruiti in modo errato.
4. Verifica di un indirizzo legacy invece del manifest POC.
5. Compiler settings differenti da quelli del deploy.
6. Explorer API key non valida o API non compatibile.
7. Contratto già verified con metadata differenti.
8. Artifact locali non corrispondenti al commit baseline.
9. Pubblicazione GitHub incompleta per assenza di GitHub CLI.
10. `npm ci` pulito fallisce senza la policy peer dependency usata implicitamente nell'ambiente originale.

## Stato delle credenziali e degli strumenti

- RPC Arbitrum: presente;
- API key explorer: presente;
- private key: presente nell'ambiente ma non necessaria per la verifica sorgenti;
- Git remote: configurato;
- GitHub CLI: assente all'inizio del ciclo, quindi commit/push/PR restano bloccati dal workflow GitHub finché non viene installato.

## Output attesi

- tag locale e remoto sul commit baseline;
- commit separato per Prompt e documentazione fasi 0–1;
- archivio esportabile con checksum;
- matrice di verifica dei 22 contratti;
- URL explorer e risultato per ogni indirizzo;
- checklist aggiornata con evidenze e blocchi reali.

## Risultati dell'audit eseguito il 14 luglio 2026

- Il clean-room ha confermato che `npm ci` puro falliva per il peer conflict già descritto. `npm ci --legacy-peer-deps`, equivalente alla `.npmrc` ora versionata, è passato.
- Compile pulita: 90 file Solidity compilati, 103 artifact prodotti.
- `scripts:typecheck`: PASS.
- `scripts:test`: 39 PASS.
- `automation:test`: 14 PASS.
- Evidenza storica della suite completa sul medesimo codice Solidity: 1.193 unit, 654 integration, 230 E2E attivi, 83 invariants/security e 29 performance; GMX/Dolomite esclusi come richiesto.
- Preflight Arbitrum del manifest reale: 22/22 contratti con bytecode, receipt status 1 e address coerente col contratto creato.
- `SwapManager`: 24.473 byte runtime, 103 byte sotto il limite EIP-170.
- `git diff 8f53e98 -- contracts`: vuoto; nessun sorgente Solidity è stato modificato da questa certificazione.
- `.env` e `.automation-state` non risultano tracciati.
- È stata trovata una credenziale OneInch hardcoded in quattro file, già presente su `origin/dev-26` dal commit `5fea9a2`. I quattro literal sono stati rimossi dal worktree e sostituiti da `ONEINCH_API_KEY` di ambiente. La credenziale storica deve essere revocata/ruotata prima di considerarla utilizzabile.
- Audit npm production: 17 advisory transitivi (10 low, 3 moderate, 4 high, 0 critical); diretti: `@chainlink/contracts` high e `@uniswap/v3-periphery` moderate. Non equivalgono automaticamente a vulnerabilità del bytecode deployato e richiedono un assessment separato prima della produzione.
- Audit npm complessivo dopo l'upgrade mirato del verificatore: 57 advisory (22 low, 16 moderate, 15 high, 4 critical). Non è stato eseguito `npm audit fix --force`.

## Blocchi esterni ancora aperti

I precedenti blocchi di pubblicazione sono risolti: repository pubblico, branch/tag/PR pubblicati, archivio prodotto e autorizzazione Arbiscan ricevuta. La verifica pubblica è completata 22/22. Resta soltanto la copia fisica degli archivi su storage separato, che non può essere certificata dal repository locale.

Il 15 luglio 2026 `gh 2.96.0` è stato installato e autenticato come `Poppo753`. Il remoto risolto è `Poppo753/TestPOC`, repository pubblico con default branch `master`; il precedente blocco GitHub è quindi risolto.
