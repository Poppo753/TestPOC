# Fase 3 — architettura governance e Safe

## Obiettivo

Definire il modello di governance e creare una Safe su Arbitrum One. La fase
riduce la dipendenza dal deployer senza trasferire ancora le ownership dei
contratti core.

## Stato di partenza

- chain operativa: Arbitrum One, chain ID `42161`;
- deployer registrato: `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- observer VPS: `vault-observer-arbitrum-01`, `46.225.133.37`;
- servizio: `vault-automation-observe.service`;
- control file: `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- modalità: `observe`, execution `disabled`, autonomous `false`;
- capitale osservato: 3.1 USDC;
- transazioni automation eseguite: 0.

## Decisioni aperte dell'utente

Prima della creazione devono essere approvati:

- numero e identità degli owner;
- threshold;
- hardware wallet associato a ogni owner;
- isolamento tra dispositivi e seed phrase;
- procedura per perdita o indisponibilità di una chiave;
- identità o processo autorizzato a proporre;
- processo di decodifica e revisione della calldata;
- delay operativo per upgrade e operazioni ad alto impatto.

La proposta POC è una Safe `2-of-3`. Non è un valore definitivo finché la
decisione non è registrata e approvata.

## Perimetro consentito

- documentare owner, threshold e ruoli senza dati segreti;
- creare una Safe su Arbitrum One;
- verificare bytecode, chain, owner, threshold e nonce;
- eseguire una transazione innocua con valore `0` e calldata `0x`;
- provare il recovery rendendo indisponibile un solo owner;
- mantenere l'observer VPS in modalità read-only.

## Perimetro vietato

- trasferire ownership dei contratti core;
- modificare in place il control file observe;
- abilitare advisory, autonomous o direct execution;
- copiare private key, mnemonic o seed phrase sulla VPS;
- usare lo stesso dispositivo o la stessa seed phrase per più owner;
- assegnare a una sola chiave il potere di proposta ed esecuzione;
- installare moduli, guard o fallback handler Safe non approvati;
- usare la Safe per muovere i 3.1 USDC del vault in questa fase.

## Relazione con le altre fasi

La Fase 2 continua senza cambiamenti e fornisce osservazione read-only. La Fase
3 crea il confine di governance necessario alla Fase 4. La Fase 4 simulerà su
fork i trasferimenti di ownership. Il trasferimento reale resta escluso fino
alla Fase 6.

## Gate di uscita

- decisioni di governance approvate e registrate;
- Safe deployata su chain ID `42161`;
- owner e threshold verificati da almeno due dispositivi;
- transazione innocua confermata con receipt `status=1`;
- nonce Safe incrementato esattamente di `1`;
- recovery provato con un owner indisponibile e threshold ancora raggiungibile;
- owner dei contratti core invariati;
- observer ancora `observe`, execution `disabled`, autonomous `false`.

