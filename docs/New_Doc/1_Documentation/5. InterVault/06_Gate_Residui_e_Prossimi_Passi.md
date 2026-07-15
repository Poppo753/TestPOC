# Gate residui e prossimi passi MetaVault

## Stato sintetico

L'architettura locale dei tre moschettieri è implementata, compila ed è coperta
da test deterministici. È pronta per ulteriore review e fork rehearsal, non per
un deploy con capitale reale.

## Gate G0 — integrità della valuation

Il comportamento skip-on-Lens-error del ProtocolManager deve ricevere una
mitigazione formalmente approvata. Finché una Lens fallita può essere esclusa
dal totale senza far fallire il calcolo, non è prudente attivare MetaVault.

Criterio di uscita: prova fail-closed o guardiano esterno dimostrato, testato su
fork, monitorato e accompagnato da cap conservativi. La scelta non deve essere
mascherata come semplice dettaglio operativo.

## Gate G1 — leaf reali

Per USDC, WETH e in futuro WBTC servono manifest leaf reali e distinti con:

- indirizzi core verificati;
- base asset reale;
- LiquidityManager, LPT e ValueCalculator verificati;
- owner/Safe;
- hash manifest immutabile;
- test di deposito, prelievo totale, donation/yield e stato pausato;
- prova che il leaf non abbia capability InterVault.

## Gate G2 — fork riproducibile

La prima prova è stata superata al blocco `483832997`: un parent nuovo ed
effimero ha depositato nel POC USDC reale usato come leaf e ha chiuso con share
zero. RPC autenticata, whale, snapshot e revert sono stati usati correttamente.

Resta necessario ripetere la certificazione sul manifest MetaVault reale dopo
un eventuale deploy. Quel fork post-deploy dovrà ricreare lo
stato post-deploy e coprire almeno:

- registrazione del leaf;
- swap separato, se cross-asset;
- deposit e redeem completi;
- variazione exchange rate;
- pause e deprecazione;
- failure Lens e failure leaf;
- emergency con fallimento parziale e retry;
- zero share residue e accounting parent invariato.

## Gate G3 — sicurezza amministrativa

Registry owner e Plugin owner devono passare alla Safe secondo la matrice dei
permessi. Il worker 24/7 può osservare e proporre calldata; non deve detenere una
chiave capace di cambiare Registry, cap o implementazioni senza quorum.

## Gate G4 — canary

Solo dopo G0–G3: un leaf, un importo trascurabile, cap minimo, conferme on-chain,
monitoraggio 24/7 e procedura di unwind già provata. Il canary non deve usare i
5 USDC del POC finché il fork post-deploy non è verde.

## Gate G5 — espansione

WETH e WBTC si aggiungono uno alla volta. Ogni nuovo token ripete l'intero ciclo
manifest → review → fork → proposta Safe → canary → observe. Non si aggiungono
più leaf contemporaneamente e non si alzano cap durante un incidente aperto.

## Differito intenzionalmente

- cross-chain messaging e accounting asincrono;
- MetaVault sopra altri MetaVault;
- prestito o leva dentro InterVaultPlugin;
- router generico o destinatario arbitrario;
- automazione autonoma di governance;
- deploy Arbitrum in questa sessione.

Queste esclusioni sono parte della sicurezza della milestone, non task
dimenticati.
