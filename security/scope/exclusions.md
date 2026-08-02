# Esclusioni dallo scope production e criteri di reingresso

Documento generato in **S0.2** (2026-07-15) al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.
Complementare a `security/scope/production-paths.txt` (lista machine-readable).

## 1. Principio guida

Ogni esclusione:
1. è **motivata** con un riferimento al codice o allo stato del progetto;
2. ha un **criterio di reingresso** esplicito (cosa deve succedere prima che il path rientri nello scope production);
3. **non è permanente**: viene rivista ad ogni ciclo S1.6 e a ogni nuova release candidate.

Esclusioni globali per severity o detector non sono ammesse — le uniche esclusioni valide sono **per path**.

## 2. Contratti esclusi

### 2.1 `contracts/plugins/old/**`

- **Contenuto attuale:** `FlashLoanPlugin.md` (documento, non compilato).
- **Motivazione:** cartella storica di plugin sostituiti; nessun file `.sol` produce bytecode.
- **Criterio di reingresso:** nessuno previsto. In caso di reintroduzione di un plugin, deve essere spostato fuori da `plugins/old/` e sottoposto al ciclo S1.6.
- **Enforcement:** ignorare al pattern glob `contracts/plugins/old/**` in `slither.config.json`, in `foundry.toml` (`ignore`), e nei workflow CI.

### 2.2 `contracts/plugins/DolomitePlugin.sol`

- **Motivazione:** integrazione Dolomite non completata e non deploy target attuale (mandate utente esplicito nell'audit 2026-07: "non considerare gli old e dolomite e gmx").
- **Criterio di reingresso:**
  1. il team decide formalmente di attivare l'integrazione Dolomite;
  2. il plugin passa audit interno (S1.6) e static analysis (S3/S4);
  3. la PR che rimuove l'esclusione aggiunge anche: (a) property test dedicate (S6), (b) fork test (S10.1), (c) rimozione dell'entry `!plugins/DolomitePlugin.sol` da qui.
- **Non-goal:** la sola presenza on-chain di Dolomite in Arbitrum non basta a giustificare l'ingresso nello scope se il plugin non è testato end-to-end.

### 2.3 `contracts/plugins/EulerV2Plugin copy.sol.md`

- **Motivazione:** file `.md` con codice Solidity in blocco markdown, non compilato. Snapshot storico durante refactor.
- **Criterio di reingresso:** **nessuno**. Il file deve essere eliminato in un ciclo di cleanup S1.5/Ciclo 5 (hardening/debito tecnico) — non deve mai essere considerato codice.

### 2.4 `contracts/SwapManager.sol.backup`

- **Motivazione:** backup manuale di una versione precedente di SwapManager. Non compilato (Hardhat/Slither non processano `.backup`).
- **Criterio di reingresso:** **nessuno**. Da rimuovere in cleanup S1.5. Aggiungere `*.backup` a `.gitignore` per prevenire future occorrenze.
- **Nota di sicurezza:** il file contiene codice storico con bug già registrati nell'audit 2026-07 (finding CORE-035). Va rimosso dal repository, non solo escluso dai tool.

### 2.5 GMX

- **Stato attuale:** nessun file Solidity GMX presente in `contracts/`. Esistono riferimenti in `scripts/deploy/setupGMXv2Plugin.ts` (path referenziato in `package.json` ma directory `scripts/deploy/` **non esiste**) e in `test/integration/GMXv2Plugin.e2e.test.ts`.
- **Motivazione:** integrazione non completata, plugin non deploy target attuale.
- **Criterio di reingresso:** stesso di Dolomite (§2.2). Prima di attivare, ripulire anche i riferimenti orfani in `package.json` (`test:gmx`, `deploy:setup`, `deploy:testnet`) che oggi puntano a un path inesistente.

## 3. Mock non-production runtime

### 3.1 Mocks a root `contracts/`

Files: `MockChainlinkOracle.sol`, `MockERC20.sol`, `MockWETH.sol`.

- **Motivazione:** utilities di test che vivono nella root `contracts/`. Al commit corrente sono compilate da Hardhat con la stessa configurazione della produzione (non hanno flag di build che le escluda).
- **Criterio di reingresso in scope full audit:** **nessuno**. Sono mock **per definizione**.
- **Deployment-hygiene aperto:** la loro presenza nella root aumenta il rischio di deploy accidentale. Finding `ADP-033` e `ADP-035` dell'audit 2026-07 già registrano la posizione. Fix atteso in S1.5/Ciclo 5:
  - spostare in `contracts/mocks/`;
  - aggiungere `abstract` o `require(false, "MOCK")` in `constructor`;
  - aggiornare `production-paths.txt` conseguentemente.
- **In scope PARZIALE per static analysis:** Slither deve **continuare** a girare su questi file con severity ridotta, per catturare regressioni di deployment-hygiene (es. rimozione accidentale della clausola abstract).

### 3.2 Mocks in `contracts/mocks/**`

Files: `MockBeacon.sol`, `MockChainlinkAggregator.sol`, `MockDepositHelper.sol`, `MockFlashLoanService.sol`, `MockLiquidityManager.sol`, `MockMorpho.sol`, `MockOperationalProtocol.sol`, `MockOracleAdapter.sol`, `MockProxyGeneral.sol`, `MockReentrantToken.sol`, `MockSimpleSwap.sol`, `MockTokenManager.sol`, `mocks/metavault/MockInterVaultLeaf.sol`, `mocks/metavault/MockInterVaultValueCalculator.sol`.

- **Motivazione:** cartella dichiaratamente di test/mock; nessun deploy target.
- **Criterio di reingresso in scope full audit:** **nessuno**. Restano fuori dallo scope production.
- **In scope PARZIALE per static analysis:** Slither può includerli con detector base per catturare bug che possano falsare gli invariant test (es. mock che mentono su `balanceOf` in modo non intenzionale). Non-bloccante.

## 4. Test e script non-production

### 4.1 `test/**`

- **Motivazione:** codice di test, non deploy target. Include suite Hardhat (unit/integration/e2e/security/invariants/performance/fork), test scripts, docs.
- **Criterio di reingresso:** non applicabile — i test **devono** rimanere fuori dallo scope production per definizione.
- **Enforcement richiesto:** Slither NON deve analizzare `test/**`; foundry.toml deve avere `test = "test-foundry"` (nuovo path) distinto da `test/` (Hardhat).

### 4.2 `test/old/**`

- **Motivazione:** test storici non più autorevoli (contengono riferimenti a `EulerV2Plugin.leverage.e2e.test.ts` che precedono refactor).
- **Criterio di reingresso:** **nessuno**. Da valutare rimozione in S1.5.

### 4.3 `test/integration/dolomite/**`, `test/integration/GMXv2Plugin.e2e.test.ts`

- **Motivazione:** allineate all'esclusione plugin corrispondenti (§2.2, §2.5).
- **Criterio di reingresso:** simultaneo al reingresso dei plugin.

### 4.4 Documentazione e artifact non compilati

- `docs/**` — documentazione, out-of-scope per tool statici.
- `*.md` (in root e in altre cartelle) — out-of-scope.
- `deployments/**`, `ignition/**` — artifact di deploy, out-of-scope per tool statici (rientrano in S10.2 off-chain security).
- `dapp-new/**` — front-end (out-of-scope per la suite security on-chain, in scope solo se contiene logica di firma).

## 5. Controllo automatico "nuovo file Solidity non classificato"

Requisito da checklist S0.2:
> Aggiungere controllo CI che segnali nuovi file Solidity non classificati.

**Implementazione richiesta (in S2 quando la CI verrà toccata):** un job GitHub Actions che, ad ogni PR modifichi file `.sol`, esegua:

```bash
# pseudo-script check-scope-drift.sh
DECLARED=$(grep -vE '^(#|$)' security/scope/production-paths.txt | grep -E '\.sol$' | sort -u)
ACTUAL=$(find contracts -name "*.sol" -type f | sort -u)
UNCLASSIFIED=$(comm -23 <(echo "$ACTUAL") <(echo "$DECLARED"))
if [ -n "$UNCLASSIFIED" ]; then
  echo "::error::New Solidity file(s) not classified in production-paths.txt:"
  echo "$UNCLASSIFIED"
  echo "Add explicit include or exclusion (with motivation in exclusions.md) before merge."
  exit 1
fi
```

**Blocker per l'implementazione ora:** nessuno tecnico, ma il job va introdotto solo con il primo intervento CI in S2 per non violare il vincolo "non toccare CI in S0" della checklist.

**Follow-up:** aprire task S2 dedicato "Enforce scope drift check" con questo comando come deliverable.

## 6. Riepilogo tabellare

| Path | Tipo | Stato | Criterio reingresso |
|---|---|---|---|
| `contracts/plugins/old/**` | Legacy | Escluso | Nessuno (dir da rimuovere) |
| `contracts/plugins/DolomitePlugin.sol` | Integrazione incompleta | Escluso | Attivazione Dolomite + audit S1.6 |
| `contracts/plugins/EulerV2Plugin copy.sol.md` | Snapshot markdown | Escluso | Nessuno (da eliminare) |
| `contracts/SwapManager.sol.backup` | Backup manuale | Escluso | Nessuno (da eliminare) |
| GMX (nessun `.sol`) | Non esiste | N/A | Attivazione integrazione |
| `contracts/MockChainlinkOracle.sol` | Mock in root | Escluso da scope full | Cleanup deployment-hygiene |
| `contracts/MockERC20.sol` | Mock in root | Escluso da scope full | Cleanup deployment-hygiene |
| `contracts/MockWETH.sol` | Mock in root | Escluso da scope full | Cleanup deployment-hygiene |
| `contracts/mocks/**` | Mock dedicata | Escluso da scope full | Non applicabile |
| `test/**` | Test | Escluso | Non applicabile |
| `docs/**` | Documentazione | Escluso | Non applicabile |

## 7. Modifiche a questo documento

Ogni modifica a `production-paths.txt` o a questo file richiede:
- riferimento all'ID del ciclo S1.6 o dello sprint che la giustifica;
- entry in `security/DECISIONS.md`;
- revisione dei workflow CI dipendenti;
- riesecuzione della campagna Slither/Foundry sui path aggiunti prima del merge.

Nessuna modifica opportunistica per rendere una PR verde: si applica la §1.4 della checklist (baseline non modificabile per assorbire nuovi finding della stessa PR).
