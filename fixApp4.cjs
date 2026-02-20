const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The blocks look like:
// pushUndo({ label: ..., run: async () => {
//   await ...
// })
// We want to replace `\n        })\n` with `\n        } })\n` for those specific lines
content = content.replace(
  /        pushUndo\(\{ label: `estado de \$\{previous\.pe \|\| previous\.processo \|\| previous\.reciboNumero \|\| 'registo'\}`, run: async \(\) => \{\n          await updateRecordStatus\(recordId, previous\.estadoId, \{ registerUndo: false \}\)\n        \}\)\n/g,
  "        pushUndo({ label: `estado de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, run: async () => {\n          await updateRecordStatus(recordId, previous.estadoId, { registerUndo: false })\n        } })\n"
);

content = content.replace(
  /        pushUndo\(\{ label: 'alteração de estado em lote', run: async \(\) => \{\n          await Promise\.all\(before\.map\(\(item\) => api\.updateRecordStatus\(item\.id, item\.estadoId\)\)\)\n        \}\)\n/g,
  "        pushUndo({ label: 'alteração de estado em lote', run: async () => {\n          await Promise.all(before.map((item) => api.updateRecordStatus(item.id, item.estadoId)))\n        } })\n"
);

content = content.replace(
  /        pushUndo\(\{ label: 'edição em lote', run: async \(\) => \{\n          await Promise\.all\(before\.map\(\(record\) => api\.patchRecord\(record\.id, recordToPatchPayload\(record\)\)\)\)\n        \}\)\n/g,
  "        pushUndo({ label: 'edição em lote', run: async () => {\n          await Promise.all(before.map((record) => api.patchRecord(record.id, recordToPatchPayload(record))))\n        } })\n"
);

content = content.replace(
  /      pushUndo\(\{ label: `edição de \$\{previous\.pe \|\| previous\.processo \|\| previous\.reciboNumero \|\| 'registo'\}`, run: async \(\) => \{\n        await api\.patchRecord\(previous\.id, recordToPatchPayload\(previous\)\)\n      \}\)\n/g,
  "      pushUndo({ label: `edição de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, run: async () => {\n        await api.patchRecord(previous.id, recordToPatchPayload(previous))\n      } })\n"
);

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed pushUndo syntaxes.");
