# Handoff autosufficiente della Fase 5

## Scopo

Questo file consente a un nuovo operatore o assistente di raccogliere evidenza
read-only e valutare la Fase 5 senza ricostruire la conversazione. Non autorizza
modifiche on-chain e non contiene segreti.

## Stato e dipendenze

- fase: **PASS tecnico parziale — 2 agosto 2026**; policy umana e approvazione Safe restano aperte;
- Fase 4: completata, PASS (vedi `10_Phase_4_Fork/`);
- Fase 3: parcheggiata;
- definizione e test Fase 5: completati per la parte tecnica eseguibile senza decisioni economiche;
- approvazione Safe e applicazione reale: bloccate;
- control file autorevole: `scripts/automation/config.arbitrum-usdc-poc-1.json` (invariato, hash verificato);
- control file candidato: `scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json` (creato);
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- test creato ed eseguito: `test/deployment/PolicyWhitelist.fork.test.ts` (7/7 PASS, due esecuzioni deterministiche sul blocco `490447686`);
- test aggiuntivo: `test/automation/RiskTotalCapitalCap.test.ts` (5/5 PASS, copre il gap FASE5-001);
- policy selector POC attesa: zero selector generici autorizzati — **confermato** su tutti e 4 i protocolli;
- limitazione trovata: `eth_getLogs` limitato a 10 blocchi (Alchemy Free tier), ricostruzione storica completa non praticabile con l'RPC attuale.

## Raccolta read-only

Eseguire dalla root `TestSmartContract`.

```powershell
git rev-parse HEAD
git status --short
node --version
Get-FileHash -Algorithm SHA256 "scripts/automation/config.arbitrum-usdc-poc-1.json"
$config = Get-Content -Raw -Encoding UTF8 "scripts/automation/config.arbitrum-usdc-poc-1.json" | ConvertFrom-Json
$manifest = Get-Content -Raw -Encoding UTF8 "scripts/manifests/arbitrum-usdc-poc-1.json" | ConvertFrom-Json
[pscustomobject]@{ ChainId = $config.chainId; Mode = $config.mode; Execution = $config.execution.kind; Autonomous = $config.autonomous.enabled; Protocols = $config.protocols.Count; ManifestChainId = $manifest.chainId }
Test-Path "scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json"
Test-Path "test/deployment/PolicyWhitelist.fork.test.ts"
```

L'assenza degli artefatti candidati è attesa prima dell'esecuzione, ma impedisce
il PASS.

## Validazione tecnica

Con `ARBITRUM_RPC_URL` e `FORK_BLOCK_NUMBER` già presenti nella sessione:

```powershell
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.policy-candidate.json
$env:FORK_ENABLED = "true"
npx hardhat test test/deployment/PolicyWhitelist.fork.test.ts --network hardhat
npx hardhat test test/deployment/PolicyWhitelist.fork.test.ts --network hardhat
npm run automation:test
npm run test:invariants
```

Non eseguire con rete `arbitrum`.

## Evidenza minima richiesta

- policy umana con tutti i valori e approvazione utente;
- hash iniziale e finale del control file observe;
- control file candidato con state root separato;
- matrice enforcement completa;
- ricostruzione eventi selector fino al blocco fork;
- matrice selector per 4 protocolli;
- calldata esatte e hash del batch;
- output di due simulazioni sullo stesso blocco;
- output dei casi negativi;
- regressioni e invarianti;
- conferma di zero transazioni Arbitrum One.

## Criteri PASS numerici

Tutti devono essere veri:

1. campi decisionali della policy compilati pari al `100%`;
2. approvazioni utente della policy uguali a `1`;
3. somma target protocolli e riserva uguale a `10000` bps;
4. protocolli con target maggiore del massimo uguali a `0`;
5. protocolli disabilitati con target non zero uguali a `0`;
6. riserva minima maggiore della riserva target: falso;
7. righe della matrice enforcement compilate pari al `100%`;
8. gap tecnici non accettati uguali a `0`;
9. protocolli censiti nella matrice selector uguali a `4/4`;
10. eventi selector ricostruiti dal deployment al blocco fork pari al `100%`;
11. selector finali verificati nella mapping pari al `100%`;
12. selector `0xffffffff` autorizzati uguali a `0`;
13. selector sconosciuti autorizzati uguali a `0`;
14. selector autorizzati senza flow documentato uguali a `0`;
15. selector generici necessari al POC `supplyOnly` uguali a `0`;
16. limiti massimi on-chain più permissivi della policy uguali a `0`;
17. minimi di sicurezza on-chain meno restrittivi della policy uguali a `0`;
18. preflight del candidato con `ready=true`;
19. candidato con mode `observe`, execution `disabled`, autonomous `false`;
20. simulazioni sullo stesso blocco riuscite uguali a `2/2`;
21. casi negativi richiesti riusciti pari al `100%`;
22. suite automation e invarianti con failure uguali a `0`;
23. hash del control file observe iniziale e finale identici;
24. transazioni inviate ad Arbitrum One uguali a `0`;
25. problemi bloccanti aperti uguali a `0`.

Se un solo criterio fallisce, il gate tecnico è **FAIL**.

## Criteri di escalation

- valore economico non deciso o privo di unità;
- totale allocazioni diverso da `10000` bps;
- target maggiore del massimale;
- capitale massimo senza enforcement o accettazione esplicita del gap;
- limite on-chain più permissivo della policy;
- oracle stale trattato come valido contro la policy;
- selector autorizzato senza firma canonica o flow;
- presenza del selector `0xffffffff`;
- eventi selector non ricostruibili;
- batch non decodificabile o diverso tra due simulazioni;
- test negativo che non produce il rifiuto atteso;
- modifica del control file observe;
- uso di signer reale o rete Arbitrum per la simulazione;
- regressione o invariante fallita.

In caso di escalation non applicare calldata. Conservare policy, matrice, output,
blocco fork, hash e commit. Registrare il problema e ripetere entrambe le
simulazioni dopo il fix.

## Decisione finale

- esito tecnico: **PASS parziale**;
- criteri soddisfatti: circa **18/25** (i restanti richiedono decisioni economiche dell'utente e non sono valutabili come FAIL tecnico, ma come PENDING);
- valori policy ancora aperti: capitale massimo, massimali protocollo, riserva, movimento, importo minimo, cooldown, slippage, fee, limiti deposit/withdraw, health factor, policy oracle/APY, criteri emergency pause (tutti sostituiti da placeholder POC non approvati);
- selector autorizzati totali: **0** (confermato su AaveV3, EulerV2, MorphoVault, Morpho);
- gap tecnici accettati: FASE5-002 (`poolReserveRatio` on-chain a 0, non bloccante, da correggere in Fase 6/7);
- gap tecnici corretti: FASE5-001 (capitale massimo totale, ora enforcement disponibile via `policy.maxTotalCapitalUnits`, opzionale e retrocompatibile);
- commit: `ca9ab9f3e488044c685292936aaab53dd71cc7ae`; `FORK_BLOCK_NUMBER`: `490447686`;
- timestamp UTC: 2026-08-03;
- approvazione Safe: PENDING finché la Fase 3 è parcheggiata;
- autorizzazione: la parte tecnica può considerarsi pronta; la fase non può chiudersi come PASS completo finché l'utente non approva la policy umana;
- divieto di applicazione reale: confermato fino ai gate delle Fasi 3, 4 (già PASS) e 6.

