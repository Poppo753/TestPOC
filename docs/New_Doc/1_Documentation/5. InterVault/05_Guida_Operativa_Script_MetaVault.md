# Guida operativa degli script MetaVault

## 1. Regola di sicurezza

Per i comandi operativi normali una transazione persiste soltanto con:

```text
--execute=true --dry-run=false
```

Senza questa coppia il framework simula o produce un piano. Per il comando
speciale `deploy-bundle`, invece, `--execute=true` abilita direttamente il
deployment: va usato solo dopo rehearsal, review del manifest e controllo del
network Hardhat selezionato.

Gli importi sono sempre unità minime on-chain: `1000000` significa 1 USDC con 6
decimali; non significa un milione di USDC.

Negli esempi:

```powershell
$M = "scripts/manifests/arbitrum-usdc-poc-1.json"
$env:HARDHAT_NETWORK = "arbitrum"
```

Sostituire sempre manifest, hash, ID e indirizzi con dati verificati. Gli esempi
non autorizzano il deploy sul POC esistente.

## 2. Deployment del bundle dei tre moschettieri

Rehearsal senza deploy:

```powershell
npx ts-node scripts/cli.ts deploy-bundle --manifest $M --kind inter-vault --execute=false
```

Deployment persistente, soltanto dopo il superamento dei gate:

```powershell
npx ts-node scripts/cli.ts deploy-bundle --manifest $M --kind inter-vault --execute=true --confirmations 2
```

Il comando:

1. ricava `parentVaultId` da `manifest.metadata.vaultId`, se presente e valido;
2. altrimenti usa un ID deterministico basato su chain e base asset;
3. deploya Registry, Plugin e Lens;
4. configura il Plugin come `positionHolder` del Registry;
5. registra gli alias nel Beacon;
6. registra `InterVault` nel ProtocolManager;
7. salva indirizzi e protocol bundle nel manifest.

## 3. Preflight read-only

```powershell
npx ts-node scripts/cli.ts metavault-preflight --manifest $M
```

Controlla che Registry, Plugin e Lens abbiano bytecode, che ogni componente
child censito abbia bytecode e che il manifest punti allo stesso Plugin del
protocol bundle. `valid: true` non sostituisce audit, fork o canary.

## 4. Registrare il leaf canonico

Prima si generano fuori banda:

- `child-id`: identità univoca del vault foglia;
- `asset-id`: identità economica e di chain del token;
- `child-manifest-hash`: hash del manifest leaf già certificato.

Piano encode-only destinabile a una Safe:

```powershell
npx ts-node scripts/cli.ts registry-inter-vault-child `
  --manifest $M --encode-only=true --caller 0xSAFE `
  --child-id 0xCHILD_ID --token WETH --asset-id 0xASSET_ID `
  --child-beacon 0xCHILD_BEACON `
  --child-liquidity-manager 0xCHILD_LM `
  --child-share-token 0xCHILD_LPT `
  --child-value-calculator 0xCHILD_VC `
  --child-base-asset 0xWETH `
  --child-manifest-hash 0xMANIFEST_HASH `
  --child-asset-decimals 18 `
  --max-exposure-bps 2000 `
  --max-share-deviation-bps 50 `
  --exit-priority 10 `
  --max-deposit-assets 1000000000000000000
```

Simulazione dipendente con signer:

```powershell
# Stessi argomenti del comando precedente
npx ts-node scripts/cli.ts registry-inter-vault-child ... --execute=true --dry-run=true
```

Invio reale:

```powershell
# Stessi argomenti, dopo approvazione
npx ts-node scripts/cli.ts registry-inter-vault-child ... --execute=true --dry-run=false --confirmations 2
```

Il Registry rifiuta indirizzi senza bytecode, chain errata, livello diverso da
zero, manifest hash nullo, componenti diversi dal Beacon child, un secondo leaf
per lo stesso token, share token duplicato e child dotato di InterVaultPlugin.

## 5. Aggiornare una policy

```powershell
npx ts-node scripts/cli.ts registry-inter-vault-policy `
  --manifest $M --child-id 0xCHILD_ID `
  --max-exposure-bps 1500 `
  --max-deposit-assets 500000000000000000 `
  --max-share-deviation-bps 50 `
  --exit-priority 5 `
  --execute=true --dry-run=true
```

Ripetere con `--dry-run=false` solo dopo aver confrontato calldata, owner e
stato atteso. Ridurre un cap non liquida automaticamente la posizione esistente;
impedisce nuovi depositi non conformi.

## 6. Cambiare lifecycle

Deprecazione conservativa: niente ingressi, uscite ancora possibili.

```powershell
npx ts-node scripts/cli.ts registry-inter-vault-status `
  --manifest $M --child-id 0xCHILD_ID `
  --active=false --deposits-enabled=false `
  --withdrawals-enabled=true --emergency-only=false `
  --execute=true --dry-run=true
```

Un child deprecated con share non sparisce dalla Lens. La rimozione anagrafica
non è esposta come comando ordinario proprio perché richiede prima prova di
saldo zero e review esplicita.

## 7. Leggere posizioni e valore

```powershell
npx ts-node scripts/cli.ts metavault-positions --manifest $M
```

Restituisce totale InterVault e, per child: token, LPT, share, underlying,
valore in USDC parent, importo conservativamente prelevabile, peso nella sleeve
InterVault e stato operativo.

## 8. Depositare e prelevare tramite l'API protocollo esistente

La nuova integrazione non introduce comandi economici speciali. Usa
`protocol-action`:

```powershell
npx ts-node scripts/cli.ts protocol-action `
  --manifest $M --operation deposit --protocol InterVault `
  --token WETH --amount 1000000000000000 `
  --execute=true --dry-run=true
```

```powershell
npx ts-node scripts/cli.ts protocol-action `
  --manifest $M --operation withdraw --protocol InterVault `
  --token WETH --amount 1000000000000000 `
  --execute=true --dry-run=true
```

Il primo esempio usa 0,001 WETH. Prima del deposito WETH, la custody parent deve
possedere WETH reale; l'eventuale swap USDC→WETH è un'operazione separata dello
SwapManager.

## 9. Uso da sito, worker o Safe

Il file `scripts/operations/metavault/inter-vault.ts` esporta funzioni, non è
legato alla shell. Un frontend o worker può importare le stesse operazioni e
passare uno `ScriptRuntime`. Con `encodeOnly` riceve calldata serializzabile; con
Safe quella calldata diventa una proposta e non viene firmata autonomamente dal
worker.

Le funzioni disponibili sono:

- `registerInterVaultChild`;
- `updateInterVaultPolicy`;
- `updateInterVaultStatus`;
- `getInterVaultPositions`;
- `preflightInterVault`.

## 10. Comandi di verifica per sviluppatori

```powershell
npx hardhat compile
npm run test:metavault
npm run automation:test
npm run scripts:typecheck
npm run scripts:test
```

Fork riproducibile:

```powershell
$env:FORK_ENABLED = "true"
$env:FORK_BLOCK_NUMBER = "483832997"
npm run test:metavault:fork
```

Risultato certificato in questa sessione: 19 test MetaVault locali, 1 fork,
16 automation e 40 script, tutti passati.

## 11. Ordine operativo corretto

1. certificare separatamente ogni leaf;
2. fissare manifest e block number del fork;
3. deployare il bundle solo in ambiente di rehearsal;
4. registrare un solo leaf con cap minimo;
5. eseguire preflight e letture;
6. testare deposit/redeem su fork dello stato post-deploy;
7. produrre calldata Safe;
8. canary con capitale trascurabile;
9. osservazione prolungata e test di emergency;
10. aumentare i cap solo con evidenza e approvazione.
