const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const toRemove = [
  /type SmartNotesErrorRow = \{[\s\S]*?\n\}\n/m,
  /function evaluateSmartNotesLine\([\s\S]*?\n\}\n/m
];

for (const regex of toRemove) {
  content = content.replace(regex, "");
}

fs.writeFileSync('src/App.tsx', content);
console.log("Warnings cleaned part 3.");
