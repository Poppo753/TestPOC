# Fase 1 — piano architetturale espanso e riesaminato

## 1. Sequenza

1. Fotografare comportamento corrente con validatore, screenshot e RPC.
2. Estrarre primitive DOM senza cambiare il contratto della pagina.
3. Estrarre renderer puri.
4. Estrarre form/preview.
5. Estrarre workflow transazionali.
6. Ridurre controller a lifecycle e coordinamento.
7. Aggiungere data hydrator con fallback.
8. Aggiungere CLI di deployment e protocolli.
9. Estendere validatore con consistenza deployment.
10. Aggiungere esempio header sicurezza.
11. Ripetere test statici, browser e live read.

## 2. Decisioni riesaminate

### Non introdurre React

La App non ha ancora una complessità di stato che giustifichi framework, bundler e pipeline. La separazione in servizi risolve il problema immediato ed evita di accoppiare il sito pubblico a una toolchain.

Decisione: mantenuta.

### Non spostare tutti i file legacy

I vecchi `src/`, JSON/API reference e video non sono referenziati dai nuovi entry point. Spostarli ora creerebbe rischio e un diff distruttivo non necessario.

Decisione: lasciarli intatti e documentarli come legacy non attivo.

### Non rendere il JSON l'unico contenuto

Una pagina vuota se fetch fallisce sarebbe peggiore della duplicazione controllata. L'HTML resta fallback; il validatore e l'hydrator riducono divergenze.

Decisione: strategia ibrida mantenuta.

### CLI soltanto read-only

Una suite operator con write verso plugin richiederebbe chiavi, policy, simulazione e approvazione multisig. Non appartiene al sito né alla consumer App.

Decisione: CLI diagnostica read-only; write consumer soltanto tramite LiquidityManager.

### Ethers CDN

Vendorizzare Ethers migliorerebbe resilienza/CSP, ma copiare manualmente un bundle in questa iterazione rende gli aggiornamenti opachi. La dipendenza viene isolata e documentata; una futura pipeline potrà bundlarla.

Decisione corretta: mantenere CDN, aggiungere CSP example e failure state.

## 3. Acceptance criteria

- controller App sotto circa 100 righe di responsabilità orchestrativa;
- nessun markup dinamico non sicuro da dati RPC;
- ogni renderer testabile tramite DOM;
- JSON hydrator fallisce senza cancellare fallback;
- due CLI funzionano senza wallet/private key;
- config JS e JSON confrontate dal validatore;
- stessi dati live della baseline;
- nessun cambiamento agli entry point transazionali.

