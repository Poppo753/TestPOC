# Limiti residui, gate e roadmap

## Disponibile ora

- contratti e script operativi;
- controller observe/advisory/autonomous con gate;
- strategy target-based;
- risk engine;
- planner serializzabile;
- simulazione locale/fork con impersonazione;
- journal e lock single-host;
- execution e verifier;
- CLI, preflight, Safe adapter e service runner con heartbeat;
- test locali e fork smoke read-only;
- documentazione e runbook.

Questo è sufficiente per iniziare deploy POC e shadow mode.

## Non disponibile ora

### Deploy POC definitivo

Non esistono ancora manifest/config specifici del nuovo POC. Senza questi non si può certificare un rebalance fork contro il futuro ambiente.

### Safe reale

L'adapter Safe Transaction Service, il batch call-only, il binding e la riconciliazione sono implementati e testati localmente. Non esistono ancora una Safe POC scelta, firme/quorum reali o acceptance sul servizio reale.

### Receipt reconciler

Non ricostruisce automaticamente una transazione broadcast prima di un crash.

### Alta disponibilità

JSON e lock file sono single-host. L'heartbeat esiste; mancano database, leader election e outbox.

### RPC failover

Esiste retry sulla stessa configurazione; non un quorum/failover fra provider con confronto head.

### Oracle snapshot normalizzato

Non esiste ancora un report per asset con prezzo, decimals, denomination, updatedAt e heartbeat. Per questo il controller resta single-base-asset.

### Ottimizzazione economica

APY è telemetria, non input strategico. Mancano gas, exit liquidity, slippage, storico e backtest.

### Alert remoti

Esiste l’interfaccia eventi, non gli adapter Telegram/PagerDuty/email.

### Ruolo executor least-privilege

Il software limita le call, ma produzione richiede enforcement on-chain e revoca separata dall’owner generale.

## Gate in ordine

### Gate 1 — deploy isolato

- deploy core/protocolli supportati;
- ruoli e registri;
- manifest;
- config observe;
- zero/limitato capitale.

### Gate 2 — fork POC

- fork recente;
- owner/Safe impersonato;
- observation completa;
- deposit/withdraw/rebalance;
- emergency path;
- user withdrawal con allocazione.

### Gate 3 — server shadow

- 24/7 senza signer;
- RPC stabile;
- alert;
- backup;
- metriche;
- almeno una settimana stabile.

### Gate 4 — advisory Safe

- adapter Safe;
- mapping run↔Safe tx;
- firme reali;
- stale/replan;
- receipt e verifier.

### Gate 5 — capitale POC

- limiti bassi;
- drill incidenti;
- revoca executor;
- recovery manuale provato.

### Gate 6 — production-hardening

- database/lease;
- reconciler;
- RPC failover;
- alert remoti;
- signer KMS/remote;
- audit indipendente.

### Gate 7 — autonomia limitata

- policy misurate;
- ruolo on-chain minimo;
- cap per call/ciclo/giorno;
- kill switch;
- rollout graduale.

## Roadmap tecnica consigliata

1. Deploy POC e manifest/config.
2. Test fork completo contro POC.
3. Packaging systemd e shadow mode.
4. Telemetria e alert adapter.
5. Acceptance Safe reale dell'adapter implementato.
6. Receipt reconciler.
7. PostgreSQL e lease.
8. Oracle snapshot.
9. Backtest/scoring economico.
10. Ruolo executor on-chain.
11. Autonomia limitata.
12. Secondo vault sulla stessa chain.
13. Seconda chain certificata.

Borrow/leverage e cross-chain non devono precedere recovery, oracle e enforcement on-chain.

## Definizione onesta di completezza

```text
Software POC locale: completato e verificato.
Pronto per deploy/shadow: sì, dopo creazione manifest/config POC.
Pronto per advisory reale: no, manca Safe end-to-end e fork POC.
Pronto per autonomia produttiva: no.
```
