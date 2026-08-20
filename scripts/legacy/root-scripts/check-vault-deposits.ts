import { ethers } from "hardhat";

async function main() {
    const vaults = [
        { name: "MEV Capital USDC", addr: "0xa60643c90A542A95026C0F1dbdB0615fF42019Cf" },
        { name: "Clearstar USDC",   addr: "0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC" },
        { name: "HexaOne USDC",     addr: "0xaE73875437c86abb60cD7fA77286D63cb94F9a25" },
        { name: "usdc staging",     addr: "0xd2d46099B70880e268B0c7557b9D22d3AA848654" },
    ];

    const abi = [
        "function asset() view returns (address)",
        "function totalAssets() view returns (uint256)",
        "function maxDeposit(address) view returns (uint256)",
        "function maxWithdraw(address) view returns (uint256)",
        "function name() view returns (string)",
        "function balanceOf(address) view returns (uint256)",
    ];

    const user = "0x0000000000000000000000000000000000000001";

    for (const v of vaults) {
        const code = await ethers.provider.getCode(v.addr);
        console.log(`\n${v.name} (${v.addr})`);
        console.log(`  bytecode: ${code.length > 2 ? `${(code.length-2)/2} bytes` : "NONE"}`);
        if (code === "0x") continue;

        const vault = new ethers.Contract(v.addr, abi, ethers.provider);
        
        try { const a = await vault.asset(); console.log(`  asset: ${a}`); } catch(e: any) { console.log(`  asset ERROR: ${e.message?.substring(0,60)}`); }
        try { const ta = await vault.totalAssets(); console.log(`  totalAssets: ${ta}`); } catch(e: any) { console.log(`  totalAssets ERROR: ${e.message?.substring(0,60)}`); }
        try { const n = await vault.name(); console.log(`  name: ${n}`); } catch(e: any) { console.log(`  name ERROR: ${e.message?.substring(0,60)}`); }
        try { const md = await vault.maxDeposit(user); console.log(`  maxDeposit: ${md}`); } catch(e: any) { console.log(`  maxDeposit ERROR: ${e.message?.substring(0,60)}`); }
    }
}

main().catch(console.error);
