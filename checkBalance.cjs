const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

let depth = 0;
let lastFuncLine = 0;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('{')) depth += (line.match(/\{/g) || []).length;
  if (line.includes('}')) depth -= (line.match(/\}/g) || []).length;
  if (depth < 0) {
    console.log(`Unbalanced closing brace at line ${i + 1}: ${line}`);
    break;
  }
}

if (depth > 0) {
  console.log(`Missing ${depth} closing braces at EOF`);
} else if (depth === 0) {
  console.log(`Perfectly balanced!`);
}
