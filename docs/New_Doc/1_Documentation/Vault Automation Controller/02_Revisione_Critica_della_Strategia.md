# Revisione critica della strategia

## Metodo

La strategia espansa è stata riletta confrontando ogni componente con le API effettive del repository. Le correzioni seguenti sono già incorporate in `01_Strategia_Espansa_e_Architettura.md`; questo documento conserva il perché delle decisioni.

## Correzioni applicate

### Da “massimizzare APY” a target allocation deterministica

Il piano iniziale citava un motore di rendimento. I summary espongono `netAPY`, ma senza un contratto dati completo su scala, freshness, errore e costo di uscita. Usarlo per spostare fondi sarebbe una falsa precisione. Il POC usa target configurati; l’APY è sola telemetria.

### Da portafoglio multi-asset a singolo asset base

Sommare balance con decimals o prezzi diversi è scorretto. Il primo observer somma solo custody e supply dello stesso base asset. Multi-asset richiederà un oracle snapshot normalizzato.

### Borrow escluso, non soltanto “sconsigliato”

Health factor e liquidation risk cambiano radicalmente il recovery di un piano parziale. Il POC impone debt zero. Emergency unwind del debito sarà un progetto successivo con simulazioni dedicate.

### JSON store prima di PostgreSQL

Un database remoto sarebbe prematuro e aumenterebbe superficie operativa. File atomici e lock esclusivo coprono il POC single-host. Il codice usa un’interfaccia concettualmente sostituibile; multi-worker richiederà database e advisory lock.

### Safe come export, non integrazione finta

Questa era la limitazione della prima implementazione. L'adapter Transaction Service è ora presente e censito in `10_Control_File_Implementation/`: costruisce batch call-only, stima, propone, lega l'hash e riconcilia receipt/post-stato. Firma e quorum restano esterni e non sono dichiarati validati finché non viene usata una Safe POC reale.

### Fingerprint e blocco, non solo timeout temporale

Un piano può diventare obsoleto in pochi secondi dopo un deposito o un altro rebalance. La validità richiede sia limite di blocchi sia corrispondenza dello stato economico osservato.

### Simulazione intera, non call indipendenti

Withdraw e deposit dipendono dallo stato prodotto dai passaggi precedenti. Il piano viene simulato come sequenza su snapshot/revert. Provider senza snapshot non certificano il piano multi-call.

### Scheduler sottile

La business logic non vive nel timer. One-shot, scheduler e backend devono richiamare lo stesso controller. Questo rende test e recovery riproducibili.

### Autonomia con doppio opt-in

Un typo in `mode` non deve inviare fondi. Oltre alla modalità servono `enabled` e una acknowledgement esatta. Il default resta observe/advisory.

## Decisioni confermate

- risk engine separato dalla strategia;
- withdraw prima di deposit;
- cap, riserva, cooldown e massimo per ciclo;
- journal append-only per transizioni;
- verifica post-stato distinta dalla receipt;
- Dolomite e GMX esclusi;
- Arbitrum-first, multi-vault prima di multi-chain;
- shadow mode e capitale limitato prima dell’autonomia.

## Rischi residui dichiarati

- un file store non coordina host differenti;
- il POC non riconcilia automaticamente transazioni rimaste pending durante un crash;
- la simulazione fork non garantisce disponibilità futura di liquidità;
- una chiave owner è troppo potente per produzione: servono ruoli dedicati;
- i lens rimangono dipendenze critiche e devono essere monitorati;
- senza feed normalizzati non è possibile attestare rendimento netto o perdita economica multi-asset.

## Conclusione

La strategia revisionata è la più prudente compatibile con l’infrastruttura attuale. Costruisce il cervello operativo e tutti i suoi confini, senza dichiarare risolti pricing, Safe, HA e cross-chain che non sono ancora implementati.
