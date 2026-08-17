# Jethos Website — checklist di implementazione verificata

Versione 1.0 — 23 luglio 2026  
Stato: checklist operativa derivata e verificata contro `02_Piano_Espanso_Riesaminato.md`

Legenda:

- `[ ]` da eseguire;
- `[x]` completato e verificato;
- `[~]` completato parzialmente o con limite documentato;
- `[!]` escluso intenzionalmente per sicurezza o fuori perimetro.

## A. Strategia e fonti

- [x] A01 Definire Jethos come self-custodial financial home.
- [x] A02 Definire la separazione fra wallet e vault.
- [x] A03 Integrare il principio di proprietà senza promesse assolute.
- [x] A04 Definire Protocol, App e Future Services.
- [x] A05 Distinguere PoC, implemented, validation, planned, vision, illustrative e live.
- [x] A06 Vietare maximum yield, every protocol, risk-free e garanzie analoghe.
- [x] A07 Separare audit Jethos da audit dei protocolli sottostanti.
- [x] A08 Stabilire il manifest USDC come record iniziale del deployment.
- [x] A09 Stabilire che lo stato live prevale sul record locale per la UI.
- [x] A10 Escludere modifiche ai contratti Solidity.

## B. Struttura e compatibilità

- [x] B01 Creare `pages`.
- [x] B02 Creare `assets/css`.
- [x] B03 Creare `assets/js/core`.
- [x] B04 Creare `assets/js/components`.
- [x] B05 Creare `assets/js/features`.
- [x] B06 Creare `assets/js/web3`.
- [x] B07 Creare `data`.
- [x] B08 Ricostruire `index.html` come landing.
- [x] B09 Creare `app.html` come console PoC.
- [x] B10 Convertire `landing.html` in compatibility redirect.
- [x] B11 Convertire `documentation.html` in compatibility redirect.
- [x] B12 Convertire `config.html` in compatibility redirect.
- [x] B13 Convertire `portfolio.html` in compatibility redirect.
- [x] B14 Aggiornare `robots.txt`.
- [x] B15 Riscrivere README della web app.

## C. Design system

- [x] C01 Definire colori, spazi, radius, shadow e typography in `tokens.css`.
- [x] C02 Definire reset, body, headings, link, focus e reduced motion in `base.css`.
- [x] C03 Implementare header, nav, mobile menu e footer.
- [x] C04 Implementare button, badge, card, callout e metric.
- [x] C05 Implementare diagrammi e flow component.
- [x] C06 Implementare form, input, tabs e transaction state.
- [x] C07 Implementare dialog, toast e skeleton.
- [x] C08 Implementare layout responsive condiviso.
- [x] C09 Implementare stili specifici landing e pagine.
- [x] C10 Verificare contrasto e focus visibile.
- [x] C11 Verificare 320 px, tablet e desktop.
- [x] C12 Eliminare dipendenze Vanta/Three/Tailwind dalla nuova esperienza.

## D. Shell e moduli comuni

- [x] D01 Implementare `site-shell.js` per header/footer condivisi.
- [x] D02 Implementare navigazione attiva e menu mobile.
- [x] D03 Implementare skip link e landmark semantici.
- [x] D04 Implementare reveal progressivo non essenziale.
- [x] D05 Rispettare `prefers-reduced-motion`.
- [x] D06 Implementare formattazione numeri, indirizzi e date.
- [x] D07 Implementare badge di stato uniformi.
- [x] D08 Implementare modal accessibile con focus management.
- [x] D09 Implementare toast con `aria-live`.
- [x] D10 Gestire link esterni in sicurezza.

## E. Landing

- [x] E01 Hero “Your self-custodial financial home”.
- [x] E02 Sottotitolo Hold/Invest/Send/Understand.
- [x] E03 Badge Private PoC USDC Conservative Arbitrum.
- [x] E04 CTA Explore, PoC e Docs.
- [x] E05 Dashboard finanziaria illustrativa.
- [x] E06 Sezione One financial home.
- [x] E07 Sezione wallet/vault con deposito esplicito.
- [x] E08 Dichiarare che gli asset nel wallet non sono investiti automaticamente.
- [x] E09 Dichiarare chiavi e approvals come responsabilità dell'utente.
- [x] E10 Percorso Choose asset/risk/deposit/manage/monitor.
- [x] E11 Matrice asset e profili.
- [x] E12 Modello APY nominale → rendimento netto atteso.
- [x] E13 Esempio allocazione con label illustrative.
- [x] E14 Sezione trasparenza “where and why”.
- [x] E15 Sezione controlli e limiti.
- [x] E16 Architettura semplificata App/Vault/Engine/Modules.
- [x] E17 Sezione Protocol/App/Future Services.
- [x] E18 Roadmap Today/Next/Vision.
- [x] E19 CTA finale non ingannevole.
- [x] E20 Rimuovere claim obsoleti e APY fittizi.

## F. Pagine informative

- [x] F01 Creare `how-it-works.html`.
- [x] F02 Spiegare wallet, approval e deposito.
- [x] F03 Spiegare share e stato del capitale.
- [x] F04 Spiegare reserve, strategie e prelievo.
- [x] F05 Documentare ciò che Jethos può/non può fare.
- [x] F06 Creare `vaults.html`.
- [x] F07 Implementare catalogo asset–rischio con stati.
- [x] F08 Presentare PoC USDC Conservative.
- [x] F09 Segnalare vault futuri come non disponibili.
- [x] F10 Creare `risk-transparency.html`.
- [x] F11 Spiegare risk score, cap, liquidity e HF.
- [x] F12 Spiegare rendimento netto e fonti dei dati.
- [x] F13 Elencare rischi inevitabili.
- [x] F14 Creare `vision.html`.
- [x] F15 Spiegare le tre anime e la visione a cinque anni.
- [x] F16 Contestualizzare pagamenti/carte/credito come future services.
- [x] F17 Creare `roadmap.html`.
- [x] F18 Inserire criteri di uscita e dipendenze.
- [x] F19 Creare `security.html`.
- [x] F20 Separare controlli, assunzioni e responsabilità wallet.
- [x] F21 Dichiarare correttamente audit status.
- [x] F22 Creare `protocol.html`.
- [x] F23 Spiegare core, custody flow e 3 Musketeers.
- [x] F24 Descrivere integrazioni e deployment record.
- [x] F25 Creare `developers.html`.
- [x] F26 Inserire quick start, entry point, eventi e struttura frontend.
- [x] F27 Creare `docs.html`.
- [x] F28 Indicizzare pacchetto v0.1 e guide web.

## G. Dati strutturati

- [x] G01 Creare `site-content.json` con status vocabulary e principi.
- [x] G02 Creare `vaults.json` con matrice e stati.
- [x] G03 Creare `protocols.json` senza APY statici ingannevoli.
- [x] G04 Creare `roadmap.json` a orizzonti.
- [x] G05 Creare `deployments.json` dal manifest USDC.
- [x] G06 Aggiungere `recordedAt` e provenienza.
- [x] G07 Validare tutti i JSON.
- [x] G08 Evitare HTML interpolato da fonti esterne.

## H. Configurazione web3

- [x] H01 Creare `deployment-config.js` centralizzato.
- [x] H02 Inserire chain ID, RPC ed explorer Arbitrum.
- [x] H03 Inserire indirizzi PoC USDC dal manifest.
- [x] H04 Inserire base asset USDC e decimali 6.
- [x] H05 Rimuovere vecchi indirizzi ETH dai moduli attivi.
- [x] H06 Creare ABI ERC-20 minima.
- [x] H07 Creare ABI ProxyGeneral minima.
- [x] H08 Creare ABI LiquidityManager corrente.
- [x] H09 Creare ABI ValueCalculator minima.
- [x] H10 Creare ABI ProtocolManager minima.
- [x] H11 Documentare che ABI e deployment sono PoC-specific.
- [x] H12 Implementare validazione indirizzi/config.

## I. Infrastruttura web3

- [x] I01 Implementare loader Ethers v6 con singleton promise.
- [x] I02 Implementare provider read-only.
- [x] I03 Implementare rilevamento provider EIP-1193.
- [x] I04 Implementare connessione wallet esplicita.
- [x] I05 Implementare restore con `eth_accounts` senza popup.
- [x] I06 Implementare switch/add Arbitrum.
- [x] I07 Implementare listener account/chain una sola volta.
- [x] I08 Implementare disconnect locale.
- [x] I09 Implementare factory contratti read/write.
- [x] I10 Implementare snapshot pubblico del vault.
- [x] I11 Implementare snapshot utente.
- [x] I12 Implementare snapshot protocolli con fallback parziali.
- [x] I13 Restituire source/timestamp/error invece di zero silenzioso.
- [x] I14 Implementare refresh manuale.
- [x] I15 Implementare timeout/error handling RPC.

## J. Stime e validazioni

- [x] J01 Implementare parser importi senza floating point on-chain.
- [x] J02 Implementare stima share deposito coerente con accounting corrente.
- [x] J03 Implementare stima asset prelievo.
- [x] J04 Considerare depositFee e withdrawFee.
- [x] J05 Etichettare sempre le stime come indicative.
- [x] J06 Gestire supply/pool zero.
- [x] J07 Gestire arrotondamenti e importo minimo.
- [x] J08 Validare saldo base asset.
- [x] J09 Validare saldo share.
- [x] J10 Validare depositsEnabled/withdrawsEnabled.
- [x] J11 Non presentare min-out non garantiti.

## K. Transazioni utente

- [x] K01 Implementare transaction mutex contro doppio click.
- [x] K02 Implementare approval esatto USDC.
- [x] K03 Attendere receipt e ricontrollare allowance.
- [x] K04 Implementare revoca allowance a zero.
- [x] K05 Implementare deposito `deposit(uint256)`.
- [x] K06 Stimare gas prima dell'invio.
- [x] K07 Implementare prelievo con deadline.
- [!] K08 Fallback `withdraw(uint256)` non usato: `withdrawWithDeadline` è disponibile e preferibile nel deployment corrente.
- [x] K09 Implementare modal con riepilogo e contratto chiamato.
- [x] K10 Implementare stati awaiting wallet/pending/confirmed/failed.
- [x] K11 Decodificare errori comuni e user rejection.
- [x] K12 Collegare tx ad Arbiscan.
- [x] K13 Aggiornare snapshot dopo conferma.
- [!] K14 Non inviare transazioni mainnet durante i test automatici.
- [!] K15 Non esporre funzioni amministrative o chiamate dirette ai plugin.

## L. Storico e protocolli

- [x] L01 Implementare query eventi Deposit e Withdrawn.
- [x] L02 Usare filtri utente se disponibili.
- [x] L03 Limitare intervallo blocchi e gestire provider limits.
- [x] L04 Deduplicare e ordinare gli eventi.
- [x] L05 Formattare importi secondo base/share decimals.
- [x] L06 Mostrare link explorer.
- [x] L07 Mostrare protocolli registrati dal record locale.
- [x] L08 Tentare lettura live nomi/info/summary.
- [x] L09 Mostrare dati parziali senza fingere completezza.
- [x] L10 Separare protocol available da allocated.

## M. App PoC

- [x] M01 Creare header specifico con PoC warning.
- [x] M02 Mostrare stato read-only senza wallet.
- [x] M03 Mostrare source e timestamp.
- [x] M04 Mostrare pool value, supply, fee e pause.
- [x] M05 Mostrare saldo ETH gas, USDC, share e allowance.
- [x] M06 Creare tab Deposit.
- [x] M07 Creare tab Withdraw.
- [x] M08 Creare azione Revoke approval.
- [x] M09 Creare pannello protocolli.
- [x] M10 Creare storico transazioni.
- [x] M11 Disabilitare azioni su rete errata.
- [x] M12 Gestire wallet assente.
- [x] M13 Gestire RPC/CDN failure.
- [x] M14 Aggiungere disclaimer PoC/non audit.
- [x] M15 Evitare auto-refresh aggressivo.

## N. SEO, accessibilità e resilienza

- [x] N01 Title e description unici per pagina.
- [x] N02 Un solo H1 per pagina.
- [x] N03 Landmark e heading order coerenti.
- [x] N04 Skip navigation funzionante.
- [x] N05 Menu mobile accessibile.
- [x] N06 Form con label/error/help associati.
- [x] N07 Dialog con Escape e focus restore.
- [x] N08 `aria-live` per stato transazioni.
- [x] N09 Grafici accompagnati da testo.
- [x] N10 Reduced motion.
- [x] N11 Funzionamento informativo senza JavaScript essenziale.
- [x] N12 App contrassegnata `noindex` nel PoC.
- [x] N13 Nessun secret nel frontend.
- [x] N14 Link esterni sicuri.

## O. Verifica

- [x] O01 Verificare sintassi JSON.
- [x] O02 Verificare sintassi/import JavaScript.
- [x] O03 Verificare tutti i link e asset locali.
- [x] O04 Verificare assenza ID duplicati per pagina.
- [x] O05 Verificare assenza vecchi claim vietati nei nuovi file.
- [x] O06 Verificare assenza vecchi indirizzi ETH nei moduli attivi.
- [x] O07 Avviare server HTTP locale.
- [x] O08 Aprire tutte le pagine e controllare HTTP 200.
- [x] O09 Controllare landing desktop.
- [x] O10 Controllare landing mobile.
- [x] O11 Controllare App disconnessa.
- [x] O12 Controllare console browser per errori bloccanti.
- [x] O13 Verificare read-only RPC/bytecode ove disponibile.
- [x] O14 Eseguire compile/test Solidity proporzionati solo per regressione repository.
- [x] O15 Registrare limiti di verifica.

## P. Documentazione finale

- [x] P01 Aggiornare ogni checkbox con stato reale.
- [x] P02 Creare report di implementazione.
- [x] P03 Creare registro delle correzioni editoriali.
- [x] P04 Creare registro tecnico dei moduli web3.
- [x] P05 Creare guida avvio e deployment del sito.
- [x] P06 Creare guida di ogni modulo core/components/features.
- [x] P07 Creare guida di ogni modulo web3.
- [x] P08 Documentare aggiornamento indirizzi e ABI.
- [x] P09 Documentare aggiornamento vault/protocolli/roadmap.
- [x] P10 Documentare test sicuri senza transazioni mainnet.
- [x] P11 Creare indice generale dei documenti prodotti.

## Q. Controllo di completezza checklist

- [x] Q01 Confrontata con tutte le sezioni del piano espanso.
- [x] Q02 Aggiunta provenienza e timestamp dei dati, inizialmente non espliciti.
- [x] Q03 Aggiunta revoca allowance.
- [x] Q04 Aggiunta separazione “available” vs “allocated” per protocolli.
- [x] Q05 Aggiunto comportamento senza wallet e senza RPC.
- [x] Q06 Aggiunta compatibilità degli URL esistenti.
- [x] Q07 Aggiunta esclusione esplicita di transazioni automatiche mainnet.
- [x] Q08 Aggiunta esclusione delle funzioni amministrative dalla consumer app.
- [x] Q09 Aggiunta verifica dei vecchi indirizzi e claim.
- [x] Q10 Aggiunte guide per ogni famiglia di script.

## R. Chiusura e risultati

- [x] R01 Checklist riletta integralmente dopo l'implementazione.
- [x] R02 Confrontata nuovamente con il piano espanso.
- [x] R03 Verificati 18 moduli JavaScript e 5 JSON.
- [x] R04 Verificate 15 pagine HTML con il validatore dedicato.
- [x] R05 Verificati HTTP 200 per tutti gli entry point principali.
- [x] R06 Verificata landing desktop e mobile.
- [x] R07 Verificata console read-only con dati Arbitrum correnti.
- [x] R08 Verificato bytecode ai cinque indirizzi principali.
- [x] R09 Eseguito `npm run compile` senza regressioni.
- [x] R10 Prodotti report, registro correzioni, architettura, guida script e indice.

Esclusioni intenzionali: nessuna transazione mainnet di test; nessuna funzione amministrativa; nessuna chiamata consumer diretta ai plugin; nessuna modifica Solidity; nessun fallback withdraw senza deadline quando il metodo protetto è disponibile.


