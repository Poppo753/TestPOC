# Strategia espansa e riesaminata per il primo MetaVault locale

## 1. Obiettivo verificabile

Consegnare un bundle InterVault locale che permetta a un MetaVault USDC di
detenere e riscattare quote di un solo leaf canonico per asset, usando le API
core già deployabili e senza introdurre capacità inter-vault nei leaf.

La consegna è codice e infrastruttura di test, non certificazione production e
non deployment Arbitrum.

## 2. Architettura della milestone

```text
MetaVault USDC parent
  Beacon
  ProxyGeneral
  ProtocolManager
      └── protocolName: InterVault
            ├── InterVaultRegistry
            ├── InterVaultPlugin
            └── InterVaultLensAdapter
                      │
                      ├── tokenCode USDC → LeafUSDC
                      └── tokenCode WETH → LeafWETH
```

Il parent è l'unico nodo con il bundle. Il Registry rifiuta child che espongono
`InterVaultPlugin` nel proprio Beacon.

## 3. InterVaultRegistry

### 3.1 Identità

Ogni record contiene child ID, token code reale, asset ID, chain ID, Beacon,
LiquidityManager, ProxyGeneral/share token, ValueCalculator, base asset,
decimali, manifest hash e lifecycle.

### 3.2 Policy

Ogni child contiene:

- cap in bps sul NAV parent;
- massimo deposito in underlying per transazione;
- deviazione massima tra share preview e share ricevute;
- exit priority;
- deposit enabled;
- withdraw enabled;
- emergency-only;
- active/deprecated.

### 3.3 Invarianti

- stesso `block.chainid`;
- livello dichiarato L0;
- componenti con bytecode;
- componenti uguali agli alias del Beacon child;
- base asset uguale all'asset associato al token code;
- un solo default attivo per token code;
- parent e child differenti;
- child privo del bundle InterVault;
- rimozione soltanto con share balance zero.

## 4. InterVaultPlugin

### 4.1 Deposito

1. riceve l'asset dal ProtocolManager;
2. risolve il child dal Registry;
3. verifica lifecycle e cap prospettico;
4. legge `calculateDepositShares`;
5. imposta allowance zero, esatta e poi nuovamente zero;
6. chiama `LiquidityManager.deposit`;
7. misura le share realmente ricevute;
8. confronta le share con la preview corretta per la tolleranza;
9. aggiunge il child all'elenco runtime se necessario;
10. emette evento con asset e share.

### 4.2 Withdraw

1. converte l'importo underlying richiesto in share con rounding verso l'alto;
2. limita la richiesta alle share possedute;
3. chiama `LiquidityManager.withdraw`;
4. misura l'underlying ricevuto;
5. trasferisce il delta alla ProxyGeneral parent;
6. rimuove il child attivo soltanto a balance zero.

### 4.3 Close ed emergency

`closePositionsForBaseAsset` opera soltanto sul child corrispondente al base
asset parent. Non vende autonomamente WETH/WBTC. `emergencyWithdrawAll` tenta i
token richiesti, preserva nel tracking le posizioni non riscattate e non invia
mai a recipient arbitrari.

### 4.4 Cap prospettico

```text
depositValue = convertToParentBase(tokenCode, amount)
postChild    = currentChildValue + depositValue
postParent   = currentParentNAVAfterTransfer + depositValue
exposureBps  = postChild / postParent
```

Il deposito fallisce se `postParent == 0`, prezzi non validi o cap superato.

## 5. InterVaultLensAdapter

### 5.1 Valore

Per ogni child:

```text
shares        = childShare.balanceOf(plugin)
underlying    = childLM.calculateWithdrawAmount(shares)
parentValue   = convert(underlying, child token → parent base)
```

La conversione usa prezzi del TokenManager parent e normalizzazione dei
decimali. Il base asset parent è 1:1 in proprie unità.

### 5.2 Liquidità

Il valore `availableToWithdraw` include soltanto posizioni per cui
`canWithdraw(plugin, shares)` è vero. Non equivale a una promessa di esecuzione
futura.

### 5.3 Interfaccia standard

Il Lens implementa integralmente `ILensAdapter`. Le posizioni sono supply-only:
debito zero, health factor massimo, leverage 1x. Ogni child con share positive è
una posizione.

## 6. Mock e test architecture

Il mock leaf combina share ERC-20 e API LiquidityManager necessarie. Permette di
configurare exchange rate, limiti, pause, deviazione share e failure. Un
MockBeacon espone componenti e base asset del child.

Suite:

- Registry unit: identità, default, cap, lifecycle, rimozione;
- Plugin unit: custody, preview, allowance, rounding, cap, access control;
- Lens unit: conversioni 6/18 decimali, enumeration, liquidity;
- Integration: ProtocolManager reale, Proxy mock, bundle e leaf;
- Security: caller non autorizzato, reentrancy/failure, target non censito;
- Invariant: asset parent + underlying child conservati, nessuna share persa;
- Script test: dry-run/encode-only e validazione manifest.

## 7. Script operativi

Le operazioni devono essere funzioni TypeScript importabili e comandi CLI:

- `deploy-bundle --kind inter-vault`;
- `registry-inter-vault-child`;
- `registry-inter-vault-policy`;
- `registry-inter-vault-status`;
- `metavault-position`;
- `metavault-preflight`.

Tutte le mutazioni mantengono la regola esistente: persistono soltanto con
`--execute=true --dry-run=false`. `--encode-only=true` produce calldata per
Safe senza inviare transazioni.

## 8. Deployment order

1. deploy Registry;
2. deploy Plugin;
3. deploy Lens;
4. configurare `positionHolder` del Registry;
5. registrare alias Beacon del bundle;
6. autorizzare il ProtocolManager nella ProxyGeneral se non già autorizzato;
7. registrare `InterVault` nel ProtocolManager;
8. registrare child da manifest verificati;
9. preflight read-only;
10. fork rehearsal;
11. Safe proposal;
12. canary separato.

## 9. Riesame critico della strategia

La prima versione della visione proponeva un routing tipizzato nel
ProtocolManager. È stato rimosso: il mapping canonico per token e il Registry
rendono sufficiente l'API esistente.

È stata respinta anche l'idea di alias `ETH1/ETH2`: separerebbe il codice dalla
reale identità dell'asset e rischierebbe doppio conteggio.

È stata mantenuta la custodia delle share nel Plugin perché coincide con tutti
gli adapter esistenti e con il receiver effettivo del LiquidityManager.

È stato evitato uno swap interno al Plugin. Duplicare SwapManager aumenterebbe
allowance, router e superficie MEV. La conversione resta un'operazione parent
separata.

È stata ridotta la prima certificazione a same-asset più un mock WETH. Un fork
WETH reale richiede prima un leaf WETH realmente deployato e manifestato.

## 10. Limite non risolto e gate

Il core aggrega Lens con semantica skip-on-error. Non viene modificato. Prima di
capitale reale sono quindi obbligatori failure injection, preflight continuo,
pause operativa e una decisione formale sulla sicurezza della valutazione. La
checklist non deve dichiarare production-ready il bundle soltanto perché i test
locali passano.

## 11. Strategia finale confermata

La sequenza migliore è Registry → Plugin → Lens → integrazione core invariata →
script → test completi locali → fork quando esistono leaf reali → Safe/canary.
Non vengono implementati cross-chain, debito o deploy reale in questa fase.
