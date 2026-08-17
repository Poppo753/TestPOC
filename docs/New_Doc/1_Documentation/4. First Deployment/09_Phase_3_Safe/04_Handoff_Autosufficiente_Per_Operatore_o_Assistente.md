# Handoff autosufficiente della Fase 3

## Scopo

Questo file consente a un nuovo operatore o assistente di raccogliere evidenza
read-only e valutare la Fase 3 senza ricostruire la conversazione originale.
Non contiene private key, mnemonic, seed phrase o RPC URL.

## Stato iniziale noto

- fase: non iniziata;
- Safe: non ancora documentata;
- decisioni owner e threshold: aperte;
- proposta POC: `2-of-3`, non approvata;
- chain richiesta: Arbitrum One, chain ID `42161`;
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- control file observe: `scripts/automation/config.arbitrum-usdc-poc-1.json`;
- VPS: `vault-observer-arbitrum-01`, `46.225.133.37`;
- servizio: `vault-automation-observe.service`;
- modalità attesa: observe, execution disabled, autonomous false;
- ownership core: non deve cambiare in questa fase.

## Informazioni richieste all'operatore

- output redatto delle decisioni di governance approvate;
- `SAFE_ADDRESS`;
- transaction hash della creazione;
- transaction hash del test innocuo;
- output dei comandi read-only;
- accesso SSH oppure output redatto della VPS;
- evidenza del recovery drill.

Senza decisioni approvate e `SAFE_ADDRESS` la fase resta **FAIL** e non si può
autorizzare la Fase 4.

## Raccolta locale read-only

Eseguire dalla root `TestSmartContract` con `ARBITRUM_RPC_URL` e `SAFE_ADDRESS`
già presenti nella sessione.

```powershell
git rev-parse HEAD
git status --short
node --version
npx --% ts-node -e "import { Contract, JsonRpcProvider } from 'ethers'; async function main() { const rpc = process.env.ARBITRUM_RPC_URL; const safeAddress = process.env.SAFE_ADDRESS; if (!rpc) throw new Error('ARBITRUM_RPC_URL missing'); if (!safeAddress) throw new Error('SAFE_ADDRESS missing'); const provider = new JsonRpcProvider(rpc); const network = await provider.getNetwork(); const code = await provider.getCode(safeAddress); const safe = new Contract(safeAddress, ['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)', 'function nonce() view returns (uint256)', 'function VERSION() view returns (string)'], provider); console.log(JSON.stringify({ chainId: network.chainId.toString(), safeAddress, codeBytes: (code.length - 2) / 2, owners: await safe.getOwners(), threshold: (await safe.getThreshold()).toString(), nonce: (await safe.nonce()).toString(), version: await safe.VERSION() }, null, 2)); } main();"
npx --% ts-node -e "import Safe from '@safe-global/protocol-kit'; async function main() { const rpc = process.env.ARBITRUM_RPC_URL; const safeAddress = process.env.SAFE_ADDRESS; if (!rpc) throw new Error('ARBITRUM_RPC_URL missing'); if (!safeAddress) throw new Error('SAFE_ADDRESS missing'); const safe = await Safe.init({ provider: rpc, safeAddress }); console.log(JSON.stringify({ modules: await safe.getModules(), guard: await safe.getGuard(), fallbackHandler: await safe.getFallbackHandler() }, null, 2)); } main();"
npm run automation:cli -- preflight --config=scripts/automation/config.arbitrum-usdc-poc-1.json
```

Il preflight usa il control file observe. Non creare una config advisory per
superare questa fase.

## Raccolta VPS read-only

```powershell
ssh -i "$env:USERPROFILE\.ssh\vault_observer_hetzner_ed25519" root@46.225.133.37
```

Eseguire sulla VPS:

```bash
hostnamectl
date --iso-8601=seconds
systemctl is-enabled vault-automation-observe.service
systemctl is-active vault-automation-observe.service
systemctl show vault-automation-observe.service -p MainPID -p NRestarts -p ExecMainStatus
cd /opt/vault-automation/TestSmartContract
sudo -u vaultops git rev-parse HEAD
sudo -u vaultops git status --short
sudo -u vaultops node -e 'const c=require("./scripts/automation/config.arbitrum-usdc-poc-1.json"); console.log(JSON.stringify({mode:c.mode,execution:c.execution,autonomous:c.autonomous},null,2))'
stat -c '%U:%G %a %n' /etc/vault-automation/arbitrum-usdc-poc-1.env
```

Non stampare il contenuto del file environment.

## Criteri PASS numerici

Tutti devono essere veri:

1. chain ID letto dal provider uguale a `42161`;
2. bytecode a `SAFE_ADDRESS` maggiore di `0` byte;
3. numero owner on-chain uguale al numero approvato;
4. corrispondenza owner approvati/on-chain pari al `100%`;
5. threshold on-chain uguale al threshold approvato;
6. threshold maggiore o uguale a `2` per la configurazione POC proposta;
7. owner verificati da almeno `2` dispositivi distinti;
8. moduli e guard non approvati uguali a `0`, fallback handler uguale a quello approvato;
9. transazione innocua con valore `0`, calldata `0x` e receipt `status=1`;
10. incremento nonce Safe dopo il test uguale a `1`;
11. firme raccolte uguali o maggiori del threshold e provenienti da owner distinti;
12. recovery drill riuscito con esattamente `1` owner indisponibile;
13. owner disponibili durante il drill maggiori o uguali al threshold;
14. variazioni delle ownership dei contratti core uguali a `0`;
15. transazioni automation eseguite durante la fase uguali a `0`;
16. servizio observer `enabled` e `active`;
17. control file con mode `observe`, execution `disabled`, autonomous `false`;
18. private key o mnemonic owner presenti sulla VPS uguali a `0`;
19. problemi bloccanti aperti uguali a `0`.

Se un solo criterio fallisce, il gate è **FAIL**.

## Criteri di escalation

- chain diversa da `42161`;
- owner o threshold diversi dalla decisione approvata;
- owner dipendenti dallo stesso dispositivo o dalla stessa seed phrase;
- singola chiave capace di raggiungere il quorum;
- bytecode Safe assente o versione non leggibile;
- modulo, guard o fallback handler non approvato;
- destinazione, valore o calldata del test non corrispondenti;
- receipt fallita o nonce incrementato di un valore diverso da `1`;
- recovery impossibile con un owner indisponibile;
- qualsiasi ownership core modificata;
- comparsa di signer, private key o mnemonic sulla VPS;
- observer non attivo o control file non observe;
- richiesta di usare `--execute=true --dry-run=false`.

In caso di escalation non firmare altre transazioni, non cambiare owner e non
avviare la Fase 4. Raccogliere output, transaction hash, receipt, commit e
timestamp. Aggiornare `03_Registro_Esecuzione.md` con problema e responsabile.

## Decisione finale

Il valutatore deve riportare:

- esito: PASS oppure FAIL;
- numero criteri soddisfatti su 19;
- criteri falliti;
- problemi bloccanti;
- timestamp UTC;
- nome del valutatore;
- autorizzazione esplicita o diniego alla Fase 4.
