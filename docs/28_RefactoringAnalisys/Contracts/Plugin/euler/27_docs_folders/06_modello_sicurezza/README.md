# 6. Modello di Sicurezza

Questa sezione descrive l'architettura di sicurezza e i controlli accessi.

## Contenuti

- **6.1 Separazione Utente/Admin** - Ruoli nettamente distinti e relativi permessi
- **6.2 Ruolo Utente** - Può solo depositare/ritirare, nessun controllo gestione
- **6.3 Ruolo Admin/Operator** - Gestione vincolata al "recinto" autorizzato
- **6.4 Il "Recinto" di Sicurezza** - Token, protocolli, vault, selectors autorizzati
- **6.5 Gerarchia Ruoli** - Owner, Operator, Guardian, User - permessi e limiti
- **6.6 Whitelist Selectors** - Controllo granulare su funzioni protocol-specific
- **6.7 Custody Model** - Tutti i fondi in ProxyGeneral, plugin stateless
- **6.8 Timelock Governance** - Delay 24h per modifiche parametri critici
- **6.9 Emergency System** - Pausa globale, freeze moduli, circuit breaker
