/**
 * MD→JSON Converter for API Reference
 * Converts API_Reference_v3.0_DRAFT.md to structured JSON
 * Shows missing fields for each function
 */

const fs = require('fs');

// Expected fields for complete documentation
const REQUIRED_FIELDS = [
    'description',
    'signature',
    'parameters',
    'returns',
    'accessControl',
    'validations',
    'events',
    'gasCost',
    'usageExample',
    'calledBy',
    'securityNotes'
];

function parseMarkdownToJSON(mdContent) {
    const lines = mdContent.split('\n');
    const result = {
        version: '3.0.0',
        date: new Date().toISOString().split('T')[0],
        modules: {}
    };

    let currentModule = null;
    let currentFunction = null;
    let currentSection = null;
    let codeBlockActive = false;
    let codeBlockType = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect code blocks
        if (trimmed.startsWith('```')) {
            codeBlockActive = !codeBlockActive;
            if (codeBlockActive) {
                codeBlockType = trimmed.substring(3).trim() || 'text';
            } else {
                codeBlockType = null;
            }
            continue;
        }

        // Skip content inside code blocks (except capture for signature/examples)
        if (codeBlockActive) {
            if (currentFunction && currentSection === 'signature') {
                currentFunction.signature += line + '\n';
            } else if (currentFunction && currentSection === 'usageExample') {
                currentFunction.usageExample += line + '\n';
            } else if (currentFunction && currentSection === 'events') {
                currentFunction.events += line + '\n';
            }
            continue;
        }

        // Detect module headers: ## 🔗 Beacon {#beacon}
        const moduleMatch = line.match(/^##\s+\S+\s+(\w+)\s+\{#(\w+)\}/);
        if (moduleMatch) {
            const moduleName = moduleMatch[1];
            const moduleId = moduleMatch[2];
            currentModule = {
                name: moduleName,
                id: moduleId,
                functions: {}
            };
            result.modules[moduleId] = currentModule;
            currentFunction = null;
            currentSection = null;
            continue;
        }

        // Detect function headers: ### functionName {#module-functionname}
        const funcMatch = line.match(/^###\s+(.+?)\s+\{#([\w-]+)\}/);
        if (funcMatch && currentModule) {
            const funcName = funcMatch[1];
            const funcId = funcMatch[2];
            
            currentFunction = {
                name: funcName,
                id: funcId,
                module: currentModule.id,
                description: '',
                signature: '',
                parameters: [],
                returns: [],
                accessControl: null,
                validations: [],
                events: '',
                gasCost: null,
                usageExample: '',
                calledBy: null,
                securityNotes: [],
                // Metadata
                _complete: false,
                _missingFields: []
            };
            
            currentModule.functions[funcId] = currentFunction;
            currentSection = 'description';
            continue;
        }

        if (!currentFunction) continue;

        // Detect sections
        if (line.startsWith('**Signature:**')) {
            currentSection = 'signature';
            continue;
        }
        if (line.startsWith('**Parameters:**')) {
            currentSection = 'parameters';
            continue;
        }
        if (line.startsWith('**Returns:**')) {
            currentSection = 'returns';
            continue;
        }
        if (line.startsWith('**Access Control:**')) {
            currentSection = 'accessControl';
            const match = line.match(/\*\*Access Control:\*\*\s+`([^`]+)`/);
            if (match) {
                currentFunction.accessControl = match[1];
            }
            continue;
        }
        if (line.startsWith('**Validations:**')) {
            currentSection = 'validations';
            continue;
        }
        if (line.startsWith('**Events Emitted:**')) {
            currentSection = 'events';
            continue;
        }
        if (line.startsWith('**Gas Cost:**')) {
            currentSection = 'gasCost';
            const match = line.match(/\*\*Gas Cost:\*\*\s+(.+)/);
            if (match) {
                currentFunction.gasCost = match[1].trim();
            }
            continue;
        }
        if (line.startsWith('**Usage Example:**')) {
            currentSection = 'usageExample';
            continue;
        }
        if (line.startsWith('**Called By:**')) {
            currentSection = 'calledBy';
            const match = line.match(/\*\*Called By:\*\*\s+(.+)/);
            if (match) {
                currentFunction.calledBy = match[1].trim();
            }
            continue;
        }
        if (line.startsWith('**Security Notes:**')) {
            currentSection = 'securityNotes';
            continue;
        }

        // Capture content based on section
        if (currentSection === 'description' && trimmed && !line.startsWith('**')) {
            currentFunction.description += trimmed + ' ';
        }

        if (currentSection === 'validations') {
            if (trimmed.startsWith('- ✅') || trimmed.startsWith('- ❌')) {
                currentFunction.validations.push(trimmed.substring(2).trim());
            }
        }

        if (currentSection === 'securityNotes') {
            if (trimmed.startsWith('- ⚠️') || trimmed.startsWith('- ')) {
                currentFunction.securityNotes.push(trimmed.replace(/^- ⚠️?\s*/, '').trim());
            }
        }

        // Table parsing for parameters/returns
        if (currentSection === 'parameters' || currentSection === 'returns') {
            if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.includes('Name')) {
                const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length >= 2) {
                    const obj = currentSection === 'parameters' 
                        ? { name: cells[0], type: cells[1], description: cells[2] || '' }
                        : { type: cells[0], description: cells[1] || '' };
                    currentFunction[currentSection].push(obj);
                }
            }
        }
    }

    return result;
}

function analyzeCompleteness(jsonData) {
    const stats = {
        totalFunctions: 0,
        completeFunctions: 0,
        incompleteFunctions: 0,
        byModule: {},
        missingFieldsSummary: {}
    };

    // Initialize missing fields counter
    REQUIRED_FIELDS.forEach(field => {
        stats.missingFieldsSummary[field] = 0;
    });

    for (const [moduleId, module] of Object.entries(jsonData.modules)) {
        stats.byModule[moduleId] = {
            total: 0,
            complete: 0,
            incomplete: 0
        };

        for (const [funcId, func] of Object.entries(module.functions)) {
            stats.totalFunctions++;
            stats.byModule[moduleId].total++;

            const missingFields = [];

            // Check each required field
            if (!func.description || func.description.trim().length < 10) {
                missingFields.push('description');
            }
            if (!func.signature || func.signature.trim().length < 10) {
                missingFields.push('signature');
            }
            if (!func.accessControl) {
                missingFields.push('accessControl');
            }
            if (!func.gasCost) {
                missingFields.push('gasCost');
            }
            if (!func.usageExample || func.usageExample.trim().length < 10) {
                missingFields.push('usageExample');
            }
            if (!func.calledBy && func.accessControl && !func.accessControl.includes('view')) {
                missingFields.push('calledBy');
            }
            if (func.securityNotes.length === 0 && func.accessControl && !func.accessControl.includes('view')) {
                missingFields.push('securityNotes');
            }
            if (func.validations.length === 0 && func.accessControl && !func.accessControl.includes('view')) {
                missingFields.push('validations');
            }
            if (!func.events || func.events.trim().length < 10) {
                if (func.accessControl && !func.accessControl.includes('view')) {
                    missingFields.push('events');
                }
            }

            func._missingFields = missingFields;
            func._complete = missingFields.length === 0;

            if (func._complete) {
                stats.completeFunctions++;
                stats.byModule[moduleId].complete++;
            } else {
                stats.incompleteFunctions++;
                stats.byModule[moduleId].incomplete++;
                
                // Count missing fields
                missingFields.forEach(field => {
                    stats.missingFieldsSummary[field]++;
                });
            }
        }
    }

    return stats;
}

function generateReport(jsonData, stats) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 API REFERENCE COMPLETENESS ANALYSIS');
    console.log('='.repeat(70));
    
    console.log('\n📈 OVERALL STATISTICS:');
    console.log(`   Total Functions: ${stats.totalFunctions}`);
    console.log(`   ✅ Complete: ${stats.completeFunctions} (${Math.round(stats.completeFunctions/stats.totalFunctions*100)}%)`);
    console.log(`   ❌ Incomplete: ${stats.incompleteFunctions} (${Math.round(stats.incompleteFunctions/stats.totalFunctions*100)}%)`);

    console.log('\n📦 BY MODULE:');
    for (const [moduleId, modStats] of Object.entries(stats.byModule)) {
        const completePct = Math.round(modStats.complete / modStats.total * 100);
        const status = completePct === 100 ? '✅' : completePct >= 75 ? '⚠️' : '❌';
        console.log(`   ${status} ${moduleId.padEnd(20)} ${modStats.complete}/${modStats.total} (${completePct}%)`);
    }

    console.log('\n🔍 MISSING FIELDS SUMMARY:');
    const sortedFields = Object.entries(stats.missingFieldsSummary)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0);
    
    for (const [field, count] of sortedFields) {
        const pct = Math.round(count / stats.totalFunctions * 100);
        console.log(`   ${field.padEnd(20)} missing in ${count} functions (${pct}%)`);
    }

    console.log('\n❌ INCOMPLETE FUNCTIONS (showing first 20):');
    let count = 0;
    for (const [moduleId, module] of Object.entries(jsonData.modules)) {
        for (const [funcId, func] of Object.entries(module.functions)) {
            if (!func._complete && count < 20) {
                console.log(`   ${moduleId}.${func.name}`);
                console.log(`      Missing: ${func._missingFields.join(', ')}`);
                count++;
            }
        }
    }

    if (stats.incompleteFunctions > 20) {
        console.log(`   ... and ${stats.incompleteFunctions - 20} more`);
    }

    console.log('\n' + '='.repeat(70));
}

// Main execution
try {
    console.log('🔄 Reading API_Reference_v3.0_DRAFT.md...');
    const mdContent = fs.readFileSync('API_Reference_v3.0_DRAFT.md', 'utf8');
    
    console.log('🔄 Parsing markdown to JSON...');
    const jsonData = parseMarkdownToJSON(mdContent);
    
    console.log('🔄 Analyzing completeness...');
    const stats = analyzeCompleteness(jsonData);
    
    console.log('💾 Writing api_reference.json...');
    fs.writeFileSync('api_reference.json', JSON.stringify(jsonData, null, 2));
    
    console.log('💾 Writing api_reference_stats.json...');
    fs.writeFileSync('api_reference_stats.json', JSON.stringify(stats, null, 2));
    
    // Generate report
    generateReport(jsonData, stats);
    
    console.log('\n✅ Conversion complete!');
    console.log('   📄 api_reference.json - Full structured data');
    console.log('   📊 api_reference_stats.json - Completeness statistics');
    console.log('\n💡 Tip: Check api_reference.json for "_missingFields" in each function');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
