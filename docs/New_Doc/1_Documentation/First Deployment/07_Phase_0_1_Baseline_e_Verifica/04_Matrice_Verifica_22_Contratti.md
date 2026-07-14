# Matrice dei 22 contratti POC

`Preflight` significa: address dal manifest, bytecode on-chain presente, deployment receipt riuscita, contract address coerente e input della transazione di creazione identico ad artifact più constructor arguments dichiarati. `Explorer` resta pending finché non è autorizzata la pubblicazione dei sorgenti.

| # | Contratto | Address | Runtime byte | Preflight | Explorer |
|---:|---|---|---:|---|---|
| 1 | Beacon | `0x145833173cc47Fde624Be8cc4f391eeA07b82a16` | 7.111 | PASS | PENDING |
| 2 | ProxyGeneral | `0xb070303C3634eA404593A87725aaCb18E1d5d9BF` | 13.098 | PASS | PENDING |
| 3 | ChainlinkAdapter | `0xaD262cbf08ac5D5e9Ca55B652Dc455752dE37c5D` | 8.011 | PASS | PENDING |
| 4 | TokenManager | `0xD448DD636B0c6be24ffFbf56b5B480b7d38bE820` | 10.447 | PASS | PENDING |
| 5 | ValueCalculator | `0x1850e1E37a7a46E74bBDAE5704Afe0C79BCb7c1A` | 13.935 | PASS | PENDING |
| 6 | SwapManager | `0xF187F8AE7F2B099d71453a29a1Ceb24a7A942188` | 24.473 | PASS | PENDING |
| 7 | ParameterManager | `0x3972e959A3fB28ce38543Dc42A249fc0dDC229b5` | 13.375 | PASS | PENDING |
| 8 | EmergencyHandler | `0xcEcabED130B96B8F496c3B6D1Fe5A7556C0AB563` | 22.407 | PASS | PENDING |
| 9 | LiquidityManager | `0x80fB731B78D2C7180cd22eCF18Dc4243546ce192` | 21.937 | PASS | PENDING |
| 10 | ProtocolManager | `0x91fEc8f3161504Dd20c2Ed58B8E6003854AC5A8D` | 14.164 | PASS | PENDING |
| 11 | FlashLoanService | `0x3fadC547a502F5B5593f79CAe691bCDBE6332782` | 6.930 | PASS | PENDING |
| 12 | AaveV3Registry | `0x92141Fc608C240BF08c36700E968681536374b61` | 5.789 | PASS | PENDING |
| 13 | AaveV3Plugin | `0x9b2230464540dd1B269156c685A191fd48291447` | 17.536 | PASS | PENDING |
| 14 | AaveV3LensAdapter | `0x575C361090A2CFebEFFc21A4e5b6b541042103e5` | 7.504 | PASS | PENDING |
| 15 | EulerRegistry | `0x3bd278e926d29e6629e5792D25e76F96F0B5307b` | 9.344 | PASS | PENDING |
| 16 | EulerV2Plugin | `0x31814FB423fA5578CB54a21f0e1f8561CC850A43` | 24.214 | PASS | PENDING |
| 17 | EulerLensAdapter | `0x4157890A87198A47a350D25220AD092423B1602E` | 18.844 | PASS | PENDING |
| 18 | MorphoRegistry | `0x7EFce6D2501A2C17c3fE214D2B902744Ad64fE6e` | 5.865 | PASS | PENDING |
| 19 | MorphoPlugin | `0x13984c992CE512901F8eCe91aDa4c3A2F7EEEe05` | 22.364 | PASS | PENDING |
| 20 | MorphoLensAdapter | `0xdd5A283fafc621313358a5B923EC7d25fd113606` | 12.473 | PASS | PENDING |
| 21 | MorphoVaultPlugin | `0x2040a3128d6dBF5E0C19ED69411f63d11BDF13D5` | 10.888 | PASS | PENDING |
| 22 | MorphoVaultLensAdapter | `0x02D091DCde102CeC7bb8E4A45208D2DD7f81516C` | 6.675 | PASS | PENDING |

Constructor arguments e fully-qualified names sono definiti dichiarativamente in `scripts/verification/verify-poc.ts` e registrati anche nel report JSON. MorphoRegistry è unico e condiviso intenzionalmente dai bundle Morpho e Morpho Vault.
