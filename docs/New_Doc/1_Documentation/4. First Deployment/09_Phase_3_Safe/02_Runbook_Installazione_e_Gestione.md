# Fase 3 — runbook governance e Safe

## Prerequisiti

- decisioni della sezione A della checklist approvate;
- almeno due dispositivi owner disponibili;
- hardware wallet inizializzati e verificati fuori dalla VPS;
- saldo sufficiente per il gas di creazione e del test innocuo;
- `ARBITRUM_RPC_URL` disponibile nella sessione locale;
- `SAFE_ADDRESS` disponibile solo dopo la creazione;
- repository sul commit da certificare;
- Node 22 e dipendenze installate con `npm ci`.

Non procedere se owner, threshold o recovery sono ancora ambigui.

## Baseline locale

Eseguire dalla root `TestSmartContract`.

```powershell
git status --short
git rev-parse HEAD
node --version
npm --version
npm ci
npm run compile
npm run scripts:typecheck
npm run automation:test
```

`git status --short` deve essere vuoto oppure ogni modifica deve essere censita.

## Verifica preventiva dei segreti

Il comando elenca soltanto nomi di file e righe sospette. Non eseguirlo su
directory esterne al repository.

```powershell
rg -n -i "PRIVATE_KEY|MNEMONIC|SEED_PHRASE" --glob "!node_modules/**" --glob "!.git/**"
```

Ogni risultato deve essere una variabile, una regola o documentazione. Non deve
contenere un valore segreto.

## Creazione della Safe

Usare l'interfaccia ufficiale Safe da una workstation fidata.

1. Selezionare Arbitrum One e verificare chain ID `42161` nel wallet.
2. Inserire gli indirizzi owner approvati.
3. Impostare il threshold approvato.
4. Verificare owner e threshold da un secondo dispositivo.
5. Rifiutare moduli, guard o fallback handler non previsti.
6. Firmare la creazione con l'hardware wallet autorizzato.
7. Registrare indirizzo Safe, transaction hash e receipt nel registro.

Non usare la VPS observer per creare la Safe. Non importare seed phrase in un
browser, file `.env`, shell history o password manager non approvato.

## Verifica provider e Safe

Impostare `ARBITRUM_RPC_URL` e `SAFE_ADDRESS` nella sessione tramite il secret
manager locale. Non salvarli nel runbook.

```powershell
npx --% ts-node -e "import { Contract, JsonRpcProvider } from 'ethers'; async function main() { const rpc = process.env.ARBITRUM_RPC_URL; const safeAddress = process.env.SAFE_ADDRESS; if (!rpc) throw new Error('ARBITRUM_RPC_URL missing'); if (!safeAddress) throw new Error('SAFE_ADDRESS missing'); const provider = new JsonRpcProvider(rpc); const network = await provider.getNetwork(); const code = await provider.getCode(safeAddress); const safe = new Contract(safeAddress, ['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)', 'function nonce() view returns (uint256)', 'function VERSION() view returns (string)'], provider); console.log(JSON.stringify({ chainId: network.chainId.toString(), safeAddress, codeBytes: (code.length - 2) / 2, owners: await safe.getOwners(), threshold: (await safe.getThreshold()).toString(), nonce: (await safe.nonce()).toString(), version: await safe.VERSION() }, null, 2)); } main();"
```

Il risultato deve mostrare `chainId: "42161"`, bytecode maggiore di zero, owner
esatti e threshold approvato.

## Verifica moduli, guard e fallback handler

```powershell
npx --% ts-node -e "import Safe from '@safe-global/protocol-kit'; async function main() { const rpc = process.env.ARBITRUM_RPC_URL; const safeAddress = process.env.SAFE_ADDRESS; if (!rpc) throw new Error('ARBITRUM_RPC_URL missing'); if (!safeAddress) throw new Error('SAFE_ADDRESS missing'); const safe = await Safe.init({ provider: rpc, safeAddress }); console.log(JSON.stringify({ safeAddress, modules: await safe.getModules(), guard: await safe.getGuard(), fallbackHandler: await safe.getFallbackHandler() }, null, 2)); } main();"
```

Per la configurazione base, `modules` deve essere vuoto e `guard` deve essere
l'indirizzo zero. Il fallback handler deve coincidere con quello mostrato nel
riepilogo di creazione approvato. Ogni differenza richiede escalation.

## Test innocuo

Nell'interfaccia Safe creare una transazione con:

```json
{
  "to": "SAFE_ADDRESS",
  "value": "0",
  "data": "0x"
}
```

`SAFE_ADDRESS` indica la variabile operativa e deve essere sostituita
dall'interfaccia con l'indirizzo Safe verificato. Confermare su due dispositivi
che destinazione e Safe coincidano, il valore sia zero e la calldata sia `0x`.
Raccogliere il quorum approvato ed eseguire.

Ripetere il comando di verifica provider e Safe. Il nonce deve aumentare
esattamente di `1`. Registrare transaction hash, block number e receipt status.

## Recovery drill

1. Dichiarare indisponibile un solo owner senza cancellare o esporre la chiave.
2. Elencare gli owner rimanenti.
3. Verificare che il loro numero sia almeno pari al threshold.
4. Provare il percorso di proposta, revisione e quorum senza cambiare owner.
5. Registrare tempo, partecipanti, risultato e punti di escalation.

Il drill non trasferisce ownership core e non rimuove owner dalla Safe.

## Verifica observer

Eseguire sulla VPS senza stampare il contenuto del file RPC.

```bash
systemctl is-active vault-automation-observe.service
cd /opt/vault-automation/TestSmartContract
sudo -u vaultops git status --short
sudo -u vaultops node -e 'const c=require("./scripts/automation/config.arbitrum-usdc-poc-1.json"); console.log(JSON.stringify({mode:c.mode,execution:c.execution,autonomous:c.autonomous},null,2))'
```

Il risultato atteso è servizio `active`, working tree pulito, mode `observe`,
execution `disabled` e autonomous `false`.

## Cosa non fare

- non trasferire ownership dei contratti core;
- non aggiungere `PRIVATE_KEY` o mnemonic alla VPS;
- non modificare `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- non eseguire `safe-propose`, `safe-sync` o `execute` in questa fase;
- non usare `--execute=true --dry-run=false`;
- non approvare una transazione non decodificata;
- non ignorare una chain diversa da `42161`;
- non continuare se owner o threshold on-chain differiscono dalla decisione.
