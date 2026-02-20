const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const toRemove = [
  /import type \{ ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, ReactNode \} from 'react'/g,
  /, SavedView/g,
  /const DEFAULT_TABLE_FILTERS: RecordFilters = \{[\s\S]*?\n\}\n/g,
  /const DEFAULT_DS_FILTERS: DsRecordFilters = \{[\s\S]*?\n\}\n/g,
  /const DEFAULT_PENHORAS_FILTERS: PenhorasRecordFilters = \{[\s\S]*?\n\}\n/g,
  /type DashboardWidgetScope = 'recibos' \| 'ds' \| 'penhoras'\n/g,
  /function resolveInitialTheme\(\): ThemeId \{[\s\S]*?\n\}\n/g,
  /function resolveInitialDisabledSavedViewIds\(\): string\[\] \{[\s\S]*?\n\}\n/g,
  /function resolveInitialSmartNotes\(\): string \{[\s\S]*?\n\}\n/g,
  /function resolveInitialSmartNotesPinnedSignatures\(\): string\[\] \{[\s\S]*?\n\}\n/g,
  /function resolveInitialSmartNotesSavedEntries\(\): SavedSmartNotesEntry\[\] \{[\s\S]*?\n\}\n/g,
  /const EMPTY_RECORD_SUGGESTIONS: RecordSuggestions = \{[\s\S]*?\n\}\n/g,
  /function defaultDashboardWidgetLayout\([\s\S]*?\n\}\n/g,
  /function defaultDsDashboardWidgetLayout\([\s\S]*?\n\}\n/g,
  /function defaultPenhorasDashboardWidgetLayout\([\s\S]*?\n\}\n/g,
  /function sanitizeDashboardWidgetSize\([\s\S]*?\n\}\n/g,
  /function sanitizeDashboardWidgetColumn\([\s\S]*?\n\}\n/g,
  /function clampDashboardWidgetHeight\([\s\S]*?\n\}\n/g,
  /  const smartNotesEvaluation = useMemo\(\(\) => \{[\s\S]*?\}, \[smartNotesText, evaluateSmartNotes\]\)\n/m
];

for (const regex of toRemove) {
  content = content.replace(regex, "");
}

// Fix the import we broke:
content = content.replace(
  "import { useCallback, useEffect, useMemo, useRef, useState } from 'react'\n",
  "import { useCallback, useEffect, useMemo, useRef, useState } from 'react'\nimport type { ChangeEvent, FormEvent, ReactNode } from 'react'\n"
);

fs.writeFileSync('src/App.tsx', content);

// useDashboard.ts
let dashContent = fs.readFileSync('src/hooks/useDashboard.ts', 'utf8');
dashContent = dashContent.replace("import { useState, useRef, useEffect, useCallback } from 'react'", "import { useState, useRef, useEffect } from 'react'");
fs.writeFileSync('src/hooks/useDashboard.ts', dashContent);

// useRecords.ts
let recContent = fs.readFileSync('src/hooks/useRecords.ts', 'utf8');
recContent = recContent.replace("export function useRecords(globalSearch: string, setFeedback: (msg: string) => void) {", "export function useRecords(globalSearch: string) {");
fs.writeFileSync('src/hooks/useRecords.ts', recContent);

console.log("Warnings cleaned.");
