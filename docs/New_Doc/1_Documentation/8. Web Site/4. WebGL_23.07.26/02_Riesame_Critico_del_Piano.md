# Riesame critico del piano WebGL

## Correzioni applicate

### Non usare EffectComposer nella prima release

Bloom e post-processing aumentano memoria e render target. L'identità desiderata può essere ottenuta con materiali emissivi, alpha e additive blending. EffectComposer resta una possibile evoluzione dopo misurazioni reali.

### Non creare tredici renderer diversi

Un renderer e primitive condivise, configurate da manifest, riducono bug e GPU context pressure. Ogni pagina crea comunque una sola istanza durante la propria visita.

### Non rendere il canvas cliccabile

Raycasting e controlli 3D nascosti penalizzerebbero accessibilità. Le interazioni arrivano da controlli HTML visibili; canvas e scena rimangono `pointer-events:none`.

### Non collegare il minigioco a dati o wallet reali

Roadmap usa evidenza didattica e stato di sessione. Nessuna firma, ricompensa, classifica o risultato economico.

### Non mantenere 60 FPS quando non serve

High usa fino a 60 FPS; medium 45; low 30; static renderizza un frame. Il loop viene sospeso su tab nascosta.

### Non mettere WebGL pesante nella App

La console deve conservare priorità visiva su rete, importo, allowance e conferme. La scena App usa pochi oggetti, bassa opacità e si ferma quando il documento apre dialog o perde visibilità.

## Strategia finale approvata

Progressive enhancement, Three.js core pinned, scene manifest-driven, controllo DOM accessibile, qualità adattiva, lifecycle completo e minigioco separato dalle operazioni finanziarie.

