# Sicurezza: dipendenze e segreti rilevati

## Credenziale OneInch

L'audit ha trovato lo stesso literal ad alta entropia assegnato a una API key OneInch in quattro file:

- due helper Euler legacy;
- due test fork Euler.

Il valore non viene riportato in alcun documento o output. È stato sostituito con `process.env.ONEINCH_API_KEY ?? ""` e aggiunto a `.env.example` senza valore.

La rimozione dal commit nuovo non revoca la credenziale. Il literal era già presente su `origin/dev-26` e risale al commit `5fea9a2`; va quindi considerato compromesso. Il 15 luglio 2026 l'utente ha confermato di aver revocato la key. Restano come disciplina operativa:

1. generare un'eventuale nuova key con scope/quota minimi;
2. conservarla solo nel secret manager o `.env` locale;
3. non riutilizzare quella revocata in test o documenti;
4. valutare separatamente una history rewrite coordinata, sapendo che è distruttiva per clone e branch esistenti.

La rotazione è prioritaria; la history rewrite non sostituisce la revoca.

## Audit npm

Risultato più recente:

| Scope | Low | Moderate | High | Critical | Totale |
|---|---:|---:|---:|---:|---:|
| Production (`--omit=dev`) | 10 | 3 | 4 | 0 | 17 |
| Completo | 22 | 16 | 15 | 4 | 57 |

Dipendenze dirette segnalate nello scope production:

- `@chainlink/contracts`: high, fix disponibile secondo npm;
- `@uniswap/v3-periphery`: moderate, nessun fix automatico indicato.

Lo scope production è rimasto a 17 advisory. Il totale della toolchain è sceso da 73 a 57 dopo l'upgrade mirato del verificatore Arbiscan; non è stato applicato alcun fix forzato. Questi numeri descrivono l'albero npm, non dimostrano da soli che i 22 runtime deployati siano sfruttabili. Molti pacchetti servono a compilazione, test o integrazioni non incluse nel POC. La remediation corretta è una fase dedicata:

1. mappare ogni advisory al path di dipendenza;
2. verificare se il codice vulnerabile è importato/compilato/usato dal POC;
3. preparare upgrade su branch separato;
4. rieseguire compile, bytecode diff, intera suite e fork;
5. fare un nuovo deploy/upgrade solo con evidenze.

Non è stato eseguito `npm audit fix --force`: alterare automaticamente versioni e bytecode durante il congelamento della baseline sarebbe scorretto.

## File ambiente

- `.env` è ignorato e non tracciato.
- `.env.mainnet` è tracciato ma contiene soltanto indirizzi pubblici legacy; il nome può confondere e andrebbe rinominato in una futura pulizia non-baseline.
- `.automation-state/` è ignorata e non tracciata.
- `.env.example` contiene solo nomi di variabili vuote.
