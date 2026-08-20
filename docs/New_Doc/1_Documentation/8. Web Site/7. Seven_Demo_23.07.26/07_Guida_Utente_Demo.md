# Guida utente — Jethos Interactive Demo

## Avvio

Da `dapp-new`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8000
```

Aprire:

```text
http://127.0.0.1:8000/demo/
```

Usare le credenziali preview già definite per il sito. Non aprire il file con
`file://`: i moduli ES richiedono un'origine HTTP.

## Cosa rappresenta

La demo parte con 10.000 demo USDC. Non collega MetaMask, non legge la chain e
non può muovere fondi. Il banner superiore rimane visibile per ricordarlo.

## Percorso consigliato

1. Aprire **Overview** e osservare il confine wallet/vault.
2. Aprire **Explore vaults**.
3. Confrontare APY, rischio, liquidità e allocazioni.
4. Aprire **View details** per vedere rischi e route.
5. Selezionare **Simulate deposit**.
6. Inserire un importo o usare 25%, 50%, Max.
7. Leggere la review e confermare.
8. In **Portfolio**, usare **Simulate 30 days**.
9. Aprire **Transparency** per vedere dove è allocata la posizione.
10. Tornare in **Portfolio** e simulare un prelievo.
11. Verificare la ricevuta in **Activity**.

## Reset

Su desktop, usare **Reset demo** in fondo alla rail. Confermare per cancellare
posizioni e attività e tornare a 10.000 demo USDC.

In alternativa, dalla console del browser:

```javascript
JethosDemo.reset()
```

Il comando è soltanto un ausilio diagnostico locale.

## Persistenza

La demo ricorda lo stato nel browser e nell'origine correnti. Un'altra porta,
un altro browser o una finestra privata avranno uno stato distinto.

## Differenza tra demo e PoC

- **Interactive Demo:** esperienza completa, dati tutti simulati.
- **Technical PoC:** letture e azioni esplicite verso il deployment configurato.

Il collegamento “Open technical PoC” permette di passare alla console senza
confondere i due ambienti.

