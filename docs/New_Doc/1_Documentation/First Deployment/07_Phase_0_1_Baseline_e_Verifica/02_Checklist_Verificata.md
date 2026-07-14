# Fasi 0–1 — Checklist verificata

Legenda: `[x]` completato; `[ ]` da eseguire; `[!]` fallito/bloccato; `[~]` in corso.

## A. Audit e perimetro

- [x] Leggere integralmente Prompt e roadmap.
- [x] Confermare tag `arbitrum-usdc-poc-1`.
- [x] Confermare inclusione dello spostamento Prompt.
- [x] Confermare pubblicazione GitHub.
- [x] Identificare branch `dev-26`.
- [x] Identificare commit baseline `8f53e98`.
- [x] Confermare che il manifest reale è incluso nella baseline.
- [x] Censire 22 contratti unici.
- [x] Separare dipendenze esterne dai contratti proprietari.
- [x] Confermare configurazione compiler.

## B. Sicurezza repository

- [x] Verificare file tracciati sensibili.
- [x] Verificare che `.env` non sia tracciato.
- [x] Cercare pattern di private key/API key nei file da pubblicare senza stampare valori.
- [x] Rimuovere quattro copie hardcoded della credenziale OneInch e usare l'ambiente.
- [x] Revocare la credenziale OneInch esposta nella storia e già presente sul remoto — confermato dall'utente il 15 luglio 2026.
- [x] Verificare `.automation-state` ignorata.
- [x] Eseguire `git diff --check`.
- [x] Confermare scope dello spostamento Prompt.

## C. Riproducibilità baseline

- [x] Validare manifest JSON.
- [x] Validare control file JSON.
- [!] Primo `npm ci` pulito: fallito per peer conflict ethers/chai-matchers.
- [x] Aggiungere `.npmrc` con `legacy-peer-deps=true` per riprodurre il lockfile senza risolverlo diversamente.
- [x] Ripetere `npm ci` in ambiente pulito con la policy equivalente `--legacy-peer-deps`.
- [x] Eseguire compile.
- [x] Eseguire typecheck.
- [x] Eseguire script test: 39 PASS.
- [x] Eseguire automation test: 14 PASS.
- [x] Registrare l'evidenza già conclusa delle suite unit/integration/E2E/fork rilevanti, escluse GMX/Dolomite.
- [x] Verificare runtime SwapManager sotto EIP-170: 24.473 byte.
- [!] Classificare audit npm: completata la discovery; remediation da pianificare senza alterare alla cieca la baseline.
- [ ] Registrare hash commit e checksum file critici.

## D. Archivio baseline

- [ ] Creare source archive dal commit baseline certificato.
- [ ] Preparare bundle artifact/build-info senza segreti.
- [ ] Generare SHA-256 degli archivi e del manifest.
- [ ] Creare istruzioni di restore.
- [ ] Registrare percorso locale del pacchetto.
- [ ] Segnalare che la copia offline fisica resta responsabilità dell'utente.

## E. Tooling verifica explorer

- [x] Creare matrice dichiarativa dei 22 contratti.
- [x] Usare indirizzi esclusivamente dal manifest.
- [x] Ricostruire constructor args da deploy-core/deploy-bundle.
- [x] Supportare `already verified` come successo idempotente.
- [x] Continuare la raccolta dopo failure singola.
- [x] Uscire non-zero con failure residue.
- [x] Non leggere o stampare private key.
- [x] Documentare comando e output.
- [x] Typecheck e testare il tooling in modalità preflight.

## F. Preflight explorer/on-chain

- [x] Verificare chain ID 42161.
- [x] Verificare RPC autenticata raggiungibile.
- [x] Verificare API key explorer presente senza stamparla.
- [x] Verificare bytecode dei 22 indirizzi.
- [x] Verificare receipt deploy dal manifest.
- [x] Verificare assenza di indirizzi proprietari duplicati inattesi.
- [x] Verificare SwapManager runtime 24.473 byte.

## G. Source verification

Blocco comune: la verifica pubblica espone i sorgenti del repository privato. Serve approvazione esplicita dell'utente dopo l'informativa; il preflight tecnico è 22/22 PASS.

- [ ] Verificare 11 core.
- [ ] Verificare 3 Aave.
- [ ] Verificare 3 Euler.
- [ ] Verificare 3 Morpho.
- [ ] Verificare 2 Morpho Vault.
- [ ] Registrare risultato per ogni contratto.
- [ ] Registrare URL explorer.
- [ ] Rieseguire in modo idempotente per confermare `already verified`.

## H. Git e GitHub

- [x] GitHub CLI disponibile: `gh 2.96.0`.
- [x] GitHub CLI autenticata come `Poppo753`.
- [x] Confermare repository remoto `Poppo753/TestPOC`, pubblico, default branch `master`.
- [ ] Commit separato dello spostamento Prompt.
- [ ] Commit documenti/tooling/evidenze fasi 0–1.
- [ ] Verificare che l'albero `contracts/` finale sia identico a `8f53e98`.
- [ ] Creare tag annotato `arbitrum-usdc-poc-1` sul commit baseline certificato.
- [ ] Verificare target del tag.
- [ ] Push `dev-26`.
- [ ] Push tag.
- [ ] Aprire o aggiornare draft PR verso default branch.
- [ ] Registrare URL PR e commit remoti.

## I. Documentazione finale

- [x] Creare registro esecuzione con timestamp e risultati.
- [x] Creare matrice verification completa per il preflight e colonne Explorer predisposte.
- [x] Creare guida per rerun.
- [ ] Aggiornare roadmap/checklist principale.
- [ ] Riesaminare checklist contro strategia.
- [ ] Dichiarare con precisione gate completi e blocchi residui.
