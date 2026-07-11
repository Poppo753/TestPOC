# 🎨 Style Guide - Presentazione Progetto

> Guida completa per design, colori, font e visual consistency della presentazione.

---

## 📋 Indice

1. [Palette Colori](#palette-colori)
2. [Typography](#typography)
3. [Layout Grid](#layout-grid)
4. [Iconografia](#iconografia)
5. [Grafici e Diagrammi](#grafici-e-diagrammi)
6. [Immagini e Mockup](#immagini-e-mockup)
7. [Animazioni](#animazioni)
8. [Do's and Don'ts](#dos-and-donts)

---

## 🎨 Palette Colori

### Colori Primari

| Nome | HEX | RGB | Uso |
|------|-----|-----|-----|
| **Brand Primary** | `#0EA5E9` | rgb(14, 165, 233) | CTA, elementi chiave, link |
| **Brand Secondary** | `#22C55E` | rgb(34, 197, 94) | Positivo, crescita, conferme |
| **Brand Dark** | `#0F172A` | rgb(15, 23, 42) | Sfondo scuro, testi heading |
| **Brand Light** | `#F8FAFC` | rgb(248, 250, 252) | Sfondo chiaro, card |

### Colori Semantici

| Nome | HEX | Uso |
|------|-----|-----|
| **Success/Positive** | `#22C55E` | Rendimenti, conferme, check ✅ |
| **Warning/Medium** | `#EAB308` | Risk medio, attenzione |
| **Danger/High** | `#EF4444` | Perdite, risk alto, errori |
| **Info** | `#3B82F6` | Informazioni, note |

### Gradienti

```css
/* Sfondo slide PROBLEMA (scuro) */
background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);

/* Sfondo slide SOLUZIONE (positivo) */
background: linear-gradient(135deg, #0F172A 0%, #064E3B 100%);

/* Sfondo slide VISION (ambizioso) */
background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%);

/* Sfondo slide TECH (neutro) */
background: linear-gradient(135deg, #111827 0%, #1F2937 100%);
```

### Applicazione per Sezione

| Sezione | Sfondo | Accento |
|---------|--------|---------|
| 1. Problema | Scuro + rosso | `#EF4444` |
| 2. Soluzione | Scuro + verde | `#22C55E` |
| 3. Vision | Viola/blu | `#8B5CF6` |
| 4. Roadmap | Blu | `#0EA5E9` |
| 5. Architettura | Grigio tech | `#64748B` |
| 6. Business | Verde money | `#22C55E` |
| 7. Stato | Blu progress | `#3B82F6` |
| 8. Team | Neutro caldo | `#F59E0B` |
| 9. Financials | Verde/oro | `#22C55E` + `#EAB308` |
| 10. Closing | Brand primary | `#0EA5E9` |

---

## 📝 Typography

### Font Stack

```css
/* Titoli principali */
font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
font-weight: 700;

/* Sottotitoli e body */
font-family: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
font-weight: 400-500;

/* Code/Technical */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
font-weight: 400;
```

### Dimensioni

| Elemento | Size | Weight | Line Height |
|----------|------|--------|-------------|
| Titolo Slide | 48-56px | 700 (Bold) | 1.1 |
| Sottotitolo | 24-28px | 500 (Medium) | 1.3 |
| Body Text | 18-20px | 400 (Regular) | 1.5 |
| Caption | 14-16px | 400 | 1.4 |
| Label/Badge | 12-14px | 600 (Semibold) | 1.2 |
| Code | 14-16px | 400 | 1.4 |

### Gerarchia Esempio

```
[FASE 1] Le fondamenta                    ← Badge 14px + Titolo 48px
Pool multi-asset con stratificazione     ← Sottotitolo 24px
del rischio

• Arbitrum ✅ (first)                     ← Body 18px
• Optimism 📋
```

---

## 📐 Layout Grid

### Struttura Base Slide

```
┌────────────────────────────────────────────────────────────────┐
│  MARGIN: 40-60px                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HEADER ZONE (15%)                                       │  │
│  │  Titolo + Sottotitolo                                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  CONTENT ZONE (70%)                                      │  │
│  │  Griglia 12 colonne                                      │  │
│  │                                                          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  FOOTER ZONE (15%)                                       │  │
│  │  CTA, metriche, note                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Proporzioni Comuni

| Layout | Colonna Sinistra | Colonna Destra |
|--------|------------------|----------------|
| Testo + Visual | 40% | 60% |
| Visual + Testo | 60% | 40% |
| 50/50 | 50% | 50% |
| Full Width | 100% | - |
| 3 Colonne | 33% | 33% | 33% |

### Spacing

```
SPACING SCALE:
- xs: 8px   (tra elementi inline)
- sm: 16px  (tra elementi correlati)
- md: 24px  (tra gruppi)
- lg: 40px  (tra sezioni)
- xl: 60px  (margin esterno)
```

---

## 🔣 Iconografia

### Stile Icone

- **Stile**: Line icons o filled minimal
- **Peso linea**: 1.5-2px
- **Dimensioni**: 24px (inline), 32-48px (standalone), 64-96px (hero)
- **Fonte consigliata**: Lucide Icons, Heroicons, Phosphor Icons

### Icone per Sezione

| Concetto | Emoji/Icon | Alternativa SVG |
|----------|------------|-----------------|
| Banca | 🏦 | `building-2` |
| DeFi | 📊 | `chart-bar` |
| Sicurezza | 🛡️ | `shield-check` |
| Wallet | 🔐 | `wallet` |
| Rendimento | 📈 | `trending-up` |
| Perdita | 📉 | `trending-down` |
| Check | ✅ | `check-circle` |
| Warning | ⚠️ | `alert-triangle` |
| In corso | 🔨 | `hammer` |
| Pianificato | 📋 | `clipboard-list` |
| Gas | ⛽ | `fuel` |
| Bridge | 🌉 | `git-branch` |
| Time | ⏱️ | `clock` |
| Euro | 💶 | `euro` |
| Dollar | 💵 | `dollar-sign` |
| NFT/Casa | 🏠 | `home` |

### Risk Levels

| Livello | Colore | Icona |
|---------|--------|-------|
| Low | 🟢 `#22C55E` | `shield` |
| Medium | 🟡 `#EAB308` | `alert-circle` |
| High | 🔴 `#EF4444` | `alert-triangle` |

---

## 📊 Grafici e Diagrammi

### Stile Generale

- **Sfondo grafico**: Trasparente o leggermente più scuro dello sfondo slide
- **Linee griglia**: Sottili, colore `#334155` (quasi invisibili)
- **Etichette**: Font 14px, colore `#94A3B8`
- **Bordi**: Arrotondati (border-radius: 8px per bar, 4px per elementi piccoli)

### Line Chart

```css
/* Linea positiva (rendimento) */
stroke: #22C55E;
stroke-width: 3px;

/* Linea negativa (perdita) */
stroke: #EF4444;
stroke-width: 3px;

/* Linea neutra */
stroke: #64748B;
stroke-width: 2px;
stroke-dasharray: 5, 5;
```

### Bar Chart

```css
/* Bar primaria */
fill: #0EA5E9;
border-radius: 4px 4px 0 0;

/* Bar comparativa */
fill: #64748B;
opacity: 0.6;
```

### Pie/Donut Chart

```css
/* Palette pie chart */
slice-1: #22C55E;  /* 40% */
slice-2: #1E3A8A;  /* 25% */
slice-3: #0EA5E9;  /* 20% */
slice-4: #8B5CF6;  /* 15% */

/* Donut hole */
inner-radius: 60%;
```

### Diagrammi Architettura

```css
/* Box contratto */
background: #1E293B;
border: 1px solid #334155;
border-radius: 8px;
padding: 16px;

/* Box attivo/highlight */
border: 2px solid #0EA5E9;
box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);

/* Linee connessione */
stroke: #64748B;
stroke-width: 2px;

/* Frecce */
fill: #64748B;
```

---

## 🖼️ Immagini e Mockup

### Mockup App

**Stile raccomandato**:
- Frame iPhone 14/15 Pro (bordi sottili, notch/dynamic island)
- Sfondo app: Scuro (`#0F172A`) per coerenza
- UI elements: Seguire palette colori
- Saldo/numeri: Font bold, colore `#F8FAFC`
- CTA buttons: `#0EA5E9` con bordi arrotondati

**Placeholder da sostituire**:
```
[MOCKUP_APP_DASHBOARD] → Screenshot reale quando disponibile
[MOCKUP_APP_DEPOSIT] → Screenshot flusso deposito
[MOCKUP_CARD] → Render carta di credito branded
```

### Immagini Stock

**Temi ricerca**:
- "fintech abstract" per sfondi
- "blockchain visualization" per tech
- "people using phone banking" per lifestyle
- "city skyline night" per vision/ambizione

**Trattamento**:
- Overlay scuro 60-80% per usare come sfondo
- Desaturare leggermente per non distrarre
- Blur leggero se troppo dettagliate

---

## 🎬 Animazioni

### Timing

| Tipo | Durata | Easing |
|------|--------|--------|
| Fade in elementi | 300-400ms | ease-out |
| Slide in | 400-500ms | ease-out |
| Highlight/glow | 200ms | ease-in-out |
| Draw line | 800-1000ms | linear |
| Counter (numeri) | 1000-1500ms | ease-out |

### Transizioni Slide

- **Fade**: Default tra slide simili
- **Slide Left**: Progressione timeline
- **Zoom**: Approfondimento (overview → dettaglio)

### Animazioni Elementi

| Elemento | Animazione Suggerita |
|----------|---------------------|
| Bullet points | Fade in uno alla volta (200ms delay) |
| Grafici | Draw lines progressivamente |
| Numeri/metriche | Counter da 0 al valore |
| Box/Card | Scale in da 0.95 a 1 + fade |
| Timeline | Reveal da sinistra a destra |
| Diagrammi | Elementi appaiono in ordine logico |

---

## ✅ Do's and Don'ts

### ✅ DO

- **Consistenza**: Usare sempre gli stessi colori per gli stessi concetti
- **Gerarchia**: Titolo > Sottotitolo > Body sempre distinguibili
- **Spazio bianco**: Lasciare respiro tra elementi
- **Allineamento**: Griglia consistente, elementi allineati
- **Contrasto**: Testo sempre leggibile sullo sfondo
- **Focus**: Un messaggio principale per slide
- **Numeri**: Grandi e in evidenza quando sono il punto

### ❌ DON'T

- ~~Troppo testo~~ (max 6-7 bullet points)
- ~~Font diversi~~ (stick to 1-2 font families)
- ~~Colori random~~ (usa solo palette definita)
- ~~Immagini pixelate~~ (min 2x resolution)
- ~~Animazioni eccessive~~ (distraggono)
- ~~Gradienti clash~~ (un gradiente per slide)
- ~~Informazioni dense~~ (split in più slide se necessario)

---

## 📏 Checklist Pre-Export

Per ogni slide verificare:

- [ ] Titolo presente e leggibile
- [ ] Colori coerenti con sezione
- [ ] Font size appropriati (no testo troppo piccolo)
- [ ] Allineamento su griglia
- [ ] Contrasto sufficiente (WCAG AA)
- [ ] Immagini/icone ad alta risoluzione
- [ ] Placeholder sostituiti con dati reali
- [ ] Animazioni testate

---

## 🔧 Tools Consigliati

| Uso | Tool |
|-----|------|
| Slide creation | Figma, PowerPoint, Google Slides, Keynote |
| Mockup app | Figma, Sketch, Framer |
| Grafici | Chart.js, Recharts, o built-in tool |
| Icone | Lucide, Heroicons, Phosphor |
| Colori | Coolors.co, ColorHunt |
| Font | Google Fonts (Inter) |
| Export | PDF per share, PPTX per edit |

---

*Ultimo aggiornamento: Gennaio 2026*
