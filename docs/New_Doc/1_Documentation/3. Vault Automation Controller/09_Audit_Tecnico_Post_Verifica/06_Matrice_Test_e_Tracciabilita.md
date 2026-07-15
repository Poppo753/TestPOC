# Matrice test e tracciabilità

## Suite controller

File: `test/automation/VaultAutomationController.test.ts`.

| Caso | Requisiti coperti |
|---|---|
| Config/autonomy | somme bps, supply-only, acknowledgement fail-closed |
| Strategy | withdraw-first, target/delta, max movement, cooldown, balanced/no-action, azione cap sotto minimum |
| Risk aggregato | debt, circuit unknown, oracle missing, reserve |
| Risk guard table | pause, deposit/withdraw flags, inactive, circuit breaker, health, cap, movement, autonomy |
| Fingerprint | indipendenza da tempo/blocco, sensibilità allo stato economico |
| Drift | yield piccolo ammesso, variazione materiale respinta, cambio strutturale sempre respinto |
| Planner/verifier | ID, dipendenze, direzione, managed asset loss |
| Store/lock | persistenza, transizioni, esclusione secondo worker |
| End-to-end locale | protocolli attivi completi, summary ABI, observer, simulation rollback, approve, execute, verify, stale, lock release su read failure |
| Control file security | execution kind, signer atteso, secret fields, combinazioni mode |
| Preflight | bytecode, registry on-chain, owner e mismatch identità |
| Safe adapter | call-only batch, estimate, hash, proposal e status con client fake |
| Safe reconciliation | pending/mismatch, receipt reale e post-state verifier |
| Servizio | persistent gate, heartbeat, shutdown e failure threshold |

Risultato corrente: `14 passing`.

## Regression suite script

Comando:

```powershell
npm run scripts:test
```

Copre framework, operations, deployment e Phase 1 core script. Risultato corrente: `37 passing`.

Nota: il test deployment che menziona Dolomite/GMX verifica che bundle incompleti siano rifiutati; non testa i plugin.

## Typecheck

```powershell
npm run scripts:typecheck
```

Compila staticamente tutto `scripts/**/*.ts`, escluso `scripts/legacy`. Include runtime signer injection, controller e CLI.

Risultato: PASS.

## Compile

```powershell
npm run compile
```

Verifica il mock aggiornato e tutti i contratti. Risultato: PASS.

## Fork smoke

```powershell
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483105327"
npx hardhat test test/scripts/ForkSmoke.test.ts
```

Risultato: `1 passing`. È read-only e verifica infrastruttura/manifest deployed. Non è il rebalance completo del controller.

## Matrice requisito → implementazione → evidenza

| Requisito | Implementazione | Evidenza |
|---|---|---|
| Nessun send accidentale | CLI persistent gate + `executePlan` | framework test e controller execution |
| Multi-call stateful simulation | snapshot/revert | framework + controller end-to-end |
| Accounting completo | observer active protocol census | hidden active protocol test |
| Supply-only | config + risk debt guard | config/risk tests |
| Cap/reserve | risk projection + verifier | risk table/end-to-end |
| Passive yield | material drift function | drift test |
| Config immutability | config hash in run | controllo statico execution; da ripetere nel fork POC |
| Circuit breaker autorevole | plugin direct read | observer end-to-end con mock |
| Concorrenza | exclusive lock/token | store test e read-failure release |
| Post-condition | verifier | planner/verifier + end-to-end |
| Chain/vault binding | runtime/plan/run checks | framework + context checks |
| Autonomous opt-in | triple gate | config/risk tests |
| Safe multisig binding | official Safe kits + immutable binding | adapter fake + controller receipt integration |
| Service liveness | atomic heartbeat + failure threshold | service runner tests |

## Cosa non è testabile prima del deploy

- indirizzi e ruoli del POC futuro;
- owner impersonato corretto;
- liquidità reale del protocollo al blocco POC;
- Safe signature workflow su una Safe reale;
- uptime 24/7 misurato nel tempo;
- failover RPC;
- alert remoti;
- receipt reconciliation dopo crash reale.

Questi elementi restano checklist esterna; non vengono marcati passati tramite mock.
