# Checklist deployment nuovo POC USDC

Aggiornata il 14 luglio 2026 dopo deployment, fork post-deploy e micro-flow reali.

Legenda: `[x]` completato con evidenza; `[ ]` gate ancora aperto; `[N/A]` escluso consapevolmente dal POC.

## A. Scope e sicurezza

- [x] Arbitrum One, chain ID 42161.
- [x] USDC nativo come base asset, 6 decimali.
- [x] Nuovi contratti core e nuovi bundle Aave, Euler, Morpho e Morpho Vault.
- [x] Dolomite, GMX e Uniswap esclusi dal deploy e dai test di certificazione.
- [x] Vecchi indirizzi riutilizzati solo per dipendenze esterne verificate on-chain.
- [x] RPC e private key assenti da manifest e documentazione.
- [x] Autorizzato l'uso dei circa 0,00369 ETH e di massimo 5 USDC per il POC.
- [ ] Verificare fuori repository backup e recovery dell'account deployer.

## B. Verifiche e rehearsal pre-deploy

- [x] Endpoint Alchemy autenticato, chain ID, signer, saldo ETH/USDC e nonce verificati.
- [x] Bytecode e metadata di USDC, WETH, feed, Aave Pool, Euler, Morpho, oracle, IRM e vault verificati.
- [x] Reserve Aave e relativi aToken/debt token derivati on-chain.
- [x] EVC, Lens e `asset()` dell'Euler USDC Vault verificati.
- [x] Market tuple Morpho WETH/USDC verificata.
- [x] `asset()`, `maxDeposit()` e stato del Morpho Vault verificati.
- [x] Rehearsal persistente completo al blocco 483819514.
- [x] Stima L2 + componente L1: 0,0015336565 ETH; budget con margine 50%: 0,0023004848 ETH.

## C. Qualità software

- [x] Compilazione con limite EIP-170 reale attivo.
- [x] Typecheck script.
- [x] Suite script finale: 39 test passati; suite Operations: 13 test passati.
- [x] Suite automation: 14 test passati.
- [x] Unit EulerRegistry: 74 test passati.
- [x] Deployment/migration mirati: 25 test passati; deployment bundle: 3 test passati.
- [x] Fork plugin Aave/Euler/Morpho/Morpho Vault: 221 test passati.
- [x] E2E rilevanti: 80 test passati; Aave leverage: 32 test passati.
- [x] Morpho Vault fork mirato dopo fix dust: 60 test passati.
- [x] `git diff --check` completato; `.env` non tracciato e `.env.mainnet` contiene solo indirizzi pubblici legacy.

## D. Rehearsal e certificazione manifest

- [x] Core e quattro bundle da stato pulito sullo stesso fork persistente.
- [x] Feed WETH configurato prima dei metadata TokenManager.
- [x] Registry Aave, Euler, Morpho market e Morpho Vault configurati.
- [x] Alias Beacon pubblici coerenti con il routing ProtocolManager.
- [x] Aave supply/withdraw completo con clamp del rounding.
- [x] Euler deposit/withdraw completo con share accounting e ruolo registry corretto.
- [x] Morpho WETH/USDC deposit/withdraw completo su fork.
- [x] Morpho Vault deposit/withdraw con share dust e `activeVaults` puliti.
- [x] Snapshot/revert, zero allowance e zero posizioni residue.
- [x] Certificazione sul manifest reale al blocco 483832997: 2 test passati.

## E. Deployment reale

- [x] Manifest `scripts/manifests/arbitrum-usdc-poc-1.json` creato incrementalmente.
- [x] Undici contratti core nuovi deployati e verificati tramite bytecode/receipt.
- [x] SwapManager ridotto a 24.473 byte runtime, sotto EIP-170 di 103 byte.
- [x] Bundle Aave, Euler, Morpho e Morpho Vault nuovi deployati.
- [x] Beacon mapping, Proxy authorization e ProtocolManager registration verificati.
- [x] Euler plugin autorizzato come position manager senza cedergli ownership del registry.
- [x] WETH, Aave USDC, Euler USDC, Morpho WETH/USDC e Morpho Vault USDC configurati.
- [x] Dolomite, GMX e Uniswap non registrati.
- [x] Ownership mantenuta temporaneamente sul deployer fino ai gate Safe.
- [ ] Verificare e pubblicare i sorgenti dei nuovi contratti sull'explorer.
- [ ] Applicare selector whitelist e policy economiche definitive dopo il periodo observe.

## F. Micro-flow reale e pulizia

- [x] Deposit iniziale di 1 USDC nel vault e mint di 1.000.000 LP share.
- [x] Aave: deposit 0,25 USDC e withdraw completo; residui zero.
- [x] Euler: deposit 0,25 USDC e withdraw completo; residui zero.
- [x] Morpho Vault: deposit 0,25 USDC e withdraw completo; share e tracking zero.
- [x] Withdraw finale del 100% delle LP share.
- [x] Wallet finale: 5,460204 USDC; rounding totale: 3 unità minime, cioè 0,000003 USDC.
- [x] Pool finale: `totalSupply = 0`, `totalValue = 0`, base balance zero.
- [x] Allowance wallet verso LiquidityManager: zero.
- [x] Saldi diretti USDC dei quattro plugin, WETH Morpho, aToken Aave, share Euler e Morpho Vault: zero.
- [x] Morpho market reale non finanziato: con solo USDC non è possibile aprire e chiudere seriamente una posizione collateralizzata WETH; full-cycle certificato sul fork.

## G. Automation e passaggio a Safe

- [x] Control file reale `scripts/automation/config.arbitrum-usdc-poc-1.json`.
- [x] Modalità `observe`, `execution.kind = disabled`, autonomia disabilitata.
- [x] Preflight reale: `ready = true`.
- [x] Primo ciclo reale: `NO_ACTION`, quattro protocolli a zero.
- [x] Morpho configurato monitor-only WETH/USDC: non può ricevere allocazioni automatiche e blocca il ciclo se rileva una posizione.
- [ ] Eseguire observe continuativo per almeno 24–72 ore su un servizio supervisionato.
- [ ] Definire Safe, owner, threshold e recovery process.
- [ ] Configurare Safe Transaction Service/API key e provare advisory end-to-end.
- [ ] Applicare policy/selector finali tramite Safe.
- [ ] Trasferire le ownership alla Safe con checklist separata e verifica post-transfer.
- [ ] Valutare autonomous solo dopo audit, telemetria oracle/APY affidabile e periodo operativo più lungo.

## Verdetto corrente

Il deployment POC è reale, funzionante e pulito dopo i test. È pronto per la fase `observe -> Safe advisory`; non è ancora autorizzato per capitale significativo o funzionamento autonomo.
