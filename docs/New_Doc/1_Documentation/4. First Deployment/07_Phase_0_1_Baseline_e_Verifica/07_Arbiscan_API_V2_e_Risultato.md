# Arbiscan — migrazione API V2 e risultato finale

## Chiarimento essenziale

I contratti sono stati verificati su **Arbiscan**, non su Ethereum mainnet. Il plugin usa il backend unificato chiamato “Etherscan API V2”, passando `chainId = 42161` per selezionare Arbitrum One. Di conseguenza:

- rete: Arbitrum One;
- chain ID: `42161`;
- explorer pubblico: `https://arbiscan.io`;
- transazioni inviate per la verifica: nessuna;
- capitale o stato dei contratti modificato: nessuno.

## Problema incontrato

La prima esecuzione usava una versione del plugin ancora collegata alla Etherscan API V1. Dal 15 agosto 2025 la V1 è dismessa; tutti i 22 tentativi hanno quindi restituito lo stesso errore infrastrutturale prima della pubblicazione. Il fallimento non indicava una mancata corrispondenza dei contratti.

La correzione ha aggiornato esclusivamente il tooling di sviluppo:

- `hardhat`: `2.28.6`;
- `@nomicfoundation/hardhat-verify`: `2.1.3`.

Non sono stati modificati sorgenti Solidity, compiler settings del deployment, indirizzi, manifest o constructor arguments. Dopo l'upgrade sono stati ripetuti compile, typecheck, test script, test automation, compilazione pulita e preflight completo.

## Evidenza finale

| Controllo | Risultato |
|---|---:|
| Contratti nel manifest | 22 |
| Bytecode on-chain presente | 22/22 |
| Receipt di creazione riuscita | 22/22 |
| Creation input esatto | 22/22 |
| Sorgenti pubblicati su Arbiscan | 22/22 |
| Failure residue | 0 |
| URL Arbiscan unici | 22 |
| Rerun idempotente | 22/22 già verificati |

Il dettaglio per indirizzo è in `04_Matrice_Verifica_22_Contratti.md`; l'evidenza strutturata è in `reports/verification/arbitrum-usdc-poc-1.json`.

## Link principali

- [Beacon](https://arbiscan.io/address/0x145833173cc47Fde624Be8cc4f391eeA07b82a16#code)
- [ProxyGeneral](https://arbiscan.io/address/0xb070303C3634eA404593A87725aaCb18E1d5d9BF#code)
- [SwapManager](https://arbiscan.io/address/0xF187F8AE7F2B099d71453a29a1Ceb24a7A942188#code)
- [AaveV3Plugin](https://arbiscan.io/address/0x9b2230464540dd1B269156c685A191fd48291447#code)
- [EulerV2Plugin](https://arbiscan.io/address/0x31814FB423fA5578CB54a21f0e1f8561CC850A43#code)
- [MorphoPlugin](https://arbiscan.io/address/0x13984c992CE512901F8eCe91aDa4c3A2F7EEEe05#code)
- [MorphoVaultPlugin](https://arbiscan.io/address/0x2040a3128d6dBF5E0C19ED69411f63d11BDF13D5#code)

Riferimenti ufficiali:

- [Etherscan API V2 migration](https://docs.etherscan.io/v2-migration);
- [Hardhat verification](https://docs.etherscan.io/contract-verification/verify-with-hardhat).
