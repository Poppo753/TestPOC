# Report implementazione WebGL

## Risultato

È stato implementato un sottosistema 3D condiviso e progressive-enhancement su tredici entry point attivi. Non è un insieme di sfondi indipendenti: tutte le scene derivano dallo stesso capital world wallet → gate → vault → protocolli → prova.

## Componenti

- Three.js `0.185.1` importato dinamicamente e pinned.
- Capability detection e fallback dichiarato nel dataset HTML.
- Quality budget `static/low/medium/high`.
- DPR massimo 1.5, particelle 90–420, FPS 1–60.
- FPS limitati a 24–30 per App, FAQ, Docs, Developers e Trust.
- Un renderer e un animation loop per pagina.
- Sospensione su tab nascosta e durante il modal di conferma App.
- Teardown di geometrie, materiali, renderer e WebGL context.
- Controlli HTML accessibili separati dal canvas.

## Scene

- Home: capitale parzialmente trasferito attraverso il gate.
- How it works: progressione card-driven.
- Vaults: profili che modificano complessità e struttura.
- Risk: slider illustrativi concentration/liquidity/complexity.
- Trust: topology a densità e motion ridotti.
- Protocol: architettura che si separa al focus.
- Security: quattro shock simulati e defense rings.
- Roadmap: Proof Path a cinque gate.
- Vision: espansione scroll-driven.
- Developers: trace di read/approve/deposit/withdraw.
- Docs: graph leggero e focus dei documenti.
- FAQ: pulse minimo all'apertura.
- App: preview importo, bassa densità e pausa durante conferma.

## Sicurezza e contenuto

Il canvas è `aria-hidden` e `pointer-events:none`. Non legge chiavi, non accede a wallet, non invia transazioni e non modifica il flusso Web3. Controlli Risk e Proof Path sono marcati illustrativi. Il minigioco non contiene punteggio, reward o connessione wallet.

## Decisione prestazionale

EffectComposer e bloom multipass sono stati esclusi: il risultato usa wireframe, alpha e additive blending senza render target aggiuntivi. Potranno essere valutati solo dopo budget prestazionale su dispositivi reali.

