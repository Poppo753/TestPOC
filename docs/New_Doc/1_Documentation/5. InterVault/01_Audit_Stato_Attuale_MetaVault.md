# Audit dello stato attuale per il MetaVault locale

## 1. Scopo e decisioni congelate

Questo audit applica `Prompt.md` alla prima implementazione concreta descritta
in `00_Visione_Completa_Architettura_MetaVault.md`. Il perimetro è il bundle
InterVault locale; non comprende bridge, hub cross-chain, capitale reale o
modifiche al POC in osservazione.

Decisioni definitive:

- un solo MetaVault locale per chain, con base asset e unità di conto USDC;
- un solo leaf canonico di ingresso per `tokenCode` e per chain;
- `tokenCode` identifica sempre un asset reale, mai un vault mascherato;
- soltanto il MetaVault possiede il bundle InterVault;
- i leaf non possono investire nel parent o in peer;
- nessun borrow nel MetaVault;
- nessuna modifica a `ProtocolManager`, `ProxyGeneral`, `LiquidityManager`,
  `ValueCalculator`, `TokenManager`, `SwapManager` o `Beacon`.

## 2. Componenti riutilizzabili

### 2.1 ProtocolManager

Il routing esistente è sufficiente:

```text
deposit("InterVault", tokenCode, amount)
  → risolve il Plugin
  → trasferisce il token dalla ProxyGeneral al Plugin
  → chiama deposit(tokenCode, amount)
```

Il modello coincide con Aave, Euler, Morpho e Morpho Vault. In particolare
Morpho Vault usa già `tokenCode → default vault` tramite Registry.

### 2.2 ProxyGeneral

È contemporaneamente custody degli asset liquidi e share token LPT del proprio
vault. Nel child, le LPT possono essere detenute dall'InterVaultPlugin parent
come avviene per aToken, eVault share, posizioni Morpho e share ERC-4626.

### 2.3 LiquidityManager

Le API necessarie esistono già:

- `deposit(amount)` trasferisce il base asset dalla chiamante e minta LPT alla
  chiamante;
- `withdraw(shares)` brucia le LPT della chiamante e restituisce il base asset;
- `calculateDepositShares(amount)` consente un controllo pre-deposito;
- `calculateWithdrawAmount(shares)` consente la conversione shares/assets;
- `canWithdraw(user, shares)` fornisce un limite di liquidità conservativo.

Non serve trasformare il core in ERC-4626.

### 2.4 TokenManager e oracle

Il parent può convertire WETH/WBTC in unità USDC usando prezzo del token,
prezzo del base asset e decimali. Codici artificiali come `ETH1`/`ETH2` non
sono ammessi: causerebbero identità duplicate e possibile doppio conteggio.

### 2.5 SwapManager

La conversione cross-asset rimane separata dal Plugin:

```text
USDC in custody → SwapManager → WETH in custody
WETH in custody → ProtocolManager → InterVaultPlugin → LeafWETH
```

La prima versione usa due transazioni. L'asset intermedio resta nella custody e
deve essere osservato come `pending allocation`, non come perdita.

### 2.6 Framework script

La suite attiva dispone già di:

- manifest versionati;
- runtime con dry-run, execute ed encode-only;
- preflight di bytecode e ownership;
- piani di chiamate e transazioni confermate;
- CLI unica;
- deployer con checkpoint;
- operazioni di registrazione protocollo e Beacon.

Il MetaVault deve estendere questo framework, non creare script isolati.

## 3. Cosa manca

### 3.1 Contratti

- `IInterVaultRegistry`;
- `IInterVaultPlugin`;
- `IInterVaultLensAdapter`;
- `InterVaultRegistry`;
- `InterVaultPlugin`;
- `InterVaultLensAdapter`;
- mock leaf deterministico per USDC e WETH.

### 3.2 Registry

Mancano identità child, manifest hash, verifica dei componenti del Beacon,
mapping canonico `tokenCode → child`, cap, lifecycle, pause separata per
deposit/withdraw, exit priority e controllo di rimozione a saldo zero.

### 3.3 Plugin

Mancano deposito/riscatto LPT child, allowance esatte, min-share check,
tracking dei child attivi, cap prospettico, ritorno degli asset alla custody,
close base-asset ed emergency exit.

### 3.4 Lens

Mancano conversione delle share in underlying, conversione in USDC,
enumerazione, liquidità, breakdown, health supply-only e implementazione
completa di `ILensAdapter`.

### 3.5 Script

Mancano deploy bundle, registrazione child, aggiornamento policy, pause,
ispezione posizioni e preflight MetaVault.

### 3.6 Test

Mancano unit test di Registry/Plugin/Lens, integrazione attraverso
ProtocolManager invariato, invarianti di custodia e test operativi degli script.

## 4. Problemi strutturali emersi

### 4.1 Aggregazione Lens non fail-closed

`ProtocolManager.getAllProtocolsValue()` cattura un revert della Lens e salta
il protocollo. Per una posizione InterVault questo può sottostimare il NAV e
rendere pericoloso un successivo mint.

Poiché il core è congelato, questa implementazione:

- rende la Lens deterministica e con superficie esterna minima;
- verifica componenti e oracle prima di abilitare depositi;
- espone controlli di preflight e stato;
- non autorizza un deploy con capitale reale finché failure injection e
  procedure di pausa non dimostrano che la valorizzazione critica resta sicura.

Il limite non viene nascosto né marcato come risolto da un semplice test happy
path.

### 4.2 Un solo leaf per token

Il routing core non passa un `childId`. La scelta accettata è un solo child
canonico attivo per asset. Più leaf sullo stesso underlying richiederebbero
istanze Plugin distinte selezionate da `protocolName`, non alias token.

### 4.3 Amount di withdraw

Il core esprime `withdraw(tokenCode, amount)` in asset, mentre il child ritira
per share. Il Plugin deve calcolare le share con rounding verso l'alto, misurare
il delta asset reale e non trasferire più di quanto effettivamente ricevuto.

### 4.4 Cap durante il trasferimento

Quando il Plugin viene chiamato, l'asset è già uscito dalla custody parent. Il
cap prospettico deve ricostruire il NAV post-deposito aggiungendo il valore
dell'importo in transito, altrimenti il denominatore sarebbe temporaneamente
sottostimato.

## 5. Strategia raccomandata

1. implementare prima il percorso USDC same-asset;
2. usare mock leaf deterministici per share, rounding e failure injection;
3. integrare il bundle nel ProtocolManager senza modificarlo;
4. implementare Lens e accounting in unità del base asset parent;
5. aggiungere WETH soltanto nei test dopo la conversione prezzo;
6. estendere CLI e manifest con operazioni riusabili;
7. eseguire compile, typecheck e suite mirate;
8. mantenere deployment reale, Safe e fork con child reali dietro un gate
   separato.

## 6. Stato iniziale

| Area | Stato prima del lavoro |
|---|---|
| Visione e invarianti | presenti |
| Core generico | riutilizzabile |
| Registry InterVault | assente |
| Plugin InterVault | assente |
| Lens InterVault | assente |
| Mock child | assente |
| Script MetaVault | assenti |
| Test MetaVault | assenti |
| Deploy reale | non autorizzato |
