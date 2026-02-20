const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Unused helper functions
const funcsToRemove = [
  "sanitizeDsFilters",
  "sanitizePenhorasFilters",
  "sanitizeDashboardFilters",
  "parseDashboardWidgets",
  "parseDsDashboardWidgets",
  "parsePenhorasDashboardWidgets"
];
for (const func of funcsToRemove) {
  content = content.replace(new RegExp(`function ${func}\\(input: unknown\\)[:]?[^{]*\\{[\\s\\S]*?\\n\\}`, 'm'), "");
}

// 2. Unused UndoAction
content = content.replace(/type UndoAction = \{\n  id: string\n  label: string\n  run: \(\) => Promise<void>\n\}\n/m, "");

// 3. Unused destructured variables in App
content = content.replace(/, isDarkLike /, " ");
content = content.replace(/, dismissUndo /, " ");
content = content.replace(/    setRecords,\n/g, "");
content = content.replace(/    recordSuggestions,\n/g, "");
content = content.replace(/    setDsRecords,\n/g, "");
content = content.replace(/    setPenhorasRecords,\n/g, "");
content = content.replace(/    smartNotesPinnedSignatures,\n/g, "");
content = content.replace(/    setDisabledSavedViewIds,\n/g, "");

content = content.replace(/    notesWindowRef,\n/g, "");
content = content.replace(/    calculatorWindowRef,\n/g, "");
content = content.replace(/    smartNotesWindowRef,\n/g, "");

content = content.replace(/, setPageError /, " ");
content = content.replace(/  const \[recordSuggestions, setRecordSuggestions\] = useState<RecordSuggestions>\(EMPTY_RECORD_SUGGESTIONS\)\n/g, "");
content = content.replace(/  const smartNotesEvaluation = useMemo\(\(\) => \{[\s\S]*?\}, \[smartNotesText, evaluateSmartNotes\]\)\n/m, "");

// 4. Redeclared refs
content = content.replace(/  const widgetResizeRef = useRef[^\n]*\n/, "");
content = content.replace(/  const toolLayerRef = useRef[^\n]*\n/, "");
content = content.replace(/  const toolDragRef = useRef[^\n]*\n/, "");
content = content.replace(/  const notesWindowRef = useRef[^\n]*\n/, "");
content = content.replace(/  const calculatorWindowRef = useRef[^\n]*\n/, "");
content = content.replace(/  const smartNotesWindowRef = useRef[^\n]*\n/, "");

// 5. Duplicate undo logic
const undoRegex = /  function pushUndo\(label: string, run: \(\) => Promise<void>\) \{[\s\S]*?  \}[\s\n]*async function handleUndo\(\) \{[\s\S]*?  \}[\s\n]*/m;
content = content.replace(undoRegex, "");

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed App.tsx elements part 2.");
