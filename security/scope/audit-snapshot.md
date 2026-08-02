# Audit snapshot — commit di riferimento per la suite di sicurezza

Documento generato in esecuzione della checklist **S0.1 Snapshot autorevole**
(vedi `docs/New_Doc/1_Documentation/6. audit_2026_07/11-security-testing-suite/02_Checklist_Implementazione_Verificata.md`).

## 1. Branch e commit di riferimento

| Campo | Valore | Fonte |
|---|---|---|
| Branch corrente | `dev-26` | `git branch --show-current` |
| HEAD | `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89` | `git rev-parse HEAD` |
| HEAD subject | `security checklist update: Esegui una fase alla volta…` | `git log -1` |
| HEAD timestamp | 2026-07-15 17:28:55 +0200 | `git log -1 --format=%ai` |
| Working tree | clean (nessuna modifica non committata) | `git status --short` (output vuoto) |

## 2. Data di analisi

- Data snapshot: **2026-07-15**
- Time zone: Europe/Rome (CEST)
- Timestamp riferimento evidenze: 2026-07-15 T ~17:30 CEST

## 3. Toolchain fissata dal commit

| Tool | Versione | Fonte |
|---|---|---|
| Node.js | v22.20.0 | `node --version` |
| npm | 10.9.3 | `npm --version` |
| Solidity (solc) | 0.8.27 | `hardhat.config.ts` L.12 |
| Hardhat | ^2.28.6 (semver range) | `package.json` L.48 |
| TypeScript | ^5.3.3 | `package.json` L.53 |
| Ethers.js | ^6.9.0 | `package.json` L.47 |
| OpenZeppelin Contracts | ^4.9.2 | `package.json` L.57 |
| Chainlink Contracts | ^0.8.0 | `package.json` L.56 |
| Uniswap v3-periphery | ^1.4.4 | `package.json` L.61 |
| Optimizer runs | 100 | `hardhat.config.ts` L.16 |
| Via IR | true | `hardhat.config.ts` L.18 |
| EVM target | (default `paris` per solc 0.8.27) | non override in config |
| `allowUnlimitedContractSize` (hardhat network) | **false** | `hardhat.config.ts` L.48 — coerente con EIP-170 |

**Lockfile:** `package-lock.json` presente, 373 046 byte, modificato 2026-07-15 15:26. Da usare con `npm ci` (versione bindata) in tutti i job CI e in ambienti di sviluppo.

**Nota:** i range semver in `package.json` non fissano la versione esatta a run-time. Il commit di riferimento è autorevole solo insieme al `package-lock.json` allo stesso commit; qualsiasi `npm install` senza `--frozen-lockfile`/`npm ci` invalida la riproducibilità.

## 4. Commit di riferimento dell'audit 2026-07

L'audit registrato in `docs/audit_2026_07/` è stato committato come singolo blocco documentale il **2026-07-15 15:49:18 +0200** (commit `12b6cb1495475cb848d0eb8ffc6751c40945a27f`). L'audit **non ha dichiarato retrospettivamente** un commit di codice come snapshot analizzato: la campagna è stata condotta durante la sessione in memoria, senza fissare un `codebase-hash`.

**Assunzione operativa:** il codice `contracts/**` analizzato dall'audit è quello presente sul disco dei 4 agenti di audit tra il 2026-07-14 e il 2026-07-15, che risulta identico al codice del commit **`7f0dc690a665485b68ac62b71db0817cebb41837`** (2026-07-15 10:52:51 +0200) — il commit che ha aggiunto lo stack InterVault e che precede tutti i commit puramente documentali fino a HEAD.

## 5. Diff dello scope rispetto ad HEAD

### 5.1 Contratti modificati tra commit audit (`12b6cb...`) e HEAD (`786a5b...`)

```
git diff --name-status 12b6cb1495475cb848d0eb8ffc6751c40945a27f HEAD -- contracts/
```

**Output: vuoto.** Nessun file `contracts/**` è stato modificato tra il commit di audit e HEAD.

### 5.2 Contratti modificati tra commit InterVault (`7f0dc6...`) e HEAD

```
git diff --name-only 7f0dc690a665485b68ac62b71db0817cebb41837 HEAD -- contracts/
```

**Output: vuoto.** Nessun file `contracts/**` è stato modificato dal 2026-07-15 10:52:51 in poi.

### 5.3 Timeline commit rilevante

| Commit | Data | Subject |
|---|---|---|
| `7f0dc690` | 2026-07-15 10:52:51 | feat(metavault): add guarded InterVault stack and operations |
| `f7cd3a81` | 2026-07-15 15:16:24 | documentation fixing (partial) |
| `12b6cb14` | 2026-07-15 15:49:18 | BUG ANALYSIS: Add zero budget security roadmap (audit docs) |
| `e6361650` | 2026-07-15 17:22:53 | Moving Docs + checklist |
| `786a5b92` | 2026-07-15 17:28:55 | security checklist update (HEAD) |

**Nessun commit sposta o modifica codice Solidity dopo `7f0dc690`.**

### 5.4 File production **aggiunti** rispetto all'audit ma **non analizzati** dai 4 agenti

L'audit del 2026-07 ha analizzato:
- Core: `Beacon`, `DepositHelper`, `EmergencyHandler`, `Liquiditymanager`, `ParameterManager`, `ProtocolManager`, `ProxyGeneral`, `SwapManager`, `TokenManager`, `ValueCalculator`.
- Plugins: `AaveV3Plugin`, `AaveV3Registry`, `EulerRegistry`, `EulerV2Plugin`, `MorphoPlugin`, `MorphoRegistry`, `MorphoVaultPlugin`, `UniswapV3Plugin`, `UniswapV3PluginDirect`.
- Adapters: `AaveV3LensAdapter`, `ChainlinkAdapter`, `EulerLensAdapter`, `MorphoLensAdapter`, `MorphoVaultLensAdapter`.
- Services: `FlashLoanService`.
- Escluso da mandate utente: `plugins/old/*`, `DolomitePlugin`, `GMXv2Plugin*`, `*.backup`, `EulerV2Plugin copy.sol.md`.

**Escluso di fatto (mai raggiunto dagli agenti) anche se in scope production:**
| File | Aggiunto in commit | LOC | Nel scope audit? |
|---|---|---|---|
| `contracts/metavault/InterVaultRegistry.sol` | `7f0dc690` | 198 | ❌ Omesso dall'audit |
| `contracts/plugins/InterVaultPlugin.sol` | `7f0dc690` | 334 | ❌ Omesso dall'audit |
| `contracts/adapters/InterVaultLensAdapter.sol` | `7f0dc690` | 199 | ❌ Omesso dall'audit |
| `contracts/interfaces/metavault/IInterVaultLensAdapter.sol` | `7f0dc690` | 23 | ❌ Omesso dall'audit |
| `contracts/interfaces/metavault/IInterVaultPlugin.sol` | `7f0dc690` | 12 | ❌ Omesso dall'audit |
| `contracts/interfaces/metavault/IInterVaultRegistry.sol` | `7f0dc690` | 33 | ❌ Omesso dall'audit |

**Impatto per S0/S1:** il registro finding di audit **non copre lo stack InterVault** (~800 LOC production). Deve essere trattato come componente in scope production **non ancora analizzato**. Prima di considerare la suite di sicurezza completa, InterVault deve entrare nel ciclo S1.2/S1.6 con lo stesso trattamento dei plugin già analizzati.

**Mocks metavault** (aggiunti nello stesso commit): `contracts/mocks/metavault/MockInterVaultLeaf.sol` (70 LOC), `contracts/mocks/metavault/MockInterVaultValueCalculator.sol` (13 LOC). Trattamento: deployment-hygiene, non production runtime.

### 5.5 Riverifica di risultati su linee obsolete

Poiché tra il commit di riferimento e HEAD il codice `contracts/**` **non è cambiato**, tutti i finding registrati nell'audit del 2026-07 restano applicabili con lo stesso `file:line` indicato, senza necessità di riverifica per drift di path/line. Fanno eccezione:
- I finding relativi a InterVault: **non esistono nell'audit** e devono essere prodotti ex-novo in fase S1.6.
- Qualsiasi finding che referenzi codice esterno alla cartella `contracts/**` (script, deploy, manifest, VAC) va comunque riverificato in S10.2.

## 6. Dichiarazioni obbligatorie richieste da S0.1

- [x] Commit e branch registrati (§1 di questo documento).
- [x] Data e versioni tool registrate (§2, §3).
- [x] Confronto commit audit vs HEAD eseguito (§5.1 – §5.3).
- [x] File production aggiunti dopo audit elencati, InterVault incluso (§5.4).
- [x] Diff di scope salvato come documento (questo file).
- [x] Dichiarazione che risultati su linee obsolete richiedono riverifica (§5.5): **non applicabile** al codice `contracts/**` che non è cambiato; **applicabile** allo stack InterVault che non è mai stato analizzato.

## 7. Comandi di verifica riproducibili

Per rigenerare le evidenze di questo documento:

```bash
cd C:/Personal/TestPOC

# HEAD e branch
git rev-parse HEAD
git branch --show-current
git status --short

# Toolchain
node --version
npm --version
grep -E "solidity|hardhat|openzeppelin|chainlink" package.json
grep -E "version|optimizer|viaIR" hardhat.config.ts

# Commit di riferimento audit e InterVault
git log --diff-filter=A --format="%H %ai %s" -- "docs/audit_2026_07/00-README.md"
git log --format="%H %ai %s" 7f0dc690a665485b68ac62b71db0817cebb41837

# Diff di scope
git diff --name-status 12b6cb1495475cb848d0eb8ffc6751c40945a27f HEAD -- contracts/
git diff --name-only 7f0dc690a665485b68ac62b71db0817cebb41837 HEAD -- contracts/

# File InterVault aggiunti nel commit
git show --stat 7f0dc690a665485b68ac62b71db0817cebb41837 -- contracts/
```

Exit codes attesi: tutti 0. Output atteso: come riportato ai paragrafi 1-5.

## 8. Follow-up bloccati da S0.3 (human gate)

- Ownership tecnico e reviewer non ancora nominati (S0.3).
- CODEOWNERS non ancora esistente.
- Reviewer per accepted risk non ancora definito.

Questo documento **non nomina persone reali**. La nomina di owner/reviewer è delegata al gate umano §1.4 e verrà registrata in `security/DECISIONS.md` dopo autorizzazione esplicita.
