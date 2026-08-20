# Mappa file e limiti evolutivi

## Dove leggere cosa

- `first chat idea.md`: visione iniziale.
- `00_Audit_e_Stato_Attuale.md`: ciò che esisteva e i gap.
- `01_Strategia_Espansa_e_Architettura.md`: architettura completa e ordine di lavoro.
- `02_Revisione_Critica_della_Strategia.md`: correzioni apportate dopo la rilettura.
- `03_Checklist_Implementazione.md`: tracciabilità task per task.
- `04_Stato_Finale_e_Changelog.md`: risultato ed evidenze.
- `05_Guida_Comandi_e_Utilizzo.md`: manuale operatore.
- `06_Runbook_Sicurezza_e_Incidenti.md`: rollout e failure handling.
- `08_Verifica_End_to_End_14_07_2026.md`: audit conclusivo passaggio per passaggio ed evidenze.
- `09_Audit_Tecnico_Post_Verifica/README.md`: indice del censimento tecnico approfondito, con modifiche file-per-file, invarianti, configurazione, fork/deploy, persistenza, test e gate residui.
- `10_Indice_Generale_e_Perimetro_Documentale.md`: punto d'ingresso unico e percorsi di lettura per sviluppatore, operatore, reviewer di sicurezza e responsabile del deploy.
- `10_Control_File_Implementation/README.md`: implementazione del control file unico, preflight, signer, Safe e servizio 24/7.
- questo documento: mappa del codice e roadmap.

## Mappa del codice

```text
scripts/automation/
├── cli.ts                 ingresso umano/job/backend
├── config.ts              policy boundary
├── types.ts               linguaggio comune
├── observer.ts            sensori e fingerprint
├── strategy.ts            proposta deterministica
├── risk.ts                veto indipendente
├── planner.ts             calldata e dipendenze
├── controller.ts          stateful orchestration
├── store.ts               journal e lock
├── verifier.ts            post-condition
├── alerts.ts              event adapter
└── config.example.json    template
```

Test: `test/automation/VaultAutomationController.test.ts`. Mock esclusivo ai test: `contracts/mocks/MockOperationalProtocol.sol`.

## Matrice di maturità

| Capacità | POC attuale | Production-hardening | Multi-vault | Multi-chain |
|---|---|---|---|---|
| Asset | uno, quantità native | prezzi/freshness normalizzati | config isolata per vault | feed certificati per chain |
| Strategia | target statici | score netto e backtest | policy per prodotto | parametri per mercato |
| Rischio | supply-only, cap/reserve/HF | stress, gas, liquidity exit | limiti aggregati | rischio chain/bridge |
| Stato | JSON single-host | DB, receipt reconciliation | lock per vault + global cap | coordinator per chain |
| Approvazione | journal/export | Safe adapter reale | Safe/policy per vault | Safe per chain |
| Executor | sequenziale, nonce framework | signer remoto, HA | code e quote | finality per chain |
| Alert | JSON | PagerDuty/Telegram/dashboard | aggregazione | routing chain-aware |
| Recovery | fail-stop/manuale | automatic reconciliation testata | isolamento incidenti | stato asincrono/bridge |

## Prossime implementazioni, in ordine

1. Adapter oracle snapshot con prezzo, decimals, denomination, updatedAt e heartbeat.
2. Gas estimator e soglia di miglioramento netto.
3. Safe Transaction Service adapter con verifica delle firme e mapping run↔Safe tx.
4. Receipt reconciler per crash in execution.
5. Database transazionale e worker lease rinnovabile.
6. Metriche Prometheus/OpenTelemetry e alert adapter.
7. Shadow analytics e backtest su decisioni registrate.
8. Ruolo on-chain automation least-privilege e limiti enforceable on-chain.
9. Secondo vault sulla stessa chain.
10. Certificazione separata di una seconda chain.

Borrow/leverage viene dopo oracle, reconciliation, emergency unwind e stress test. Cross-chain viene dopo multi-vault e multi-chain indipendente; non è il prossimo task.

## Limite più importante

Il controller attuale dimostra un processo automatico sicuro e spiegabile entro un dominio ristretto. Non dimostra che una strategia guadagni, né che sia sicura con capitale elevato. Queste sono evidenze economiche e operative che si raccolgono nel tempo, non proprietà che si possono aggiungere con un’altra classe TypeScript.
