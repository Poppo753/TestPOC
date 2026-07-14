# Roadmap dei prossimi passi: dal POC funzionante a un sistema operativo sicuro

Data: 14 luglio 2026.

## 1. Risposta breve

Non serve rifare il deployment. Il POC USDC esiste, funziona ed è stato ripulito dopo i test reali.

Il prossimo lavoro è trasformarlo da insieme di contratti funzionanti a servizio governato e osservabile:

```text
baseline immutabile
    -> verifica sorgenti
    -> observe 24–72 ore
    -> Safe e simulazione ownership
    -> policy e selector definitivi
    -> Safe advisory
    -> canary con capitale minimo
    -> audit e hardening
    -> capitale graduale
    -> eventuale multi-vault/multi-chain
    -> eventuale autonomia limitata
```

Il successo del POC prova che i componenti fondamentali possono operare. Non prova ancora che un servizio non supervisionato possa gestire capitale significativo per mesi.

## 2. Stato di partenza certificato

Il punto di partenza autorevole è:

- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- control file observe: `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- chain: Arbitrum One, chain ID 42161;
- base asset: USDC nativo;
- protocolli: Aave, Euler, Morpho e Morpho Vault;
- automazione: `mode = observe`, `execution.kind = disabled`;
- pool e posizioni: zero;
- ownership: ancora sul deployer;
- Safe: non ancora configurata;
- policy e selector definitivi: non ancora applicati;
- sorgenti explorer: non ancora verificati.

Il controller può leggere lo stato ma non può inviare transazioni persistenti.

## 3. Principio guida

Ogni fase deve avere:

1. un obiettivo limitato;
2. una prova su fork;
3. criteri di accettazione misurabili;
4. una procedura di rollback o arresto;
5. un limite massimo di capitale;
6. un documento di evidenza.

Non si passa alla fase successiva perché “sembra funzionare”, ma perché il gate precedente è documentato come superato.

## 4. Fase 0 — Congelare la baseline

### Obiettivo

Rendere identificabile la versione esatta che ha prodotto il deployment.

### Attività

- Revisionare il worktree e separare modifiche del POC da modifiche non correlate.
- Committare contratti, script, test, manifest e documentazione in modo intenzionale.
- Creare un tag, per esempio `arbitrum-usdc-poc-1`.
- Salvare hash del commit e tag nel registro di deployment.
- Conservare copia offline del manifest.
- Conservare gli artifact di compilazione corrispondenti.
- Non inserire `.env`, private key o API key nel commit.

### Gate di uscita

- Repository riproducibile da un clone pulito.
- `npm ci`, compile, typecheck e test rilevanti passano.
- Il bytecode compilato corrisponde alla baseline utilizzata.
- Manifest e control file passano validazione JSON.

### Perché viene prima

Senza una baseline non è possibile sapere quale codice verificare sull'explorer, auditare o confrontare durante un incidente.

## 5. Fase 1 — Verificare i sorgenti sull'explorer

### Obiettivo

Associare agli indirizzi reali codice sorgente, compiler, optimizer e constructor arguments corretti.

### Attività

- Verificare tutti gli undici contratti core.
- Verificare registry, plugin e lens dei quattro bundle.
- Usare Solidity `0.8.27`, optimizer 100 runs e `viaIR = true`.
- Ricostruire i constructor arguments dal manifest e dalle funzioni di deploy.
- Registrare URL e risultato per ogni indirizzo.
- Verificare che SwapManager pubblicato abbia runtime 24.473 byte.
- Non considerare verificato un contratto soltanto perché l'explorer mostra bytecode.

### Controlli

- Nome contratto corretto.
- Constructor arguments corretti.
- Bytecode compilato corrispondente.
- Nessun indirizzo del vecchio deployment confuso con il nuovo.

### Gate di uscita

Tutti i componenti proprietari del nuovo manifest risultano verified oppure ogni eccezione è spiegata e bloccante per il passaggio a capitale maggiore.

## 6. Fase 2 — Eseguire observe supervisionato per 24–72 ore

### Obiettivo

Dimostrare che RPC, observer, store, lock, heartbeat e retry restano stabili nel tempo senza capacità di esecuzione.

### Comando manuale iniziale

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.json
npm run automation:cli -- run --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

### Loop observe

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- loop --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

Non aggiungere `--execute=true --dry-run=false`.

### Dove eseguirlo

Preferibilmente su VPS o server dedicato con:

- utente di sistema non privilegiato;
- RPC in secret/environment file protetto;
- directory `.automation-state` persistente;
- systemd, Docker restart policy o altro supervisor;
- log rotation;
- monitor esterno dell'heartbeat;
- alert separato dal processo controllato.

Per observe non serve la private key del deployer.

### Metriche minime

- numero cicli riusciti;
- numero `CYCLE_FAILED`;
- latenza media e massima RPC;
- retry per ciclo;
- blocchi attraversati dall'osservazione;
- età dell'heartbeat;
- consecutive failures;
- divergenze manifest/on-chain;
- posizione e debt per protocollo;
- stato pause, deposit e withdraw.

### Comando heartbeat

```powershell
npm run automation:cli -- service-status --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

### Gate di uscita consigliato

- almeno 24 ore, preferibilmente 72;
- nessun fallimento deterministico;
- nessun restart loop;
- nessun heartbeat stale non spiegato;
- eventuali errori RPC recuperati entro il limite;
- nessuna posizione inattesa;
- Morpho sempre zero oppure blocco fail-closed correttamente generato.

## 7. Fase 3 — Definire governance e Safe

### Decisioni richieste all'utente

Prima di creare la Safe devono essere scelti:

- numero di owner;
- identità degli owner;
- threshold;
- dispositivi hardware wallet;
- procedura in caso di perdita di una chiave;
- persona/processo autorizzato a proporre;
- processo di revisione delle calldata;
- eventuale delay operativo per upgrade importanti.

### Configurazione POC ragionevole

Per un POC personale evoluto può avere senso una Safe `2-of-3`, purché i tre owner non dipendano dallo stesso dispositivo o dalla stessa seed phrase. La scelta definitiva dipende dal numero reale di operatori e dal recovery model.

### Regole

- Il deployer non deve essere l'unico controllo permanente.
- La chiave che propone non deve poter eseguire da sola.
- Una private key owner non deve stare in chiaro sul server.
- Il server observe continua a non avere necessità di signer.
- L'API key del Safe Transaction Service è un segreto off-chain, non un owner on-chain.

### Gate di uscita

- Safe deployata sulla chain corretta.
- Owner e threshold verificati da almeno due dispositivi.
- Transazione Safe innocua provata.
- Recovery process scritto e provato senza muovere i contratti del POC.

## 8. Fase 4 — Simulare il trasferimento delle ownership su fork

### Obiettivo

Evitare di trasferire controllo alla Safe e scoprire dopo che un componente è rimasto sul deployer o che una procedura è irreversibile.

### Attività sul fork fissato

- Forkare da un blocco successivo all'ultima configurazione.
- Impersonare il deployer solo nel fork.
- Simulare ogni ownership transfer.
- Gestire correttamente i contratti con trasferimento a uno o due step.
- Verificare owner di Beacon, ProxyGeneral, manager, registry, plugin e lens proprietari.
- Simulare una modifica amministrativa tramite la Safe.
- Simulare pause e unpause.
- Simulare update e rollback di una configurazione innocua.
- Rieseguire deposit/withdraw e health dopo il trasferimento.

### Invariante

Alla fine del test nessun componente amministrativo deve essere controllato accidentalmente dal vecchio deployer, salvo eccezioni documentate.

### Gate di uscita

Matrice completa `contratto -> owner attuale -> owner atteso -> metodo di trasferimento -> evidenza` senza righe mancanti.

## 9. Fase 5 — Definire policy economiche e selector whitelist

### Problema attuale

Il deployment è funzionale, ma le allocazioni del control file sono ancora una policy POC provvisoria:

- riserva 20%;
- Aave 35%;
- Euler 25%;
- Morpho Vault 20%;
- Morpho diretto 0%, monitor-only.

Questi numeri non devono essere trattati come una strategia finanziaria già approvata.

### Decisioni necessarie

- capitale massimo totale;
- massimale per protocollo;
- riserva minima;
- movimento massimo per ciclo;
- importo minimo economicamente sensato;
- cooldown;
- slippage;
- fee;
- limiti deposit/withdraw;
- health factor minimo;
- comportamento con oracle/APY mancanti;
- criteri di emergency pause;
- selector realmente necessari per ciascun plugin.

### Metodo

1. Definire la policy in un documento umano.
2. Tradurla nel control file e nei contratti.
3. Generare le calldata.
4. Simularle sul fork come batch esatto.
5. Rieseguire regressioni e invarianti.
6. Farle approvare tramite Safe.

### Gate di uscita

- Nessun selector wildcard non motivato.
- Ogni selector autorizzato collegato a un flow documentato.
- Limiti on-chain non più permissivi della policy off-chain.
- Emergency path provato.
- Configurazione finale salvata e revisionata.

## 10. Fase 6 — Trasferimento reale alla Safe

### Ordine consigliato

1. Ricontrollare chain, Safe, owner e threshold.
2. Fissare un nuovo fork block.
3. Ripetere la simulazione completa.
4. Trasferire un componente alla volta.
5. Attendere le conferme configurate.
6. Leggere l'owner on-chain dopo ogni trasferimento.
7. Non proseguire se una post-condition fallisce.
8. Eseguire preflight Safe finale.

### Rollback

Il rollback deve essere definito prima della prima transazione. Per i contratti che trasferiscono ownership immediatamente, il ritorno al deployer richiede una nuova decisione della Safe; non va dato per scontato.

### Gate di uscita

- Matrice ownership completamente verde.
- Deployer privo dei privilegi che dovevano essere rimossi.
- Safe capace di pause/unpause e amministrazione prevista.
- Automation preflight riconosce la Safe come owner atteso.

## 11. Fase 7 — Safe advisory end-to-end

### Obiettivo

Il controller osserva, crea un piano, lo simula e propone una transazione Safe, ma non può approvarla autonomamente.

### Nuovo control file

Non modificare direttamente il file observe funzionante. Creare una copia, per esempio:

```text
scripts/automation/config.arbitrum-usdc-poc-1.advisory.json
```

Differenze principali:

```json
{
  "mode": "advisory",
  "execution": { "kind": "safe" },
  "safe": {
    "address": "SAFE_ADDRESS",
    "apiKeyEnv": "SAFE_API_KEY"
  }
}
```

### Workflow

```powershell
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.advisory.json
npm run automation:cli -- run --config=scripts/automation/config.arbitrum-usdc-poc-1.advisory.json
npm run automation:cli -- safe-propose --config=scripts/automation/config.arbitrum-usdc-poc-1.advisory.json --run-id=RUN_ID
npm run automation:cli -- safe-sync --config=scripts/automation/config.arbitrum-usdc-poc-1.advisory.json --run-id=RUN_ID
```

### Controlli umani prima della firma

- chain ID;
- Safe address;
- nonce;
- target di ogni call;
- funzione e selector;
- token e importo;
- protocollo;
- piano non scaduto;
- stato on-chain non cambiato;
- assenza di approve illimitate non previste.

### Gate di uscita

Almeno un ciclo completo proposta -> firme -> esecuzione -> receipt -> post-state verificato, inizialmente con un'azione innocua o capitale minimo.

## 12. Fase 8 — Canary con capitale minimo

### Obiettivo

Provare l'intero sistema operativo, non soltanto i contratti.

### Capitale

Usare una quantità deliberatamente sacrificabile, per esempio 1–5 USDC. Il limite deve essere scritto prima dell'operazione.

### Sequenza

1. Deposit minimo nel vault.
2. Observe e verifica della posizione custody.
3. Generazione piano advisory.
4. Revisione umana delle calldata.
5. Esecuzione Safe.
6. Verifica allocazione e share.
7. Attesa di almeno un ciclo.
8. Withdraw dai protocolli.
9. Withdraw LP completo.
10. Verifica residui zero.

### Protocolli

- Aave: canary reale.
- Euler: canary reale.
- Morpho Vault: canary reale.
- Morpho WETH/USDC: resta monitor-only finché non esiste una strategia collateral/loan e un percorso sicuro di valorizzazione e uscita.

### Gate di uscita

- Safe e controller concordano sullo stesso piano.
- Nessuna azione fuori policy.
- Tutti i saldi finali riconciliati.
- Nessuna allowance inattesa.
- Costi gas e rounding registrati.
- Recovery provato almeno in simulazione.

## 13. Fase 9 — Osservabilità e incident response reali

### Telemetria necessaria

- heartbeat stale;
- RPC failure rate;
- Safe proposal pending troppo a lungo;
- owner/configuration drift;
- posizione non prevista;
- debt diverso da zero in modalità supply-only;
- health factor sotto soglia;
- circuit breaker;
- pool paused;
- differenza tra accounting interno e token balance;
- variazioni anomale di share price;
- gas balance insufficiente;
- contract code mismatch.

### Alert

Gli alert devono arrivare fuori dal server controllato: email, Telegram, PagerDuty o equivalente. Un log locale non è un alert.

### Runbook minimi

- RPC indisponibile;
- heartbeat fermo;
- Safe pending/stale;
- posizione residua;
- protocollo in pausa;
- oracle stale;
- perdita di un owner;
- transazione Safe fallita;
- upgrade errato;
- sospetta compromissione.

### Gate di uscita

Ogni alert critico testato almeno una volta in staging/fork e associato a un responsabile e a una procedura.

## 14. Fase 10 — Audit e hardening

### Ambiti

- controllo accessi e ownership;
- Beacon e upgrade immediati;
- custody ProxyGeneral;
- share accounting LiquidityManager;
- rounding e dust;
- delegatecall/module authorization;
- selector whitelist;
- registry poisoning;
- oracle manipulation/staleness;
- cross-protocol state;
- emergency unwind;
- Safe transaction binding;
- automation replay/staleness;
- lock e concorrenza;
- dipendenze npm e supply chain;
- secret management;
- EIP-170 e margine bytecode.

### Livelli

1. revisione interna strutturata;
2. static analysis;
3. fuzz e invariant testing esteso;
4. audit esterno indipendente;
5. eventuale bug bounty dopo remediation.

### Gate di uscita

Nessun finding critico o alto aperto; finding medi con mitigazione esplicita e accettazione del rischio.

## 15. Fase 11 — Aumento graduale del capitale

Non passare da 5 USDC a capitale significativo in un solo step.

Esempio di progressione concettuale:

```text
canary minimo
    -> piccolo capitale per più giorni
    -> aumento limitato dopo review
    -> nuovo limite dopo audit
```

Ogni livello deve avere:

- massimale assoluto;
- stop-loss operativo;
- reserve minima;
- tempo minimo di osservazione;
- review delle metriche;
- approvazione Safe;
- rollback verificato.

Le cifre concrete devono dipendere dal capitale che si accetta di perdere, dall'audit e dalla liquidità dei protocolli, non soltanto dal successo tecnico del POC.

## 16. Fase 12 — Multi-vault e multi-chain

### Quando ha senso

Solo dopo che un singolo vault Arbitrum ha completato observe, Safe advisory, canary e periodo operativo stabile.

### Multi-vault

Ogni vault deve avere:

- manifest separato;
- `vaultId` separato;
- control file separato;
- directory state separata;
- lock separato;
- policy separata;
- capitale e accounting separati;
- Safe e ownership esplicitamente definite.

### Multi-chain

Non basta cambiare RPC. Per ogni chain bisogna riverificare:

- chain ID e finalità;
- token canonici e decimali;
- oracle e heartbeat;
- deployment dei protocolli;
- vault e market tuple;
- liquidità;
- gas model;
- explorer;
- Safe deployment;
- RPC provider;
- whale e fork block per i test;
- bridge risk, se esiste movimento cross-chain.

### Gate di uscita

Una chain non eredita automaticamente la certificazione di Arbitrum. Deve avere una propria checklist e un proprio manifest.

## 17. Fase 13 — Eventuale autonomia limitata

Autonomous non è il prossimo passo. È una fase eventuale.

Prima servono almeno:

- audit completato;
- mesi di advisory stabile;
- oracle freshness normalizzata;
- APY affidabile;
- limiti on-chain;
- executor con permessi minimi;
- circuit breaker;
- rate limit;
- allowance limitate;
- monitor e alert indipendenti;
- emergency Safe;
- capitale massimo autonomo molto basso;
- kill switch provato.

Una possibile architettura futura è consentire all'automazione soltanto operazioni entro limiti on-chain, lasciando upgrade, nuovi protocolli, selector e aumenti di capitale alla Safe.

## 18. Ordine operativo consigliato

### Subito

1. Congelare e committare la baseline.
2. Verificare i sorgenti sull'explorer.
3. Scegliere il server/VPS.
4. Avviare observe 24–72 ore.

### Durante observe

5. Definire owner, threshold e recovery della Safe.
6. Creare e testare la Safe.
7. Scrivere policy e selector definitivi.
8. Preparare la matrice ownership.

### Dopo observe

9. Simulare ownership e policy sul fork.
10. Trasferire ownership alla Safe.
11. Creare il control file advisory.
12. Eseguire il canary Safe end-to-end.

### Prima di capitale significativo

13. Completare monitoraggio e incident runbook.
14. Audit e remediation.
15. Aumentare capitale gradualmente.

### Soltanto successivamente

16. Secondo vault.
17. Seconda chain.
18. Valutazione dell'autonomia limitata.

## 19. Informazioni necessarie per procedere

Per le prossime implementazioni servono decisioni dell'utente che non devono essere inventate automaticamente:

1. Dove eseguire observe: PC sempre acceso, VPS o server dedicato?
2. Quanti owner Safe reali sono disponibili?
3. Quale threshold si desidera?
4. Gli owner useranno hardware wallet separati?
5. Qual è il capitale massimo sacrificabile per il canary?
6. Quale canale deve ricevere gli alert?
7. Si vuole usare Safe ufficiale o infrastruttura self-hosted?
8. Qual è il primo obiettivo dopo Arbitrum: secondo vault o seconda chain?

## 20. Cose da non fare ora

- Non rifare il deployment senza motivo.
- Non abilitare `autonomous`.
- Non usare `--execute=true --dry-run=false` nel loop observe.
- Non trasferire ownership prima della simulazione completa.
- Non lasciare la private key del deployer sul server observe.
- Non considerare le percentuali POC una strategia finanziaria definitiva.
- Non aggiungere GMX o Dolomite finché non sono completati e certificati separatamente.
- Non finanziare Morpho diretto con USDC come se fosse un normale supply market.
- Non espandere multi-chain prima di aver stabilizzato un vault.

## 21. Definizione di “production-ready” per questo progetto

Il sistema può essere definito production-ready solo quando:

- codice e deployment sono riproducibili;
- sorgenti verificati;
- ownership sulla Safe;
- policy e selector minimi;
- observe e advisory stabili;
- alert e runbook provati;
- canary concluso;
- audit senza finding critici/alti aperti;
- capitale limitato e incremento graduale;
- ogni componente ha owner, upgrade e recovery documentati;
- nessun singolo server o signer può muovere tutto il capitale da solo.

## 22. Prossimo task concreto raccomandato

Il prossimo task da eseguire è:

```text
creare la baseline/versione del deployment
e avviare il servizio observe supervisionato per 24–72 ore
```

In parallelo, senza modificare i contratti, si possono preparare verifica explorer e progetto della Safe. Questo utilizza ciò che è già stato costruito e raccoglie le evidenze che ancora mancano.

## 23. Documenti e file autorevoli

- `scripts/manifests/arbitrum-usdc-poc-1.json` — indirizzi e transazioni reali.
- `scripts/automation/config.arbitrum-usdc-poc-1.json` — observe reale.
- `01_Checklist_Deploy_Nuovo_POC_USDC.md` — stato dei gate.
- `03_Registro_Evidenze_PreDeploy.md` — evidenze on-chain.
- `05_Registro_Tecnico_Completo_Errori_e_Fix.md` — errori e correzioni.
- `../Vault Automation Controller/10_Control_File_Implementation/05_Guida_Safe_e_Servizio_24_7.md` — Safe e servizio.
- `../Vault Automation Controller/10_Control_File_Implementation/06_Comandi_Completi.md` — comandi automation.
