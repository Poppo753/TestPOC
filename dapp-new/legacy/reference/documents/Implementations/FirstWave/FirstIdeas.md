## Analisi — Cosa Manca e Come Risolverlo

### Problemi Attuali

| Area | Problema | Impatto |
|------|----------|---------|
| **Prima impressione** | Nessuna landing page — l'utente atterra direttamente sul dashboard tecnico | Bounce rate altissimo, zero fiducia |
| **Identità protocollo** | Nessuna spiegazione di cosa fa Jethos, come funziona, perché usarlo | Un utente non capisce il valore in 5 secondi |
| **Plugin/moduli** | La documentazione esiste ma è nascosta in un link separato, senza contesto | La modularità (il vantaggio principale) è invisibile |
| **3D / Visual impact** | Video di sfondo generico — nessun elemento 3D interattivo, nessuna particella, nessun effetto WOW | Sembra un progetto hobbistico, non un protocollo serio |
| **Roadmap** | Assente | Gli investitori/utenti non sanno dove sta andando il protocollo |
| **Trust signals** | Nessun audit, nessuna metrica TVL prominente, nessun social proof | Zero credibilità |
| **Navigazione** | 4 pagine separate senza menu, senza coherenza | Esperienza frammentata |
| **Contenuto hardcodato** | Tutto nei file JS — difficile aggiornare testi, aggiungere notizie | Non scalabile |

---

## Proposta di Trasformazione

### Struttura Nuova — 6 Sezioni in una Landing Page + DApp

```
landing.html (NUOVA — homepage pubblica)
├── 1. HERO ─────────── 3D/WebGL, headline forte, CTA "Launch App"
├── 2. STATS BAR ────── TVL live, APY, # depositors (on-chain)
├── 3. HOW IT WORKS ─── 3 step animati (Deposit → Strategies → Earn)
├── 4. PLUGINS/MODULES ─ Showcase modulare interattivo  
├── 5. ROADMAP ──────── Timeline animata Q1-Q4 2026 + futuro
├── 6. ECOSYSTEM ────── Integrazioni (Uniswap, Morpho, ecc.)
├── 7. SECURITY ──────── Audit, open source, bug bounty
└── 8. FOOTER ────────── Social, docs, legal

index.html (rimane — App dashboard, raggiungibile da "Launch App")
documentation.html (rimane — API docs)
portfolio.html (rimane — portfolio view)
```

---

## Dettaglio per Ogni Sezione

### 1. HERO — Prima Impressione

**Cosa serve:**
- **Three.js** o **Spline 3D** embedded: una sfera ETH che ruota con particelle che orbitano attorno — tipo [Aave](https://aave.com) o [Euler Finance](https://euler.finance)
- Headline: *"The Modular ETH Yield Protocol on Arbitrum"*
- Sub-headline: *"Deposit ETH. Let Jethos allocate across battle-tested DeFi strategies automatically."*
- 2 CTA: `Launch App →` e `Read Docs`
- Contatore TVL animato in tempo reale (on-chain via ethers.js)

**Tecnologie da usare (zero build tools):**
```html
<!-- Three.js per WebGL 3D -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js">
<!-- oppure Spline embed che è più semplice -->
<script type="module" src="https://unpkg.com/@splinetool/viewer"></script>
<spline-viewer url="URL_SCENA_3D"></spline-viewer>
<!-- Vanta.js per particelle/waves 3D su sfondo -->
<script src="https://cdn.jsdelivr.net/npm/vanta/dist/vanta.waves.min.js">
```

---

### 2. STATS BAR — On-Chain in Tempo Reale

```
┌─────────────────────────────────────────────────────┐
│  💰 TVL: $2,847,392   │  📈 APY: 8.4%  │  👥 Users: 1,247  │
└─────────────────────────────────────────────────────┘
```

- Dati **live** da blockchain (stesso `web3.js` che già esiste)
- `AnimatedNumber` già implementato negli atoms — riutilizzabile
- Aggiornamento ogni 60s via `setInterval`
- Legge: `ValueCalculator.getTotalPoolValueView()` + Uniswap quoter

---

### 3. HOW IT WORKS — 3 Step Animati

```
[1]                    [2]                      [3]
Deposit ETH   ──→   Strategies Execute   ──→   Earn Yield
               
"You deposit ETH   "Jethos routes funds      "Withdraw anytime.
 and receive       via modular plugins        Your JHETH grows
 JHETH tokens"     (Morpho, GMX, Uniswap)"   in value"
```

- Animazione scroll-triggered (Intersection Observer API, nativa)
- Diagramma di flusso SVG animato con frecce (riutilizza `ConnectionArrow.js`)
- Spiega chiaramente la differenza rispetto a semplice staking

---

### 4. PLUGINS/MODULES SHOWCASE — Il Cuore del Protocollo

**Questo è il pezzo più importante** perché la modularità via Beacon è ciò che distingue Jethos da altri protocolli.

```
┌──────────────────── PLUGIN ECOSYSTEM ────────────────────┐
│                                                           │
│  [Morpho Plugin]    [GMX Plugin]    [Uniswap Plugin]     │
│  Vault yields       Perp hedging    Liquidity fees        │
│  Status: Active     Status: Active  Status: Coming Q3     │
│                                                           │
│  [Euler Plugin]     [+ Propose Plugin]                   │
│  Money markets      (governance)                          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Carousel/grid interattiva con hover 3D (CSS `perspective + rotateX/Y`)
- Ogni plugin: icona, nome, descrizione, status, link alla documentazione
- Spiega il sistema **Beacon** in termini non tecnici: *"Add new yield sources without changing the core contract"*
- Link diretto a `documentation.html` per i dettagli tecnici

---

### 5. ROADMAP — Timeline Animata

```
Q1 2026 ──●── Q2 2026 ────── Q3 2026 ─────── Q4 2026 ──── 2027+
[Completato]  [In corso]     [Pianificato]   [Pianificato]
                                  
✅ Core protocol    🔄 Morpho        ⏳ Governance     ⏳ Multi-chain   🚀 DAO
✅ Beacon system    🔄 GMX plugin     ⏳ veJHETH        ⏳ Optimism      🚀 L2 expansion
✅ Audit v1         🔄 UI v2          ⏳ Bug bounty     ⏳ Base          🚀 SDK pubblico
```

- Timeline orizzontale scrollabile (mobile: verticale)
- Scroll-reveal per ogni milestone
- Colori: verde (done) / blu-animato (in corso) / grigio (pianificato)
- File JSON esterno `roadmap.json` per aggiornare senza toccare HTML

---

### 6. SECURITY — Trust Signals

```
┌──────── SECURITY ────────┐────────── AUDIT ────────────┐
│ ✅ Audited by [Firm]      │  📄 Quantstamp Report PDF    │
│ ✅ Open source (GitHub)   │  📄 ABDK Report PDF          │
│ ✅ Bug bounty active      │                             │
│ ✅ Upgrades via Beacon    │  🔗 Etherscan Contracts      │
└──────────────────────────┘─────────────────────────────┘
```

- I report di audit esistono già in audits — da linkare
- Badge verificabili (link a Arbiscan per ogni contratto)
- Sezione "How we protect your funds"

---

## Tecnologie 3D Raccomandate (Zero Build Tools)

### Opzione A — **Vanta.js** (più semplice, impatto immediato)
```html
<script src="https://cdn.jsdelivr.net/npm/vanta/dist/vanta.waves.min.js"></script>
<!-- Crea onde 3D animate in WebGL sul background -->
<!-- Già compatibile con Three.js r134 da CDN -->
```
Effetti disponibili: `WAVES`, `NET`, `DOTS`, `RINGS`, `BIRDS`, `FOG`

### Opzione B — **Three.js + custom sphere** (più impatto, più controllo)
```html
<!-- Sfera ETH 3D che ruota, con wireframe + particelle orbitanti -->
<!-- ~150 righe vanilla JS, zero dipendenze extra -->
```

### Opzione C — **Spline** (più facile, designer-friendly)
```html
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.0.0/build/spline-viewer.js">
<spline-viewer url="..."></spline-viewer>
```

### Effetti CSS 3D per le card plugin (zero librerie):
```css
.plugin-card {
  transform-style: preserve-3d;
  transition: transform 0.3s;
}
.plugin-card:hover {
  transform: perspective(1000px) rotateX(5deg) rotateY(10deg) translateZ(20px);
}
```

---

## File da Creare / Modificare

| Azione | File | Cosa Fare |
|--------|------|-----------|
| **Creare** | `landing.html` | Homepage completa con tutte le sezioni |
| **Creare** | `roadmap.json` | Dati roadmap in JSON (facile da aggiornare) |
| **Creare** | `plugins.json` | Descrizioni plugin/moduli per la landing |
| **Modificare** | `index.html` | Aggiungere nav bar, cambiare hero, link ← landing |
| **Modificare** | `documentation.html` | Aggiungere nav bar e link ← landing |
| **Modificare** | `portfolio.html` | Aggiungere nav bar |
| **Creare** | `src/organisms/HeroSection.js` | Componente hero riutilizzabile |
| **Creare** | `src/organisms/PluginShowcase.js` | Grid plugin interattiva |
| **Creare** | `src/organisms/RoadmapTimeline.js` | Timeline animata |
| **Creare** | `src/organisms/NavBar.js` | Navigazione condivisa tra tutte le pagine |

---

## Priorità di Implementazione

```
FASE 1 (impatto max, tempo min):
├── NavBar condivisa su tutte le pagine
├── Landing page con Hero 3D (Vanta.js waves)
├── Stats bar on-chain live  
└── Plugin showcase statico

FASE 2 (contenuto e trust):
├── How it works animated
├── Roadmap timeline
└── Security/audit section

FASE 3 (polish):
├── Three.js sphere animata nel hero
├── Scroll animations (Intersection Observer)
└── Micro-interazioni sulle card
```