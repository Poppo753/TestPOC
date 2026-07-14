# Guida completa ai comandi

## 1. Preparazione

Lavora dalla root `TestSmartContract`. Copia `scripts/automation/config.example.json` con un nome dedicato e modifica almeno:

- `vaultId` univoco;
- `manifestPath` verso un manifest reale e validato;
- chain, asset e decimals;
- nomi dei protocolli esattamente uguali a `ProtocolManager` e al manifest;
- target, cap e riserva la cui somma target sia 10.000 bps;
- `stateDirectory` dedicata al vault;
- `maxStateDriftBps`, che tollera soltanto piccoli movimenti passivi;
- modalità iniziale `observe`.

L’esempio punta intenzionalmente a un manifest segnaposto. Non lanciarlo invariato contro mainnet.

In PowerShell seleziona la rete Hardhat:

```powershell
$env:HARDHAT_NETWORK = "arbitrum"
```

Per uno smoke riproducibile read-only su fork:

```powershell
$env:HARDHAT_NETWORK = "hardhat"
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483105327"
```

Usa una RPC privata/stabile e il blocco certificato per prove riproducibili.

Per una simulazione advisory destinata a un’esecuzione successiva, il fork deve invece partire da uno stato recente. Aggiungi alla sezione `runtime` della configurazione:

```json
"simulationImpersonateAddress": "0x..."
```

L’indirizzo deve essere l’owner/autorità che può chiamare `ProtocolManager`. Sul solo network Hardhat forkato la CLI impersona e finanzia questo account per il gas simulato. Non è una private key e non abilita alcun invio su mainnet.

## 2. Validazione e test

```powershell
npm run scripts:typecheck
npm run automation:test
npm run scripts:test
npm run compile
```

Fork smoke:

```powershell
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483105327"
npx hardhat test test/scripts/ForkSmoke.test.ts
```

## 3. Un ciclo

```powershell
npm run automation:cli -- run --config="scripts/automation/config.poc.json"
```

In `observe` il run termina `OBSERVED_ONLY` o `NO_ACTION`. In `advisory`, se esiste un rebalance valido, termina `AWAITING_APPROVAL`. In `autonomous` la mancanza dei flag persistenti lascia il run `APPROVED` senza inviare.

## 4. Consultare il journal

```powershell
npm run automation:cli -- list --config="scripts/automation/config.poc.json"
npm run automation:cli -- show --config="scripts/automation/config.poc.json" --run-id="RUN_ID"
```

Questi comandi sono offline: leggono i file locali e non richiedono signer.

## 5. Esportare il piano

```powershell
npm run automation:cli -- export --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --output="rebalance-plan.json"
```

Il file di output deve non esistere, per evitare sovrascritture accidentali. Il piano contiene target, value, calldata, dipendenze e warning; non contiene una firma Safe.

## 6. Approvare o cancellare

```powershell
npm run automation:cli -- approve --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --approved-by="safe-proposal-123"
npm run automation:cli -- cancel --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --reason="policy changed"
```

L’approvazione del POC è un evento nel journal. Non sostituisce una firma multisig. Il campo `approved-by` deve contenere un riferimento auditabile, non “ok”.

## 7. Eseguire un piano approvato

Solo questo comando invia realmente:

```powershell
npm run automation:cli -- execute --config="scripts/automation/config.poc.json" --run-id="RUN_ID" --execute=true --dry-run=false
```

Se manca uno dei due flag, il comando fallisce. Prima dell’invio il controller verifica configurazione, vault e chain, riosserva il vault e riesegue il risk engine. Cambi strutturali sono sempre `STALE`; drift oltre `maxStateDriftBps` o un piano troppo vecchio sono `STALE`. Piccoli interessi passivi entro soglia non invalidano inutilmente il piano.

Una sequenza advisory reale usa due ambienti:

1. `HARDHAT_NETWORK=hardhat` con fork recente e impersonazione per costruire/simulare;
2. approvazione del piano;
3. `HARDHAT_NETWORK=arbitrum` con signer reale per `execute`.

Un normale RPC mainnet non offre `evm_snapshot`: non usarlo per dichiarare simulato un piano multi-call.

## 8. Loop

Shadow/advisory, senza invio:

```powershell
npm run automation:cli -- loop --config="scripts/automation/config.poc.json"
```

Interrompi con `Ctrl+C`. In produzione usa un process manager; non considerare una shell aperta un servizio affidabile. Il loop non rende persistenti transazioni perché non riceve i due flag. L’autonomous persistente può essere avviato con gli stessi due flag, ma non va usato prima dei gate descritti nel runbook.

## 9. Interpretazione stati

- `NO_ACTION`: nessun intervento economicamente/politicamente necessario.
- `OBSERVED_ONLY`: decisione registrata, modalità observe.
- `REJECTED`: risk finding bloccante.
- `AWAITING_APPROVAL`: simulazione riuscita, operatore richiesto.
- `APPROVED`: approvato ma non ancora inviato.
- `STALE`: non eseguibile; creare un nuovo run.
- `EXECUTION_FAILED`: invio iniziato ma piano non completato; riconciliare le receipt.
- `VERIFICATION_FAILED`: receipt confermate, post-stato non conforme; incidente.
- `FAILED`: errore inatteso registrato.
- `COMPLETED`: execution e verifica riuscite.

## 10. Regola pratica

Non modificare manualmente un run JSON. Cancella o lascia terminale il vecchio run e generane uno nuovo. Conserva la state directory in backup e impedisci accessi in scrittura non autorizzati.
