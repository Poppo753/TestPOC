# Registro evidenze deployment POC USDC

Data: 14 luglio 2026. Chain: Arbitrum One, chain ID 42161.

## Identità e capitale

- deployer: `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- saldo iniziale: 0,003691288220706979 ETH e 5,460207 USDC;
- saldo finale rilevato: 0,002096154072684979 ETH e 5,460204 USDC;
- gas complessivamente speso: 0,001595134148022 ETH;
- perdita USDC complessiva per rounding: 0,000003 USDC;
- endpoint usato: Alchemy autenticato, non RPC pubblica.

## Rehearsal e correzioni bloccanti

Il rehearsal persistente ha impedito un deployment incompleto. Ha rilevato e portato alla correzione di:

- comando oracle feed separato e ordine feed -> metadata per WETH;
- exit code CLI non-zero dopo `success:false`;
- alias Beacon pubblici per il routing ProtocolManager;
- rounding Aave nel micro-withdraw;
- API Pool corretta nei test Aave;
- share dust e `activeVaults` Morpho Vault;
- ruolo `positionManager` separato dall'ownership amministrativa di EulerRegistry;
- limite EIP-170 precedentemente nascosto dal fork: SwapManager è passato da 24.601 a 24.473 byte runtime;
- lettura yield-only Morpho Vault nel monitor delle posizioni;
- monitoraggio Morpho market WETH/USDC come protocollo attivo ma non allocabile dal controller USDC.

La stima rehearsal era 0,0015336565 ETH e 0,0023004848 ETH con margine del 50%. Il costo reale è rimasto entro il budget.

## Deployment reale

Il manifest autorevole è `scripts/manifests/arbitrum-usdc-poc-1.json`. Contiene indirizzi, transaction hash e metadata di certificazione; non contiene chiavi o URL RPC.

Core principali:

- Beacon: `0x145833173cc47Fde624Be8cc4f391eeA07b82a16`;
- ProxyGeneral: `0xb070303C3634eA404593A87725aaCb18E1d5d9BF`;
- LiquidityManager: `0x80fB731B78D2C7180cd22eCF18Dc4243546ce192`;
- ProtocolManager: `0x91fEc8f3161504Dd20c2Ed58B8E6003854AC5A8D`;
- ValueCalculator: `0x1850e1E37a7a46E74bBDAE5704Afe0C79BCb7c1A`;
- SwapManager: `0xF187F8AE7F2B099d71453a29a1Ceb24a7A942188`.

Plugin:

- Aave: `0x9b2230464540dd1B269156c685A191fd48291447`;
- Euler: `0x31814FB423fA5578CB54a21f0e1f8561CC850A43`;
- Morpho: `0x13984c992CE512901F8eCe91aDa4c3A2F7EEEe05`;
- Morpho Vault: `0x2040a3128d6dBF5E0C19ED69411f63d11BDF13D5`.

Configurazione conclusa al blocco 483832997. Il manifest è stato certificato su fork fissato esattamente a quel blocco: 2 test passati, quattro round-trip e cleanup finale.

## Micro-flow reali

Sono stati usati 1 USDC nel vault e 0,25 USDC per ciascun protocollo supply-only. Tutte le transazioni hanno receipt riuscita:

- approval USDC: `0xc0c06cf0fb43c43772aca9b21a028365e9d2d839a7249bb8905b45a1e44a350a`;
- vault deposit: `0xf87dad3ad376cf53c21a9dff51d2a6d1260fd3b9cf92fd79bcf6c70cea591237`;
- Aave deposit/withdraw: `0x100406e64b267d14bfc200f7a26a077ddc37c8b39948fec3f18d9a3c828a7698`, `0x4f87892b59d5c7bfb963ec87bef9931792656fa374505a366a8442231ace8e78`;
- Euler deposit/withdraw: `0x8b7f3437fcaa2afe7a69ac3aed10bcc739a4e5e87ed2f59196ae0373726c650d`, `0x0b2089fc28a2ca8cb60db311459cd61b04e10bc72fcd8e497d6c714179cac654`;
- Morpho Vault deposit/withdraw: `0x0f8ef7afe8ea8a4e6d7f48a94d36c82417dc04fd33b264314bb396ec01f6cb25`, `0x08ea41aacb1f00010ca762aaa78791048aea0fca5015c5d689cee0234f9a9c29`;
- vault withdraw finale: `0xda0594e7be35af6fc61eee1a8b7a0bc51ba43c5d5e20aeec0660e72d28ae3bff`.

Il Morpho market collateralizzato WETH/USDC non è stato aperto sulla chain reale perché il wallet disponeva di USDC ma non di WETH sufficiente a un test serio. Il medesimo full-cycle è passato sul fork.

## Stato finale on-chain

Controllo al blocco 483837057 e ciclo observe ai blocchi 483836963–483836972:

- pool total value, total supply e base balance: zero;
- LP share del deployer: zero;
- Aave balance/debt e aToken: zero;
- Euler balance/debt e share eUSDC: zero;
- Morpho collaterale WETH, debito USDC e token diretti: zero;
- Morpho Vault balance, share esterne e tracking attivo: zero;
- allowance deployer -> LiquidityManager: zero;
- sistema non in pausa; depositi e prelievi abilitati;
- quattro protocolli registrati e attivi.

## Automation observe

Control file: `scripts/automation/config.arbitrum-usdc-poc-1.json`.

- preflight reale: `ready: true`;
- execution: `disabled`;
- ciclo reale: `NO_ACTION`;
- managed assets: zero;
- health factor globale: massimo;
- Morpho: monitor-only, target e max allocation zero.

Un primo ciclo fallito durante lo sviluppo ha evidenziato la differenza tra API Morpho a due token e API lending generica. Non ha inviato transazioni. Il monitor è stato reso fail-closed e il ciclo successivo è passato.

## Test eseguiti

- Morpho Vault fork mirato: 60/60;
- script framework finale: 39/39; Operations: 13/13;
- automation: 14/14;
- plugin fork completi: 221/221;
- E2E rilevanti: 80/80;
- Aave leverage: 32/32;
- EulerRegistry unit: 74/74;
- deployment manifest post-deploy: 2/2;
- deployment bundle: 3/3;
- migration/deployment dopo fix EIP-170: 25/25;
- compile e typecheck: PASS.

GMX e Dolomite sono stati esclusi intenzionalmente perché incompleti.

## Gate ancora aperti

Il POC deployato è pronto per observe e Safe advisory, non per capitale significativo:

1. osservazione supervisionata 24–72 ore;
2. verifica sorgenti su explorer;
3. policy e selector whitelist definitivi;
4. Safe con threshold/recovery e prova advisory;
5. trasferimento ownership alla Safe;
6. audit di sicurezza prima di autonomia o capitale materiale.
