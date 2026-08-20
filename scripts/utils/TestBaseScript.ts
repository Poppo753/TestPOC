/**
 * 🧪 TEST BASESCRIPT CLASS
 * Script di test per verificare che la BaseScript funzioni correttamente
 */

import { BaseScript, ScriptResult } from "./BaseScript";

// Implementazione di test che estende BaseScript
class TestScript extends BaseScript {
  protected getScriptName(): string {
    return "Test Script";
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Testing BaseScript functionality", "✅");
    
    // Simulazione di un'operazione semplice
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      result: "Test completed successfully"
    };
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("Custom pre-execution check", "Running...");
  }

  protected async customPostExecutionVerification(): Promise<void> {
    this.logScriptInfo("Custom post-execution verification", "Completed");
  }
}

// Esecuzione del test
async function main() {
  const testScript = new TestScript({
    verbose: true,
    dryRun: false
  });

  const result = await testScript.execute();
  
  if (result.success) {
    console.log("🎉 BaseScript test completed successfully!");
    console.log(`⏱️ Execution time: ${result.executionTime}ms`);
  } else {
    console.error("❌ BaseScript test failed:", result.error);
  }
}

// Esegui il test
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });