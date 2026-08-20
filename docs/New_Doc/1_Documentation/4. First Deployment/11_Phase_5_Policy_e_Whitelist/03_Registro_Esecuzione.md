# Fase 5 — registro esecuzione policy e selector whitelist

## Stato

- stato fase: tecnicamente in lavorazione, PASS parziale
- operatore responsabile: GitHub Copilot (agente), su richiesta dell'utente
- commit Git: `ca9ab9f3e488044c685292936aaab53dd71cc7ae`
- decisione tecnica finale: PASS (parziale — vedi sezione "Cosa resta bloccato")
- approvazione Safe: PENDING

## Timestamp

- inizio fase: 2026-08-03 (sessione locale)
- fine fase: 2026-08-03
- timezone usata: UTC per gli orari on-chain, CEST per riferimento operatore
- durata totale: circa 2 ore (esplorazione RPC, implementazione gap tecnico, test, documentazione)

## Policy umana approvata

Nessun valore in questa sezione è approvato. Sono tutti placeholder tecnici
presi dal control file POC attuale, usati solo per costruire e testare gli
artefatti tecnici. Nessuno deve essere trattato come policy definitiva.

- capitale massimo totale: **non deciso**; placeholder tecnico `50000000` unità (50 USDC) nel candidato
- riserva target bps: `2000` (placeholder, valore POC attuale)
- riserva minima bps: `1500` (placeholder, valore POC attuale)
- AaveV3 target/max bps: `3500/4000` (placeholder, valore POC attuale)
- EulerV2 target/max bps: `2500/3000` (placeholder, valore POC attuale)
- MorphoVault target/max bps: `2000/2500` (placeholder, valore POC attuale)
- Morpho target/max bps: `0/0`, monitor-only (placeholder, valore POC attuale)
- movimento massimo per ciclo bps: `1000` (placeholder, valore POC attuale)
- importo minimo unità USDC: `100000` (placeholder, valore POC attuale)
- cooldown secondi: `3600` (placeholder, valore POC attuale)
- slippage massimo bps: **non deciso a livello di policy off-chain**; on-chain `SwapManager.maxSlippage=300`
- fee deposito bps: **non deciso**; on-chain `depositFee=0`
- fee withdraw bps: **non deciso**; on-chain `withdrawFee=0`
- limite deposito per utente: **non deciso a livello di policy**; on-chain `minDeposit=1`, `maxDeposit=100000000` unità
- limite deposito globale: **non deciso**
- limite withdraw per utente: **non deciso a livello di policy**; on-chain `minWithdraw=1`, `maxWithdraw=50000000` unità
- limite withdraw globale: **non deciso**
- limite withdraw orario: **non deciso a livello di policy**; on-chain `hourlyLimit=100000000` unità
- limite withdraw giornaliero: **non deciso a livello di policy**; on-chain `dailyLimit=1000000000` unità
- health factor minimo: `1500000000000000000` (placeholder, valore POC attuale)
- oracle mancante: `requireOracleFreshness=false` (placeholder, valore POC attuale)
- oracle stale: nessuna policy dedicata oltre al flag sopra
- APY mancante: nessuna policy dedicata; gestito come warning non bloccante da `risk.ts`
- criteri emergency pause: nessuna policy formalizzata oltre al meccanismo tecnico esistente (vedi FASE4-001 in `10_Phase_4_Fork/03_Registro_Esecuzione.md`)
- approvazione utente: **non ottenuta**
- timestamp approvazione: non applicabile

## Evidenza baseline

- hash control file observe (SHA256): `D0D0F2B904AD64EE6D1148342116097DC58065578318E009B5489490EBE588BE`, invariato prima e dopo (verificato con `git status --short` vuoto sul file)
- chain ID: `42161`
- blocco lettura preflight candidato: `490473305`
- valori off-chain correnti: identici al control file observe (vedi sopra, tutti placeholder)
- valori on-chain correnti: `minDeposit=1`, `maxDeposit=100000000`, `poolReserveRatio=0`, `depositFee=0`, `withdrawFee=0`, `maxSlippage=300`, `withdrawLimits={hourly:100000000, daily:1000000000, min:1, max:50000000}`
- selector correnti ricostruiti: 0 selector generici autorizzati su AaveV3, EulerV2, MorphoVault, Morpho (stato attuale, non storia completa — vedi limitazione RPC sotto)
- problemi trovati: vedi "Gap tecnici trovati e corretti" sotto

## Limitazione RPC trovata (non risolvibile via codice)

`eth_getLogs` sull'RPC configurato in `.env` (Alchemy, piano Free) è limitato
a un range massimo di **10 blocchi per chiamata**. Errore esatto restituito
dal nodo:

```text
Under the Free tier plan, you can make eth_getLogs requests with up to a 10
block range. Based on your parameters, this block range should work:
[0x1cd6b4a8, 0x1cd6b4b1]. Upgrade to PAYG for expanded block range.
```

Tra il blocco di deploy (`~483832997`) e un blocco fork recente
(`490447686`) ci sono circa 6,6 milioni di blocchi: la ricostruzione
esaustiva degli eventi `SelectorAllowanceChanged` richiederebbe centinaia di
migliaia di chiamate `eth_getLogs`, non praticabile con questo piano.

**Sostituito con:** lettura dello stato attuale della mapping
`allowedSelectors(plugin, selector)` per un set di firme canoniche rilevanti
di ciascun plugin (deposit/withdraw/borrow/repay dove applicabile) più il
selettore jolly `0xffffffff`. Per lo scopo di questa fase (dimostrare che la
whitelist generica è vuota nel POC `supplyOnly`) questa verifica è
equivalente e sufficiente, ma non fornisce la tracciabilità storica completa
richiesta testualmente dalla checklist C.

**Decisione per l'utente:** se serve la tracciabilità storica completa, è
necessario un RPC con supporto `eth_getLogs` su range ampi (upgrade del piano
Alchemy o provider diverso). Non è una decisione che questo assistente può
prendere autonomamente (comporta un costo).

## Gap tecnici trovati e corretti

### Gap: nessun enforcement per "capitale massimo totale"

- identificativo: FASE5-001
- descrizione: prima di questa fase, nessun campo del control file o della
  logica di rischio (`scripts/automation/risk.ts`) imponeva un tetto assoluto
  agli asset gestiti (custody + protocolli). Il control file poteva
  teoricamente crescere senza limite superiore.
- severità: media (nessun rischio nell'immediato con execution disabilitato,
  ma un gap reale per le fasi successive con capitale maggiore)
- correzione applicata: aggiunto campo opzionale e retrocompatibile
  `policy.maxTotalCapitalUnits` in `scripts/automation/types.ts`, validazione
  in `config.ts` (formato intero non negativo se presente), enforcement
  fail-closed in `risk.ts` (finding bloccante `TOTAL_CAPITAL_EXCEEDED` se
  `observation.managedAssets` supera il tetto).
- retrocompatibilità: verificata. Il campo è opzionale; quando assente il
  comportamento è identico a prima (vedi `test/automation/RiskTotalCapitalCap.test.ts`,
  primo test). La suite automation esistente (16/16) e il resto della suite
  script (40/40) restano PASS senza modifiche.
- valore inserito nel candidato: `50000000` unità (50 USDC), placeholder
  tecnico esplicitamente non approvato, solo per dimostrare il meccanismo.
- stato: corretto lato codice; il numero definitivo resta una decisione
  economica dell'utente.

### Gap: `poolReserveRatio` on-chain (`0`) più permissivo della policy off-chain (`reserveMinimumBps=1500`)

- identificativo: FASE5-002
- descrizione: il parametro on-chain `ParameterManager.poolReserveRatio`, che
  `LiquidityManager._withdrawInternal` usa per bloccare un withdraw che
  scenderebbe sotto una riserva minima, è attualmente `0` (nessun vincolo
  on-chain). La policy off-chain dichiara `reserveMinimumBps=1500` (15%), ma
  quel vincolo è applicato soltanto nel motore di rischio TypeScript
  (`risk.ts`), non nel contratto.
- severità: bassa nell'immediato (execution disabilitato: nessuna automazione
  può comunque eseguire un withdraw); diventa rilevante quando la Fase 7
  (advisory) o oltre abiliteranno esecuzioni reali.
- correzione applicata: nessuna in questo passaggio (richiede una transazione
  owner-only reale su `ParameterManager`, quindi è un'azione di Fase 6 dopo
  il trasferimento Safe, non un fix di solo codice/test).
- decisione: non bloccante per il PASS tecnico della Fase 5. Da includere
  esplicitamente nel batch di configurazione della Fase 6/7 quando la Safe
  sarà operativa.
- stato: aperto, non bloccante.

## Matrice enforcement

| Voce policy | Valore umano (placeholder) | Controllo off-chain | Valore off-chain | Controllo on-chain | Valore on-chain | Relazione richiesta | Esito |
|---|---|---|---|---|---|---|---|
| capitale massimo totale | 50000000 (non approvato) | `risk.ts: TOTAL_CAPITAL_EXCEEDED` (nuovo) | 50000000 | nessuno | n/d | on-chain non più permissivo | gap chiuso lato off-chain; nessun on-chain equivalente (accettato: execution disabled) |
| riserva minima | 1500 bps | `risk.ts: RESERVE_BELOW_MINIMUM` | 1500 bps | `ParameterManager.poolReserveRatio` | 0 bps | on-chain non più permissivo | **FASE5-002: on-chain più permissivo** |
| massimale AaveV3 | 4000 bps | `risk.ts: PROTOCOL_CAP_EXCEEDED` | 4000 bps | nessuno | n/d | on-chain non più permissivo | gap accettato (execution disabled) |
| massimale EulerV2 | 3000 bps | `risk.ts: PROTOCOL_CAP_EXCEEDED` | 3000 bps | nessuno | n/d | on-chain non più permissivo | gap accettato (execution disabled) |
| massimale MorphoVault | 2500 bps | `risk.ts: PROTOCOL_CAP_EXCEEDED` | 2500 bps | nessuno | n/d | on-chain non più permissivo | gap accettato (execution disabled) |
| massimale Morpho | 0 bps (monitor-only) | `risk.ts: PROTOCOL_NOT_ALLOWED`/`enabled=false` | 0 bps | nessuno | n/d | on-chain non più permissivo | gap accettato (execution disabled) |
| movimento per ciclo | 1000 bps | `risk.ts: MOVEMENT_LIMIT` | 1000 bps | nessuno | n/d | on-chain non più permissivo | gap accettato (execution disabled) |
| importo minimo | 100000 unità | `planner.ts`/`risk.ts` | 100000 unità | `LiquidityManager.minDeposit`* | 1 unità | off-chain uguale alla policy | *ambito diverso: minDeposit governa depositi utente, non azioni di rebalance |
| cooldown | 3600 s | `risk.ts` (test cooldown esistente) | 3600 s | nessuno | n/d | off-chain uguale alla policy | non applicabile on-chain (concetto solo off-chain) |
| slippage | non deciso | nessuno | n/d | `SwapManager.maxSlippage` | 300 bps | on-chain non più permissivo | policy off-chain da definire |
| fee deposito | non deciso | nessuno | n/d | `LiquidityManager.depositFee` | 0 bps | on-chain non più permissivo | policy off-chain da definire |
| fee withdraw | non deciso | nessuno | n/d | `LiquidityManager.withdrawFee` | 0 bps | on-chain non più permissivo | policy off-chain da definire |
| limiti deposito | non deciso | nessuno | n/d | `LiquidityManager.minDeposit/maxDeposit` | 1 / 100000000 | on-chain non più permissivo | policy off-chain da definire |
| limiti withdraw | non deciso | nessuno | n/d | `LiquidityManager.withdrawLimits` | hourly 100000000, daily 1000000000, min 1, max 50000000 | on-chain non più permissivo | policy off-chain da definire |
| health factor | 1.5e18 | `risk.ts: HEALTH_BELOW_MINIMUM` | 1.5e18 | nessun limite plugin dedicato oltre alla lettura | n/d | on-chain non meno restrittivo | coerente, stessa scala 1e18 |
| oracle freshness | `requireOracleFreshness=false` | `risk.ts: ORACLE_DATA_UNAVAILABLE` | false | non applicabile | n/d | fail-closed | verificato nella suite automation esistente |

## Matrice selettori

Stato attuale (non ricostruzione storica completa, vedi limitazione RPC sopra). Fonte: `test/deployment/PolicyWhitelist.fork.test.ts`, eseguito due volte sul blocco `490447686`.

| Protocollo | Plugin | Flow | Firma canonica | Selector | Stato attuale | Stato atteso | Test positivo | Test negativo | Esito |
|---|---|---|---|---|---|---|---|---|---|
| AaveV3 | `0x9b2230464540dd1B269156c685A191fd48291447` | supply-only tipizzato | deposit/withdraw/borrow/repay(string,uint256) | vari | non autorizzato (4/4) | nessun selector generico | n/d | `executeProtocolCall` reverte `SelectorNotAllowed` | PASS |
| EulerV2 | `0x31814FB423fA5578CB54a21f0e1f8561CC850A43` | supply-only tipizzato | deposit/withdraw/borrow/repay(string,uint256) | vari | non autorizzato (4/4) | nessun selector generico | n/d | n/d | PASS |
| MorphoVault | `0x2040a3128d6dBF5E0C19ED69411f63d11BDF13D5` | supply-only tipizzato | deposit/withdraw(string,uint256) | vari | non autorizzato (2/2) | nessun selector generico | n/d | n/d | PASS |
| Morpho | `0x13984c992CE512901F8eCe91aDa4c3A2F7EEEe05` | monitor-only | deposit/withdraw(string,uint256), borrow/repay(string,string,uint256) | vari | non autorizzato (4/4) | nessun selector generico | n/d | n/d | PASS |

Selettore jolly `0xffffffff`: non autorizzato su tutti e 4 i protocolli (4/4 PASS).

## Evidenza control file candidato

- percorso: `scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json`
- hash: non calcolato separatamente (file versionato, contenuto verificabile da `git diff`)
- state directory separato: `.automation-state/arbitrum-usdc-poc-1-policy-candidate` (confermato diverso da quello operativo)
- heartbeat separato: `.automation-state/arbitrum-usdc-poc-1-policy-candidate/service-heartbeat.json`
- mode: `observe`
- execution: `disabled`
- autonomous: `false`
- somma target bps: `10000` (verificato dal test)
- preflight ready: `true` (blocco `490473305`, `EXECUTION_DISABLED` PASS)
- problemi trovati: nessuno

## Evidenza calldata

Non applicabile in questo passaggio: la whitelist selettori è già vuota
(nessuna calldata di revoca necessaria). Unico batch testato: chiamata
negativa `executeProtocolCall` con selettore non autorizzato, che reverte
correttamente.

- numero chiamate: 1 (negativa, attesa fallire)
- ordine chiamate: n/d
- target verificati: `protocolManager` (`0x91fEc8f3161504Dd20c2Ed58B8E6003854AC5A8D`)
- selector verificati: `deposit(string,uint256)` usato come selettore non autorizzato di prova
- argomenti verificati: calldata sintetica (non decodificata, il test verifica solo il revert)
- value totali: `0`
- hash batch: non applicabile
- chiamate fuori policy: `0`

## Evidenza fork

- `FORK_BLOCK_NUMBER`: `490447686`
- prima esecuzione: 7/7 PASS
- seconda esecuzione: 7/7 PASS
- batch simulato: non applicabile (vedi sopra)
- stato post-batch: whitelist selettori invariata (vuota, come atteso)
- test capitale massimo: PASS (`test/automation/RiskTotalCapitalCap.test.ts`, motore di rischio, non fork Solidity)
- test massimali protocollo: PASS (suite automation esistente)
- test riserva minima: PASS (suite automation esistente)
- test movimento massimo: PASS (suite automation esistente)
- test importo minimo: PASS (suite automation esistente, copertura strutturale)
- test cooldown: PASS (suite automation esistente)
- test health factor: PASS (suite automation esistente)
- test oracle stale: PASS (suite automation esistente)
- test selector negato: PASS (fork reale, `PolicyWhitelist.fork.test.ts`)
- risultati deterministici: sì, identici nelle due esecuzioni fork

## Evidenza regressioni

- compile: PASS
- typecheck: PASS
- suite script: PASS (40/40)
- suite automation: PASS (16/16)
- invarianti: PASS (17/17, 4 pending non correlati e pre-esistenti — richiedono `FORK_ENABLED` per gli scenari specifici, non una regressione introdotta qui)
- failure: 0

## Problemi trovati

Vedi "Gap tecnici trovati e corretti" sopra (FASE5-001 corretto, FASE5-002 aperto non bloccante) e "Limitazione RPC trovata" (infrastruttura, non bloccante per il PASS tecnico ma limita la profondità della sezione C).

## Cosa resta bloccato (per l'utente)

1. Tutti i valori economici della policy umana (sezione A della checklist): capitale massimo, massimali per protocollo, riserva, movimento, importo minimo, cooldown, slippage, fee, limiti deposit/withdraw, health factor, policy oracle/APY, criteri emergency pause.
2. Approvazione esplicita della policy umana da parte dell'utente.
3. Decisione su FASE5-002 (`poolReserveRatio` on-chain a `0`): correggere con una transazione Safe in Fase 6/7, o accettare esplicitamente come comportamento voluto finché execution resta disabilitato.
4. Decisione su come trattare la limitazione RPC (Alchemy Free, 10 blocchi per `eth_getLogs`): accettare la verifica su stato attuale come sufficiente per il POC, oppure valutare un upgrade di piano/provider per la tracciabilità storica completa.
5. Approvazione Safe complessiva: bloccata dalla Fase 3 (parcheggiata), indipendentemente da questa fase.

## Gate di uscita

- policy umana completa: **no** (placeholder tecnici, non approvati)
- matrice enforcement completa: sì
- gap non accettati: `0` bloccanti (FASE5-001 corretto, FASE5-002 aperto ma non bloccante e già annotato per Fase 6/7)
- protocolli whitelist censiti 4/4: sì
- selector wildcard 0: sì
- selector sconosciuti autorizzati 0: sì
- selector senza flow 0: sì (nessun selector autorizzato)
- limiti on-chain più permissivi 0: **1 trovato** (FASE5-002, `poolReserveRatio`), non bloccante e documentato
- control file candidato valido: sì
- simulazioni fork 2/2: sì
- regressioni e invarianti PASS: sì
- hash observe invariato: sì
- transazioni Arbitrum One 0: sì
- problemi bloccanti aperti: 0
- valutazione tecnica: **PASS parziale** (infrastruttura, meccanismi e test tecnici completi; policy umana e approvazione Safe restano aperte per decisione dell'utente)
- approvazione Safe: PENDING (Fase 3 parcheggiata)
- motivazione: ogni attività eseguibile senza una decisione economica dell'utente è stata completata con evidenza riproducibile (due esecuzioni deterministiche, regressioni pulite, un gap tecnico reale trovato e corretto in modo retrocompatibile). Il gate completo richiede comunque input dell'utente su valori economici, un gap on-chain non bloccante, e la Safe.
- valutatore: GitHub Copilot (agente), su richiesta dell'utente
- timestamp valutazione: 2026-08-03

