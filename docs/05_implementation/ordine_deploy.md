// 1. Deploy Beacon (prima di tutto)
const beacon = await Beacon.deploy();

// 2. Deploy ProxyGeneral (custody contract)
const proxy = await ProxyGeneral.deploy(beacon.address);

// 3. Deploy tutti i moduli (in qualsiasi ordine)
const tokenManager = await TokenManager.deploy(beacon.address);
const valueCalculator = await ValueCalculator.deploy(beacon.address);
const swapManager = await SwapManager.deploy(beacon.address);
// ... altri moduli

// 4. Registra i moduli nel Beacon
await beacon.setImplementation("TokenManager", tokenManager.address);
await beacon.setImplementation("ValueCalculator", valueCalculator.address);
// ... altri moduli

// 5. Autorizza i moduli in ProxyGeneral
await proxy.authorizeModule(tokenManager.address, "TokenManager");
await proxy.authorizeModule(swapManager.address, "SwapManager");
// ... altri moduli

// 6. Deploy LiquidityManager (ultimo, perché dipende dagli altri)
const liquidityManager = await LiquidityManager.deploy(
    beacon.address,
    proxy.address,
    wethAddress
);

// 7. Registra LiquidityManager nel Beacon
await beacon.setImplementation("LiquidityManager", liquidityManager.address);

// 8. Autorizza LiquidityManager in ProxyGeneral
await proxy.authorizeModule(liquidityManager.address, "LiquidityManager");