# Fase 2 — registro esecuzione VPS

Data avvio preparazione: 15 luglio 2026.

## Evidenza locale

- preflight Arbitrum: PASS;
- loop Windows observe avviato, intervallo 300 secondi;
- persistent execution: false;
- cicli iniziali: `NO_ACTION` perché il vault è vuoto;
- consecutive failure osservate: 0.

È uno smoke test, non ancora il periodo shadow ufficiale.

## VPS

- provider: Hetzner Cloud;
- host: `vault-observer-arbitrum-01`;
- provisioning: completato;
- SSH, bootstrap, test, preflight e `systemd`: pending;
- inizio finestra shadow: pending.

RPC e chiavi non devono comparire in questo documento.
