# Stato finale, censimento e limiti

## Cosa è stato implementato

### Control file

`scripts/automation/types.ts` e `config.ts` includono ora:

- `execution.kind`: `disabled`, `direct` o `safe`;
- `execution.expectedSignerAddress` per direct execution;
- `safe.address`;
- `safe.txServiceUrl` opzionale per Transaction Service self-hosted;
- `safe.apiKeyEnv`, che contiene soltanto il nome della variabile;
- `runtime.heartbeatPath`;
- `runtime.maxConsecutiveFailures`.

I vecchi schema v1 ricevono default conservativi. Una configurazione non-observe non può rimanere `disabled`; autonomous richiede direct, expected signer e acknowledgement. Safe+autonomous è rifiutato perché non esiste ancora un Safe Module auditato.

La scansione ricorsiva rifiuta `privateKey`, `mnemonic`, seed phrase e varianti come campi JSON.

### Preflight

Nuovo file: `scripts/automation/preflight.ts`.

Controlla cumulativamente:

- provider e block number;
- chain config/manifest/provider;
- asset code e decimals;
- bytecode asset e core;
- presenza, active state e kind dei protocolli;
- bytecode plugin, lens e registry;
- registrazioni on-chain del `ProtocolManager` contro il manifest;
- owner del `ProtocolManager`;
- signer diretto e saldo gas;
- Safe, ownership e Transaction Service;
- scrivibilità di state e heartbeat directory.

Il report usa `PASS`, `WARNING` e `FAIL`. `ready=false` e exit code 2 indicano preflight fallito.

### Safe

Nuovo file: `scripts/automation/safe.ts`.

Dipendenze fissate per Node 20:

- `@safe-global/protocol-kit` 7.2.0;
- `@safe-global/api-kit` 4.2.0;
- `@safe-global/types-kit` 3.1.0;
- override `safe-deployments` 1.37.56.

L'adapter:

1. converte il piano in sole operazioni `CALL`;
2. forza `MultiSendCallOnly` per batch;
3. richiede al Transaction Service la stima;
4. ricostruisce la transazione col `safeTxGas` definitivo;
5. calcola il Safe transaction hash ufficiale;
6. verifica che il proposer sia owner;
7. firma e propone;
8. salva binding immutabile;
9. legge lo stato dal servizio;
10. richiede `trusted=true`;
11. confronta tutti i dati col binding;
12. verifica receipt, target Safe e conferme;
13. esegue il post-state verifier.

La semplice proposta resta `AWAITING_APPROVAL`. Soltanto esecuzione on-chain più post-verifica portano a `COMPLETED`.

### Controller e state machine

`controller.ts` aggiunge:

- `AWAITING_SAFE_PROPOSAL`;
- binding Safe;
- riconciliazione external execution;
- blocco direct execution quando `execution.kind` non è direct;
- verifica signer atteso prima dell'invio;
- riuso di un run aperto per evitare intenzioni duplicate.

`store.ts` include le transizioni Safe e `latestOpen()`.

### Servizio

Nuovo file: `scripts/automation/service.ts`.

Implementa:

- heartbeat atomico;
- PID e timestamp;
- ultimo run/stato;
- fallimenti consecutivi;
- exit dopo soglia;
- attesa interrompibile;
- forwarding esplicito del persistent gate.

Il vecchio scheduler duplicato è stato rimosso. La CLI usa un solo runner.

### CLI

`scripts/automation/cli.ts` aggiunge:

- `preflight`;
- `safe-propose`;
- `safe-sync`;
- `service-status`.

`loop` esegue preflight prima di avviare il servizio. In Safe mode il comando testuale `approve` è rifiutato.

## Censimento file modificati

| File | Modifica |
|---|---|
| `scripts/automation/types.ts` | execution, Safe binding/status, heartbeat, nuovo stato |
| `scripts/automation/config.ts` | validazione execution/Safe/segreti/service |
| `scripts/automation/config.example.json` | default observe e service fields |
| `scripts/automation/preflight.ts` | nuovo bootstrap report |
| `scripts/automation/safe.ts` | nuovo adapter ufficiale Safe |
| `scripts/automation/service.ts` | nuovo runner supervisionabile |
| `scripts/automation/controller.ts` | Safe workflow, signer guard, open-run guard |
| `scripts/automation/store.ts` | transizioni e run aperto |
| `scripts/automation/cli.ts` | quattro comandi e preflight del loop |
| `test/automation/VaultAutomationController.test.ts` | 14 casi complessivi |
| `package.json` / `package-lock.json` | dipendenze Safe compatibili Node 20 |

## Evidenze eseguite

```text
npm run automation:test   14 passing
npm run scripts:test      37 passing
npm run scripts:typecheck PASS
npm run compile           PASS
```

Totale delle due suite locali: 51 test.

Il percorso Safe è testato con:

- client Protocol/API fake iniettati;
- verifica della conversione e del call-only batch;
- estimate → hash → propose → status;
- pending non considerato execution;
- mismatch hash rifiutato;
- transazione Hardhat realmente confermata;
- receipt, conferme e post-state verifier.

Non è stato chiamato un Transaction Service reale perché manca una Safe POC scelta.

## Dependency audit

`npm audit --omit=dev` segnala 17 advisory runtime nella dependency tree preesistente di Chainlink, Uniswap, vecchie OpenZeppelin/Ethers 5 e `ws`: 10 low, 3 moderate, 4 high, 0 critical.

I kit Safe aggiunti non sono indicati come causa. La correzione proposta per gran parte della catena richiede un major upgrade di `@chainlink/contracts`; applicarlo automaticamente potrebbe cambiare import, ABI e comportamento Solidity. È quindi un workstream separato da analizzare e testare prima del deploy produttivo.

## Limiti che restano

- Nessun manifest reale può essere inventato: deve provenire dal deploy scelto.
- Nessuna Safe reale è stata creata o finanziata.
- Nessuna ownership reale è stata trasferita.
- Nessuna firma/quorum Safe reale è stata raccolta.
- Il servizio è single-host, non HA.
- Il journal resta JSON locale.
- Una proposta Safe stale può essere segnalata ma non invalidata on-chain dal controller.
- Non esiste un Safe Module autonomo.
- Le advisory legacy devono essere migrate prima della produzione.
- Uptime 24/7 e incident drill richiedono tempo reale.

Questi limiti impediscono la dicitura production-ready, ma non impediscono deploy POC, fork, observe e successivo advisory controllato.
