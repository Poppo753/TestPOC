# Report finale dell'implementazione MetaVault locale

## 1. Risultato

È stata implementata e verificata la prima versione locale, supply-only e
single-chain del MetaVault USDC. Il MetaVault può acquistare quote di vault
foglia censiti usando le API core già esistenti. Nessun contratto core e nessuna
interfaccia core sono stati modificati.

La milestone implementata comprende i “tre moschettieri”:

1. `InterVaultRegistry`: identità, routing e policy dei vault foglia;
2. `InterVaultPlugin`: movimento degli asset e custodia delle LPT foglia;
3. `InterVaultLensAdapter`: valutazione e osservabilità delle posizioni.

La certificazione è locale. Non equivale a un'autorizzazione al deploy su
Arbitrum e non equivale a production readiness.

## 2. Modello definitivo

- Esiste un solo MetaVault locale con base asset USDC per chain.
- Per ogni token reale può esistere un solo leaf canonico sulla chain.
- `USDC`, `WETH` e `WBTC` sono identità economiche reali, non alias inventati.
- Un leaf non può possedere a sua volta il bundle InterVault: questo rende il
  grafo locale aciclico per costruzione.
- Il MetaVault investe; i leaf non possono reinvestire nel MetaVault.
- La prima milestone fa soltanto supply/redeem. Non prende debito, non usa leva,
  non contiene un router di swap e non esegue operazioni cross-chain.
- Per investire in un leaf con asset diverso, lo SwapManager del parent converte
  prima l'asset; il Plugin riceve poi il vero token richiesto dal leaf.

## 3. Flusso di deposito

Il chiamante usa l'API invariata:

`ProtocolManager.deposit("InterVault", tokenCode, amount)`.

Il ProtocolManager trasferisce il token reale dalla custody `ProxyGeneral` al
Plugin. Il Plugin risolve `tokenCode` nel Registry, verifica lifecycle, cap e
limiti, calcola la preview, imposta un'allowance esatta, deposita nel
LiquidityManager del leaf e misura le quote realmente ricevute. Le LPT vengono
detenute dal Plugin, esattamente come gli altri plugin custodiscono i receipt
token necessari a rappresentare la loro posizione.

L'allowance segue sempre `zero → importo esatto → zero`. Se le share ricevute
sono inferiori alla tolleranza configurata, l'intera transazione reverte: anche
il trasferimento iniziale dal Proxy viene annullato.

## 4. Flusso di prelievo

Il chiamante usa:

`ProtocolManager.withdraw("InterVault", tokenCode, assetAmount)`.

Il Plugin converte l'importo asset in share con arrotondamento verso l'alto,
chiama il leaf, misura il saldo asset prima e dopo e trasferisce alla custody
parent soltanto il delta ricevuto. Un full unwind rimuove il child dalla lista
runtime attiva, senza alterarne il censimento nel Registry.

`closePosition` usa come identificatore il `childId` bytes32 convertito in
uint256. Non usa l'indice dell'array `activeChildIds`, perché tale indice può
cambiare dopo una compattazione.

## 5. Emergency e lifecycle

Registry e Plugin distinguono:

- `active`: child disponibile come destinazione normale;
- `depositsEnabled`: nuovi ingressi consentiti;
- `withdrawalsEnabled`: uscite consentite;
- `emergencyOnly`: child utilizzabile soltanto nel percorso di uscita previsto;
- circuit breaker del Plugin: blocco globale delle operazioni normali.

La deprecazione non nasconde mai una posizione con share residue. La rimozione
dal Registry è vietata finché il Plugin possiede anche una sola share.

Durante `emergencyWithdrawAll`, il fallimento di un leaf viene catturato ed
emesso come evento. Il Plugin non restituisce `false`, perché il ProtocolManager
reverterebbe l'intera transazione annullando anche le uscite già riuscite. Il
leaf fallito rimane nell'elenco attivo, resta osservabile e può essere ritentato.

## 6. Valutazione

La Lens legge le share detenute dal Plugin e usa
`calculateWithdrawAmount(shares)` del leaf. Se il token del leaf coincide con il
base asset parent, il valore è diretto. Altrimenti usa i prezzi del TokenManager
e normalizza i decimali.

`exposureBps` nel breakdown rappresenta il peso del child all'interno della
sola sleeve InterVault. Non richiama il ValueCalculator parent: farlo dalla Lens
creerebbe il ciclo `ValueCalculator → Lens → ValueCalculator` fino a esaurimento
gas. Il peso della sleeve rispetto al NAV totale va calcolato off-chain usando
il totale InterVault e il NAV parent ottenuti in due letture separate.

## 7. Censimento dei file

### Contratti e interfacce

- `contracts/interfaces/metavault/IInterVaultRegistry.sol`: record child, viste,
  lifecycle e policy.
- `contracts/interfaces/metavault/IInterVaultPlugin.sol`: viste sulle share e
  sui child attivi.
- `contracts/interfaces/metavault/IInterVaultLensAdapter.sol`: breakdown
  tipizzato delle posizioni leaf.
- `contracts/metavault/InterVaultRegistry.sol`: censimento canonico e guardrail.
- `contracts/plugins/InterVaultPlugin.sol`: esecuzione e custodia LPT.
- `contracts/adapters/InterVaultLensAdapter.sol`: valuation boundary.

### Mock e supporto test

- `contracts/mocks/metavault/MockInterVaultLeaf.sol`: leaf deterministico con
  deposit, redeem, donation, haircut e failure injection.
- `contracts/mocks/metavault/MockInterVaultValueCalculator.sol`: NAV parent
  controllabile nei test di cap.
- `contracts/mocks/MockBeacon.sol`: aggiunta la vista `checkModuleExists` usata
  per validare le capability del child.
- `contracts/mocks/MockTokenManager.sol`: base token configurabile per testare
  parent USDC senza alterare il TokenManager reale.

### Suite operativa

- `scripts/operations/deployment/deploy-bundle.ts`: supporta `inter-vault`,
  deploya e registra Registry, Plugin e Lens con checkpoint nel manifest.
- `scripts/operations/metavault/inter-vault.ts`: register child, policy, status,
  posizioni e preflight.
- `scripts/cli.ts`: espone le operazioni tramite entry point unico.
- `scripts/framework/types.ts` e `manifest.ts`: riconoscono il nuovo kind senza
  invalidare i manifest preesistenti.

### Test

- `test/unit/metavault/InterVault.bundle.test.ts`: 19 casi mirati.
- `test/scripts/Deployment.test.ts`: deployment e registrazione del bundle.
- `test/scripts/Operations.test.ts`: uso reale delle operazioni importabili.

## 8. Evidenze

| Verifica | Esito |
|---|---:|
| Hardhat compile finale | PASS |
| Suite locale unit/integration/E2E MetaVault | 22 PASS |
| Fork fissato con leaf POC reale | 1 PASS |
| Typecheck suite script | PASS |
| Suite script completa | 40 PASS |
| Suite Vault Automation Controller | 16 PASS |
| Modifica contratti/interfacce core | Nessuna |
| Transazioni Arbitrum | Nessuna |

I test coprono canonicalità del token, rifiuto dei cicli, access control,
deposito e prelievo, custody LPT, allowance, cap prospettico, tolleranza share,
rollback atomico, lifecycle, deprecazione, rimozione, valuation USDC/WETH,
chiusura con ID stabile, emergency con retry, target non censito, deploy, CLI,
NAV full-core, yield, automatic unwind, osservazione automation e fork contro
il LiquidityManager realmente deployato del POC USDC.

La suddivisione aggiornata e i comandi sono censiti in
`07_Piano_Estensione_Test_e_Automazione.md` e
`08_Matrice_Copertura_Test_Aggiornata.md`.

## 9. Limite bloccante emerso dal riesame

Il ProtocolManager attuale cattura l'errore di una Lens durante l'aggregazione e
salta quel protocollo. Se la Lens InterVault fallisse, il core potrebbe quindi
riportare un NAV sottostimato invece di bloccare l'operazione. Esiste un test che
dimostra esplicitamente questo comportamento; non è stato nascosto.

Poiché il vincolo progettuale vieta modifiche al core, il deploy reale rimane
gated finché non viene scelta e verificata una mitigazione compatibile, per
esempio un guardiano esterno fail-closed e limiti operativi fortemente
conservativi, oppure una futura revisione formalmente approvata del boundary di
valuation. Fino ad allora niente capitale reale nel MetaVault.
