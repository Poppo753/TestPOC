# Piano espanso WebGL2

## 1. Obiettivo e criteri di successo

L'obiettivo non è “avere più 3D”, ma costruire pochi momenti tridimensionali riconoscibili, professionali e funzionali al racconto. La consegna è accettabile quando:

- header, menu, CTA, PoC e link restano sempre cliccabili;
- ogni pagina attiva ha una silhouette e un movimento diversi;
- le pagine non attive non scaricano Three.js;
- la disattivazione via `?webgl=off` lascia un fallback intenzionale;
- `prefers-reduced-motion` produce una composizione statica;
- il canvas non è mai l'unico modo per ottenere informazioni;
- lo stato WebGL non rappresenta saldo, APY o sicurezza reali;
- il renderer si ferma fuori viewport e a tab nascosta;
- resize e teardown non lasciano listener o GPU resource.

## 2. Correzione strutturale

### 2.1 Header

Il wrapper `data-site-header` deve possedere un livello globale superiore al main. Il precedente `z-index: 1` assegnato sia al wrapper sia al main creava stacking context fratelli: il main, successivo nel DOM, poteva intercettare input nella zona del fixed header. La correzione assegna livelli nominali separati e rende il canvas full-screen non interattivo.

### 2.2 Scope del renderer

Viene eliminato il vecchio stage condiviso da tutte le pagine e viene scartata anche la successiva presentazione “canvas in una card”. Ogni pagina autorizzata possiede un background `position: fixed; inset: 0`, con factory unica, gradienti di leggibilità e `pointer-events: none`. Header e contenuti restano in stacking context superiori.

### 2.3 Progressive enhancement

Il markup contiene host, controlli semantici e fallback CSS. Titoli e descrizioni principali restano nel page hero e non vengono duplicati in un pannello WebGL. JavaScript aggiunge il canvas soltanto dopo i controlli di supporto. Un errore di CDN non rimuove o oscura nulla.

## 3. Scene

### 3.1 Ownership Core — Home

Composizione:

- nucleo wallet mint a sinistra, formato da shell metallica e core luminoso;
- anello amber al centro come soglia di autorizzazione;
- vault viola traslucido a destra con camere interne;
- tre ribbon di capitale che restano nel wallet fino all'attivazione;
- un singolo impulso attraversa il gate e raggiunge il vault.

Movimento:

- respirazione molto lenta del core;
- anello di autorizzazione quasi fermo;
- trasferimento periodico breve, seguito da pausa;
- parallasse massima di pochi gradi;
- nessuna pioggia di particelle.

Interazione HTML: un controllo “Replay capital path” riavvia la sequenza; la legenda spiega wallet, authorization e vault.

### 3.2 Capital Journey — How it works

Composizione:

- quattro stazioni su una curva pulita;
- una capsula rappresenta il capitale;
- una parete amber separa Hold e Authorize;
- Deposit entra in una camera viola;
- Withdraw inverte il percorso.

Interazione HTML: quattro pulsanti step selezionabili da tastiera cambiano il focus. Il testo è la fonte informativa; il 3D è una rappresentazione.

### 3.3 Transparent Stack — Protocol

Composizione:

- quattro piastre fisiche sovrapposte;
- bordi e materiali specifici per ruolo;
- connettori verticali;
- moduli Registry, Plugin e Lens come tre blocchi laterali;
- modalità esplosa con distanze leggibili.

Interazione HTML: pulsanti per selezionare i layer. Il layer selezionato sale e si illumina mentre gli altri vengono attenuati.

### 3.4 Evidence Reactor — Roadmap

Composizione:

- quattro gate disposti in profondità;
- un core che avanza esclusivamente quando viene scelta un'evidenza corretta;
- archi completati solidi e luminosi;
- milestone future presenti ma fredde;
- completamento con stabilizzazione dell'intera struttura, non fuochi d'artificio.

Il gioco rimane privo di wallet, token, score finanziario e ricompense. Session storage conserva solo il gate corrente.

## 4. Rendering e art pipeline

### 4.1 Implementazione immediata

La prima versione professionale usa geometrie solide procedurali, `MeshStandardMaterial`/`MeshPhysicalMaterial`, luci direzionali e area-like, fog leggero e tone mapping. Questo elimina subito l'aspetto da debug e crea una base verificabile senza introdurre asset binari improvvisati.

### 4.2 Evoluzione Blender

Dopo approvazione delle composizioni:

1. creare concept frame 16:9 e mobile;
2. modellare Ownership Core, Authorization Gate, Vault Chamber e Protocol Plates;
3. usare UV e texture solo dove aggiungono dettaglio percepibile;
4. esportare GLB con nomi di nodo stabili;
5. comprimere mesh e texture dopo misurazione, non per abitudine;
6. conservare geometrie procedurali come fallback.

Unity o Unreal rimangono fuori dal runtime principale. Possono essere valutati soltanto per un'esperienza standalone futura.

## 5. Prestazioni

Budget iniziale:

- una sola istanza di renderer per pagina;
- DPR massimo 1.5 desktop, 1.2 medio, 1 low;
- 60/45/30 fps secondo qualità;
- nessuna shadow map nella baseline;
- geometrie condivise dove possibile;
- pausa tramite IntersectionObserver e visibility state;
- resize con ResizeObserver sul container;
- zero rendering nelle pagine senza scena.

Un contatore diagnostico opzionale, attivato da `?webglDebug=1`, espone scena, profilo, frame rate campionato, draw calls e triangoli senza contaminare l'interfaccia normale.

## 6. Accessibilità

- canvas `aria-hidden=true` e `tabindex=-1`;
- controlli in HTML nativo;
- focus visibile;
- stato del gioco comunicato con `aria-live`;
- reduced motion: nessun loop continuo, rendering singolo;
- fallback sempre visibile se il renderer fallisce;
- contrasto testuale indipendente dal canvas.

## 7. Ordine di esecuzione revisionato

1. acquisire baseline e correggere stacking;
2. ridurre il manifest alle quattro pagine;
3. creare viewport HTML e fallback;
4. rifare runtime e lifecycle;
5. implementare libreria materiali/luci;
6. implementare Home e verificarla;
7. implementare How e Protocol;
8. integrare Roadmap game con la scena dedicata;
9. rimuovere attributi e controlli WebGL dalle altre pagine;
10. estendere validatori e release gate;
11. test statici, browser e responsive;
12. aggiornare checklist e documentare.

Questo ordine evita di costruire nuove scene sopra il bug globale e permette di interrompere in sicurezza a ogni gate.
