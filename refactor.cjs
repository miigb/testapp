const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const imports = `
// Extracted modules
import { formatCurrency, toFormNumber, normalizeText, toColor, colorWithAlpha } from './lib/formatters'
import {
  STORAGE_KEYS,
  resolveInitialTheme,
  resolveInitialDisabledSavedViewIds,
  resolveInitialQuickNotes,
  resolveInitialSmartNotes,
  resolveInitialSmartNotesPinnedSignatures,
  resolveInitialSmartNotesSavedEntries,
} from './lib/localStorage'
import {
  formatSmartNotesValue,
  parseSmartNumber,
  buildSmartNotesSignature,
  evaluateSmartNotesLine,
} from './lib/smartNotes'
import {
  composeIndicacoes,
  extractGpeSeFromIndicacoes,
} from './lib/recordHelpers'
import {
  getInitialEntryForm,
  formToPayload,
  recordToForm,
  recordToPatchPayload,
  getPrimaryRecordReference,
  getUniqueRecordReferences,
  getSecondaryRecordReference,
} from './lib/recordHelpers'
import {
  dsFormToPayload,
  dsRecordToForm,
  getInitialDsEntryForm,
} from './lib/dsHelpers'
import {
  penhorasFormToPayload,
  penhorasRecordToForm,
  getInitialPenhorasEntryForm,
} from './lib/penhorasHelpers'
import {
  DASHBOARD_WIDGET_MIN_HEIGHT,
  DASHBOARD_WIDGET_MAX_HEIGHT,
  DASHBOARD_WIDGET_MIN_COL_SPAN,
  DASHBOARD_WIDGET_MAX_COL_SPAN,
  DASHBOARD_WIDGET_LIBRARY,
  DS_DASHBOARD_WIDGET_LIBRARY,
  DEFAULT_DS_DASHBOARD_WIDGETS,
  PENHORAS_DASHBOARD_WIDGET_LIBRARY,
  DEFAULT_PENHORAS_DASHBOARD_WIDGETS,
  cloneDefaultDsDashboardWidgets,
  cloneDefaultPenhorasDashboardWidgets,
  sanitizeDashboardWidgetSize,
  sanitizeDashboardWidgetColumn,
  clampDashboardWidgetHeight,
  clampDashboardWidgetColSpan,
  parseDashboardWidgets,
  parseDsDashboardWidgets,
  parsePenhorasDashboardWidgets,
} from './lib/dashboardWidgets'
import {
  sanitizeDsFilters,
  sanitizePenhorasFilters,
  sanitizeDashboardFilters,
} from './lib/sanitizers'

// Shared Components
import { LabeledInput, AutocompleteInput, LabeledSelect, Info } from './components/shared/FormInputs'
import { StatusIcon, StatusPill, ExequenteLogo, GestorAvatar, EntityIdentity } from './components/shared/StatusComponents'

// Shared constants
import {
  TABS,
  DEFAULT_TABLE_FILTERS,
  DEFAULT_DASHBOARD_FILTERS,
  DEFAULT_DS_FILTERS,
  DEFAULT_PENHORAS_FILTERS,
  THEME_OPTIONS,
  TOTAL_METRIC_OPTIONS,
  CALCULATOR_KEYS,
  MONTHS,
  EMPTY_CALC_SETTINGS,
  EMPTY_RECORD_SUGGESTIONS,
  STATUS_ICON_OPTIONS,
} from './constants'
import type { LayoutMode, QuickToolId, TotalMetricKey, CalculatorKey } from './constants'
import type { ThemeId, SavedSmartNotesEntry } from './lib/localStorage'
import type { DashboardWidgetType, DashboardWidgetSize, DashboardWidgetColumn, DashboardWidgetScope, DashboardWidget, DsDashboardWidgetType, DsDashboardWidget, PenhorasDashboardWidgetType, PenhorasDashboardWidget } from './lib/dashboardWidgets'

// Utils
import { getStatus } from './lib/utils'

// Types
import type { SmartNotesResultRow, SmartNotesErrorRow } from './lib/smartNotes'
`;

// Replace chunk 1: constants and helpers BEFORE App()
const startIdx1 = content.indexOf('const TABS: { id: TabId; label: string }[] = [');
const endIdx1 = content.indexOf('function App() {');
if (startIdx1 === -1 || endIdx1 === -1) {
  console.error('Could not find chunk 1 boundaries');
  process.exit(1);
}
content = content.slice(0, startIdx1) + '\n' + imports + '\n\n' + content.slice(endIdx1);

// Replace chunk 2: components AFTER App()
const startIdx2 = content.lastIndexOf('type LabeledInputProps = {');
const endIdx2 = content.lastIndexOf('export default App');
if (startIdx2 === -1 || endIdx2 === -1) {
  console.error('Could not find chunk 2 boundaries');
  process.exit(1);
}
content = content.slice(0, startIdx2) + '\n\n' + content.slice(endIdx2);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx refactored successfully.');
