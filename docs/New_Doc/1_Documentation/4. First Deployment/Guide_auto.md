Sì: scartiamo completamente i vecchi deployment e realizziamo un POC nuovo su Arbitrum, con indirizzi, configurazione e manifest generati da zero.

La frase:

> deploy POC → fork → observe → Safe advisory

descrive quattro certificazioni diverse. Il solo deploy supera soltanto la prima.

| Fase | Cosa dimostra |
|---|---|
| Deploy POC | I contratti nuovi esistono e sono configurati realmente |
| Fork post-deploy | Tutti i flow funzionano sugli esatti contratti appena distribuiti |
| Observe | Il controller interpreta correttamente condizioni reali senza muovere capitale |
| Safe advisory | Il controller crea proposte Safe corrette, ma non può eseguirle autonomamente |

## Il prossimo passaggio concreto

Prima facciamo una prova generale del deployment su un fork Arbitrum fissato. Poi eseguiamo il deployment reale con capitale inizialmente nullo o minimo.

### 1. Preparazione del nuovo POC

Definiamo:

- chain: Arbitrum One, chain ID `42161`;
- asset base: presumibilmente WETH;
- nuovo account deployer dedicato;
- RPC Arbitrum privata e stabile;
- piccolo saldo ETH esclusivamente per il gas;
- indirizzi ufficiali delle dipendenze esterne:
  - Chainlink feed;
  - Aave Pool;
  - Euler EVC e Lens;
  - Morpho;
  - eventuali Router e Quoter Uniswap;
- Safe nuova dedicata al POC;
- protocolli inclusi: Aave, Euler, Morpho e Morpho Vault;
- Dolomite e GMX esclusi, come concordato.

Non riutilizzeremo gli indirizzi dei vecchi contratti. Riutilizzeremo solo gli indirizzi dei protocolli esterni ufficiali, perché Aave, Euler, Morpho e Chainlink non devono essere ridistribuiti da noi.

### 2. Rehearsal del deployment su fork

Prima di spendere gas reale:

1. fissiamo `FORK_BLOCK_NUMBER`;
2. avviamo un fork Arbitrum;
3. finanziamo localmente il deployer;
4. eseguiamo `deploy-core`;
5. eseguiamo i bundle Aave, Euler e Morpho;
6. configuriamo registry, market, vault e token;
7. proviamo depositi, prelievi e interazioni complete;
8. verifichiamo owner, custody, accounting e autorizzazioni.

Questa fase trova errori nel processo di deployment senza pubblicare contratti sbagliati su Arbitrum.

## 3. Deployment reale del POC

Il primo comando reale creerà automaticamente:

`scripts/manifests/arbitrum-weth-poc.json`

Inizialmente il file non esiste perché deve contenere gli indirizzi risultanti dalle transazioni reali.

La sequenza sarà indicativamente:

```powershell
npm run scripts:cli -- deploy-core `
  --manifest="scripts/manifests/arbitrum-weth-poc.json" `
  --base-code="WETH" `
  --base-address="INDIRIZZO_WETH" `
  --base-decimals=18 `
  --base-price-feed="INDIRIZZO_CHAINLINK_FEED" `
  --feed-decimals=8 `
  --heartbeat=3600 `
  --confirmations=2 `
  --execute=true
```

Poi:

```powershell
npm run scripts:cli -- deploy-bundle `
  --manifest="scripts/manifests/arbitrum-weth-poc.json" `
  --kind="aave" `
  --pool="AAVE_POOL" `
  --confirmations=2 `
  --execute=true
```

E analogamente per Euler, Morpho e Morpho Vault.

Attenzione: per i comandi di deployment `--execute=true` invia realmente le transazioni. La doppia protezione `--execute=true --dry-run=false` riguarda invece la CLI operativa, usata per depositi, prelievi, configurazioni e operazioni successive.

Il deployer salva il manifest dopo ogni checkpoint. Se la procedura si interrompe, può riprendere senza ridistribuire automaticamente ciò che è già stato completato.

## 4. Configurazione post-deploy

Distribuire i contratti non basta. Dobbiamo anche:

- registrare i protocolli nel `ProtocolManager`;
- configurare WETH nei registry;
- configurare Aave aToken e debt token;
- configurare gli Euler Vault;
- configurare market, oracle, IRM e LLTV di Morpho;
- configurare i Morpho Vault;
- verificare custody e autorizzazioni del `ProxyGeneral`;
- configurare selector whitelist;
- impostare limiti, fee, slippage ed emergency policy;
- eseguire il preflight completo;
- trasferire infine le ownership alla Safe.

Solo dopo queste operazioni il manifest rappresenterà un deployment utilizzabile, non soltanto un insieme di indirizzi.

## 5. Fork degli esatti contratti POC

Dopo l’ultima configurazione reale:

1. salviamo il block number;
2. impostiamo quel blocco come `FORK_BLOCK_NUMBER`;
3. eseguiamo la suite fork contro il nuovo manifest;
4. proviamo flow completi con fondi impersonati;
5. eseguiamo snapshot/revert;
6. verifichiamo Aave, Euler, Morpho, emergency, cross-protocol e automatic withdrawal;
7. escludiamo Dolomite e GMX;
8. archiviamo risultati, blocco RPC e manifest.

Questo è molto più significativo del testare genericamente “Arbitrum”: testeremo una copia deterministica del nostro deployment reale.

## 6. Observe

Creiamo poi il control file associato al nuovo manifest:

```text
scripts/automation/config.arbitrum-weth-poc-1.json
```

In modalità:

```json
{
  "mode": "observe",
  "execution": {
    "kind": "disabled"
  }
}
```

Il controller:

- legge posizioni e health;
- applica le policy;
- genera decisioni e piani;
- scrive heartbeat e stato;
- non firma;
- non propone;
- non invia transazioni;
- non può muovere capitale.

Lo lasciamo funzionare continuativamente, idealmente almeno 24–72 ore, e confrontiamo ogni decisione con lo stato reale.

## 7. Safe advisory

Quando observe è affidabile:

- il `ProtocolManager` e le altre ownership operative passano alla Safe;
- configuriamo Safe address, chain e Transaction Service;
- il signer del servizio deve essere soltanto un owner autorizzato a proporre;
- il controller crea una proposta;
- gli altri owner la controllano e raggiungono il quorum;
- soltanto la Safe può eseguirla.

“Advisory” significa quindi:

> l’automazione suggerisce e prepara; gli esseri umani approvano; la Safe esegue.

Non è ancora autonomous mode.

## Cosa manca per iniziare davvero

Tecnicamente il software è pronto. Per partire con il nuovo deploy servono dati esterni reali:

- `ARBITRUM_RPC_URL` privata e stabile;
- account deployer dedicato;
- chiave gestita in modo sicuro;
- ETH sufficiente per il gas;
- indirizzi ufficiali aggiornati delle dipendenze;
- scelta definitiva del capitale POC;
- Safe POC e relativi owner.

La strategia seria sarà quindi:

```text
rehearsal deploy su fork
        ↓
nuovo deploy reale senza capitale significativo
        ↓
configurazione completa
        ↓
preflight
        ↓
fork fissato post-deploy
        ↓
test completi
        ↓
micro-deposito reale
        ↓
observe 24–72 ore
        ↓
Safe advisory
        ↓
stress controllato e audit
```

Quindi sì, il prossimo lavoro è il nuovo deployment POC. Ma non considereremo il sistema “production-ready” appena i contratti risultano deployati: serviranno anche evidenze fork, osservazione continuativa, prova Safe reale, monitoraggio e procedure d’incidente. Ogni nuova blockchain dovrà poi avere il proprio deployment, manifest, control file e ciclo di certificazione.