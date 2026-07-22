# Report fase 1 — architettura

## Esito

La seconda iterazione separa il sito editoriale, la console PoC e gli strumenti operativi senza introdurre un framework o una pipeline non necessaria. L'architettura resta statica, ispezionabile e distribuibile su qualsiasi hosting HTTP, ma non concentra più l'intera App in un solo controller.

## Cosa è cambiato

- `assets/js/app/controller.js` coordina soltanto avvio, eventi e refresh.
- `dom.js`, `renderers.js`, `forms.js` e `workflow.js` separano accesso al DOM, presentazione, stato dei form e transazioni.
- Il vecchio `web3/app-controller.js` rimane come shim deprecato per compatibilità.
- `data-hydrator.js` usa i JSON locali come progressive enhancement, con timeout e fallback HTML.
- Il validatore confronta anche il deployment JavaScript con il manifest JSON.
- `check-deployment.mjs` e `inspect-protocols.mjs` rendono ripetibili le verifiche read-only.
- `_headers.example` fornisce una baseline di header di sicurezza da adattare all'hosting.

## Decisioni riesaminate

Non è stato introdotto React/Vite: per sedici pagine prevalentemente statiche avrebbe aumentato dipendenze e superficie di manutenzione senza un beneficio proporzionato. Non sono state aggiunte scritture dirette verso plugin: il modello corretto mantiene LiquidityManager/core Jethos come confine utente e tratta plugin e lens come infrastruttura osservabile.

## Sicurezza

Le CLI non acquisiscono signer, seed o private key. Le scritture browser restano approval esatto, revoke, deposit e withdraw attraverso i contratti core configurati. Prima di un rilascio pubblico restano comunque necessari audit indipendente, verifica dei deployment e configurazione reale degli header sul provider.

## Verifica

- sintassi dei moduli: superata;
- validazione sito/configurazione: superata;
- bytecode e letture live Arbitrum: superate;
- quattro integrazioni attive ispezionate senza errori;
- test HTTP delle pagine e della App: superato.

