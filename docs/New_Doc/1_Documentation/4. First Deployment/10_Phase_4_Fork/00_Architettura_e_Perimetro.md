# Fase 4 — architettura della rehearsal ownership su fork

## Obiettivo

Provare il trasferimento completo del controllo amministrativo prima di
modificare Arbitrum One. La rehearsal deve individuare contratti dimenticati,
metodi a uno o due step, permessi residui del deployer e procedure non
reversibili.

## Stato di partenza

- chain sorgente: Arbitrum One, chain ID `42161`;
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- deployer: `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- contratti censiti nel manifest: `22`;
- control file reale: `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- observer reale: mode `observe`, execution `disabled`, autonomous `false`;
- Fase 3: parcheggiata nel documento `00_TODO_Non_Tecnico/01_Cose_Da_Fare_Dopo_Parte_Tecnica.md`.

## Modello della simulazione

Hardhat crea un fork locale fissato da `FORK_BLOCK_NUMBER`. Le transazioni
modificano davvero lo stato EVM del fork ma non vengono inviate ad Arbitrum One.

Il test crea una Safe effimera `2-of-3` con tre account Hardhat distinti. La
Safe esiste soltanto nella rehearsal. Non rappresenta la governance definitiva
e non sblocca le Fasi 6, 7 o 8.

Il deployer viene impersonato soltanto sulla rete Hardhat. L'impersonation viene
chiusa e lo snapshot iniziale viene ripristinato a fine prova.

## Perimetro dei contratti

Il manifest contiene 22 righe obbligatorie:

- `beacon`: ownership custom a due step;
- 20 contratti `Ownable`: trasferimento a uno step;
- `flashLoanService`: nessuna ownership trasferibile, accesso vincolato al Beacon immutabile.

`flashLoanService` resta nella matrice con metodo `non applicabile` ed evidenza
dell'indirizzo Beacon. Non deve essere eliminato dal censimento.

## Perimetro consentito

- leggere Arbitrum One tramite `ARBITRUM_RPC_URL`;
- fissare un blocco successivo all'ultima configurazione;
- impersonare il deployer e whale esclusivamente nel fork;
- finanziare account locali con RPC Hardhat;
- creare una Safe locale effimera;
- trasferire tutte le ownership trasferibili nel fork;
- eseguire amministrazione, pause, unpause, update e rollback nel fork;
- eseguire deposit, withdraw e controlli health nel fork;
- salvare output, receipt locali e matrice senza segreti.

## Perimetro vietato

- usare `--network arbitrum` per comandi mutativi;
- inviare transazioni ad Arbitrum One;
- cambiare ownership o capitale reale;
- usare una private key reale per il fork;
- scrivere private key, mnemonic o RPC URL nei documenti;
- trattare la Safe effimera come Safe approvata;
- omettere `flashLoanService` dalla matrice;
- accettare un fork mobile senza `FORK_BLOCK_NUMBER`;
- dichiarare PASS se il vecchio deployer conserva controllo non documentato.

## Relazione con le altre fasi

La Fase 2 continua in observe. La Fase 3 resta parcheggiata. La Fase 4 può
procedere perché non richiede governance reale. Il suo PASS fornisce evidenza
tecnica alla Fase 6, ma non autorizza un trasferimento reale. La Fase 5 può
procedere dopo questa documentazione senza attendere la Safe reale.

## Gate di uscita

- fork fissato e riproducibile su chain ID `42161`;
- matrice completa `22/22` senza righe mancanti;
- bytecode presente per `22/22` contratti;
- ownership trasferita alla Safe locale per `21/21` contratti trasferibili;
- `flashLoanService` classificato e verificato come eccezione non Ownable;
- controllo residuo non autorizzato del deployer pari a `0`;
- amministrazione tramite Safe locale riuscita e rollback verificato;
- pause e unpause riuscite tramite Safe locale;
- deposit, withdraw e health riusciti dopo il trasferimento;
- snapshot ripristinato e nessuna transazione Arbitrum One inviata.

