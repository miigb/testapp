const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const toRemove = [
  /  RecordSuggestions,\n/g,
  /  SavedView,\n/g,
  /const DASHBOARD_WIDGET_MIN_HEIGHT = 96\n/g,
  /const DASHBOARD_WIDGET_MAX_HEIGHT = 2200\n/g,
  /type SavedSmartNotesEntry = \{[\s\S]*?\n\}\n/g,
  /  const smartNotesEvaluation = useMemo\(\(\) => \{[\s\S]*?\}, \[smartNotesText, evaluateSmartNotes\]\)\n/m
];

for (const regex of toRemove) {
  content = content.replace(regex, "");
}

fs.writeFileSync('src/App.tsx', content);
console.log("Warnings cleaned part 2.");
