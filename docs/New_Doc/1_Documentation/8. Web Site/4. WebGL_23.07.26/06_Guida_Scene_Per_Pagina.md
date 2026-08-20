# Guida scene per pagina

## Montaggio

Una pagina attiva una scena dichiarando:

```html
<body data-page="risk" data-webgl-scene="risk">
```

Deve già caricare `site-features.js`. Redirect e pagine legacy non devono dichiarare scene.

## Home — `capital`

Il world è spostato verso destra e mascherato dietro il copy. Scroll trasferisce gradualmente una frazione delle particelle. Non aumentare l'opacità senza ricontrollare il contrasto della hero.

## How it works — `journey`

Le `.flow-step` cambiano progress al focus e hover. Keyboard focus produce lo stesso comportamento del mouse.

## Vaults — `vaults`

`data-scene-profile` imposta Conservative/Balanced/Advanced. La scena cambia complessità, rischio, scala e densità percepita; non calcola rendimento.

## Risk — `risk`

Gli slider `data-scene-risk="risk|liquidity|complexity"` producono valori 0–1. La UI deve continuare a dichiarare che è un modello illustrativo.

## Trust — `trust`

La scena ha densità e FPS bassi. L'evento `jethos:data-hydrated` genera un solo proof pulse dopo il caricamento delle fonti.

## Protocol — `protocol`

Focus su layer e card modifica separazione dei moduli e progressione del capitale. La rappresentazione mantiene il core come consumer boundary.

## Security — `security`

I quattro `data-scene-threat` cambiano intensità degli anelli. Il visual non è un penetration test né una prova di resilienza.

## Roadmap — `roadmap`

Il minigioco viene inserito dopo la hero. Il world si illumina a ogni gate. La timeline normale resta disponibile sotto, anche senza WebGL.

## Vision — `vision`

Timeline e flow spostano progress; nodi e frame si espandono con lo scroll. Le informazioni HTML mantengono status Planned/Vision.

## Developers — `developers`

I bottoni Read, Approve, Deposit e Withdraw modificano route e focus. Sono animazioni, non chiamate RPC.

## Docs — `docs`

Doc item e start cards guidano un knowledge graph discreto. La lista HTML è sempre la fonte di navigazione.

## FAQ — `faq`

L'apertura di un `<details>` genera un pulse breve. FPS massimo 24 e densità minima.

## App — `app`

L'input deposit genera una quantità normalizzata, limitata visualmente a 10.000 USDC. Questa normalizzazione non cambia importo, preview o transazione. Il modal ferma il loop.

