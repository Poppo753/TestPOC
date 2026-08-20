# Report fase 1 — architettura

## Risultato

La terza iterazione conserva lo stack statico ma aggiunge confini interni più chiari e un vero release gate read-only.

## Implementato

- `assets/js/config/site-config.js`: navigazione, gruppi footer, disclaimer e tassonomia stati.
- `site-shell.js`: header/footer costruiti con API DOM, non con un template HTML monolitico.
- Controller App con token `latest wins`: una risposta RPC vecchia non può sovrascrivere un refresh o account più recente.
- Pulsante Refresh con stato `aria-busy` e feedback testuale.
- `scripts/lib/diagnostics.mjs`: provider esclusivamente read-only, error normalization e JSON BigInt-safe.
- CLI deployment e protocolli rifattorizzate sulla libreria.
- `check-content.mjs`: contratto editoriale automatizzato.
- `release-readiness.mjs`: validazione statica, copy, deployment e protocolli in un comando.
- Trust Center alimentato dal manifest deployment con fallback HTML.
- Validatore esteso a navigazione e status taxonomy.

## Decisioni confermate

Non sono stati introdotti framework, build step obbligatori o backend. Non sono state aggiunte chiamate write ai plugin: gli utenti operano attraverso il core; plugin e lens sono infrastruttura registrata e osservabile.

## Verifica

`npm run ready` supera tutti i gate. La suite non accetta signer, seed o private key e non autorizza un rilascio produttivo: offre evidenza ripetibile, non assurance indipendente.

