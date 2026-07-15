# Registro tecnico completo degli errori e delle correzioni

Data di consolidamento: 14 luglio 2026.

Questo documento censisce i problemi emersi dal rehearsal del POC USDC fino al deployment reale, al fork post-deploy, ai micro-flow reali e al primo ciclo automation `observe`.

Per ogni voce sono distinti:

- il sintomo osservato;
- la causa reale;
- il rischio se non fosse stato corretto;
- la modifica applicata;
- le implicazioni funzionali e di sicurezza;
- l'evidenza usata per considerare il problema risolto.

Non tutti i problemi erano bug nei contratti. Alcuni erano errori nei test, negli ABI TypeScript, nel wiring del deployment o nelle assunzioni dell'automazione. Correggere un test sbagliato non significa cambiare il protocollo per far passare il test: significa riallineare il test all'interfaccia realmente esistente.

## 1. Riepilogo immediato

| ID | Area | Problema | Livello | Stato |
|---|---|---|---|---|
| FIX-01 | Fork | Limite EIP-170 disabilitato | Configurazione test | Risolto |
| FIX-02 | SwapManager | Runtime oltre il limite di 25 byte | Contratto | Risolto e deployato |
| FIX-03 | Deployment | Deploy reale interrotto dopo alcuni contratti | Script/manifest | Ripreso senza duplicazioni |
| FIX-04 | Oracle | WETH metadata configurati prima del feed | Script/wiring | Risolto |
| FIX-05 | CLI | `success:false` restituiva exit code zero | Script | Risolto |
| FIX-06 | Beacon | Mancavano alias pubblici dei protocolli | Deployment/wiring | Risolto |
| FIX-07 | Aave test | API DataProvider chiamata sul Pool | Test | Risolto |
| FIX-08 | Aave | Micro-withdraw falliva per rounding | Contratto | Risolto e provato reale |
| FIX-09 | Euler | Plugin impossibilitato a mantenere le posizioni senza ownership | Contratto/ruoli | Risolto |
| FIX-10 | Morpho Vault | Share economicamente nulla rimaneva | Contratto | Risolto |
| FIX-11 | Morpho Vault | Mutazione di `activeVaults` durante iterazione | Contratto | Risolto |
| FIX-12 | Monitoring | Morpho Vault interrogato come lending protocol | Script | Risolto |
| FIX-13 | Monitoring | ABI delle protocol summary non corrispondente | Script ABI | Risolto |
| FIX-14 | Mock | Mock privo della superficie Lens reale | Test contract | Risolto |
| FIX-15 | Runtime | Impossibile iniettare signer impersonato | Script framework | Risolto |
| FIX-16 | Automation | Protocollo attivo assente dal control file | Configurazione | Risolto fail-closed |
| FIX-17 | Automation | Morpho usa API a due token | Script/configurazione | Risolto monitor-only |
| FIX-18 | Automation | Possibile somma tra unità WETH e USDC | Modello economico | Impedita fail-closed |
| FIX-19 | Certificazione | Test fixture non provava il manifest esatto | Infrastruttura test | Risolto |
| FIX-20 | RPC | Endpoint pubblico instabile e blocco mobile | Infrastruttura | Risolto per il POC |
| FIX-21 | Stato fork | Call separate non condividevano lo stato | Infrastruttura | Risolto |
| FIX-22 | Sicurezza operativa | Directory runtime automation non ignorata | Repository | Risolto |

## 2. FIX-01 — Il fork ignorava il limite massimo dei contratti

### Sintomo

Il rehearsal dichiarava deployabile `SwapManager`, mentre la prima transazione reale di deploy del contratto veniva rifiutata con un errore equivalente a `max code size exceeded`.

### Causa

In `hardhat.config.ts` era configurato:

```typescript
allowUnlimitedContractSize: true
```

Questa opzione consente alla rete Hardhat e ai fork locali di accettare bytecode che Arbitrum One rifiuta per il limite EIP-170.

### Rischio

Era un falso positivo di certificazione: test e rehearsal verdi, deployment reale impossibile.

### Fix

La configurazione è stata portata a:

```typescript
allowUnlimitedContractSize: false
```

### Implicazioni

- Nessuna modifica al comportamento on-chain.
- I fork diventano più severi e realistici.
- Un futuro contratto sovradimensionato fallirà prima di spendere gas reale.
- I plugin incompleti che richiedessero artificialmente dimensione illimitata non possono essere considerati deployabili.

### Evidenza

Compilazione, migration/deployment test e deployment reale di SwapManager riusciti con il limite attivo.

## 3. FIX-02 — SwapManager superava EIP-170

### Sintomo

Il runtime compilato misurava 24.601 byte, cioè 25 byte sopra il limite di 24.576.

### Causa

Le stringhe di revert vengono incorporate nel bytecode. SwapManager era già molto vicino al limite e anche controlli poco frequenti contribuivano alla dimensione finale.

### Fix

Sono stati introdotti i custom error:

```solidity
error InvalidBeaconAddress();
error InvalidBaseAssetCode();
error InvalidSwapLimits();
error SlippageTooHigh();
error InvalidRouter();
```

I relativi `require(..., "stringa")` sono diventati `if (...) revert ErrorName()`.

### Cosa non è cambiato

- Le validazioni non sono state rimosse.
- I limiti di slippage non sono stati indeboliti.
- Un router zero continua a essere rifiutato.
- Beacon e base asset code continuano a essere obbligatori.

### Implicazioni

- Runtime finale: 24.473 byte.
- Margine residuo: 103 byte, quindi ancora ridotto.
- Tooling moderno decodifica il nome del custom error; tooling vecchio potrebbe mostrare solo il selector.
- Modifiche future a SwapManager devono includere un controllo esplicito della dimensione.

### Evidenza

SwapManager reale deployato all'indirizzo registrato nel manifest e bytecode presente on-chain.

## 4. FIX-03 — Deployment reale parziale e ripartenza sicura

### Sintomo

Prima del fallimento EIP-170 erano già stati deployati Beacon, ProxyGeneral, ChainlinkAdapter, TokenManager e ValueCalculator.

### Rischio

Rilanciare tutto senza checkpoint avrebbe:

- duplicato i contratti;
- speso altro gas;
- prodotto indirizzi discordanti;
- reso incerto quale deployment fosse autorevole.

### Fix

Il manifest incrementale ha conservato ogni contratto e transaction hash già confermato. Dopo il fix di SwapManager il comando è stato ripreso sullo stesso manifest e ha saltato i checkpoint completi.

### Implicazioni

Il manifest non è un semplice report finale: è anche un journal resumable del deployment. Una voce può essere riutilizzata solo dopo verifica receipt e bytecode.

### Evidenza

Un solo indirizzo autorevole per ogni componente; nessun redeploy dei cinque contratti iniziali; manifest finale validato.

## 5. FIX-04 — WETH registrato senza oracle feed

### Sintomo

La configurazione dei metadata WETH falliva oppure avrebbe lasciato il sistema incapace di valorizzare una posizione Morpho WETH/USDC.

### Causa

La CLI aveva `token-config`, che configura TokenManager, ma non esponeva un comando indipendente per ChainlinkAdapter. Token metadata e price source sono due configurazioni diverse.

### Fix

Sono stati aggiunti:

- `configureOracleFeed()` in `scripts/operations/administration/tokens.ts`;
- comando CLI `oracle-feed`;
- ABI `setPriceFeed`;
- ordine operativo obbligatorio `feed -> metadata`;
- test locale specifico per asset non-base.

### Implicazioni

Registrare un ERC-20 non implica più, erroneamente, che sia anche valorizzabile. Il feed viene verificato con owner e post-condition.

### Evidenza

Feed WETH e metadata WETH configurati realmente; test Operations passato.

## 6. FIX-05 — La CLI trattava un fallimento come successo del processo

### Sintomo

Una simulazione o transazione poteva produrre:

```json
{ "success": false, "error": { ... } }
```

ma il processo terminava con exit code `0`.

### Causa

Il framework restituiva correttamente un risultato strutturato, ma `scripts/cli.ts` stampava il JSON senza tradurre `success:false` in fallimento del processo.

### Rischio

PowerShell, CI o un deployment runner avrebbero continuato con lo step successivo.

### Fix

Quando il risultato contiene `success === false`, la CLI imposta `process.exitCode = 1`.

### Implicazioni

- Il JSON diagnostico rimane disponibile.
- Gli orchestratori possono affidarsi a `$LASTEXITCODE`.
- Un errore non viene più nascosto da output formalmente valido.

## 7. FIX-06 — Alias Beacon mancanti

### Sintomo

`ProtocolManager.deposit("AaveV3", ...)` falliva con `Implementation not found` nonostante il plugin fosse deployato.

### Causa

Il bundle registrava il plugin nel Beacon con il nome implementativo, per esempio `AaveV3Plugin`, ma ProtocolManager risolveva il nome pubblico `AaveV3`.

### Fix

`deploy-bundle.ts` registra entrambi:

- il nome del contratto, utile all'infrastruttura;
- l'alias pubblico usato dal routing.

Alias certificati: `AaveV3`, `EulerV2`, `Morpho`, `MorphoVault`.

### Implicazioni

Non sono quattro plugin duplicati. Ogni coppia di chiavi Beacon punta allo stesso indirizzo.

### Evidenza

Test deployment confronta ogni alias con `manifest.protocols[name].plugin`; round-trip reali Aave, Euler e Morpho Vault riusciti.

## 8. FIX-07 — Il test Aave chiamava l'API sbagliata

### Sintomo

Il test leverage cercava `getReserveAToken()` e `getReserveVariableDebtToken()` sull'indirizzo configurato come Aave Pool.

### Causa

Quei metodi appartengono alla superficie del ProtocolDataProvider, non al Pool configurato.

### Fix

Il test ora usa la funzione canonica del Pool:

```solidity
getReserveData(asset)
```

e legge `aTokenAddress` e `variableDebtTokenAddress` dalla tuple restituita.

### Implicazioni

È stato corretto il test, non il contratto Aave esterno e non il plugin. Il test ora dimostra la dipendenza realmente utilizzata.

### Evidenza

Suite Aave leverage: 32/32.

## 9. FIX-08 — Aave micro-withdraw falliva per due unità

### Sintomo

Dopo un supply di 1.000.000 unità USDC, il saldo aToken riscattabile poteva essere 999.998. Richiedere il nominale originario causava `NotEnoughAvailableUserBalance()`.

### Causa

Aave usa scaled balance e liquidity index. Su quantità minime la conversione può arrotondare di una o due unità dell'asset.

### Fix

Per un withdraw con importo esplicito:

```solidity
withdrawAmount = min(amountRequested, aTokenBalance);
```

`amount == 0` mantiene il percorso canonico Aave `type(uint256).max`, cioè withdraw-all.

### Implicazioni

- Non è possibile prelevare più del saldo realmente riscattabile.
- Non viene creato valore.
- L'evento continua a riportare l'importo effettivo.
- Il chiamante vede l'eventuale differenza di rounding.

### Evidenza

Micro-flow Aave reale concluso con balance, debt e aToken a zero.

## 10. FIX-09 — EulerRegistry richiedeva troppi o troppo pochi privilegi

### Sintomo

EulerPlugin deve creare, aggiornare e chiudere record di posizione. Le funzioni erano `onlyOwner`; il plugin non poteva chiamarle. Trasferire l'intera ownership al plugin avrebbe risolto il sintomo creando però un rischio amministrativo.

### Causa

Il registry non distingueva:

- amministrazione della configurazione vault;
- manutenzione operativa dei record di posizione.

### Fix

Sono stati aggiunti:

- `mapping(address => bool) positionManagers`;
- `setPositionManager(address,bool)` riservata all'owner;
- evento `PositionManagerSet`;
- modifier `onlyPositionManagerOrOwner` sulle sole funzioni di position accounting;
- checkpoint automatico `eulerRegistry:authorizePositionManager` nel deploy bundle.

### Cosa il plugin non può fare

- `setVault`;
- rimuovere o sostituire vault;
- nominare altri position manager;
- trasferire ownership.

### Evidenza

74 test EulerRegistry, test bundle, verifica fork e verifica on-chain del ruolo. L'owner resta il deployer in attesa della Safe.

## 11. FIX-10 — Dust share Morpho Vault

### Sintomo

Dopo withdraw nominalmente completo:

- valore posizione: zero;
- ma una share ERC-4626 rimaneva;
- `activePositionCount` restava uno.

### Causa

La conversione ERC-4626 tra asset e share può arrotondare. Una share residua poteva avere `convertToAssets(share) == 0`.

### Fix

Dopo `withdraw` il plugin controlla le share residue. Le riscatta solo se il loro valore convertito è esattamente zero.

### Protezione importante

Share residue con valore positivo non vengono bruciate o dimenticate. Restano tracciate e visibili.

### Evidenza

60/60 test fork mirati; certificazione manifest; micro-flow reale con share esterne e active tracking a zero.

## 12. FIX-11 — Cleanup `activeVaults` durante l'iterazione

### Sintomo

Il redeem-all poteva saltare elementi o lasciare riferimenti obsoleti se la lista veniva modificata mentre era iterata.

### Causa

La rimozione da un array compatto cambia indici e lunghezza.

### Fix

`_redeemAllVaults` itera una copia in memoria della lista originale. Dopo ogni tentativo rimuove dal tracking solo il vault il cui saldo share è realmente zero.

### Gestione dei fallimenti

Una redemption fallita non viene cancellata dal tracking. Il problema rimane osservabile e gestibile come incidente.

## 13. FIX-12 — Morpho Vault interrogato come protocollo di lending

### Sintomo

Il comando `position` e il primo monitor tentavano di chiamare `getDebt` e `getHealthFactor` per Morpho Vault, provocando revert dopo un deposit riuscito.

### Causa

MorphoVaultPlugin è yield-only ERC-4626. Non ha debito né rischio di liquidazione e non implementa la stessa superficie dei lending adapter.

### Fix

`readProtocolPosition()` riconosce `kind === "morpho-vault"` e restituisce:

- balance reale;
- debt zero;
- health factor massimo.

### Implicazioni

Non si nasconde un debito: quel tipo di adapter non può crearne uno. La semantica è modellata esplicitamente.

## 14. FIX-13 — ABI TypeScript delle protocol summary obsoleta

### Sintomo

Il monitor decodificava `getAllProtocolSummaries()` con campi non corrispondenti alla struct Solidity attuale.

### Causa

L'ABI locale descriveva una versione precedente più ampia della summary.

### Fix

`scripts/framework/abis.ts` è stato riallineato alla tuple reale:

```text
name, protocolType, totalCollateral, totalDebt, netValue,
activePositionCount, lowestHealthFactor, isHealthy
```

### Rischio evitato

Decodifiche errate, valori scambiati o revert durante health/status.

## 15. FIX-14 — MockOperationalProtocol non rappresentava il Lens reale

### Sintomo

I test operativi non potevano esercitare correttamente protocol summary, APY e circuit breaker.

### Fix

Il mock test-only implementa ora:

- `getProtocolSummary()` con la struct reale;
- `isCircuitBreakerActive()`;
- `circuitBreakerTripped()`;
- `getNetAPY()`.

### Implicazioni

Nessun bytecode di produzione è influenzato. Aumenta la fedeltà dei test locali.

## 16. FIX-15 — Runtime senza signer esplicito

### Sintomo

La simulazione fork dell'automazione doveva impersonare l'owner del manifest, ma `createRuntime()` prendeva sempre il primo signer configurato da Hardhat.

### Fix

`RuntimeInput` accetta un `signer` esplicito. Se fornito viene usato e ne viene verificato l'indirizzo; altrimenti resta il comportamento precedente.

### Implicazioni

- Simulazioni e test usano l'identità corretta.
- Non viene inserita alcuna private key nel control file.
- Un mismatch tra signer dichiarato e reale viene rifiutato.

## 17. FIX-16 — L'automazione poteva ignorare un protocollo attivo

### Sintomo

Una configurazione automation poteva elencare solo i protocolli sui quali desiderava allocare, omettendo un protocollo attivo nel ProtocolManager.

### Rischio

Il managed value sarebbe stato sottostimato e l'allocazione calcolata su uno stato incompleto.

### Fix

L'observer confronta i nomi registrati on-chain con quelli del control file. Un protocollo attivo mancante causa fallimento.

### Implicazioni

Anche un protocollo non allocabile deve essere dichiarato come monitor-only, non semplicemente ignorato.

## 18. FIX-17 — Morpho non usa l'API lending generica a un token

### Sintomo

Il primo ciclo reale `observe` è terminato `FAILED: execution reverted`. Non è stata inviata alcuna transazione perché `execution.kind` era `disabled`.

### Causa

Il market Morpho è identificato dalla coppia collaterale/loan. Le letture richiedono:

```text
getDebt(collateralCode, loanCode)
```

mentre il monitor generico chiedeva debt e health su un solo token.

### Fix

Il control file dichiara esplicitamente:

```json
{
  "name": "Morpho",
  "enabled": false,
  "targetBps": 0,
  "maxBps": 0,
  "collateralTokenCode": "WETH",
  "loanTokenCode": "USDC"
}
```

L'observer usa l'API specifica del plugin per verificare collaterale WETH e debito USDC.

### Implicazioni

Morpho è registrato e monitorato, ma il controller supply-only USDC non può depositarvi automaticamente.

### Evidenza

Secondo preflight reale `ready:true`; ciclo reale successivo `NO_ACTION` con quattro protocolli a zero.

## 19. FIX-18 — Divieto di sommare unità WETH e USDC

### Problema concettuale

Un balance WETH a 18 decimali non può essere sommato direttamente a un balance USDC a 6 decimali. Anche normalizzare i decimali non basta: serve un prezzo affidabile e temporalmente valido.

### Fix

Per Morpho monitor-only:

- se collaterale e debito sono zero, contribuisce zero ai managed assets;
- se uno dei due è non-zero, il ciclo fallisce e richiede revisione manuale;
- nessuna conversione economica viene inventata.

### Implicazioni

È un comportamento volutamente conservativo. In futuro si potrà supportare una posizione Morpho non-zero solo introducendo telemetria oracle normalizzata e testata.

## 20. FIX-19 — Mancava la certificazione del manifest esatto

### Problema

Le fixture di protocollo dimostravano che i contratti potevano funzionare, ma non che gli indirizzi prodotti dal deployment fossero collegati correttamente tra loro.

### Fix

È stato creato `test/deployment/POCManifest.rehearsal.test.ts`, che consuma `POC_MANIFEST` e verifica:

- bytecode di ogni indirizzo;
- alias Beacon;
- owner e positionManager Euler;
- round-trip Aave;
- round-trip Euler;
- round-trip Morpho WETH/USDC;
- round-trip Morpho Vault;
- zero posizioni residue e active vault.

Il test usa whale solo sul fork, impersonazione, snapshot e revert.

### Evidenza

Certificazione post-deploy al blocco 483832997: 2/2.

## 21. FIX-20 — RPC pubblica, retry e blocco mobile

### Sintomo

Timeout, retry ripetuti e HTTP 429 durante le suite fork. Run lunghi potevano inoltre osservare stato a blocchi differenti.

### Fix operativo

- Endpoint Alchemy autenticato per rehearsal e deployment.
- `FORK_BLOCK_NUMBER` fissato nelle certificazioni.
- Timeout fork coerenti con retry RPC.
- Numero massimo di blocchi attraversati da una singola osservazione automation.
- Cinque retry con delay nel control file reale.

### Implicazioni

I retry coprono errori transitori, non revert deterministici. Un errore di contratto non viene ripetuto fingendo che sia un problema di rete.

## 22. FIX-21 — Call isolate invece di fork persistente

### Problema

Due `eth_call` separate partono dallo stesso stato iniziale. La seconda non vede approval, registry update o deposit simulati dalla prima.

### Fix

Il rehearsal completo usa un nodo fork persistente e transazioni simulate nello stesso stato. Le certificazioni usano snapshot/revert per ripristinare lo stato solo al termine.

### Implicazioni

È possibile provare sequenze dipendenti reali senza modificare mainnet e senza contaminare il test successivo.

## 23. FIX-22 — Stato runtime automation nel worktree

### Problema

Il primo preflight ha creato `.automation-state/`, contenente run, lock ed heartbeat locali. Non è sorgente applicativo e non deve essere versionato.

### Fix

`.automation-state/` è stato aggiunto a `.gitignore`.

### Implicazioni

Il control file resta versionabile; lo stato operativo di ciascun server resta locale e separato.

## 24. Scelte corrette che non erano bug

### MorphoRegistry condiviso

MorphoPlugin e MorphoVaultPlugin condividono intenzionalmente MorphoRegistry. Il registry contiene namespace distinti per market Morpho Blue e vault ERC-4626. Non condivide fondi, share o posizioni; condivide configurazione amministrativa dell'ecosistema.

Separarlo sarebbe necessario solo se i due moduli avessero governance o cicli di upgrade differenti.

### Due conferme

Una transazione viene inviata una sola volta. Lo script attende il blocco di inclusione e un ulteriore blocco prima di procedere. Non è una correzione contrattuale ma una policy prudenziale del runner.

### Manifest separato dai segreti

Il manifest contiene indirizzi e hash pubblici. RPC e private key restano in variabili d'ambiente. Non è un limite: è una proprietà di sicurezza intenzionale.

## 25. Cosa non è stato modificato in questa fase

### LiquidityManager

Durante la fase finale rehearsal/deploy descritta in questo documento, `contracts/LiquidityManager.sol` non è stato modificato. È stato deployato un nuovo esemplare e ne sono stati provati deposit, share mint, prelievo completo, total supply e total value.

Le modifiche precedenti relative a custody, bootstrap share, rounding, automatic withdrawal e isolamento sono documentate in:

- `../Test Documentation/1_Motivazioni_Cambiamenti_Contratti_e_Test.md`;
- `../Test Documentation/2_Infrastruttura_Completa_e_Catalogo_Test.md`.

### Contratti esterni

Non sono stati modificati Aave, Euler, Morpho Blue, HexaOne Vault, USDC, WETH o Chainlink. Sono dipendenze esterne; sono stati verificati e configurati i relativi indirizzi.

### GMX e Dolomite

Non sono stati corretti, deployati o certificati. Sono stati esclusi intenzionalmente perché incompleti.

## 26. Modifiche infrastrutturali aggiuntive

Oltre ai fix direttamente causati da errori, sono stati introdotti:

- manifest reale con transaction hash e metadata finali;
- checkpoint dei bundle e dei registry;
- control file USDC reale in observe;
- preflight cumulativo che controlla chain, bytecode, manifest, owner, protocolli e directory;
- dipendenze ufficiali Safe (`api-kit`, `protocol-kit`, `types-kit`);
- modalità `observe`, `advisory` e `autonomous` fail-closed;
- store atomico, lock, heartbeat, recovery e supervised loop;
- simulazione atomica dei piani;
- binding immutabile tra run e proposta Safe;
- documentazione deployment, update, evidenze e prossimi gate.

Queste aggiunte non rendono autonomous automaticamente sicuro. Preparano il percorso verso Safe advisory mantenendo l'esecuzione reale disabilitata.

## 27. Gate ancora aperti: non chiamarli fix completati

I seguenti punti non sono errori nascosti ma lavoro ancora necessario:

1. osservazione supervisionata per almeno 24–72 ore;
2. pubblicazione/verifica sorgenti sull'explorer;
3. selector whitelist definitive;
4. fee, limiti, slippage ed emergency policy definitivi;
5. creazione Safe, threshold e recovery process;
6. prova Safe advisory end-to-end;
7. trasferimento ownership alla Safe;
8. telemetria oracle/APY normalizzata prima di supportare Morpho non-zero nell'automazione;
9. audit indipendente prima di capitale significativo o modalità autonoma.

## 28. Matrice file modificati

| File | Motivo principale |
|---|---|
| `contracts/SwapManager.sol` | Dimensione EIP-170 e custom error |
| `contracts/plugins/AaveV3Plugin.sol` | Clamp micro-withdraw al saldo aToken |
| `contracts/plugins/EulerRegistry.sol` | Ruolo positionManager limitato |
| `contracts/plugins/MorphoVaultPlugin.sol` | Dust share e cleanup activeVaults |
| `contracts/mocks/MockOperationalProtocol.sol` | Mock compatibile con Lens reale |
| `hardhat.config.ts` | Limite contract size attivo sul fork |
| `scripts/cli.ts` | Oracle feed e exit code corretto |
| `scripts/framework/abis.ts` | Protocol summary ABI corretta |
| `scripts/framework/runtime.ts` | Signer esplicito/impersonato |
| `scripts/operations/administration/tokens.ts` | Configurazione oracle separata |
| `scripts/operations/deployment/deploy-bundle.ts` | Alias Beacon e ruolo Euler |
| `scripts/operations/protocols/positions.ts` | Semantica yield-only |
| `scripts/automation/*` | Controller, preflight, Safe, store, service e monitor-only |
| `test/deployment/POCManifest.rehearsal.test.ts` | Certificazione indirizzi reali su fork |
| `test/integration/aave/AaveV3Plugin.leverage.test.ts` | API Aave Pool corretta |
| `test/scripts/Deployment.test.ts` | Alias e ruolo Euler verificati |
| `test/scripts/Operations.test.ts` | Oracle e Morpho Vault monitoring |
| `test/unit/EulerRegistry.test.ts` | Separazione ruoli e revoca |
| `test/automation/VaultAutomationController.test.ts` | Policy, Safe, lock e fail-closed |
| `.gitignore` | Esclusione stato runtime automation |

## 29. Evidenze finali

- compile: PASS;
- typecheck: PASS;
- script suite: 39/39;
- automation: 14/14;
- plugin fork: 221/221;
- E2E rilevanti: 80/80;
- Aave leverage: 32/32;
- Morpho Vault fork: 60/60;
- EulerRegistry: 74/74;
- manifest post-deploy: 2/2;
- deployment bundle: 3/3;
- migration/deployment dopo EIP-170: 25/25;
- micro-flow reali Aave, Euler e Morpho Vault: PASS;
- stato finale: pool, posizioni, share e allowance a zero;
- automation reale: preflight `ready:true`, ciclo `NO_ACTION`, execution disabilitata.

## 30. Documenti correlati

- `01_Checklist_Deploy_Nuovo_POC_USDC.md`: checklist e gate.
- `03_Registro_Evidenze_PreDeploy.md`: indirizzi, saldi e transaction hash.
- `04_Report_Deploy_Reale_e_Prossimi_Gate.md`: stato operativo e prossimi passi.
- `../Test Documentation/1_Motivazioni_Cambiamenti_Contratti_e_Test.md`: modifiche strutturali precedenti.
- `../Vault Automation Controller/10_Control_File_Implementation/README.md`: indice dell'automazione e Safe.
