const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add dashboardFilters
content = content.replace(
  "const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)",
  "const [dashboardFilters, setDashboardFilters] = useState<RecordFilters>(DEFAULT_DASHBOARD_FILTERS)\n  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)"
);

// 2. Remove smartNotes variables
const smartNotesBlockRegex = /  const smartNotesResults = smartNotesEvaluation\.results[\s\S]*?\}, \[smartNotesResults, smartNotesPinnedSet\]\)\n/m;
content = content.replace(smartNotesBlockRegex, "");

// 3. Fix handleQuickToolShortcuts
content = content.replace(
  /setNotesOpen\(true\)\n        setToolLayers\(\(current\) => \{\n          const nextLayer = toolLayerRef\.current\+\+\n          return \{ \.\.\.current, notes: nextLayer \}\n        \}\)/m,
  "setNotesOpen(true)\n        bringToolToFront('notes')"
);
content = content.replace(
  /setCalculatorOpen\(true\)\n        setToolLayers\(\(current\) => \{\n          const nextLayer = toolLayerRef\.current\+\+\n          return \{ \.\.\.current, calculator: nextLayer \}\n        \}\)/m,
  "setCalculatorOpen(true)\n        bringToolToFront('calculator')"
);
content = content.replace(
  /setSmartNotesOpen\(true\)\n        setToolLayers\(\(current\) => \{\n          const nextLayer = toolLayerRef\.current\+\+\n          return \{ \.\.\.current, 'smart-notes': nextLayer \}\n        \}\)/m,
  "setSmartNotesOpen(true)\n        bringToolToFront('smart-notes')"
);

// 4. Remove pushUndo, runUndo, dismissUndo block
const undoBlockRegex = /  function pushUndo\(label: string, run: \(\) => Promise<void>\) \{[\s\S]*?  \}[\s\n]*async function runUndo\(\) \{[\s\S]*?  \}[\s\n]*function dismissUndo\(\) \{[\s\S]*?  \}\n/m;
content = content.replace(undoBlockRegex, "");

// 5. Variable declaration list cannot be empty
content = content.replace(/  const\n/m, "");

// 6. Remove remaining zIndexes
content = content.replace(/  const notesWindowZIndex = [^\n]*\n/m, "");
content = content.replace(/  const calculatorWindowZIndex = [^\n]*\n/m, "");
content = content.replace(/  const smartNotesWindowZIndex = [^\n]*\n/m, "");

// 7. runUndo in JSX should be handleUndo
content = content.replace(/runUndo\(\)/g, "handleUndo()");

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed App.tsx elements.");
