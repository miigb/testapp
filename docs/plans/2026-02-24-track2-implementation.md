# Track 2: Code Quality — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vitest unit tests for `src/lib/` pure functions (Part A), then refactor the 3,249-line server monolith into domain-organized modules (Part B). No logic changes.

**Architecture:** Part A adds a Vitest config and test files alongside existing `src/lib/` modules. Part B extracts routes, services, middleware, and schemas from `server/src/index.ts` into separate files organized by domain (records, ds, penhoras), leaving `index.ts` as a thin shell that mounts routers.

**Tech Stack:** Vitest, TypeScript, Express (v5), Prisma, Zod

---

## Part A: Unit Tests

### Task 1: Install Vitest and create config

**Files:**
- Modify: `package.json` (add vitest devDependency + test script)
- Create: `vitest.config.ts`

**Step 1: Install vitest**

Run: `npm install -D vitest`

**Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
  },
})
```

**Step 4: Create test directory**

Run: `mkdir -p src/lib/__tests__`

**Step 5: Verify vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "No test files found" or exit 0 with 0 tests

**Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest and test config"
```

---

### Task 2: Tests for `calculations.ts`

**Files:**
- Create: `src/lib/__tests__/calculations.test.ts`
- Reference: `src/lib/calculations.ts`, `src/types.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseFormNumber, applyFormAutoCalculations } from '../calculations'
import type { CalculationSettings, EntryForm } from '../../types'

// -- parseFormNumber ---------------------------------------------------------

describe('parseFormNumber', () => {
  it('returns undefined for empty string', () => {
    expect(parseFormNumber('')).toBeUndefined()
    expect(parseFormNumber('   ')).toBeUndefined()
  })

  it('parses plain integers', () => {
    expect(parseFormNumber('100')).toBe(100)
    expect(parseFormNumber('-42')).toBe(-42)
  })

  it('parses PT-style comma decimal (e.g. "1234,56")', () => {
    expect(parseFormNumber('1234,56')).toBe(1234.56)
  })

  it('parses US-style dot decimal (e.g. "1234.56")', () => {
    expect(parseFormNumber('1234.56')).toBe(1234.56)
  })

  it('handles thousand separators: dot+comma (PT "1.234,56")', () => {
    expect(parseFormNumber('1.234,56')).toBe(1234.56)
  })

  it('handles thousand separators: comma+dot (US "1,234.56")', () => {
    expect(parseFormNumber('1,234.56')).toBe(1234.56)
  })

  it('strips currency symbols', () => {
    expect(parseFormNumber('€1.234,56')).toBe(1234.56)
    expect(parseFormNumber('$100')).toBe(100)
  })

  it('handles comma-only thousand pattern (e.g. "1,000,000")', () => {
    expect(parseFormNumber('1,000,000')).toBe(1000000)
  })

  it('handles dot-only thousand pattern (e.g. "1.000.000")', () => {
    expect(parseFormNumber('1.000.000')).toBe(1000000)
  })

  it('returns undefined for non-numeric text', () => {
    expect(parseFormNumber('abc')).toBeUndefined()
  })
})

// -- applyFormAutoCalculations -----------------------------------------------

function makeForm(overrides: Partial<EntryForm> = {}): EntryForm {
  return {
    tipo: 'exequente', mes: 1, ano: 2025,
    processo: '', pe: '', reciboNumero: '',
    dataLevantamento: '', dataRecibo: '',
    valorIndicado: '', valorSemIva: '', iva: '',
    retencao: '', valorEmissao: '', meu5: '', outrasTaxas: '',
    gpeSe: '', gestor: '', exequente: '',
    descricaoValor: '', estadoId: 'status-1', indicacoes: '',
    ...overrides,
  }
}

function makeSettings(overrides: Partial<CalculationSettings> = {}): CalculationSettings {
  return {
    id: 'settings-1',
    autoApplyRules: true,
    autoComputeValorSemIva: false,
    autoComputeValorEmissao: false,
    roundTo: 2,
    taxRules: [],
    ...overrides,
  }
}

describe('applyFormAutoCalculations', () => {
  it('returns form unchanged when autoApplyRules is false', () => {
    const form = makeForm({ valorIndicado: '1000,00' })
    const settings = makeSettings({ autoApplyRules: false })
    const result = applyFormAutoCalculations(form, settings)
    expect(result).toEqual(form)
  })

  it('applies IVA rule from valorSemIva base', () => {
    const form = makeForm({ valorSemIva: '100,00' })
    const settings = makeSettings({
      taxRules: [{
        id: 'r1', code: 'IVA', label: 'IVA 23%', rate: 0.23,
        enabled: true, targetField: 'iva', baseField: 'valorSemIva', order: 1,
      }],
    })
    const result = applyFormAutoCalculations(form, settings)
    expect(result.iva).toBe('23,00')
  })

  it('does not overwrite existing target field value', () => {
    const form = makeForm({ valorSemIva: '100,00', iva: '30,00' })
    const settings = makeSettings({
      taxRules: [{
        id: 'r1', code: 'IVA', label: 'IVA 23%', rate: 0.23,
        enabled: true, targetField: 'iva', baseField: 'valorSemIva', order: 1,
      }],
    })
    const result = applyFormAutoCalculations(form, settings)
    expect(result.iva).toBe('30,00')
  })

  it('overwrites target when forceRecalculate is true', () => {
    const form = makeForm({ valorSemIva: '100,00', iva: '30,00' })
    const settings = makeSettings({
      taxRules: [{
        id: 'r1', code: 'IVA', label: 'IVA 23%', rate: 0.23,
        enabled: true, targetField: 'iva', baseField: 'valorSemIva', order: 1,
      }],
    })
    const result = applyFormAutoCalculations(form, settings, true)
    expect(result.iva).toBe('23,00')
  })

  it('infers valorSemIva from valorIndicado using IVA rate', () => {
    const form = makeForm({ valorIndicado: '123,00' })
    const settings = makeSettings({
      taxRules: [{
        id: 'r1', code: 'IVA', label: 'IVA 23%', rate: 0.23,
        enabled: true, targetField: 'iva', baseField: 'valorSemIva', order: 1,
      }],
    })
    const result = applyFormAutoCalculations(form, settings)
    expect(parseFormNumber(result.valorSemIva)).toBeCloseTo(100, 1)
  })

  it('computes valorEmissao when autoComputeValorEmissao is true', () => {
    const form = makeForm({ valorSemIva: '100,00', iva: '23,00' })
    const settings = makeSettings({ autoComputeValorEmissao: true })
    const result = applyFormAutoCalculations(form, settings)
    expect(result.valorEmissao).toBe('123,00')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/calculations.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/calculations.test.ts
git commit -m "test: add unit tests for calculations.ts"
```

---

### Task 3: Tests for `smartNotes.ts`

**Files:**
- Create: `src/lib/__tests__/smartNotes.test.ts`
- Reference: `src/lib/smartNotes.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseSmartNumber, formatSmartNotesValue, evaluateSmartNotesLine } from '../smartNotes'

describe('parseSmartNumber', () => {
  it('parses plain integers', () => {
    expect(parseSmartNumber('42')).toBe(42)
  })

  it('parses decimal with comma', () => {
    expect(parseSmartNumber('3,14')).toBeCloseTo(3.14)
  })

  it('parses k suffix', () => {
    expect(parseSmartNumber('5k')).toBe(5000)
    expect(parseSmartNumber('2,5K')).toBe(2500)
  })

  it('parses m suffix', () => {
    expect(parseSmartNumber('1m')).toBe(1_000_000)
  })

  it('parses b suffix', () => {
    expect(parseSmartNumber('3B')).toBe(3_000_000_000)
  })

  it('returns null for invalid input', () => {
    expect(parseSmartNumber('')).toBeNull()
    expect(parseSmartNumber('abc')).toBeNull()
  })

  it('handles negative numbers', () => {
    expect(parseSmartNumber('-10')).toBe(-10)
    expect(parseSmartNumber('-2k')).toBe(-2000)
  })
})

describe('formatSmartNotesValue', () => {
  it('formats integers without decimals', () => {
    expect(formatSmartNotesValue(1000)).toBe('1\u00a0000') // pt-PT uses non-breaking space
  })

  it('formats decimals', () => {
    expect(formatSmartNotesValue(3.14)).toMatch(/3,14/)
  })
})

describe('evaluateSmartNotesLine', () => {
  const emptyCtx = { previousResults: [] as number[], variables: new Map<string, number>() }

  it('returns null for empty lines and comments', () => {
    expect(evaluateSmartNotesLine('', emptyCtx)).toBeNull()
    expect(evaluateSmartNotesLine('# comment', emptyCtx)).toBeNull()
  })

  it('evaluates simple arithmetic', () => {
    const result = evaluateSmartNotesLine('10 + 20', emptyCtx)
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('error')
    expect((result as { result: number }).result).toBe(30)
  })

  it('evaluates multiplication with x', () => {
    const result = evaluateSmartNotesLine('5 x 3', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(15)
  })

  it('evaluates Portuguese keywords: "mais", "menos", "vezes"', () => {
    const r1 = evaluateSmartNotesLine('10 mais 5', emptyCtx)
    expect((r1 as { result: number }).result).toBe(15)

    const r2 = evaluateSmartNotesLine('10 menos 3', emptyCtx)
    expect((r2 as { result: number }).result).toBe(7)
  })

  it('evaluates "total" with previous results', () => {
    const ctx = { previousResults: [10, 20, 30], variables: new Map() }
    const result = evaluateSmartNotesLine('total', ctx)
    expect((result as { result: number }).result).toBe(60)
  })

  it('returns error for total without previous results', () => {
    const result = evaluateSmartNotesLine('total', emptyCtx)
    expect(result).toHaveProperty('error')
  })

  it('evaluates percent-of pattern ("10% de 200")', () => {
    const result = evaluateSmartNotesLine('10% de 200', emptyCtx)
    expect((result as { result: number }).result).toBe(20)
  })

  it('handles variable assignment', () => {
    const result = evaluateSmartNotesLine('preco = 100 + 50', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number; variableKey: string }).result).toBe(150)
    expect((result as { variableKey: string }).variableKey).toBe('preco')
  })

  it('uses scaled numbers (k/m)', () => {
    const result = evaluateSmartNotesLine('2k + 500', emptyCtx)
    expect((result as { result: number }).result).toBe(2500)
  })

  it('resolves variables from context', () => {
    const ctx = { previousResults: [], variables: new Map([['preco', 100]]) }
    const result = evaluateSmartNotesLine('preco + 50', ctx)
    expect((result as { result: number }).result).toBe(150)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/smartNotes.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/smartNotes.test.ts
git commit -m "test: add unit tests for smartNotes.ts"
```

---

### Task 4: Tests for `recordHelpers.ts`

**Files:**
- Create: `src/lib/__tests__/recordHelpers.test.ts`
- Reference: `src/lib/recordHelpers.ts`, `src/types.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { extractGpeSeFromIndicacoes, formToPayload, recordToForm, getUniqueRecordReferences } from '../recordHelpers'
import type { EntryForm, ReceiptRecord } from '../../types'

describe('extractGpeSeFromIndicacoes', () => {
  it('returns empty for undefined', () => {
    expect(extractGpeSeFromIndicacoes(undefined)).toEqual({ gpeSe: '', text: '' })
  })

  it('returns empty for empty string', () => {
    expect(extractGpeSeFromIndicacoes('')).toEqual({ gpeSe: '', text: '' })
  })

  it('extracts GPESE value', () => {
    const result = extractGpeSeFromIndicacoes('GPESE: 1234 | Some note')
    expect(result.gpeSe).toBe('1234')
    expect(result.text).toBe('Some note')
  })

  it('handles only GPESE with no other text', () => {
    const result = extractGpeSeFromIndicacoes('GPESE: 5678')
    expect(result.gpeSe).toBe('5678')
    expect(result.text).toBe('')
  })

  it('handles only text with no GPESE', () => {
    const result = extractGpeSeFromIndicacoes('Just a note | Another note')
    expect(result.gpeSe).toBe('')
    expect(result.text).toBe('Just a note | Another note')
  })
})

describe('formToPayload', () => {
  it('converts numeric string fields to numbers', () => {
    const form: EntryForm = {
      tipo: 'exequente', mes: 3, ano: 2025,
      processo: 'P-001', pe: '', reciboNumero: '',
      dataLevantamento: '', dataRecibo: '',
      valorIndicado: '1.234,56', valorSemIva: '1.003,71',
      iva: '230,85', retencao: '', valorEmissao: '',
      meu5: '', outrasTaxas: '',
      gpeSe: '', gestor: 'João', exequente: '',
      descricaoValor: '', estadoId: 's1', indicacoes: '',
    }
    const payload = formToPayload(form)
    expect(payload.valorIndicado).toBeCloseTo(1234.56)
    expect(payload.valorSemIva).toBeCloseTo(1003.71)
    expect(payload.iva).toBeCloseTo(230.85)
    expect(payload.processo).toBe('P-001')
    expect(payload.pe).toBeUndefined()
  })

  it('composes indicacoes from gpeSe + indicacoes', () => {
    const form: EntryForm = {
      tipo: 'exequente', mes: 1, ano: 2025,
      processo: '', pe: '', reciboNumero: '',
      dataLevantamento: '', dataRecibo: '',
      valorIndicado: '', valorSemIva: '', iva: '',
      retencao: '', valorEmissao: '', meu5: '', outrasTaxas: '',
      gpeSe: '1234', gestor: '', exequente: '',
      descricaoValor: '', estadoId: 's1', indicacoes: 'Some note',
    }
    const payload = formToPayload(form)
    expect(payload.indicacoes).toBe('GPESE: 1234 | Some note')
  })
})

describe('recordToForm', () => {
  it('converts numbers to PT-formatted strings', () => {
    const record: ReceiptRecord = {
      id: 'r1', tipo: 'exequente', mes: 3, ano: 2025,
      valorIndicado: 1234.56, valorSemIva: 1003.71, iva: 230.85,
      estadoId: 's1', createdAt: '', updatedAt: '', history: [],
    }
    const form = recordToForm(record)
    expect(form.valorIndicado).toBe('1234,56')
    expect(form.valorSemIva).toBe('1003,71')
    expect(form.iva).toBe('230,85')
  })

  it('extracts gpeSe from indicacoes', () => {
    const record: ReceiptRecord = {
      id: 'r1', tipo: 'exequente', mes: 1, ano: 2025,
      indicacoes: 'GPESE: 999 | Note here',
      estadoId: 's1', createdAt: '', updatedAt: '', history: [],
    }
    const form = recordToForm(record)
    expect(form.gpeSe).toBe('999,00')
    expect(form.indicacoes).toBe('Note here')
  })
})

describe('getUniqueRecordReferences', () => {
  it('returns unique non-empty references', () => {
    const record = {
      id: 'r1', tipo: 'exequente' as const, mes: 1, ano: 2025,
      processo: 'P-001', pe: 'PE-001', reciboNumero: 'P-001',
      estadoId: 's1', createdAt: '', updatedAt: '', history: [],
    }
    const refs = getUniqueRecordReferences(record)
    expect(refs).toHaveLength(2)
    expect(refs).toContain('P-001')
    expect(refs).toContain('PE-001')
  })

  it('skips empty/undefined fields', () => {
    const record = {
      id: 'r1', tipo: 'exequente' as const, mes: 1, ano: 2025,
      processo: '', pe: undefined, reciboNumero: 'R-001',
      estadoId: 's1', createdAt: '', updatedAt: '', history: [],
    }
    const refs = getUniqueRecordReferences(record)
    expect(refs).toEqual(['R-001'])
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/recordHelpers.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/recordHelpers.test.ts
git commit -m "test: add unit tests for recordHelpers.ts"
```

---

### Task 5: Tests for `formatters.ts`

**Files:**
- Create: `src/lib/__tests__/formatters.test.ts`
- Reference: `src/lib/formatters.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatNumber, toFormNumber, normalizeText, toColor } from '../formatters'

describe('formatCurrency', () => {
  it('returns "-" for undefined', () => {
    expect(formatCurrency(undefined)).toBe('-')
  })

  it('formats number in EUR with PT locale', () => {
    const result = formatCurrency(1234.5)
    expect(result).toMatch(/1[\s.]234,50/)
    expect(result).toMatch(/€/)
  })
})

describe('formatNumber', () => {
  it('formats with PT locale grouping', () => {
    const result = formatNumber(1234567)
    expect(result).toMatch(/1[\s.]234[\s.]567/)
  })
})

describe('toFormNumber', () => {
  it('returns empty string for undefined', () => {
    expect(toFormNumber(undefined)).toBe('')
  })

  it('formats with comma decimal separator', () => {
    expect(toFormNumber(123.45)).toBe('123,45')
  })

  it('pads to 2 decimal places', () => {
    expect(toFormNumber(100)).toBe('100,00')
  })
})

describe('normalizeText', () => {
  it('returns empty for null/undefined', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
  })

  it('uppercases and strips diacritics', () => {
    expect(normalizeText('João')).toBe('JOAO')
    expect(normalizeText('café')).toBe('CAFE')
  })

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('HELLO')
  })
})

describe('toColor', () => {
  it('returns valid hex color as-is (uppercased)', () => {
    expect(toColor('#ff0000')).toBe('#FF0000')
    expect(toColor('#AbCdEf')).toBe('#ABCDEF')
  })

  it('returns fallback for invalid color', () => {
    expect(toColor('red')).toBe('#BFC4CC')
    expect(toColor('#12345')).toBe('#BFC4CC')
    expect(toColor('')).toBe('#BFC4CC')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/formatters.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/formatters.test.ts
git commit -m "test: add unit tests for formatters.ts"
```

---

### Task 6: Tests for `sanitizers.ts`

**Files:**
- Create: `src/lib/__tests__/sanitizers.test.ts`
- Reference: `src/lib/sanitizers.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeDsFilters, sanitizePenhorasFilters, sanitizeDashboardFilters } from '../sanitizers'

describe('sanitizeDsFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizeDsFilters({})
    expect(result.estadoId).toBe('todos')
    expect(result.gestora).toBe('')
    expect(result.ano).toBe('todos')
    expect(result.mes).toBe('todos')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })

  it('preserves valid values', () => {
    const result = sanitizeDsFilters({ estadoId: 'abc', gestora: 'Bank', ano: 2025, mes: 3 })
    expect(result.estadoId).toBe('abc')
    expect(result.gestora).toBe('Bank')
    expect(result.ano).toBe(2025)
    expect(result.mes).toBe(3)
  })

  it('rejects out-of-range months', () => {
    expect(sanitizeDsFilters({ mes: 0 }).mes).toBe('todos')
    expect(sanitizeDsFilters({ mes: 13 }).mes).toBe('todos')
  })

  it('handles non-object input', () => {
    const result = sanitizeDsFilters(null)
    expect(result.estadoId).toBe('todos')
  })

  it('validates reciboEstado enum', () => {
    expect(sanitizeDsFilters({ reciboEstado: 'com-recibo' }).reciboEstado).toBe('com-recibo')
    expect(sanitizeDsFilters({ reciboEstado: 'invalid' }).reciboEstado).toBe('todos')
  })
})

describe('sanitizePenhorasFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizePenhorasFilters({})
    expect(result.estadoId).toBe('todos')
    expect(result.gestor).toBe('')
    expect(result.acto).toBe('')
  })

  it('preserves valid values', () => {
    const result = sanitizePenhorasFilters({ gestor: 'Maria', acto: 'Penhora', ano: 2024, mes: 12 })
    expect(result.gestor).toBe('Maria')
    expect(result.acto).toBe('Penhora')
    expect(result.ano).toBe(2024)
    expect(result.mes).toBe(12)
  })
})

describe('sanitizeDashboardFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizeDashboardFilters({})
    expect(result.tipo).toBe('todos')
    expect(result.estadoId).toBe('todos')
    expect(result.exequente).toBe('')
    expect(result.gestor).toBe('')
  })

  it('validates tipo enum', () => {
    expect(sanitizeDashboardFilters({ tipo: 'exequente' }).tipo).toBe('exequente')
    expect(sanitizeDashboardFilters({ tipo: 'executado' }).tipo).toBe('executado')
    expect(sanitizeDashboardFilters({ tipo: 'invalid' }).tipo).toBe('todos')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/sanitizers.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/sanitizers.test.ts
git commit -m "test: add unit tests for sanitizers.ts"
```

---

### Task 7: Tests for `dashboardWidgets.ts`

**Files:**
- Create: `src/lib/__tests__/dashboardWidgets.test.ts`
- Reference: `src/lib/dashboardWidgets.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  clampDashboardWidgetHeight,
  clampDashboardWidgetColSpan,
  sanitizeDashboardWidgetSize,
  sanitizeDashboardWidgetColumn,
  defaultDashboardWidgetLayout,
  DASHBOARD_WIDGET_MIN_HEIGHT,
  DASHBOARD_WIDGET_MAX_HEIGHT,
} from '../dashboardWidgets'

describe('clampDashboardWidgetHeight', () => {
  it('clamps below minimum', () => {
    expect(clampDashboardWidgetHeight(10)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
  })

  it('clamps above maximum', () => {
    expect(clampDashboardWidgetHeight(99999)).toBe(DASHBOARD_WIDGET_MAX_HEIGHT)
  })

  it('rounds to integer', () => {
    expect(clampDashboardWidgetHeight(150.7)).toBe(151)
  })

  it('returns min for NaN/Infinity', () => {
    expect(clampDashboardWidgetHeight(NaN)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
    expect(clampDashboardWidgetHeight(Infinity)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
  })
})

describe('clampDashboardWidgetColSpan', () => {
  it('clamps to 1-3 range', () => {
    expect(clampDashboardWidgetColSpan(0)).toBe(1)
    expect(clampDashboardWidgetColSpan(5)).toBe(3)
    expect(clampDashboardWidgetColSpan(2)).toBe(2)
  })

  it('returns 1 for NaN', () => {
    expect(clampDashboardWidgetColSpan(NaN)).toBe(1)
  })
})

describe('sanitizeDashboardWidgetSize', () => {
  it('accepts valid values', () => {
    expect(sanitizeDashboardWidgetSize('kpi', 'normal')).toBe('kpi')
    expect(sanitizeDashboardWidgetSize('wide', 'normal')).toBe('wide')
  })

  it('returns fallback for invalid values', () => {
    expect(sanitizeDashboardWidgetSize('huge', 'normal')).toBe('normal')
    expect(sanitizeDashboardWidgetSize(42, 'kpi')).toBe('kpi')
  })
})

describe('sanitizeDashboardWidgetColumn', () => {
  it('accepts valid values', () => {
    expect(sanitizeDashboardWidgetColumn('main', 'side')).toBe('main')
    expect(sanitizeDashboardWidgetColumn('side', 'main')).toBe('side')
  })

  it('returns fallback for invalid values', () => {
    expect(sanitizeDashboardWidgetColumn('center', 'main')).toBe('main')
  })
})

describe('defaultDashboardWidgetLayout', () => {
  it('returns kpi layout for kpi- types', () => {
    const layout = defaultDashboardWidgetLayout('kpi-registos')
    expect(layout.size).toBe('kpi')
    expect(layout.column).toBe('side')
  })

  it('returns wide layout for chart types', () => {
    const layout = defaultDashboardWidgetLayout('chart-status')
    expect(layout.size).toBe('wide')
    expect(layout.colSpan).toBe(2)
  })

  it('returns normal layout for list types', () => {
    const layout = defaultDashboardWidgetLayout('list-top-gestores')
    expect(layout.size).toBe('normal')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/dashboardWidgets.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/dashboardWidgets.test.ts
git commit -m "test: add unit tests for dashboardWidgets.ts"
```

---

### Task 8: Tests for `dsHelpers.ts`

**Files:**
- Create: `src/lib/__tests__/dsHelpers.test.ts`
- Reference: `src/lib/dsHelpers.ts`, `src/types.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { dsFormToPayload, dsRecordToForm } from '../dsHelpers'
import type { DsEntryForm, DsRecord } from '../../types'

describe('dsFormToPayload', () => {
  it('converts numeric form fields to numbers', () => {
    const form: DsEntryForm = {
      gestora: 'Gestora A', proponentes: '', referencia: 'REF-001',
      produto: '', entidadeBancaria: 'CGD', liderCalculo: '',
      recibo: '', faltaReciboGestora: '',
      valor: '1.234,56', dataEscritura: '2025-01-15', dataFechoCrm: '',
      comissaoLoja: '500,00', ivaCgdRaw: '', totalComissaoLojaCmIva: '',
      comissaoGestor: '200,00', percentagem: '10,50',
      pagComissaoGestor: '', estadoId: 's1',
    }
    const payload = dsFormToPayload(form)
    expect(payload.valor).toBeCloseTo(1234.56)
    expect(payload.comissaoLoja).toBeCloseTo(500)
    expect(payload.comissaoGestor).toBeCloseTo(200)
    expect(payload.percentagem).toBeCloseTo(10.5)
    expect(payload.gestora).toBe('Gestora A')
    expect(payload.proponentes).toBeUndefined()
  })
})

describe('dsRecordToForm', () => {
  it('converts numbers back to PT-formatted strings', () => {
    const record = {
      id: 'd1', gestora: 'Gestora A', proponentes: null,
      referencia: 'REF-001', produto: null, entidadeBancaria: 'CGD',
      liderCalculo: null, recibo: null, faltaReciboGestora: null,
      valor: 1234.56, valorRaw: '1234,56',
      dataEscritura: '2025-01-15', dataFechoCrm: null,
      comissaoLoja: 500, comissaoLojaRaw: null,
      ivaCgdRaw: null, ivaCgdValor: null,
      totalComissaoLojaCmIva: null, totalComissaoLojaCmIvaRaw: null,
      comissaoGestor: 200, comissaoGestorRaw: null,
      percentagem: 10.5, percentagemRaw: null,
      pagComissaoGestor: null, estadoId: 's1',
      createdAt: '', updatedAt: '', history: [],
    } as unknown as DsRecord
    const form = dsRecordToForm(record)
    expect(form.valor).toBe('1234,56')
    expect(form.comissaoLoja).toBe('500,00')
    expect(form.gestora).toBe('Gestora A')
    expect(form.proponentes).toBe('')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/dsHelpers.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/dsHelpers.test.ts
git commit -m "test: add unit tests for dsHelpers.ts"
```

---

### Task 9: Tests for `penhorasHelpers.ts`

**Files:**
- Create: `src/lib/__tests__/penhorasHelpers.test.ts`
- Reference: `src/lib/penhorasHelpers.ts`, `src/types.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest'
import { penhorasFormToPayload, penhorasRecordToForm } from '../penhorasHelpers'
import type { PenhorasEntryForm, PenhorasRecord } from '../../types'

describe('penhorasFormToPayload', () => {
  it('trims and converts empty strings to undefined', () => {
    const form: PenhorasEntryForm = {
      pe: '  PE-001  ', acto: '', dataPedido: '2025-01-10',
      identificacao: '', pedido: 'Pedido X', gestor: 'Maria',
      estadoId: 's1',
    }
    const payload = penhorasFormToPayload(form)
    expect(payload.pe).toBe('PE-001')
    expect(payload.acto).toBeUndefined()
    expect(payload.pedido).toBe('Pedido X')
    expect(payload.gestor).toBe('Maria')
    expect(payload.estadoId).toBe('s1')
  })
})

describe('penhorasRecordToForm', () => {
  it('converts null fields to empty strings', () => {
    const record = {
      id: 'p1', pe: 'PE-001', acto: null,
      dataPedido: '2025-01-10', identificacao: null,
      pedido: 'Pedido X', gestor: 'Maria', estadoId: 's1',
      createdAt: '', updatedAt: '', history: [],
    } as unknown as PenhorasRecord
    const form = penhorasRecordToForm(record)
    expect(form.pe).toBe('PE-001')
    expect(form.acto).toBe('')
    expect(form.identificacao).toBe('')
    expect(form.gestor).toBe('Maria')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/penhorasHelpers.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/penhorasHelpers.test.ts
git commit -m "test: add unit tests for penhorasHelpers.ts"
```

---

### Task 10: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All 8 test files pass, 0 failures

**Step 2: Verify build still passes**

Run: `npm run build:prod`
Expected: Clean build, 0 errors

**Step 3: Commit if any fixups were needed**

---

## Part B: Server Refactor

### Task 11: Extract middleware

**Files:**
- Create: `server/src/middleware/cors.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Modify: `server/src/index.ts`

**Step 1: Create `server/src/middleware/cors.ts`**

Extract the CORS setup (lines 36-50 of index.ts):

```ts
import cors from 'cors'

export function createCorsMiddleware() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : []

  return cors({
    origin: process.env.NODE_ENV === 'production' && allowedOrigins.length > 0
      ? allowedOrigins
      : true,
    credentials: true,
  })
}
```

**Step 2: Create `server/src/middleware/errorHandler.ts`**

Extract the error handler (last middleware in index.ts):

```ts
import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[unhandled]', err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ error: message })
}
```

**Step 3: Update `server/src/index.ts`**

Replace inline CORS and error handler with imports:

```ts
import { createCorsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'

// Replace inline cors(...) call with:
app.use(createCorsMiddleware())

// Replace inline error handler with:
app.use(errorHandler)
```

Remove the `allowedOrigins` variable and inline CORS config from index.ts.

**Step 4: Verify**

Run: `npm run build:prod`
Expected: Clean build

**Step 5: Commit**

```bash
git add server/src/middleware/ server/src/index.ts
git commit -m "refactor: extract middleware into server/src/middleware/"
```

---

### Task 12: Extract schemas

**Files:**
- Create: `server/src/schemas/records.ts`
- Create: `server/src/schemas/ds.ts`
- Create: `server/src/schemas/penhoras.ts`
- Modify: `server/src/index.ts`

**Step 1: Create schema files**

Move the Zod schemas from index.ts:
- `recordInputSchema`, `recordPatchSchema` → `server/src/schemas/records.ts`
- `dsRecordInputSchema`, `dsRecordPatchSchema` → `server/src/schemas/ds.ts`
- `penhorasRecordInputSchema`, `penhorasRecordPatchSchema` → `server/src/schemas/penhoras.ts`

Each file exports the schemas. Import `z` from `'zod'` in each.

**Step 2: Update `server/src/index.ts`**

Replace schema definitions with imports from `./schemas/*`.

**Step 3: Verify**

Run: `npm run build:prod`
Expected: Clean build

**Step 4: Commit**

```bash
git add server/src/schemas/ server/src/index.ts
git commit -m "refactor: extract Zod schemas into server/src/schemas/"
```

---

### Task 13: Extract `services/shared.ts`

**Files:**
- Create: `server/src/services/shared.ts`
- Modify: `server/src/index.ts`

**Step 1: Create services/shared.ts**

Move these cross-domain helpers from index.ts:
- `toStatusDto` (line ~401)
- `savedViewDto` (line ~421)
- `queryValue` (line ~1361)
- `toNumberFromDecimal` (line ~1425)
- `duplicateVariant` (line ~711)
- `toApiTaxRule` (line ~722)
- `parseLooseNumber` (line ~735)
- `toDateOrNull` (line ~771)
- `normalizeStatusToken` (line ~574)
- `databaseSetupHint` (line ~53)
- `normalizeSuggestionValues` (line ~1345)

Export all. Keep same signatures.

**Step 2: Update index.ts to import from `./services/shared`**

**Step 3: Verify**

Run: `npm run build:prod`
Expected: Clean build

**Step 4: Commit**

```bash
git add server/src/services/shared.ts server/src/index.ts
git commit -m "refactor: extract shared service helpers"
```

---

### Task 14: Extract Records domain (services + routes)

**Files:**
- Create: `server/src/services/records.ts`
- Create: `server/src/routes/records.ts`
- Modify: `server/src/index.ts`

**Step 1: Create `server/src/services/records.ts`**

Move from index.ts:
- `mergeRecordWithPatch` (line ~319)
- `asRecordInput` (line ~354)
- `buildRecordWhere` (line ~1368)
- `ensureDefaults` (line ~433)

These need access to `prisma` — pass it as a parameter or export a factory.

**Step 2: Create `server/src/routes/records.ts`**

Create an `express.Router()` containing all `/api/records/*`, `/api/bootstrap`, `/api/analytics/*`, `/api/import/*` routes. Accept `prisma` as a parameter:

```ts
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'

export function createRecordsRouter(prisma: PrismaClient): Router {
  const router = Router()
  // Move all records routes here, replacing `app.` with `router.`
  // Strip the `/api` prefix — mount point will add it
  return router
}
```

**Step 3: Mount in index.ts**

```ts
import { createRecordsRouter } from './routes/records'
app.use('/api', createRecordsRouter(prisma))
```

Remove extracted routes from index.ts.

**Step 4: Verify**

Run: `npm run build:prod`
Expected: Clean build

**Step 5: Smoke test**

Run the app and verify `/api/records` and `/api/bootstrap` return 200.

**Step 6: Commit**

```bash
git add server/src/services/records.ts server/src/routes/records.ts server/src/index.ts
git commit -m "refactor: extract Records domain into routes + services"
```

---

### Task 15: Extract DS domain (services + routes)

**Files:**
- Create: `server/src/services/ds.ts`
- Create: `server/src/routes/ds.ts`
- Modify: `server/src/index.ts`

Same pattern as Task 14. Move from index.ts:
- **services/ds.ts:** `asDsRecordInput`, `toPrismaDsRecordData`, `prismaDsRecordToDto`, `ensureDsDefaults`, `buildDsRecordKey`, `buildDsRecordWhere`, `mergeDsRecordWithPatch`, `detectDsIvaKind`, DS status resolution helpers (`getDefaultDsStatusId`, `resolveDsStatusId`)
- **routes/ds.ts:** All `/api/ds/*` routes → `Router()`

Mount: `app.use('/api/ds', createDsRouter(prisma))`

**Verify:** `npm run build:prod` passes, `/api/ds/records` returns 200.

**Commit:**
```bash
git add server/src/services/ds.ts server/src/routes/ds.ts server/src/index.ts
git commit -m "refactor: extract DS domain into routes + services"
```

---

### Task 16: Extract Penhoras domain (services + routes)

**Files:**
- Create: `server/src/services/penhoras.ts`
- Create: `server/src/routes/penhoras.ts`
- Modify: `server/src/index.ts`

Same pattern. Move from index.ts:
- **services/penhoras.ts:** `asPenhorasRecordInput`, `toPrismaPenhorasRecordData`, `prismaPenhorasRecordToDto`, `ensurePenhorasDefaults`, `buildPenhorasRecordKey`, `buildPenhorasRecordWhere`, `mergePenhorasRecordWithPatch`, `runPenhorasDataMaintenance`, Penhoras normalization helpers, Penhoras status resolution helpers
- **routes/penhoras.ts:** All `/api/penhoras/*` routes → `Router()`

Mount: `app.use('/api/penhoras', createPenhorasRouter(prisma))`

**Verify:** `npm run build:prod` passes, `/api/penhoras/records` returns 200.

**Commit:**
```bash
git add server/src/services/penhoras.ts server/src/routes/penhoras.ts server/src/index.ts
git commit -m "refactor: extract Penhoras domain into routes + services"
```

---

### Task 17: Extract Statuses routes

**Files:**
- Create: `server/src/routes/statuses.ts`
- Modify: `server/src/index.ts`

Move all three status CRUD groups (records statuses, DS statuses, Penhoras statuses) into one router. These share identical patterns — use a factory function:

```ts
function createStatusCrud(prisma: PrismaClient, model: 'status' | 'dsStatus' | 'penhorasStatus') {
  // ... CRUD for the given model
}
```

Mount: `app.use('/api', createStatusesRouter(prisma))`

**Verify + Commit:**
```bash
git add server/src/routes/statuses.ts server/src/index.ts
git commit -m "refactor: extract status CRUD routes"
```

---

### Task 18: Extract Settings and Data routes

**Files:**
- Create: `server/src/routes/settings.ts`
- Create: `server/src/routes/data.ts`
- Modify: `server/src/index.ts`

- **settings.ts:** `/api/calculation-settings`, `/api/saved-views/*`
- **data.ts:** `/api/seed`, `/api/migrate/local-storage`

Mount both on `/api`.

**Verify + Commit:**
```bash
git add server/src/routes/settings.ts server/src/routes/data.ts server/src/index.ts
git commit -m "refactor: extract settings and data routes"
```

---

### Task 19: Slim down index.ts

**Files:**
- Modify: `server/src/index.ts`

**Goal:** index.ts should be ~80 lines containing only:
1. Imports
2. Environment variable validation
3. `const app = express()` + `const prisma = new PrismaClient()`
4. Middleware: CORS, JSON body parser
5. Router mounts
6. Error handler
7. Static file serving (production)
8. `app.listen()`

**Step 1:** Remove all remaining dead code, inline functions, and route handlers that were extracted.

**Step 2:** Verify

Run: `npm run build:prod`
Expected: Clean build

Run the production server and verify all major endpoints return 200:
- `/api/health`
- `/api/bootstrap`
- `/api/records`
- `/api/ds/records`
- `/api/penhoras/records`
- `/api/statuses`
- `/` (serves index.html)

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "refactor: slim index.ts to ~80 lines — server refactor complete"
```

---

### Task 20: Final verification

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All pass

**Step 2: Run production build**

Run: `npm run build:prod`
Expected: Clean build

**Step 3: Full smoke test**

Start production server, verify all API endpoints work.

**Step 4: Count lines**

Run: `wc -l server/src/index.ts`
Expected: ~80-120 lines

**Step 5: Final commit if needed**

---
