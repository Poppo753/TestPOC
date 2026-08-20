# Stato attuale e scelte architetturali

## Decisione

Ha senso completare il percorso verso un'automazione governata da un unico control file. Non ha invece senso trasformare quel file in un contenitore di indirizzi copiati a mano, private key o poteri amministrativi.

Il risultato corretto è:

- un control file per vault, leggibile e validato;
- un manifest separato, prodotto dal deploy e trattato come evidenza tecnica;
- segreti forniti esclusivamente dal processo o da un secret manager;
- Safe come proprietario e percorso di approvazione/esecuzione multisig;
- un runner 24/7 osservabile, arrestabile e fail-closed;
- deployment e upgrade separati dal processo che gestisce il capitale.

## Cosa esiste già

### Control file

`scripts/automation/config.example.json` contiene già la maggior parte del profilo operativo:

- identità del vault e chain;
- riferimento al manifest;
- asset base;
- protocolli e allocazioni;
- reserve target e minimum;
- soglie, cooldown e limiti per ciclo;
- staleness e drift;
- health factor e oracle policy;
- modalità observe, advisory e autonomous;
- directory di stato, intervallo, lock, conferme e retry RPC.

La validazione è fail-closed: target e riserva devono sommare a 10.000 bps, i protocolli disabilitati devono avere target zero, i target non possono superare i cap e l'autonomia richiede doppio opt-in.

### Manifest

Il framework possiede già:

- schema manifest v1;
- caricamento e normalizzazione legacy;
- validazione di indirizzi, protocolli e transaction hash;
- scrittura atomica;
- deploy core e bundle con checkpoint incrementali.

Il manifest non è ancora “reale” perché manca un deploy POC scelto dall'utente con indirizzi definitivi. Questa non è una funzione che si possa completare inventando indirizzi.

### Signer

Il signer viene attualmente fornito da Hardhat. Sulle reti configurate deriva da `PRIVATE_KEY`; su fork può essere impersonato un indirizzo esplicito. La chiave non viene salvata nel control file.

Mancano tuttavia:

- un'identità attesa dichiarata e verificata;
- una distinzione esplicita tra signer diretto, Safe ed esecuzione disabilitata;
- un preflight che verifichi owner/autorità prima di ogni avvio operativo;
- istruzioni chiare per usare secret manager o signer remoto.

### Safe

Oggi il piano è portabile ed esportabile, ma `approve --approved-by=...` registra soltanto un'approvazione applicativa. Non è una firma Safe.

L'integrazione corretta deve:

1. costruire il batch a partire dallo stesso `ExecutionPlan` simulato;
2. usare solo `CALL`, mai `DELEGATECALL` arbitrario;
3. calcolare il Safe transaction hash ufficiale;
4. proporre la transazione con la firma di un owner oppure esportarla per un processo esterno;
5. legare `runId`, Safe, nonce e `safeTxHash`;
6. rileggere lo stato dal Transaction Service;
7. verificare che target, value e calldata coincidano;
8. considerare concluso il run solo dopo receipt e verifica post-stato.

Una Safe non autorizza il server a fingersi la Safe. Se `ProtocolManager.owner()` è la Safe, l'esecuzione deve provenire dalla Safe stessa o da un modulo Safe esplicitamente auditato.

### Servizio 24/7

Esiste già un loop con gestione SIGINT/SIGTERM e lock per vault. Mancano:

- heartbeat persistente;
- stato di readiness/preflight;
- conteggio dei fallimenti consecutivi;
- uscita non-zero dopo una soglia configurata;
- forwarding corretto del gate di esecuzione autonoma al loop;
- esempi di supervisione e restart policy;
- separazione fra osservabilità del processo e journal dei run.

## Cosa conviene implementare ora

### 1. Preflight unificato

Un comando deve risolvere config e manifest, verificare provider, bytecode, asset, protocolli, owner, signer atteso, Safe e directory scrivibile. Deve produrre un report JSON utilizzabile anche da CI e health check.

### 2. Identità di esecuzione esplicita

Nel control file va dichiarato il modello operativo, non il segreto:

- `disabled`: observe-only;
- `direct`: signer esterno atteso, utilizzabile soltanto quando possiede l'autorità richiesta;
- `safe`: Safe proprietaria; il controller prepara e riconcilia transazioni multisig.

La private key resta nell'ambiente o nel secret backend del processo.

### 3. Adapter Safe limitato ma reale

Per non sovra-ingegnerizzare, il POC deve usare i kit ufficiali Safe per batch, hash, proposta e lettura dello stato. Non deve implementare manualmente EIP-712 o MultiSend.

La prima versione non introduce moduli Zodiac, ERC-4337, paymaster o esecuzione automatica della Safe. Gli owner firmano/eseguono tramite Safe. Il controller riconcilia e verifica.

### 4. Runner di servizio

Il runner deve essere un processo singolo per vault, supervisionato da systemd, Docker Compose o un process manager equivalente. Il codice produce heartbeat e fallisce esplicitamente; il supervisor gestisce restart e log collection.

### 5. Documentazione e test

Ogni nuova garanzia deve avere:

- test unitario;
- test di integrazione locale ove possibile;
- comando ripetibile;
- failure path documentato;
- gate esterno lasciato aperto quando richiede infrastruttura reale.

## Cosa non conviene implementare ora

- deploy automatico durante il loop;
- private key nel JSON;
- un file globale contenente tutti i vault e tutti i segreti;
- database distribuito prima di avere più host;
- Kubernetes prima di avere un POC stabile;
- Safe module autonomo prima di audit e threat model dedicato;
- bridge, cross-chain coordinator o strategia multi-asset;
- Dolomite e GMX finché i plugin restano incompleti.

## Definizione onesta di completamento

Il lavoro software può essere completato quando control file, preflight, signer policy, Safe adapter, runner, test e guide sono presenti. Restano necessariamente esterni:

- deploy del POC con fondi reali;
- creazione/configurazione della Safe;
- firme multisig reali;
- disponibilità 24/7 misurata nel tempo;
- audit indipendente.

Questi elementi devono comparire come gate aperti, non come implementazioni mancanti nascoste.
