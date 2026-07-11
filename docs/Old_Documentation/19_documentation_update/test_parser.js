const fs = require('fs');

// Load markdown
const markdown = fs.readFileSync('API_Reference_v3.0_DRAFT.md', 'utf8');

// Test regex patterns
console.log('=== TESTING MODULE DETECTION ===\n');

const lines = markdown.split('\n');
let moduleCount = 0;
const modules = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Test pattern 1: Generic detection
  if (line.match(/^## .+ \{#[a-z]+\}/)) {
    // Test pattern 2: Name extraction
    const match = line.match(/^##\s+\S+\s+(\w+)\s+\{#(\w+)\}/);
    if (match) {
      moduleCount++;
      modules.push({ name: match[1], id: match[2], line: i + 1 });
      console.log(`✅ Module ${moduleCount}: ${match[1]} (${match[2]}) - Line ${i + 1}`);
    } else {
      console.log(`❌ FAILED to parse: ${line}`);
    }
  }
}

console.log(`\n=== TOTAL: ${moduleCount} modules found ===\n`);

// Now parse properly
const APIReferenceParser = require('./api_parser.js');
const parser = new APIReferenceParser();
parser.parseMarkdown(markdown).then(result => {
  console.log('\n=== PARSING RESULTS ===');
  console.log(`Total modules found: ${result.modules.length}`);
  console.log(`Total functions found: ${result.totalFunctions}`);
  
  console.log('\n=== MODULES ===');
  result.modules.forEach(mod => {
    console.log(`\n${mod.name} (${mod.id})`);
    console.log(`  Functions: ${mod.functions.length}`);
    console.log(`  Purpose: ${mod.purpose.substring(0, 60)}...`);
  });
  
  console.log('\n=== FUNCTION BREAKDOWN ===');
  let viewCount = 0;
  let writeCount = 0;
  let emergencyCount = 0;
  
  result.functions.forEach(f => {
    if (f.color === '#60a5fa') viewCount++;
    else if (f.color === '#f59e0b') writeCount++;
    else if (f.color === '#ef4444') emergencyCount++;
  });
  
  console.log(`View functions: ${viewCount}`);
  console.log(`Write functions: ${writeCount}`);
  console.log(`Emergency functions: ${emergencyCount}`);
});
