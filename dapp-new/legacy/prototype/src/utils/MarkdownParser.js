// ============================================
// UTILITY: API Reference Parser
// Parser per convertire il JSON API reference in oggetti per la UI
// ============================================

export class ApiReferenceParser {
  static parseApiReference(jsonData) {
    const modules = [];
    
    console.log('🔍 Parsing API reference JSON...');

    // Iterate through modules
    for (const [moduleKey, moduleData] of Object.entries(jsonData.modules)) {
      const module = {
        name: moduleData.name,
        id: moduleData.id,
        displayOrder: moduleData.displayOrder,
        functions: []
      };

      console.log(`📦 Module: ${module.name}, displayOrder: ${module.displayOrder}`);

      // Iterate through functions
      for (const [funcKey, funcData] of Object.entries(moduleData.functions)) {
        const func = {
          name: funcData.name || funcKey.split('-').pop(),
          id: funcKey,
          module: module.name,
          description: funcData.description || '',
          signature: funcData.signature || '',
          access: funcData.accessControl || 'public',
          gas: funcData.gas || 'N/A',
          color: this.determineColor(funcData.accessControl),
          parameters: funcData.parameters || [],
          returns: funcData.returns || [],
          validations: funcData.validations || [],
          events: funcData.events || '',
          usageExample: funcData.example || '',
          calledBy: funcData.calledBy || '',
          securityNotes: funcData.securityNotes || [],
          notes: funcData.notes || ''
        };

        module.functions.push(func);
      }

      console.log(`✅ Module parsed: ${module.name} - ${module.functions.length} functions`);
      modules.push(module);
    }

    console.log(`\n🎉 Parsing complete: ${modules.length} modules, ${modules.reduce((sum, m) => sum + m.functions.length, 0)} functions`);
    
    return modules;
  }

  static determineColor(accessControl) {
    if (!accessControl) return 'view';
    const access = accessControl.toLowerCase();
    if (access.includes('emergency')) return 'emergency';
    if (access.includes('owner')) return 'write';
    return 'view';
  }

  static calculateStats(modules) {
    return {
      totalModules: modules.length,
      totalFunctions: modules.reduce((sum, m) => sum + m.functions.length, 0),
      viewFunctions: modules.reduce((sum, m) => 
        sum + m.functions.filter(f => f.color === 'view').length, 0),
      writeFunctions: modules.reduce((sum, m) => 
        sum + m.functions.filter(f => f.color === 'write').length, 0),
      emergencyFunctions: modules.reduce((sum, m) => 
        sum + m.functions.filter(f => f.color === 'emergency').length, 0)
    };
  }
}
