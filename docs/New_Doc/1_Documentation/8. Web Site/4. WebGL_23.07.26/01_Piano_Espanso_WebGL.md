# Piano espanso WebGL

## 1. Fondazioni

### 1.1 Loader

Caricare Three.js solo dopo DOM ready, soltanto se la pagina dichiara una scena e soltanto se WebGL è disponibile. La versione deve essere pinned (`0.185.1`) per evitare rotture silenziose. Un timeout o errore CDN deve lasciare intatto il fallback CSS.

### 1.2 Quality manager

Classificare l'ambiente in `static`, `low`, `medium`, `high` usando reduced motion, Save-Data, viewport, device memory e logical cores. Limitare DPR, particelle e geometrie. Mobile non deve eseguire la stessa scena desktop ridotta soltanto in pixel: deve avere meno oggetti e animazioni.

### 1.3 Lifecycle

Usare un solo animation loop per pagina. Sospendere su `visibilitychange`. Ridurre aggiornamenti quando il canvas non contribuisce. Liberare renderer, geometrie e materiali durante teardown. Reagire a resize senza allocare continuamente.

### 1.4 Accessibilità

Canvas decorativo con `aria-hidden`. Tutti i controlli restano button/input HTML. Reduced motion produce una composizione ferma. La pagina non dipende da hover o pointer precision.

## 2. Motore visuale

### 2.1 Primitive condivise

- wallet core: sfera/icosaedro mint;
- authorization gate: torus amber;
- vault: struttura wireframe violet;
- protocol node: nodi cyan;
- capital particles: Points con distribuzione deterministica;
- route: curve o linee con impulsi;
- risk wave: ring o distorsione spaziale;
- proof pulse: espansione cyan breve.

### 2.2 Scene manifest

Una configurazione per pagina definisce camera, densità, palette, layout, velocità e comportamento scroll. Il codice geometrico resta condiviso.

### 2.3 Interaction bridge

Il DOM emette eventi semantici: `focus-step`, `set-risk`, `select-vault`, `simulate-threat`, `roadmap-gate`, `preview-amount`. La scena non conosce classi CSS o form Web3.

## 3. Scene immersive

### Home

Il rapporto visuale deve mostrare più capitale nel wallet che nel vault. Lo scroll sposta una frazione delle particelle attraverso il gate. Mouse/touch influenzano la camera entro pochi gradi. Nessun autoplay rapido.

### How it works

Quattro card diventano trigger accessibili. Il focus sposta camera e particella guida. Il withdrawal inverte la route.

### Roadmap

Proof Path ha cinque gate: deployment, accounting, integrations, safety, readiness. Il giocatore seleziona l'evidenza corretta. Nessun timer, punteggio o wallet. Il completamento illumina il percorso e salva solo la progressione della sessione.

## 4. Scene interattive

### Vaults

Controlli Conservative/Balanced/Advanced cambiano densità delle route e stabilità della struttura. Le famiglie non live restano trasparenti.

### Risk

Slider illustrativi per concentration, liquidity e complexity. La topologia reagisce ma i valori non vengono presentati come calcolo finanziario.

### Protocol

Hover/focus sui ruoli separa core, plugin e lens. La route consumer termina sul core, non espone write dirette ai plugin.

### Security

Bottoni simulano key compromise, stale oracle, pause e liquidity shock. Gli anelli mostrano quali confini vengono attraversati.

### Vision

Lo scroll espande uno, tre e poi più nodi. Planned e Vision usano opacità ridotta e non sembrano live.

## 5. Scene sobrie

Trust reagisce ai dati idratati con un solo pulse. Developers anima deposit/withdraw/read. Docs crea un graph stabile. FAQ usa prevalentemente CSS; il canvas reagisce appena all'apertura. App mostra un capital preview dietro il form, con loop limitato e fermo durante conferma.

## 6. CSS e compositing

Canvas fixed dietro al contenuto, gradient mask per preservare leggibilità e pointer-events disabilitati. Sezioni interattive usano pannelli HTML. Evitare mix-blend-mode aggressivo, blur estesi e bloom multipli.

## 7. Verifica

- sintassi e manifest;
- fallback con import fallito;
- HTTP desktop/mobile;
- reduced motion;
- resize e tab visibility;
- nessun errore console;
- assenza overflow;
- App e transazioni non modificate semanticamente;
- release readiness ancora superata.

## 8. Ordine di implementazione

1. Manifest e documentazione.
2. Loader/quality/lifecycle.
3. Primitive e scena base.
4. Home.
5. Bridge e scene di pagina.
6. Roadmap game.
7. App integration.
8. Validatori.
9. Screenshot e performance audit.
10. Guide finali.

