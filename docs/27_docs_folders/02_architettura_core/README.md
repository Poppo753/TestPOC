# 2. Architettura: Smart Contract Core

Questa sezione descrive i contratti core che costituiscono l'infrastruttura fondamentale del protocollo.

## Contenuti

- **2.1 Beacon** - Registry centrale dei moduli, pattern di upgrade
- **2.2 ProxyGeneral** - Custody degli asset, emissione LP Token
- **2.3 TokenManager** - Whitelist token supportati, mapping oracle
- **2.4 ValueCalculator** - Calcolo NAV pool, sistema cache prezzi
- **2.5 ParameterManager** - Parametri configurabili, timelock 24h
- **2.6 EmergencyHandler** - Procedure emergenza, pausa globale
- **2.7 LiquidityManager** - Entry point utenti, depositi/prelievi
- **2.8 SwapManager** - Orchestrazione swap, selezione plugin
- **2.9 ProtocolManager** - Orchestrazione lending/yield, delega a plugin
