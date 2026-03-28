/**
 * API Reference Parser
 * Parses API_Reference_v3.0_DRAFT.md and extracts function metadata
 * for dynamic diagram rendering
 */

class APIReferenceParser {
  constructor() {
    this.modules = [];
    this.functions = new Map();
    this.currentModule = null;
  }

  /**
   * Parse markdown content and extract function metadata
   * @param {string} markdownContent - Raw markdown content
   * @returns {Object} Parsed data structure
   */
  async parseMarkdown(markdownContent) {
    const lines = markdownContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect module headers: ## 🔹 ModuleName {#modulename}
      // Matches any emoji followed by module name
      if (line.match(/^## .+ \{#[a-z]+\}/)) {
        this.currentModule = this.parseModuleHeader(line, lines, i);
        this.modules.push(this.currentModule);
      }
      
      // Detect function definitions: ### functionName {#module-functionname}
      if (line.match(/^### \w+/) && this.currentModule) {
        const func = this.parseFunctionDefinition(line, lines, i);
        if (func) {
          this.currentModule.functions.push(func);
          this.functions.set(func.fullId, func);
        }
      }
    }
    
    return {
      modules: this.modules,
      functions: Array.from(this.functions.values()),
      totalFunctions: this.functions.size
    };
  }

  /**
   * Parse module header
   */
  parseModuleHeader(line, lines, startIdx) {
    // Extract: ## 🔹 Beacon {#beacon}
    // Matches: ## [emoji] [ModuleName] {#moduleid}
    const match = line.match(/^##\s+\S+\s+(\w+)\s+\{#(\w+)\}/);
    if (!match) return null;
    
    const moduleName = match[1];
    const moduleId = match[2];
    
    // Look ahead for purpose, inheritance, dependencies
    let purpose = '';
    let inheritance = '';
    let dependencies = '';
    
    for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
      const l = lines[i];
      if (l.startsWith('**Purpose:**')) {
        purpose = l.replace('**Purpose:**', '').trim();
      }
      if (l.startsWith('**Inheritance:**')) {
        inheritance = l.replace('**Inheritance:**', '').trim();
      }
      if (l.startsWith('**Dependencies:**')) {
        dependencies = l.replace('**Dependencies:**', '').trim();
      }
    }
    
    return {
      name: moduleName,
      id: moduleId,
      purpose,
      inheritance,
      dependencies,
      functions: []
    };
  }

  /**
   * Parse function definition
   */
  parseFunctionDefinition(line, lines, startIdx) {
    // Extract: ### functionName {#module-functionname}
    const match = line.match(/^### (\w+) \{#([\w-]+)\}/);
    if (!match) return null;
    
    const functionName = match[1];
    const anchorId = match[2];
    
    let signature = '';
    let description = '';
    let accessControl = 'public';
    let gasEstimate = 'N/A';
    let parameters = [];
    let returns = [];
    
    // Parse function details from following lines
    let inSignatureBlock = false;
    let inParametersTable = false;
    let inReturnsTable = false;
    
    for (let i = startIdx + 1; i < Math.min(startIdx + 50, lines.length); i++) {
      const l = lines[i];
      
      // Stop at next function or module
      if (l.startsWith('###') || l.startsWith('##')) break;
      
      // Extract signature
      if (l.includes('**Signature:**')) {
        inSignatureBlock = true;
        continue;
      }
      if (inSignatureBlock && l.startsWith('```solidity')) {
        // Read until closing ```
        let sig = [];
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('```')) {
            signature = sig.join(' ').replace(/\s+/g, ' ').trim();
            i = j;
            break;
          }
          sig.push(lines[j]);
        }
        inSignatureBlock = false;
      }
      
      // Extract description (first non-empty line after header)
      if (!description && l.trim() && !l.startsWith('**') && !l.startsWith('|') && !l.startsWith('```')) {
        description = l.trim();
      }
      
      // Extract access control
      if (l.includes('**Access Control:**')) {
        accessControl = l.replace('**Access Control:**', '').replace(/`/g, '').trim();
      }
      
      // Extract gas cost
      if (l.includes('**Gas Cost:**')) {
        gasEstimate = l.replace('**Gas Cost:**', '').replace(/~/g, '').trim();
      }
      
      // Parse parameters table
      if (l.startsWith('**Parameters:**')) {
        inParametersTable = true;
        continue;
      }
      if (inParametersTable && l.startsWith('|') && !l.includes('Name')) {
        const parts = l.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 3) {
          parameters.push({
            name: parts[0].replace(/`/g, ''),
            type: parts[1].replace(/`/g, ''),
            description: parts[2]
          });
        }
      }
      if (inParametersTable && l.startsWith('**Returns:**')) {
        inParametersTable = false;
        inReturnsTable = true;
        continue;
      }
      
      // Parse returns table
      if (inReturnsTable && l.startsWith('|') && !l.includes('Type') && !l.includes('Name')) {
        const parts = l.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          returns.push({
            type: parts[0].replace(/`/g, ''),
            description: parts[1]
          });
        }
      }
      if (inReturnsTable && l.startsWith('**')) {
        inReturnsTable = false;
      }
    }
    
    // Determine color based on access control and function type
    let color = 'view'; // default
    if (accessControl.includes('owner') || accessControl.includes('auth')) {
      color = 'write';
    }
    if (functionName.includes('emergency') || functionName.includes('pause')) {
      color = 'emergency';
    }
    if (accessControl.includes('view') || accessControl.includes('pure')) {
      color = 'view';
    }
    
    return {
      name: functionName,
      fullId: anchorId,
      moduleId: this.currentModule?.id,
      moduleName: this.currentModule?.name,
      signature,
      description,
      accessControl,
      gasEstimate,
      parameters,
      returns,
      color,
      docsLink: `#${anchorId}`
    };
  }

  /**
   * Load and parse from markdown file
   */
  static async loadFromFile(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      const parser = new APIReferenceParser();
      return await parser.parseMarkdown(content);
    } catch (error) {
      console.error('Error loading API Reference:', error);
      return null;
    }
  }

  /**
   * Load and parse from local markdown content (for Node.js)
   */
  static parseFromString(markdownContent) {
    const parser = new APIReferenceParser();
    return parser.parseMarkdown(markdownContent);
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIReferenceParser;
}
if (typeof window !== 'undefined') {
  window.APIReferenceParser = APIReferenceParser;
}
