# Audit finale pre-commit e gate verso la produzione

## 1. Esito dell'audit

La componente InterVault locale è completa nel perimetro concordato: contratti,
interfacce, Registry, Lens, Plugin, deployment bundle, manifest, CLI, preflight,
observer del Vault Automation Controller, test unitari, integrazione full-core,
E2E locale e fork Arbitrum fissato.

Questo non equivale ancora a dichiarare il MetaVault production-ready. Restano
due passaggi distinti: il canary reale su Arbitrum e la decisione formale sul
comportamento del core quando una Lens attiva fallisce.

## 2. Correzioni emerse dall'ultimo riesame

### 2.1 Canonicalità sul token reale

Il Registry non impedisce più soltanto di duplicare lo stesso codice logico:
mantiene anche la relazione inversa `token reale -> child`. Due alias diversi
non possono quindi censire due volte lo stesso ERC-20 e aggirare cap, tracking o
controlli operativi. La relazione viene rimossa soltanto quando il child può
essere realmente eliminato a saldo zero.

### 2.2 Integrità del Beacon verificata anche dopo la registrazione

La registrazione fotografa e valida ProxyGeneral, LiquidityManager,
ProtocolManager e assenza di InterVault nel leaf. Tuttavia un Beacon aggiornabile
può cambiare dopo il censimento. Per questo il Plugin ripete la validazione prima
di ogni nuovo deposito: un upgrade incompatibile o ricorsivo non riceve nuovo
capitale. I prelievi restano disponibili per consentire l'uscita.

### 2.3 Identità stabile delle posizioni

La Lens usa lo stesso child ID stabile sia nell'elenco delle posizioni sia in
`getPositionHealth`. Non dipende dall'indice corrente nell'array: rimozioni o
riordini non cambiano l'identità con cui script e automazione interrogano la
posizione.

### 2.4 Emergency withdrawal misurato sul saldo reale

Il Plugin non si fida del valore restituito dal leaf. Misura il balance ERC-20
prima e dopo l'operazione e contabilizza il delta realmente ricevuto. Questo
evita mismatch con leaf che arrotondano, applicano fee o restituiscono un valore
non perfettamente aderente al trasferimento effettivo.

### 2.5 Manifest del bundle

Il deployment bundle persiste anche il `vaultId` nei metadata del manifest. La
CLI, il preflight e l'automazione possono quindi ricostruire il collegamento al
vault senza parametro implicito o conoscenza esterna.

### 2.6 Comando fork riproducibile su Windows

Il comando MetaVault non richiede più `cross-env`, che non era installato. Le
variabili vengono impostate esplicitamente nella shell come già indicato nella
guida, e `npm run test:metavault:fork` esegue direttamente Hardhat.

## 3. Cosa significa “fork con leaf reali”

Un fork è una copia locale dello stato Arbitrum a un blocco preciso. Contratti,
bytecode e saldi provengono dalla chain reale, ma le transazioni successive
avvengono soltanto nel nodo Hardhat: non consumano ETH reale e non modificano
Arbitrum.

Il fork base non è più aperto: al blocco `483832997` è stato collegato un parent
effimero nuovo al leaf POC USDC realmente deployato, eseguendo deposito, lettura
Lens, chiusura e pulizia tramite snapshot/revert.

Prima del canary rimane utile un fork **post-deploy**: dopo avere gli indirizzi
del nuovo MetaVault, si rifà il fork a un blocco successivo al deploy e si prova
il manifest esatto, con tutti i leaf che saranno abilitati. Questo certifica la
configurazione reale, non soltanto la compatibilità architetturale con un leaf.

## 4. Cosa significa “canary Arbitrum”

Il canary è una prova reale, deliberatamente piccola e reversibile sulla rete
Arbitrum. A differenza del fork usa transazioni, gas, conferme e capitale veri.
La sequenza corretta è:

1. deploy e verifica dei tre contratti InterVault;
2. ruoli e ownership sotto la policy prevista, preferibilmente Safe;
3. cap iniziale minimo e un solo leaf;
4. deposito di una quantità trascurabile;
5. osservazione 24/7 di NAV, share, eventi, salute e fingerprint;
6. prelievo completo e verifica che exposure e active list tornino a zero;
7. incremento dei cap soltanto dopo una finestra di osservazione senza anomalie.

Il canary non sostituisce unit, integration, E2E o fork: verifica gli aspetti che
solo la rete reale espone, come RPC, nonce, gas, conferme, permessi reali,
indirizzi del manifest e comportamento operativo del servizio 24/7.

## 5. Gate Lens e sottostima del NAV

### 5.1 Il comportamento

Il NAV è il valore totale degli asset che sostengono le share LP del parent. Il
core chiede il valore di ogni protocollo alla rispettiva Lens. Oggi, se una Lens
va in revert, ProtocolManager intercetta l'errore e continua sommando gli altri
protocolli. Il sistema resta disponibile, ma il valore del protocollo fallito
sparisce temporaneamente dal totale.

Esempio: il parent possiede 20 USDC liquidi e 80 USDC di valore nel leaf. Il NAV
corretto è 100 USDC. Se la Lens InterVault fallisce e viene saltata, il core può
riportare 20 USDC. Gli 80 non sono necessariamente persi: sono ancora nel leaf,
ma diventano invisibili all'accounting usato in quel momento.

### 5.2 Conseguenze

- un deposito può coniare troppe share rispetto al valore reale, diluendo gli LP;
- un prelievo può usare un prezzo share scorretto e produrre trattamento iniquo;
- allocation, reserve ratio, limiti e automazione ricevono un dato falsato;
- dashboard e allarmi possono mostrare una perdita inesistente;
- nel MetaVault il rischio è annidato, perché la Lens dipende anche dalla
  valorizzazione interna del leaf.

Non è quindi soltanto un problema di interfaccia o monitoraggio: il dato entra
nella matematica economica on-chain.

### 5.3 Mitigazioni già presenti

- l'automazione InterVault è monitor-only e rifiuta `enabled=true`;
- preflight e observer interrogano direttamente Registry e Lens e falliscono in
  modo chiuso se la valorizzazione non è disponibile;
- cap, lifecycle, emergency path e controlli Beacon limitano l'esposizione;
- il comportamento skip-on-error è coperto da un test, quindi non può essere
  dimenticato o presentato come risolto.

Queste misure proteggono l'operatore, ma non cambiano la matematica delle
funzioni core che un utente può chiamare direttamente. Un monitor esterno può
reagire e mettere in pausa, ma esiste sempre un intervallo tra il guasto e la
reazione.

### 5.4 Soluzione formale raccomandata

Per protocolli attivi con capitale, l'aggregazione dovrebbe essere fail-closed:
se una Lens obbligatoria fallisce, il calcolo NAV e le operazioni che ne
dipendono devono revertire. Una possibile evoluzione è distinguere Lens
`critical` da Lens puramente informative; non va invece usato un valore zero
come fallback per transazioni economiche.

Questo può richiedere una modifica interna minima e auditata al core pur senza
cambiare le interfacce pubbliche. Se il vincolo “core immutabile” rimane
assoluto, la conclusione prudente è non finanziare InterVault con capitale
significativo: un wrapper esterno è aggirabile finché le entry point core restano
chiamabili direttamente, e un guardian reattivo è una mitigazione, non una
garanzia atomica.

La decisione deve quindi essere esplicita prima del deploy finanziato:

1. approvare una semantica core fail-closed con regressioni dedicate; oppure
2. mantenere InterVault disabilitato/monitor-only e senza capitale; oppure
3. accettare formalmente un canary estremamente limitato, con pause e cap minimi,
   come esperimento e non come dichiarazione production-ready.

## 6. Evidenze finali

| Verifica | Risultato |
|---|---:|
| Compile Solidity | PASS |
| Typecheck script | PASS |
| Unit/componente InterVault | 19 PASS |
| Integration full-core | 2 PASS |
| E2E automatic withdrawal locale | 1 PASS |
| Fork Arbitrum fissato | 1 PASS |
| Vault Automation Controller | 16 PASS |
| Suite script operativi | 40 PASS |
| Transazioni Arbitrum effettuate dai test | 0 |

## 7. Conclusione operativa

La suite locale e il primo fork reale sono pronti. Il prossimo ordine serio è:
decisione sul gate NAV, eventuale regressione fail-closed, deploy con manifest,
fork post-deploy, quindi canary Arbitrum a cap minimo e osservazione 24/7. Solo
dopo questi passaggi ha senso parlare di aumento del capitale.
