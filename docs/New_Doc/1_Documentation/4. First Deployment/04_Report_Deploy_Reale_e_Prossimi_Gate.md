# Report deployment reale e prossimi gate

## Risultato in una frase

Il POC USDC è deployato su Arbitrum One, i tre percorsi supply-only sono stati provati con fondi reali e ripuliti, Morpho market è certificato su fork, e l'automazione reale funziona in modalità observe senza possibilità di inviare transazioni.

## Cosa è già utilizzabile

- Il manifest reale permette a CLI, test e automazione di risolvere gli stessi indirizzi.
- Deposit e withdraw del vault funzionano.
- Aave, Euler e Morpho Vault accettano e restituiscono USDC.
- Morpho WETH/USDC è registrato e funzionante su fork; non viene finanziato dal controller USDC.
- Status, health, positions e cleanup sono leggibili in modo deterministico.
- Il control file reale può essere eseguito una volta o come servizio 24/7 in observe.

## Perché non viene lasciato subito autonomo

`observe` legge e decide ma non costruisce alcun percorso persistente. Il file imposta `execution.kind = disabled` e `autonomous.enabled = false`. Questa separazione consente di misurare stabilità RPC, drift, failure rate e telemetria senza esporre capitale.

Il passo successivo non è un altro deploy: è accumulare evidenza operativa, configurare Safe e passare ad advisory. In advisory il controller prepara una proposta deterministica, ma una Safe con soglia configurata decide se eseguirla.

## Comandi immediati

Da PowerShell nella root `TestSmartContract`:

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.json
npm run automation:cli -- run --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

Per avviare il loop observe supervisionato:

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
npm run automation:cli -- loop --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

Il loop va eseguito con un service manager che gestisca restart, log, heartbeat e alert. Fermarlo con `Ctrl+C` non modifica la chain.

## Cosa controllare nelle 24–72 ore

- preflight sempre `ready: true`;
- heartbeat aggiornato secondo l'intervallo di 300 secondi;
- nessun `CYCLE_FAILED` ripetuto;
- ogni ciclo `NO_ACTION` finché il vault è vuoto;
- block span entro il massimo configurato;
- nessuna posizione o allowance inattesa;
- nessuna divergenza tra manifest e ProtocolManager;
- saldo ETH sufficiente solo per operazioni amministrative intenzionali.

## Passaggio Safe advisory

Prima di cambiare il control file servono indirizzo Safe, owner, threshold, recovery e API key del Transaction Service. Poi si crea una copia advisory del control file con `mode = advisory` ed `execution.kind = safe`; si eseguono preflight, simulazione fork, proposta Safe di prova, sync della receipt e verifica dello stato post-esecuzione.

Non trasferire ownership prima che questa prova sia completa. Non abilitare autonomous come semplice conseguenza del successo del POC: richiede audit, telemetria normalizzata e limiti economici definitivi.

## Fonti autorevoli nel repository

- Manifest reale: `scripts/manifests/arbitrum-usdc-poc-1.json`.
- Control file observe: `scripts/automation/config.arbitrum-usdc-poc-1.json`.
- Checklist aggiornata: `01_Checklist_Deploy_Nuovo_POC_USDC.md`.
- Evidenze e transaction hash: `03_Registro_Evidenze_PreDeploy.md`.
- Registro completo errore per errore: `05_Registro_Tecnico_Completo_Errori_e_Fix.md`.
- Roadmap dal POC alla produzione: `06_Roadmap_Prossimi_Passi_Dal_POC_alla_Produzione.md`.
- Guida Safe/servizio: `../Vault Automation Controller/10_Control_File_Implementation/05_Guida_Safe_e_Servizio_24_7.md`.
