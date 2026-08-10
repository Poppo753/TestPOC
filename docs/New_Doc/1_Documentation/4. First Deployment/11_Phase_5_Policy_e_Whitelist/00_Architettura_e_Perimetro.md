# Fase 5 — architettura policy e whitelist

## Obiettivo

Trasformare i parametri POC in una policy esplicita, verificabile e fail-closed.
Ogni limite off-chain deve avere un controllo equivalente o più restrittivo
on-chain. Ogni selector generico deve essere collegato a un flow documentato.

## Baseline attuale non approvata

- riserva target: `2000` bps;
- riserva minima: `1500` bps;
- AaveV3 target/max: `3500/4000` bps;
- EulerV2 target/max: `2500/3000` bps;
- MorphoVault target/max: `2000/2500` bps;
- Morpho diretto: target/max `0/0`, monitor-only;
- movimento massimo per ciclo: `1000` bps;
- importo minimo: `100000` unità, cioè 0.1 USDC;
- cooldown: `3600` secondi;
- health factor minimo: `1500000000000000000`;
- `supplyOnly=true`;
- oracle freshness obbligatoria: `false`.

Questi valori descrivono il control file corrente. Non sono una raccomandazione
finanziaria e non devono essere copiati come policy definitiva senza decisione.

## Decisioni aperte

- capitale massimo totale;
- massimale per protocollo;
- riserva target e minima;
- movimento massimo per ciclo;
- importo minimo economicamente sensato;
- cooldown;
- slippage massimo;
- fee di deposito e withdraw;
- limiti deposit e withdraw;
- health factor minimo;
- comportamento con oracle mancanti o stale;
- comportamento con APY mancanti;
- criteri di emergency pause;
- selector consentiti per ogni plugin.

La fase può essere documentata e simulata senza utenti. I valori definitivi
richiedono comunque una decisione esplicita dell'utente.

## Modello dei controlli

La policy umana è la fonte normativa. Il control file implementa limiti
off-chain. I contratti applicano i limiti che devono resistere a un controller
errato o compromesso. Il confronto usa la regola seguente:

- un limite massimo on-chain deve essere minore o uguale al massimo off-chain;
- un minimo di sicurezza on-chain deve essere maggiore o uguale al minimo off-chain;
- un'azione non prevista dalla policy deve essere negata;
- una capacità senza controllo on-chain deve essere registrata come gap tecnico.

## Modello della selector whitelist

`ProtocolManager.executeProtocolCall()` usa una mapping esatta
`plugin -> bytes4 -> bool`. Non esiste una necessità tecnica di wildcard.

Il flow automation attuale usa i metodi tipizzati `deposit()` e `withdraw()` di
ProtocolManager. Non usa `executeProtocolCall()`. La policy minima per il POC
`supplyOnly` è quindi:

- selector generici autorizzati per AaveV3: `0`;
- selector generici autorizzati per EulerV2: `0`;
- selector generici autorizzati per MorphoVault: `0`;
- selector generici autorizzati per Morpho: `0`.

Borrow, leverage, swap e chiamate arbitrarie restano fuori perimetro. Un flow
futuro deve aggiungere firma canonica, selector calcolato, motivazione, limiti,
test positivo, test negativo e rollback prima dell'autorizzazione.

## Perimetro consentito

- scrivere la policy umana;
- creare un control file candidato separato;
- ricostruire la whitelist da eventi e stato on-chain;
- generare calldata esatte senza inviarle;
- simulare batch, revoche e limiti su fork fissato;
- aggiungere test di policy, rischio e invarianti;
- mantenere observer e control file operativo invariati.

## Perimetro vietato

- trattare i valori POC come approvati;
- modificare in place `config.arbitrum-usdc-poc-1.json`;
- applicare policy o selector su Arbitrum One;
- autorizzare `0xffffffff` o selector senza firma canonica;
- autorizzare selector per borrow, leverage o swap nel POC `supplyOnly`;
- rendere un limite on-chain più permissivo della policy off-chain;
- usare `PRIVATE_KEY`, mnemonic o signer sulla VPS observer;
- dichiarare completata l'approvazione Safe mentre la Fase 3 è parcheggiata.

## Relazione con le altre fasi

La definizione e i test possono procedere mentre la Fase 4 viene implementata.
La simulazione batch della Fase 5 usa un fork fissato e può riutilizzare
l'harness Safe effimero della Fase 4. La Fase 3 non blocca il PASS tecnico, ma
blocca approvazione Safe e applicazione reale. La Fase 6 resta bloccata dalle
Fasi 3 e 4.

## Gate di uscita

- policy umana completa e approvata dall'utente;
- control file candidato separato e validato;
- matrice off-chain/on-chain completa senza gap non accettati;
- whitelist ricostruita per 4/4 protocolli;
- selector wildcard o non documentati pari a `0`;
- ogni selector autorizzato collegato a un flow e a test positivi/negativi;
- limiti on-chain uguali o più restrittivi della policy off-chain;
- batch esatto simulato due volte sullo stesso fork;
- regressioni e invarianti senza failure;
- control file observe e Arbitrum One invariati.

