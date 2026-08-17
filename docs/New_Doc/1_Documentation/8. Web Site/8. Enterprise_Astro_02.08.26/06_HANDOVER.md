# Handover del progetto

## Obiettivo del progetto

Ricostruire `dapp-new/` in `jethos-web/` con Astro statico, TypeScript, design system, feature modulari, test e parità completa, mantenendo il legacy fino alla verifica finale.

## Stato attuale

COMPLETATO E VERIFICATO. M1-M6 e 33/33 task sono chiusi; resta soltanto la decisione operativa di cutover.

## Ultima milestone completata

M6 — Regressione globale, hardening, deploy e handover.

## Milestone corrente

Nessuna milestone in corso.

## Ultimo task completato

TASK-M6-F3-001 — Finalizzare documentazione e handover.

## Prossimo task da eseguire

Nessun task tecnico. Per pubblicare, seguire `jethos-web/docs/DEPLOYMENT.md` e mantenere il deployment precedente per rollback.

## File principali

- Legacy: `dapp-new/`.
- Prompt: `docs/New_Doc/1_Documentation/Prompt_BIG.md`.
- Documenti ufficiali: cartella corrente.
- Baseline visuale: `dapp-new/artifacts/enterprise-baseline/`.
- Target: `jethos-web/`; artifact: `jethos-web/dist/`.
- Review visuale: `jethos-web/artifacts/enterprise-final/`.
- Manuali as-built: `jethos-web/docs/`.

## Decisioni tecniche importanti

- Target parallelo `jethos-web/`.
- Astro statico + TypeScript; Vanilla TS client.
- Nessun React/SPA di default.
- Content Collections locali con adapter CMS futuro.
- Dati blockchain critici fuori dal CMS.
- Parità prima della pulizia CSS/DOM.
- Node 22.12+ e Astro 7; non ripristinare Astro 5, scartato dopo security audit.
- Docs precompilata in 13 route statiche; il dialog è enhancement e non interpreta Markdown runtime.

## Configurazione necessaria

Node 22.12+ per il target; sull'host corrente usare temporaneamente `npx --yes --package=node@22.23.2 node <cli>`. Edge/Chrome per E2E.

## Comandi principali

Da `dapp-new/`: gate legacy. Da `jethos-web/`: `npm run check:parity`, `npm run check`, `npm run lint`, `npm run test`, `npm run build` con Node 22.12+; `npm run sync:legacy` aggiorna le fonti controllate.

## Test attualmente superati

Installazione pulita Node 22.23.2; audit zero; parity su 58 file e quattro redirect; Astro check 0/0/0; lint e format; 50/50 unit; build di 33 pagine più alias Demo con 34 URL obbligatori; CSP, budget e manifest; Playwright 104 passed e quattro skip intenzionali su 108.

## Test ancora da eseguire

Nessun gate automatico richiesto. Prima del cutover eseguire smoke sulla preview reale e approvazione visuale umana; le transazioni mainnet restano escluse per sicurezza.

## Problemi aperti

`check:content` legacy include `artifacts/orbit-review/preview.html`, problema preesistente non replicato nel target. Hosting e CMS non sono stati scelti.

## Blocchi

Nessuno.

## Attenzioni per la prossima sessione

Leggere README e `jethos-web/docs/DEPLOYMENT.md`. Non modificare le altre modifiche utente presenti nel worktree. Non sostituire l'adapter editoriale o rimuovere i bridge hash-verificati senza nuovi test/parity; non inserire autenticazione o segreti nel client.
