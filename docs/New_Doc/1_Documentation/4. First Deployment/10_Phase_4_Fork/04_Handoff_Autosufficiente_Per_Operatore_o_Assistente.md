# Handoff autosufficiente della Fase 4

## Scopo

Questo file consente a un nuovo operatore o assistente di verificare la
rehearsal ownership e decidere PASS/FAIL senza ricostruire la conversazione.
La raccolta non richiede private key reali e non autorizza transazioni mainnet.

## Stato e dipendenze

- fase: **completata, PASS — 2 agosto 2026**;
- Fase 3: parcheggiata, non PASS;
- dipendenza Fase 3 per questa rehearsal: nessuna;
- Safe usata: effimera `2-of-3` nel fork (`EphemeralMultisig`, indirizzo deterministico `0x683659Fef0A0DebfDCf137ACE17AAC998814cDb0` sui due run);
- chain sorgente: Arbitrum One, chain ID `42161`;
- manifest: `scripts/manifests/arbitrum-usdc-poc-1.json`;
- contratti manifest: `22`;
- contratti trasferibili: `21`;
- eccezione: `flashLoanService`, non Ownable;
- test richiesto: `test/deployment/OwnershipTransfer.fork.test.ts` (creato ed eseguito);
- rete di esecuzione consentita: `hardhat`;
- `FORK_BLOCK_NUMBER` usato: `490447686`.

Il PASS di questa fase certifica la rehearsal tecnica. Non completa la Fase 3
e non autorizza il trasferimento reale della Fase 6.

## Raccolta read-only preliminare

Eseguire dalla root `TestSmartContract`.

```powershell
git rev-parse HEAD
git status --short
node --version
npm --version
$manifest = Get-Content -Raw -Encoding UTF8 "scripts/manifests/arbitrum-usdc-poc-1.json" | ConvertFrom-Json
[pscustomobject]@{ ChainId = $manifest.chainId; ContractCount = @($manifest.contracts.PSObject.Properties).Count; Deployer = $manifest.deployer; LastCompletedBlock = $manifest.metadata.lastCompletedBlock }
Test-Path "test/deployment/OwnershipTransfer.fork.test.ts"
```

Il file test deve esistere. `Test-Path` uguale a `False` produce **FAIL**.

## Esecuzione riproducibile

Usare il blocco registrato in `03_Registro_Esecuzione.md`.

```powershell
if (-not $env:ARBITRUM_RPC_URL) { throw "ARBITRUM_RPC_URL missing" }
if (-not $env:FORK_BLOCK_NUMBER) { throw "FORK_BLOCK_NUMBER missing" }
$env:FORK_ENABLED = "true"
npx hardhat test test/deployment/OwnershipTransfer.fork.test.ts --network hardhat
npx hardhat test test/deployment/OwnershipTransfer.fork.test.ts --network hardhat
```

Non sostituire `hardhat` con `arbitrum`.

## Evidenza minima richiesta

- commit e stato working tree;
- valore numerico di `FORK_BLOCK_NUMBER`;
- output completo delle due esecuzioni;
- indirizzo della Safe locale e configurazione `2-of-3`;
- matrice di 22 righe compilata;
- receipt locali dei 21 trasferimenti;
- evidenza della Beacon a due step;
- 21 prove negative del vecchio deployer;
- receipt locali di update, rollback, pause e unpause;
- evidenza deposit, withdraw e health;
- prova del cleanup e dello snapshot revert;
- conferma di zero transazioni Arbitrum One.

## Criteri PASS numerici

Tutti devono essere veri:

1. `FORK_ENABLED=true`;
2. `FORK_BLOCK_NUMBER` presente, numerico e maggiore del blocco di configurazione;
3. rete di test uguale a `hardhat` e chain ID uguale a `42161`;
4. esecuzioni complete sullo stesso blocco uguali a `2`;
5. righe della matrice compilate uguali a `22/22`;
6. contratti con bytecode uguali a `22/22`;
7. contratti Ownable a uno step classificati uguali a `20`;
8. contratti a due step classificati uguali a `1`;
9. eccezioni non Ownable classificate uguali a `1`;
10. ownership finali corrispondenti alla Safe locale uguali a `21/21`;
11. `pendingOwner` finale della Beacon uguale all'indirizzo zero;
12. tentativi owner-only del vecchio deployer rifiutati uguali a `21/21`;
13. esecuzioni Safe con una sola firma riuscite uguali a `0`;
14. esecuzioni Safe con due firme distinte riuscite maggiori o uguali a `1`;
15. modifiche amministrative riuscite uguali a `1` e rollback esatti uguali a `1`;
16. cicli pause/unpause completi uguali a `1`;
17. deposit riusciti dopo il trasferimento maggiori o uguali a `1`;
18. withdraw riusciti dopo il trasferimento maggiori o uguali a `1`;
19. protocolli attivi nel manifest sottoposti a health uguali a `4`;
20. finding critical non spiegati uguali a `0`;
21. cleanup impersonation riusciti uguali a `2/2`;
22. snapshot ripristinati uguali a `2/2`;
23. transazioni inviate ad Arbitrum One uguali a `0`;
24. problemi bloccanti aperti uguali a `0`.

Se un solo criterio fallisce, il gate è **FAIL**.

## Criteri di escalation

- test avviato con rete diversa da `hardhat`;
- blocco fork assente, mobile o precedente alla configurazione;
- manifest diverso da quello operativo;
- meno di 22 righe nella matrice;
- bytecode assente a un indirizzo del manifest;
- owner iniziale inatteso e non spiegato;
- trasferimento fallito o ownership finale non Safe;
- `pendingOwner` Beacon non azzerato;
- vecchio deployer ancora autorizzato;
- una sola firma sufficiente per la Safe locale;
- Safe incapace di amministrare un contratto trasferito;
- rollback che non ripristina il valore esatto;
- pause, unpause, deposit, withdraw o health falliti;
- cleanup o snapshot revert fallito;
- presenza di `PRIVATE_KEY` o mnemonic nella procedura;
- qualsiasi transaction hash appartenente ad Arbitrum One.

In caso di escalation interrompere la rehearsal. Conservare output, matrice,
stack trace, blocco fork e commit. Non correggere lo stato con chiamate manuali.
Aprire un problema nel registro e ripetere entrambe le esecuzioni dopo il fix.

## Decisione finale

- esito: **PASS**;
- criteri soddisfatti: **24/24**;
- righe matrice compilate: **22/22**;
- criteri falliti: nessuno;
- problemi bloccanti: nessuno (FASE4-001 aperto ma non bloccante, vedi sotto);
- commit: `ca9ab9f3e488044c685292936aaab53dd71cc7ae`; `FORK_BLOCK_NUMBER`: `490447686`;
- timestamp UTC: 2026-08-02T21:04Z;
- autorizzazione esplicita alla Fase 5: **sì**;
- nota: la Fase 6 resta bloccata dalla Fase 3 (parcheggiata) indipendentemente da questo PASS.

### Problema non bloccante riportato (FASE4-001)

`emergencyHandler.emergencyUnpause()` risulta irraggiungibile dopo un trasferimento
ownership perché `ProxyGeneral.unpause()` è `onlyOwner` e valuta `msg.sender`
come l'indirizzo di `EmergencyHandler`, non l'owner reale di `ProxyGeneral`.
Verificato con una simulazione `eth_call` prima di impegnare il quorum, in
entrambe le esecuzioni. Percorso funzionale alternativo verificato: l'owner
di `ProxyGeneral` chiama `unpause()` direttamente. Decisione (fix vs accettazione
esplicita) rimandata all'utente prima della Fase 6; vedi
`00_TODO_Non_Tecnico/01_Cose_Da_Fare_Dopo_Parte_Tecnica.md` e
`03_Registro_Esecuzione.md` per il dettaglio completo.
