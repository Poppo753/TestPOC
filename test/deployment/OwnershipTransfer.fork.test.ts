import { expect } from "chai";
import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

/**
 * Fase 4 — rehearsal del trasferimento ownership su fork locale.
 *
 * Riferimenti documentazione (non contengono segreti, sola lettura):
 *   docs/New_Doc/1_Documentation/4. First Deployment/10_Phase_4_Fork/00_Architettura_e_Perimetro.md
 *   docs/New_Doc/1_Documentation/4. First Deployment/10_Phase_4_Fork/01_Checklist_Migrazione.md
 *   docs/New_Doc/1_Documentation/4. First Deployment/10_Phase_4_Fork/02_Runbook_Installazione_e_Gestione.md
 *
 * COSA FA QUESTO TEST
 * -------------------
 * Su un fork Hardhat di Arbitrum One (mai contro la rete reale):
 *   1. Legge il manifest reale (`scripts/manifests/arbitrum-usdc-poc-1.json`)
 *      e verifica che i 22 contratti abbiano bytecode.
 *   2. Crea un multisig 2-of-3 EFFIMERO (`EphemeralMultisig`, in
 *      `contracts/mocks/EphemeralMultisig.sol`). NON è la Gnosis Safe di
 *      produzione: è un contratto minimale usato solo per rieseguire in modo
 *      deterministico la meccanica "quorum di owner indipendenti" prima che
 *      la Fase 3 crei la Safe reale.
 *   3. Trasferisce l'ownership di 20 contratti Ownable a uno step e della
 *      Beacon a due step (transferOwnership + acceptOwnership instradata
 *      tramite il multisig, perché acceptOwnership deve essere chiamata dal
 *      pending owner).
 *   4. Verifica che il vecchio deployer non controlli più nulla (21/21 revert
 *      attesi) e che una sola conferma non basti a eseguire (quorum 2-of-3).
 *   5. Esegue una modifica amministrativa innocua + rollback, pause/unpause,
 *      un recovery drill con un owner "indisponibile", una transazione
 *      innocua da 0 ETH per verificare l'incremento del nonce, e infine
 *      deposit/withdraw/health check dell'utente per provare che il sistema
 *      resta funzionale dopo il trasferimento.
 *
 * COME ESEGUIRLO (vedi anche 02_Runbook_Installazione_e_Gestione.md)
 * -------------------------------------------------------------------
 *   $env:FORK_ENABLED = "true"
 *   $env:FORK_BLOCK_NUMBER = "490447686"   # bloccco fissato, non mobile
 *   npx hardhat test test/deployment/OwnershipTransfer.fork.test.ts --network hardhat
 *
 * Il test va eseguito DUE volte sullo stesso `FORK_BLOCK_NUMBER` per
 * verificare il determinismo richiesto dalla checklist (sezione F). Non
 * invia mai transazioni ad Arbitrum One: tutto avviene nello stato in-memory
 * del fork, che viene ripristinato (`evm_revert`) alla fine.
 */

const FORK_ENABLED = process.env.FORK_ENABLED === "true";
const FORK_BLOCK_NUMBER = process.env.FORK_BLOCK_NUMBER;
const enabled = FORK_ENABLED && Boolean(FORK_BLOCK_NUMBER);

(enabled ? describe : describe.skip)("Fase 4 — rehearsal trasferimento ownership su fork (Safe effimera)", function () {
  this.timeout(600_000);

  const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const USDC_WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

  /**
   * ABI minimale condivisa da tutti i 21 contratti trasferibili (20 Ownable
   * a uno step + Beacon a due step). Beacon espone `owner()` come variabile
   * pubblica con lo stesso selector di OZ Ownable, quindi l'ABI è uniforme.
   */
  const OWNABLE_ABI = [
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
    "function transferOwnership(address newOwner) external",
    "function acceptOwnership() external",
  ];

  /** 20 contratti Ownable a trasferimento uno-step (esclusi beacon e flashLoanService). */
  const ONE_STEP_KEYS = [
    "proxyGeneral", "chainlinkAdapter", "tokenManager", "valueCalculator", "swapManager",
    "parameterManager", "emergencyHandler", "liquidityManager", "protocolManager",
    "aaveV3Registry", "aaveV3Plugin", "aaveV3LensAdapter",
    "eulerRegistry", "eulerV2Plugin", "eulerLensAdapter",
    "morphoRegistry", "morphoPlugin", "morphoLensAdapter",
    "morphoVaultPlugin", "morphoVaultLensAdapter",
  ];

  let manifest: any;
  let snapshot: string;
  let deployer: any;
  let owner1: any;
  let owner2: any;
  let owner3: any;
  let multisig: any;
  let multisigAddress: string;

  /** Matrice `contratto -> owner attuale -> owner atteso -> metodo -> evidenza` richiesta dal gate di uscita. */
  const matrix: Record<string, { address: string; currentOwner: string; expectedOwner: string; method: string; evidence?: string }> = {};

  /** True se `emergencyHandler.emergencyUnpause()` è risultato eseguibile dopo il trasferimento (vedi sezione E). */
  let emergencyUnpauseReachable: boolean | undefined;

  /** Sottomette una transazione al multisig e restituisce il suo txId, senza duplicare la submit con una staticCall separata. */
  async function submitAndTrackTxId(proposer: any, to: string, value: bigint | number, data: string): Promise<bigint> {
    const txId: bigint = await multisig.transactionCount();
    await (await multisig.connect(proposer).submitTransaction(to, value, data)).wait();
    return txId;
  }

  before(async function () {
    if (network.name !== "hardhat") throw new Error("La rehearsal Fase 4 richiede --network hardhat");
    if (!FORK_ENABLED) throw new Error("FORK_ENABLED=true e' richiesto per la rehearsal Fase 4");
    if (!FORK_BLOCK_NUMBER) throw new Error("FORK_BLOCK_NUMBER e' richiesto per una rehearsal deterministica");

    const manifestPath = path.resolve("scripts/manifests/arbitrum-usdc-poc-1.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.chainId, "il manifest deve dichiarare chain ID 42161").to.equal(42161);
    expect(Object.keys(manifest.contracts).length, "il manifest deve contenere 22 contratti").to.equal(22);

    snapshot = await ethers.provider.send("evm_snapshot", []);

    await ethers.provider.send("hardhat_impersonateAccount", [manifest.deployer]);
    await ethers.provider.send("hardhat_setBalance", [manifest.deployer, ethers.toQuantity(ethers.parseEther("1"))]);
    deployer = await ethers.getSigner(manifest.deployer);

    // signers[0] resta riservato all'utente di test per deposit/withdraw (sezione E).
    // signers[1..3] sono i tre owner del multisig effimero (mai il deployer reale).
    const signers = await ethers.getSigners();
    owner1 = signers[1];
    owner2 = signers[2];
    owner3 = signers[3];
  });

  after(async function () {
    // Cleanup garantito anche in caso di fallimento di un test precedente:
    // chiude l'impersonation e ripristina lo snapshot iniziale del fork.
    if (manifest?.deployer) {
      try {
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [manifest.deployer]);
      } catch {
        // già rimossa: nessuna azione necessaria.
      }
    }
    if (snapshot) await ethers.provider.send("evm_revert", [snapshot]);
  });

  // ==================== SEZIONE B — HARNESS: SAFE EFFIMERA ====================

  it("B. crea la Safe effimera 2-of-3 (EphemeralMultisig, non e' la Safe di produzione)", async function () {
    const MultisigFactory = await ethers.getContractFactory("EphemeralMultisig");
    multisig = await MultisigFactory.deploy([owner1.address, owner2.address, owner3.address], 2);
    await multisig.waitForDeployment();
    multisigAddress = await multisig.getAddress();

    expect(await ethers.provider.getCode(multisigAddress), "la Safe effimera deve avere bytecode").to.not.equal("0x");
    expect(await multisig.threshold()).to.equal(2n);
    expect(await multisig.ownerCount()).to.equal(3n);
    expect(await multisig.nonce()).to.equal(0n);
  });

  // ==================== SEZIONE C — MATRICE OWNERSHIP ====================

  it("C. censisce la matrice ownership per tutti i 22 contratti (bytecode + owner iniziale)", async function () {
    for (const [key, address] of Object.entries(manifest.contracts) as [string, string][]) {
      const code = await ethers.provider.getCode(address);
      expect(code, `bytecode mancante per ${key} (${address})`).to.not.equal("0x");
    }

    for (const key of ["beacon", ...ONE_STEP_KEYS]) {
      const address = manifest.contracts[key];
      const contract = new ethers.Contract(address, OWNABLE_ABI, ethers.provider);
      const currentOwner: string = await contract.owner();
      expect(currentOwner, `${key} non e' ancora del deployer atteso`).to.equal(manifest.deployer);
      matrix[key] = {
        address,
        currentOwner,
        expectedOwner: multisigAddress,
        method: key === "beacon" ? "due step" : "uno step",
      };
    }

    // flashLoanService resta censito come eccezione non Ownable: l'accesso e'
    // vincolato al Beacon immutabile, non esiste una funzione owner() da trasferire.
    matrix.flashLoanService = {
      address: manifest.contracts.flashLoanService,
      currentOwner: "non applicabile",
      expectedOwner: "non applicabile",
      method: "non Ownable",
    };

    expect(Object.keys(matrix).length, "la matrice deve avere 22 righe").to.equal(22);
  });

  // ==================== SEZIONE D — TRASFERIMENTO SUL FORK ====================

  it("D. trasferisce ownership dei 20 contratti Ownable a uno step verso la Safe locale", async function () {
    for (const key of ONE_STEP_KEYS) {
      const address = manifest.contracts[key];
      const contract = new ethers.Contract(address, OWNABLE_ABI, deployer);
      await (await contract.transferOwnership(multisigAddress)).wait();
      const newOwner: string = await contract.owner();
      expect(newOwner, `${key} non e' stato trasferito alla Safe locale`).to.equal(multisigAddress);
      matrix[key].currentOwner = newOwner;
      matrix[key].evidence = "transferOwnership uno-step eseguito dal deployer";
    }
  });

  it("D. avvia e completa il trasferimento a due step della Beacon, verificando il quorum 2-of-3", async function () {
    const beaconAddress = manifest.contracts.beacon;
    const beacon = new ethers.Contract(beaconAddress, OWNABLE_ABI, deployer);

    // Step 1: il deployer propone il nuovo owner.
    await (await beacon.transferOwnership(multisigAddress)).wait();
    expect(await beacon.pendingOwner(), "pendingOwner della Beacon non impostato").to.equal(multisigAddress);

    // Step 2: acceptOwnership deve essere chiamata DAL pending owner (la Safe
    // locale), quindi va instradata attraverso il multisig come ogni altra
    // azione owner-only.
    const acceptData = new ethers.Interface(OWNABLE_ABI).encodeFunctionData("acceptOwnership", []);
    const txId = await submitAndTrackTxId(owner1, beaconAddress, 0, acceptData);

    // Con una sola conferma (il proponente owner1) il quorum 2 non e' raggiunto:
    // l'esecuzione deve essere rifiutata. Questo verifica anche il criterio
    // "una sola firma Safe non puo' eseguire".
    await expect(multisig.connect(owner1).executeTransaction(txId)).to.be.revertedWith("EphemeralMultisig: quorum not reached");

    // Seconda conferma di un owner distinto: il quorum 2-of-3 e' ora raggiunto
    // e l'esecuzione deve riuscire. Verifica il criterio "due firme distinte possono eseguire".
    await (await multisig.connect(owner2).confirmTransaction(txId)).wait();
    await (await multisig.connect(owner1).executeTransaction(txId)).wait();

    expect(await beacon.owner(), "la Beacon non ha accettato l'ownership tramite la Safe").to.equal(multisigAddress);
    expect(await beacon.pendingOwner(), "pendingOwner della Beacon deve azzerarsi dopo l'accettazione").to.equal(ethers.ZeroAddress);

    matrix.beacon.currentOwner = multisigAddress;
    matrix.beacon.evidence = `due step via Safe locale, tx multisig #${txId}`;
  });

  it("D. verifica che il vecchio deployer non controlli piu' alcun contratto trasferibile (21/21 revert attesi)", async function () {
    let revertCount = 0;
    const failures: string[] = [];
    for (const key of ["beacon", ...ONE_STEP_KEYS]) {
      const address = manifest.contracts[key];
      const contract = new ethers.Contract(address, OWNABLE_ABI, deployer);
      try {
        await contract.transferOwnership(deployer.address);
        failures.push(key);
      } catch {
        revertCount += 1;
      }
    }
    expect(failures, `il vecchio deployer controlla ancora: ${failures.join(", ")}`).to.have.lengthOf(0);
    expect(revertCount, "attesi 21 revert del vecchio deployer").to.equal(21);
  });

  // ==================== SEZIONE E — REGRESSIONE FUNZIONALE ====================

  it("E. esegue una modifica amministrativa innocua tramite la Safe locale e verifica il rollback esatto", async function () {
    const paramManagerAddress = manifest.contracts.parameterManager;
    const paramManager = await ethers.getContractAt("ParameterManager", paramManagerAddress);
    const iface = paramManager.interface;

    const initialValue: bigint = await paramManager.parameterTimelock();
    // MIN_TIMELOCK = 1 hours, MAX_TIMELOCK = 7 days: scegliamo un valore
    // temporaneo diverso e sempre dentro i limiti consentiti dal contratto.
    const temporaryValue = initialValue === 48n * 3600n ? 72n * 3600n : 48n * 3600n;

    const setData = iface.encodeFunctionData("setParameterTimelock", [temporaryValue]);
    const txId1 = await submitAndTrackTxId(owner2, paramManagerAddress, 0, setData);
    await (await multisig.connect(owner3).confirmTransaction(txId1)).wait();
    await (await multisig.connect(owner2).executeTransaction(txId1)).wait();
    expect(await paramManager.parameterTimelock(), "valore amministrativo non modificato").to.equal(temporaryValue);

    const rollbackData = iface.encodeFunctionData("setParameterTimelock", [initialValue]);
    const txId2 = await submitAndTrackTxId(owner2, paramManagerAddress, 0, rollbackData);
    await (await multisig.connect(owner3).confirmTransaction(txId2)).wait();
    await (await multisig.connect(owner2).executeTransaction(txId2)).wait();
    expect(await paramManager.parameterTimelock(), "rollback non esatto").to.equal(initialValue);
  });

  it("E. esegue pause tramite la Safe locale e unpause dopo lo scadere del timelock", async function () {
    const proxyGeneralAddress = manifest.contracts.proxyGeneral;
    const emergencyHandlerAddress = manifest.contracts.emergencyHandler;
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddress);
    const emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddress);

    expect(await proxyGeneral.isPaused()).to.equal(false);

    // PAUSE: emergencyHandler.emergencyPause(reason) chiama internamente
    // proxy.pause(). Funziona indipendentemente da chi possiede EmergencyHandler
    // perche' proxy.pause() e' `onlyAuthorizedModule` (autorizzazione stabilita
    // in fase di deploy, non intaccata dal trasferimento di ownership).
    const pauseData = emergencyHandler.interface.encodeFunctionData("emergencyPause", ["Fase 4 rehearsal drill"]);
    const pauseTxId = await submitAndTrackTxId(owner1, emergencyHandlerAddress, 0, pauseData);
    await (await multisig.connect(owner2).confirmTransaction(pauseTxId)).wait();
    await (await multisig.connect(owner1).executeTransaction(pauseTxId)).wait();
    expect(await proxyGeneral.isPaused(), "pause non riuscita tramite la Safe locale").to.equal(true);

    const unpauseTimelockSeconds: bigint = await emergencyHandler.unpauseTimelock();
    await ethers.provider.send("evm_increaseTime", [Number(unpauseTimelockSeconds) + 60]);
    await ethers.provider.send("evm_mine", []);

    // Verifica empirica PRIMA di instradare la call nel multisig: proxy.unpause()
    // e' `onlyOwner` e valuta msg.sender come l'indirizzo di EmergencyHandler
    // quando invocato via emergencyUnpause() (non l'owner reale di ProxyGeneral).
    // Simuliamo la call con eth_call per non bloccare l'esecuzione quorum-gated
    // su una transazione che potrebbe revertire per un problema di progettazione
    // pre-esistente, indipendente da questa rehearsal.
    const emergencyUnpauseData = emergencyHandler.interface.encodeFunctionData("emergencyUnpause", []);
    try {
      await ethers.provider.call({ to: emergencyHandlerAddress, data: emergencyUnpauseData, from: multisigAddress });
      emergencyUnpauseReachable = true;
    } catch {
      emergencyUnpauseReachable = false;
    }

    if (emergencyUnpauseReachable) {
      const unpauseTxId = await submitAndTrackTxId(owner1, emergencyHandlerAddress, 0, emergencyUnpauseData);
      await (await multisig.connect(owner2).confirmTransaction(unpauseTxId)).wait();
      await (await multisig.connect(owner1).executeTransaction(unpauseTxId)).wait();
    } else {
      // PROBLEMA TROVATO (da registrare in 03_Registro_Esecuzione.md):
      // emergencyHandler.emergencyUnpause() e' irraggiungibile dopo il
      // trasferimento ownership, perche' ProxyGeneral.unpause() e' onlyOwner
      // e il msg.sender effettivo e' EmergencyHandler, non l'owner di
      // ProxyGeneral. Percorso funzionale alternativo verificato qui: l'owner
      // di ProxyGeneral (la Safe locale) chiama unpause() direttamente.
      const directUnpauseData = proxyGeneral.interface.encodeFunctionData("unpause", []);
      const directTxId = await submitAndTrackTxId(owner1, proxyGeneralAddress, 0, directUnpauseData);
      await (await multisig.connect(owner3).confirmTransaction(directTxId)).wait();
      await (await multisig.connect(owner1).executeTransaction(directTxId)).wait();
    }

    expect(await proxyGeneral.isPaused(), "unpause non riuscito").to.equal(false);
  });

  it("E. esegue una transazione innocua (0 ETH alla Safe stessa, calldata 0x) e verifica l'incremento del nonce di 1", async function () {
    const nonceBefore: bigint = await multisig.nonce();

    const txId = await submitAndTrackTxId(owner1, multisigAddress, 0, "0x");
    // Con una sola conferma il quorum non e' raggiunto: deve rifiutare l'esecuzione.
    await expect(multisig.connect(owner1).executeTransaction(txId)).to.be.revertedWith("EphemeralMultisig: quorum not reached");

    await (await multisig.connect(owner2).confirmTransaction(txId)).wait();
    await (await multisig.connect(owner1).executeTransaction(txId)).wait();

    const nonceAfter: bigint = await multisig.nonce();
    expect(nonceAfter - nonceBefore, "il nonce della Safe locale deve incrementare esattamente di 1").to.equal(1n);
    expect(await multisig.isExecuted(txId)).to.equal(true);
  });

  it("E. simula l'indisponibilita' di un owner e verifica che i restanti due raggiungano il quorum (recovery drill)", async function () {
    const drillStart = Date.now();

    // owner1 e' "indisponibile": non propone e non conferma affatto questa transazione.
    const txId = await submitAndTrackTxId(owner2, multisigAddress, 0, "0x");
    await (await multisig.connect(owner3).confirmTransaction(txId)).wait();
    await (await multisig.connect(owner2).executeTransaction(txId)).wait();

    expect(await multisig.isExecuted(txId), "il recovery drill non ha raggiunto il quorum con 2 owner su 3").to.equal(true);
    expect(await multisig.isConfirmedBy(txId, owner1.address), "owner1 non doveva partecipare al drill").to.equal(false);

    const drillElapsedMs = Date.now() - drillStart;
    // Tempo del recovery drill registrato per il registro esecuzione (evidenza umana, non un'asserzione di soglia).
    console.log(`Fase 4 recovery drill completato in ${drillElapsedMs} ms con owner1 simulato indisponibile`);
  });

  it("E. verifica che nessuna ownership core sia stata alterata dal recovery drill o dalle azioni precedenti", async function () {
    for (const key of ["beacon", ...ONE_STEP_KEYS]) {
      const address = manifest.contracts[key];
      const contract = new ethers.Contract(address, OWNABLE_ABI, ethers.provider);
      expect(await contract.owner(), `${key} owner alterato inaspettatamente`).to.equal(multisigAddress);
    }
  });

  it("E. esegue deposit e withdraw utente dopo il trasferimento e verifica l'aumento/riduzione delle quote LP", async function () {
    const [testUser] = await ethers.getSigners();
    const liquidityManagerAddress = manifest.contracts.liquidityManager;
    const proxyGeneralAddress = manifest.contracts.proxyGeneral;
    const parameterManagerAddress = manifest.contracts.parameterManager;

    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddress);
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", proxyGeneralAddress);
    const paramManager = await ethers.getContractAt("ParameterManager", parameterManagerAddress);
    const usdc = await ethers.getContractAt("IERC20", USDC);

    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    await ethers.provider.send("hardhat_setBalance", [USDC_WHALE, ethers.toQuantity(ethers.parseEther("1"))]);
    const whale = await ethers.getSigner(USDC_WHALE);

    const minDeposit: bigint = await paramManager.getCurrentParameterValue("minDeposit");
    const floor = ethers.parseUnits("2", 6);
    const depositAmount = minDeposit > floor ? minDeposit * 2n : floor;

    await (await usdc.connect(whale).transfer(testUser.address, depositAmount)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);

    const lpBefore: bigint = await proxyGeneral.balanceOf(testUser.address);
    await (await usdc.connect(testUser).approve(liquidityManagerAddress, depositAmount)).wait();
    await (await liquidityManager.connect(testUser).deposit(depositAmount)).wait();
    const lpAfterDeposit: bigint = await proxyGeneral.balanceOf(testUser.address);
    expect(lpAfterDeposit, "il deposito dopo il trasferimento non ha aumentato le quote LP").to.be.greaterThan(lpBefore);

    await (await liquidityManager.connect(testUser).withdraw(lpAfterDeposit - lpBefore)).wait();
    const lpAfterWithdraw: bigint = await proxyGeneral.balanceOf(testUser.address);
    expect(lpAfterWithdraw, "il withdraw dopo il trasferimento non ha ridotto le quote LP").to.be.lessThan(lpAfterDeposit);
  });

  it("E. esegue health check sui protocolli attivi e verifica assenza di finding critical non spiegati", async function () {
    const protocolManager = await ethers.getContractAt("ProtocolManager", manifest.contracts.protocolManager);
    const activeProtocols = Object.entries(manifest.protocols)
      .filter(([, info]: [string, any]) => info.active)
      .map(([name]) => name);

    for (const protocolName of activeProtocols) {
      try {
        const healthFactor: bigint = await protocolManager.getHealthFactor(protocolName);
        expect(healthFactor > 0n, `${protocolName} ha un health factor non positivo`).to.equal(true);
      } catch (err) {
        // Nessun debito attivo per nessun protocollo in questo POC: alcuni
        // plugin possono non esporre getHealthFactor() per posizioni vuote.
        // getGlobalHealthFactor() sotto resta il controllo autorevole.
        console.log(`Nota: getHealthFactor(${protocolName}) non disponibile via ProtocolManager: ${(err as Error).message}`);
      }
    }

    const [lowestHealthFactor, worstProtocol] = await protocolManager.getGlobalHealthFactor();
    expect(lowestHealthFactor > 0n, `global health factor critico su ${worstProtocol}`).to.equal(true);
  });

  // ==================== SEZIONE F — DETERMINISMO E CHIUSURA ====================

  it("F. riepiloga la matrice ownership finale e conferma l'assenza di transazioni verso Arbitrum One", function () {
    // Questo test gira sempre sulla rete "hardhat" (verificato in before()):
    // nessuna chiamata di questa suite ha mai potuto raggiungere Arbitrum One.
    expect(network.name).to.equal("hardhat");

    const transferable = ["beacon", ...ONE_STEP_KEYS];
    expect(transferable.length, "attesi 21 contratti trasferibili").to.equal(21);
    for (const key of transferable) {
      expect(matrix[key].currentOwner, `${key} manca dalla matrice finale`).to.equal(multisigAddress);
    }
    expect(matrix.flashLoanService.method).to.equal("non Ownable");

    console.log("Matrice ownership Fase 4:", JSON.stringify(matrix, null, 2));
    console.log(`emergencyHandler.emergencyUnpause() raggiungibile dopo il trasferimento: ${emergencyUnpauseReachable}`);
  });
});
