# Piano verificato di estensione test e automazione InterVault

## 1. Audit della copertura precedente

La prima implementazione disponeva di 16 test mirati in un unico bundle. Questi
coprivano Registry, Plugin, Lens, ProtocolManager, lifecycle ed emergency. La
suite script copriva inoltre deploy e operazioni CLI.

La copertura era valida ma non ancora completa come classificazione enterprise:

- i test unitari e di integrazione erano raccolti nello stesso file;
- mancava un E2E che attraversasse un vero LiquidityManager parent e il suo
  automatic withdrawal;
- mancava un test fork che usasse il POC USDC reale come leaf, senza mutare
  Arbitrum;
- il Vault Automation Controller non sapeva valorizzare l'intera sleeve
  InterVault tramite Lens;
- mancava una policy esplicita che impedisse all'automazione di finanziare
  InterVault prima del superamento del gate skip-on-Lens-error;
- il runbook VPS non costituiva ancora un handoff autosufficiente.

## 2. Strategia corretta

### Unit

I 16 test già presenti restano la suite unit/componente autorevole. Non vengono
duplicati artificialmente soltanto per aumentare il numero di file.

### Integration core

Va aggiunta una suite con Beacon, ProxyGeneral, TokenManager, ValueCalculator,
LiquidityManager e ProtocolManager reali. Deve dimostrare che la Lens entra nel
NAV parent e che le API core restano invariate.

### E2E locale

Va testato il percorso utente completo:

1. liquidità nel parent;
2. allocazione del parent nel leaf;
3. yield/donation nel leaf;
4. aggiornamento del NAV parent;
5. prelievo utente superiore alla riserva liquida;
6. automatic unwind via `closePositionsForBaseAsset`;
7. conservazione del valore e riduzione delle share leaf.

### Fork

Il fork non deve usare un mock come falsa prova di integrazione reale. Deve
deployare un parent nuovo esclusivamente nel fork e usare il POC USDC Arbitrum
già esistente come leaf reale. Deve usare un blocco fissato, whale stabile,
snapshot/revert e nessuna transazione mainnet.

### Script

Restano validi i test di deployment, register, policy, status, preflight e
positions. Vanno rieseguiti insieme alle altre suite.

### Automation

InterVault viene integrato inizialmente come **monitor-only**:

- il Controller legge `InterVaultLensAdapter.getTotalValue()` e non soltanto il
  balance del base-token leaf;
- il valore entra in managed assets e fingerprint;
- config con `enabled=false`, target e max a zero è accettata;
- config con `enabled=true` è rifiutata finché il gate valuation non è chiuso;
- nessun worker può generare autonomamente deposit InterVault in questa fase.

Questa scelta evita di confondere “il Controller vede la posizione” con “il
Controller è autorizzato a crearla”.

## 3. Checklist esecutiva

- [x] Aggiungere helper di fixture full-core condiviso.
- [x] Creare integration test del NAV e delle API core.
- [x] Creare E2E automatic withdrawal attraverso InterVault.
- [x] Creare fork test opt-in contro il POC USDC reale come leaf.
- [x] Rendere obbligatori RPC privata e `FORK_BLOCK_NUMBER` nel fork test.
- [x] Usare whale, snapshot/revert e parent nuovo solo nel fork.
- [x] Integrare valuation InterVault nell'observer automation.
- [x] Mantenere InterVault monitor-only nel preflight e nella strategia.
- [x] Creare test automation dedicati a osservazione, fingerprint e blocco funding.
- [x] Includere i nuovi test nel comando `automation:test`.
- [x] Rieseguire compile, unit, integration, E2E, script e automation.
- [x] Eseguire il fork con RPC autenticata e blocco `483832997`.
- [x] Aggiornare checklist, report, guida e matrice evidenze.
- [x] Creare handoff VPS autosufficiente senza segreti.

## 5. Evidenza finale

- `npm run test:metavault`: 22 PASS (19 unit/componente, 2 integration full-core, 1 E2E locale).
- `npm run test:metavault:fork` con blocco fissato: 1 PASS.
- `npm run automation:test`: 16 PASS.
- `npm run scripts:test`: 40 PASS.
- `npm run scripts:typecheck`: PASS.
- `npx hardhat compile`: PASS.
- nessuna transazione Arbitrum reale.

## 4. Gate che non possono essere simulati documentalmente

Un test fork può certificare l'integrazione col deployment POC al blocco scelto,
ma non rende deployati i tre moschettieri su Arbitrum. Il periodo shadow VPS può
essere dichiarato concluso soltanto leggendo heartbeat e journal dopo la
scadenza minima. Entrambi gli esiti devono provenire da evidenze, non da una
casella spuntata in anticipo.
