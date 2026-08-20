# Checklist verificata dell'implementazione MetaVault locale

Legenda: `[x]` completato con evidenza; `[ ]` non completato; `[~]` differito da
un gate esplicito e non appartenente alla certificazione locale.

## A. Decisioni e audit

- [x] Leggere integralmente `Prompt.md`.
- [x] Leggere integralmente la visione MetaVault.
- [x] Congelare un solo MetaVault USDC locale.
- [x] Congelare un solo leaf canonico per token e chain.
- [x] Vietare alias token usati come route.
- [x] Vietare modifiche ai contratti core.
- [x] Censire compatibilità di ProtocolManager, ProxyGeneral e LiquidityManager.
- [x] Censire il limite skip-on-error della Lens.
- [x] Creare audit dello stato attuale.
- [x] Creare strategia espansa.
- [x] Rileggere e correggere criticamente la strategia.
- [x] Confrontare questa checklist con la strategia.

## B. Interfacce

- [x] Creare `IInterVaultRegistry` con record child e policy.
- [x] Creare `IInterVaultPlugin` con viste runtime.
- [x] Creare `IInterVaultLensAdapter` con breakdown per child.
- [x] Usare Solidity compatibile con il progetto.
- [x] Non modificare `IProtocolAdapter` o `ILensAdapter`.

## C. Registry

- [x] Implementare identità parent e Registry owner.
- [x] Implementare registrazione child.
- [x] Validare bytecode e indirizzi non nulli.
- [x] Validare componenti contro Beacon child.
- [x] Validare chain, livello L0 e manifest hash.
- [x] Verificare assenza del bundle InterVault sul child.
- [x] Implementare un solo default per token code.
- [x] Implementare cap, max deposit, share deviation ed exit priority.
- [x] Implementare pause deposit/withdraw ed emergency-only.
- [x] Implementare deprecazione senza perdita di visibilità.
- [x] Impedire rimozione con share balance.
- [x] Implementare enumerazione deterministica.
- [x] Emettere eventi e usare custom error.

## D. Plugin

- [x] Implementare `IProtocolAdapter` senza cambiare core.
- [x] Limitare le operazioni normali al ProtocolManager parent.
- [x] Risolvere token reale e child dal Registry.
- [x] Implementare deposit con preview e delta share.
- [x] Usare allowance zero/esatta/zero.
- [x] Implementare cap prospettico.
- [x] Implementare withdraw asset→share con rounding verso l'alto.
- [x] Trasferire soltanto il delta ricevuto alla custody parent.
- [x] Implementare active child tracking senza duplicati.
- [x] Implementare close position e close base asset conservativi con child ID stabile.
- [x] Implementare emergency withdraw senza recipient arbitrario e senza rollback dei child già chiusi.
- [x] Implementare circuit breaker attivabile e disattivabile dall'owner.
- [x] Non integrare router o borrow.

## E. Lens

- [x] Implementare integralmente `ILensAdapter`.
- [x] Valutare share tramite `calculateWithdrawAmount`.
- [x] Convertire asset child in base asset parent.
- [x] Normalizzare decimali 6/8/18.
- [x] Esporre breakdown per child.
- [x] Esporre liquidità conservativa con `canWithdraw`.
- [x] Includere child deprecated con share residue.
- [x] Restituire debt zero e health massimo per la milestone supply-only.
- [x] Evitare doppio conteggio delle LPT come token parent.
- [x] Evitare ricorsione Lens → ValueCalculator → Lens; esposizione child espressa nella sleeve InterVault.

## F. Mock

- [x] Creare leaf deterministico con asset e LPT.
- [x] Implementare deposit, withdraw e preview.
- [x] Implementare `canWithdraw` e failure injection.
- [x] Supportare donation/yield e variazione exchange rate.
- [x] Usare MockBeacon per manifestare i componenti.

## G. Script e manifest

- [x] Aggiungere `inter-vault` ai bundle supportati.
- [x] Implementare deploy Registry/Plugin/Lens con checkpoint.
- [x] Registrare alias Beacon e ProtocolManager.
- [x] Implementare operazione register child.
- [x] Implementare operazione policy/status child.
- [x] Implementare posizione e preflight read-only.
- [x] Integrare i comandi nella CLI.
- [x] Estendere ABI e tipi senza rompere manifest esistenti.
- [x] Conservare dry-run, execute ed encode-only.

## H. Test

- [x] Compilazione Solidity.
- [x] Unit Registry happy path e failure path.
- [x] Unit Plugin deposit, withdraw, cap, allowance e access control.
- [x] Unit Lens same-asset e cross-asset mock.
- [x] Test lifecycle paused/deprecated/emergency e retry.
- [x] Test rimozione con saldo impossibile.
- [x] Integration con ProtocolManager reale e API invariata.
- [x] Invariant conservazione asset/share e rollback atomico.
- [x] Security target non censito e chiamante non autorizzato.
- [x] Test script e typecheck.
- [x] Fork fissato con parent nuovo e POC USDC reale usato come leaf; snapshot/revert e share finali zero.
- [~] Canary Arbitrum: richiede superamento gate e Safe proposal.

## I. Documentazione finale

- [x] Aggiornare questa checklist task per task.
- [x] Creare report implementazione ed evidenze.
- [x] Creare guida completa degli script MetaVault.
- [x] Documentare limiti residui e prossimo gate.
- [x] Verificare che nessun documento dichiari production-ready il sistema.

## Evidenze di chiusura

- `npx hardhat compile`: PASS, 2 file Solidity ricompilati dopo il riesame finale.
- `npx hardhat test test/unit/metavault/InterVault.bundle.test.ts`: **19 PASS**.
- `npm run scripts:typecheck`: PASS.
- `npm run scripts:test`: **40 PASS**, inclusi deploy bundle e operazioni MetaVault.
- `npm run automation:test`: **16 PASS**, inclusa osservazione InterVault monitor-only.
- fork Arbitrum al blocco `483832997`: **1 PASS**, nuovo parent effimero → leaf POC reale → unwind completo.
- Nessuna transazione verso Arbitrum e nessuna modifica al deployment POC esistente.
- I due task `[~]` restano deliberatamente fuori dalla certificazione locale: non sono falsamente marcati come completati.
