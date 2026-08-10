# Accounting, Shares & ERC-4626

> NAV, share, donazioni, reward e standard asincroni futuri

Versione 0.1 · 22 luglio 2026

Stato: bozza di lavoro consolidata

## Base documentale e stato delle informazioni

Fonti iniziali fornite: Plan_baseasssetabstraction.md; explenation_file.md; plan_baseasset_phases.md.

Decisioni consolidate: risposte e chiarimenti forniti nella conversazione fino al 22 luglio 2026.

Regola di prevalenza: quando un documento iniziale descrive una fase come futura ma la conversazione conferma che è stata implementata, il documento riporta entrambe le informazioni e considera la decisione più recente come stato corrente dichiarato.

## 1. Scelta dello standard

> **Nota:** DECISO: i vault Jethos adottano ERC-4626 per share, depositi, mint, withdraw, redeem e funzioni di preview. Gli share token utilizzano 18 decimali.

ERC-4626 fornisce l’interfaccia comune necessaria a wallet, meta-vault, lending market e integrazioni. Il primo PoC sarà sincrono. I vault con liquidità non immediata potranno utilizzare in futuro ERC-7540; la cancellazione delle richieste potrà considerare ERC-7887.

## 2. ERC-4626 nel modello Jethos

| Concetto | Decisione |
| --- | --- |
| asset() | Base asset del vault, ad esempio USDC. |
| share | ERC-20 distinta per chain, base asset e profilo. |
| decimals | 18 per tutte le share; conversione corretta per asset a 6/8/18 decimali. |
| totalAssets() | Valore netto nel base asset delle riserve e posizioni, meno debiti. |
| price per share | Espresso nel base asset; conversione USD solo come vista frontend/analytics. |
| rendimento | Matura nel prezzo per share. |

## 3. Componenti di totalAssets

- Base asset non investito nella riserva.
- Valore riscattabile delle posizioni Aave, Morpho ed Euler.
- Interessi maturati già incorporati nelle posizioni o calcolabili.
- Valore netto di future strategie autorizzate.
- Meno debiti e passività.
- Reward incluse soltanto dopo claim e conversione nel PoC; accounting più sofisticato rinviato.

> **Nota:** Se il NAV non è calcolabile in modo affidabile, l’operazione deve fallire: niente nuova emissione o distruzione di share con un valore incerto.

## 4. Reward

1. Il protocollo accumula reward dei protocolli sottostanti.
1. Quando il valore netto supera gas, slippage e soglia minima, esegue harvest.
1. Le reward vengono convertite nel base asset tramite route autorizzate.
1. Il base asset viene reinvestito o inserito nella riserva.
1. Il valore aggiunto aumenta il prezzo per share di tutti i detentori.

## 5. Donazioni di base asset

> **Nota:** DECISO: la contabilità è balance-based. Una donazione diretta di base asset aumenta totalAssets e quindi il valore economico di tutte le share.

Un ERC-20 può essere trasferito direttamente al vault senza passare da deposit(); il vault non può impedire in modo generale il trasferimento. Jethos non utilizzerà un importo contabile separato dal saldo reale, perché creerebbe complessità di riconciliazione e asset non contabilizzati.

## 6. Donation / inflation attack

Il rischio non è che una share debba essere intera: con 18 decimali può essere frazionaria. Il rischio è l’arrotondamento alle unità minime, soprattutto in vault vuoti o quasi vuoti, e l’uso di un prezzo per share manipolato in altri protocolli.

| Protezione | Uso previsto |
| --- | --- |
| Virtual assets e virtual shares | Stabilizzano la formula quando supply e asset reali sono bassi. |
| Decimal offset | Per USDC, offset coerente con share a 18 decimali e asset a 6. |
| Deposito minimo | Evita operazioni economicamente insignificanti e arrotondamenti estremi. |
| Revert su zero share | Nessun deposito può produrre zero unità minime di share. |
| minSharesOut / router protetto | L’utente definisce il minimo accettabile rispetto alla preview. |
| Cap iniziale e bootstrap controllato | Riduce la superficie durante l’avvio del vault. |
| Test donation/inflation | Fuzz e invariant test su donazioni prima/dopo depositi e vault quasi vuoto. |

## 7. Primo deposito e vault vuoto

> **Nota:** PROVVISORIO: adottare una implementazione ERC-4626 auditata con virtual accounting; non è richiesto bloccare share reali permanentemente. Definire deposito minimo e comportamento dopo il rimborso dell’ultima share nella specifica di codice.

## 8. Arrotondamenti

- Depositi e mint devono arrotondare secondo lo standard senza trasferire valore ingiusto.
- Withdraw e redeem devono impedire che l’utente riceva più del proprio diritto economico.
- Le funzioni preview devono essere coerenti con l’esecuzione nello stesso stato.
- Test obbligatori per USDC 6 decimali, WBTC 8 e WETH 18.
- Test su depositi minimi, prelievi parziali e cicli ripetuti.

## 9. ERC-7540 futuro

ERC-7540 estende ERC-4626 con richieste asincrone. È utile quando una strategia richiede tempo per recuperare liquidità. Il modello futuro Jethos prevede epoche: le richieste vengono raggruppate, il vault recupera liquidità, ogni partecipante riceve la stessa percentuale della propria richiesta e l’eventuale residuo passa all’epoca successiva.

| Stato | Significato |
| --- | --- |
| Pending | Share impegnate e richiesta in attesa di liquidità. |
| Claimable | Una quantità di asset è disponibile per il claim. |
| Claimed | L’utente ha ricevuto l’importo disponibile. |

## 10. ERC-7887 futuro

La cancellazione non è parte necessaria del PoC. In una futura queue sarà valutata una estensione compatibile con ERC-7887 o logica equivalente: cancellabile finché pending, non cancellabile quando il disinvestimento è irreversibile, con restituzione delle share o gestione esplicita del residuo.

## 11. Governance delle share

Il saldo corrente non può essere usato direttamente come potere di voto perché le share sono trasferibili, prestabili e collateralizzabili. Il futuro sistema dovrà usare snapshot, saldo medio temporale, delega o vote escrow ed evitare doppio conteggio e flash-loan voting.
