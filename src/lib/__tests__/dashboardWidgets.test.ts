import { describe, it, expect } from 'vitest'
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
    clampDashboardWidgetHeight,
    clampDashboardWidgetColSpan,
    sanitizeDashboardWidgetSize,
    sanitizeDashboardWidgetColumn,
    defaultDashboardWidgetLayout,
    defaultDsDashboardWidgetLayout,
    defaultPenhorasDashboardWidgetLayout,
    cloneDefaultDsDashboardWidgets,
    cloneDefaultPenhorasDashboardWidgets,
    parseDashboardWidgets,
    parseDsDashboardWidgets,
    parsePenhorasDashboardWidgets,
} from '../dashboardWidgets'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
    it('has expected height bounds', () => {
        expect(DASHBOARD_WIDGET_MIN_HEIGHT).toBe(96)
        expect(DASHBOARD_WIDGET_MAX_HEIGHT).toBe(2200)
    })
    it('has expected col-span bounds', () => {
        expect(DASHBOARD_WIDGET_MIN_COL_SPAN).toBe(1)
        expect(DASHBOARD_WIDGET_MAX_COL_SPAN).toBe(3)
    })
    it('DASHBOARD_WIDGET_LIBRARY contains 10 entries', () => {
        expect(DASHBOARD_WIDGET_LIBRARY).toHaveLength(10)
    })
    it('DS_DASHBOARD_WIDGET_LIBRARY contains 5 entries', () => {
        expect(DS_DASHBOARD_WIDGET_LIBRARY).toHaveLength(5)
    })
    it('PENHORAS_DASHBOARD_WIDGET_LIBRARY contains 3 entries', () => {
        expect(PENHORAS_DASHBOARD_WIDGET_LIBRARY).toHaveLength(3)
    })
})

// ---------------------------------------------------------------------------
// clampDashboardWidgetHeight
// ---------------------------------------------------------------------------

describe('clampDashboardWidgetHeight', () => {
    it('clamps below minimum to minimum', () => {
        expect(clampDashboardWidgetHeight(10)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
        expect(clampDashboardWidgetHeight(0)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
        expect(clampDashboardWidgetHeight(-50)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
    })
    it('clamps above maximum to maximum', () => {
        expect(clampDashboardWidgetHeight(99999)).toBe(DASHBOARD_WIDGET_MAX_HEIGHT)
        expect(clampDashboardWidgetHeight(3000)).toBe(DASHBOARD_WIDGET_MAX_HEIGHT)
    })
    it('passes through value in range', () => {
        expect(clampDashboardWidgetHeight(200)).toBe(200)
        expect(clampDashboardWidgetHeight(DASHBOARD_WIDGET_MIN_HEIGHT)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
        expect(clampDashboardWidgetHeight(DASHBOARD_WIDGET_MAX_HEIGHT)).toBe(DASHBOARD_WIDGET_MAX_HEIGHT)
    })
    it('rounds to nearest integer', () => {
        expect(clampDashboardWidgetHeight(150.7)).toBe(151)
        expect(clampDashboardWidgetHeight(150.3)).toBe(150)
    })
    it('returns min for NaN', () => {
        expect(clampDashboardWidgetHeight(NaN)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
    })
    it('returns min for Infinity', () => {
        expect(clampDashboardWidgetHeight(Infinity)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
        expect(clampDashboardWidgetHeight(-Infinity)).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)
    })
})

// ---------------------------------------------------------------------------
// clampDashboardWidgetColSpan
// ---------------------------------------------------------------------------

describe('clampDashboardWidgetColSpan', () => {
    it('clamps below minimum to 1', () => {
        expect(clampDashboardWidgetColSpan(0)).toBe(1)
        expect(clampDashboardWidgetColSpan(-3)).toBe(1)
    })
    it('clamps above maximum to 3', () => {
        expect(clampDashboardWidgetColSpan(5)).toBe(3)
        expect(clampDashboardWidgetColSpan(100)).toBe(3)
    })
    it('passes through valid values', () => {
        expect(clampDashboardWidgetColSpan(1)).toBe(1)
        expect(clampDashboardWidgetColSpan(2)).toBe(2)
        expect(clampDashboardWidgetColSpan(3)).toBe(3)
    })
    it('rounds to nearest integer', () => {
        expect(clampDashboardWidgetColSpan(1.6)).toBe(2)
        expect(clampDashboardWidgetColSpan(2.3)).toBe(2)
    })
    it('returns 1 for NaN', () => {
        expect(clampDashboardWidgetColSpan(NaN)).toBe(1)
    })
    it('returns 1 for Infinity', () => {
        expect(clampDashboardWidgetColSpan(Infinity)).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// sanitizeDashboardWidgetSize
// ---------------------------------------------------------------------------

describe('sanitizeDashboardWidgetSize', () => {
    it('accepts "kpi"', () => {
        expect(sanitizeDashboardWidgetSize('kpi', 'normal')).toBe('kpi')
    })
    it('accepts "normal"', () => {
        expect(sanitizeDashboardWidgetSize('normal', 'kpi')).toBe('normal')
    })
    it('accepts "wide"', () => {
        expect(sanitizeDashboardWidgetSize('wide', 'normal')).toBe('wide')
    })
    it('returns fallback for invalid string', () => {
        expect(sanitizeDashboardWidgetSize('huge', 'normal')).toBe('normal')
        expect(sanitizeDashboardWidgetSize('', 'wide')).toBe('wide')
    })
    it('returns fallback for non-string values', () => {
        expect(sanitizeDashboardWidgetSize(42, 'kpi')).toBe('kpi')
        expect(sanitizeDashboardWidgetSize(null, 'wide')).toBe('wide')
        expect(sanitizeDashboardWidgetSize(undefined, 'normal')).toBe('normal')
    })
})

// ---------------------------------------------------------------------------
// sanitizeDashboardWidgetColumn
// ---------------------------------------------------------------------------

describe('sanitizeDashboardWidgetColumn', () => {
    it('accepts "main"', () => {
        expect(sanitizeDashboardWidgetColumn('main', 'side')).toBe('main')
    })
    it('accepts "side"', () => {
        expect(sanitizeDashboardWidgetColumn('side', 'main')).toBe('side')
    })
    it('returns fallback for invalid string', () => {
        expect(sanitizeDashboardWidgetColumn('center', 'main')).toBe('main')
        expect(sanitizeDashboardWidgetColumn('', 'side')).toBe('side')
    })
    it('returns fallback for non-string values', () => {
        expect(sanitizeDashboardWidgetColumn(123, 'main')).toBe('main')
        expect(sanitizeDashboardWidgetColumn(null, 'side')).toBe('side')
        expect(sanitizeDashboardWidgetColumn(undefined, 'main')).toBe('main')
    })
})

// ---------------------------------------------------------------------------
// defaultDashboardWidgetLayout
// ---------------------------------------------------------------------------

describe('defaultDashboardWidgetLayout', () => {
    it('returns kpi layout for kpi- prefixed types', () => {
        const layout = defaultDashboardWidgetLayout('kpi-registos')
        expect(layout.size).toBe('kpi')
        expect(layout.minHeight).toBe(110)
        expect(layout.column).toBe('side')
        expect(layout.colSpan).toBe(1)
    })
    it('returns kpi layout for all kpi types', () => {
        for (const type of ['kpi-registos', 'kpi-valor-sem-iva', 'kpi-iva', 'kpi-retencao', 'kpi-levantado-com-iva'] as const) {
            expect(defaultDashboardWidgetLayout(type).size).toBe('kpi')
        }
    })
    it('returns wide layout for chart types', () => {
        for (const type of ['chart-status', 'chart-tipo', 'chart-mensal-emissao'] as const) {
            const layout = defaultDashboardWidgetLayout(type)
            expect(layout.size).toBe('wide')
            expect(layout.minHeight).toBe(210)
            expect(layout.column).toBe('main')
            expect(layout.colSpan).toBe(2)
        }
    })
    it('returns normal layout for list types', () => {
        for (const type of ['list-top-gestores', 'list-top-exequentes'] as const) {
            const layout = defaultDashboardWidgetLayout(type)
            expect(layout.size).toBe('normal')
            expect(layout.minHeight).toBe(180)
            expect(layout.column).toBe('main')
            expect(layout.colSpan).toBe(1)
        }
    })
})

// ---------------------------------------------------------------------------
// defaultDsDashboardWidgetLayout
// ---------------------------------------------------------------------------

describe('defaultDsDashboardWidgetLayout', () => {
    it('returns layout matching DEFAULT_DS_DASHBOARD_WIDGETS for known types', () => {
        const layout = defaultDsDashboardWidgetLayout('ds-mensal')
        expect(layout.size).toBe('wide')
        expect(layout.minHeight).toBe(220)
        expect(layout.column).toBe('main')
        expect(layout.colSpan).toBe(2)
    })
    it('returns kpi layout for ds-recibos', () => {
        const layout = defaultDsDashboardWidgetLayout('ds-recibos')
        expect(layout.size).toBe('kpi')
        expect(layout.column).toBe('side')
        expect(layout.colSpan).toBe(1)
    })
    it('returns normal defaults for known status type', () => {
        const layout = defaultDsDashboardWidgetLayout('ds-status')
        expect(layout.size).toBe('normal')
        expect(layout.minHeight).toBe(210)
    })
})

// ---------------------------------------------------------------------------
// defaultPenhorasDashboardWidgetLayout
// ---------------------------------------------------------------------------

describe('defaultPenhorasDashboardWidgetLayout', () => {
    it('returns layout matching DEFAULT_PENHORAS_DASHBOARD_WIDGETS for known types', () => {
        const layout = defaultPenhorasDashboardWidgetLayout('penhoras-mensal')
        expect(layout.size).toBe('wide')
        expect(layout.minHeight).toBe(220)
        expect(layout.column).toBe('main')
        expect(layout.colSpan).toBe(2)
    })
    it('returns normal layout for penhoras-status', () => {
        const layout = defaultPenhorasDashboardWidgetLayout('penhoras-status')
        expect(layout.size).toBe('normal')
        expect(layout.minHeight).toBe(210)
        expect(layout.column).toBe('main')
        expect(layout.colSpan).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// cloneDefaultDsDashboardWidgets
// ---------------------------------------------------------------------------

describe('cloneDefaultDsDashboardWidgets', () => {
    it('returns same number of widgets', () => {
        expect(cloneDefaultDsDashboardWidgets()).toHaveLength(DEFAULT_DS_DASHBOARD_WIDGETS.length)
    })
    it('returns deep copies (not same references)', () => {
        const cloned = cloneDefaultDsDashboardWidgets()
        for (let i = 0; i < cloned.length; i++) {
            expect(cloned[i]).toEqual(DEFAULT_DS_DASHBOARD_WIDGETS[i])
            expect(cloned[i]).not.toBe(DEFAULT_DS_DASHBOARD_WIDGETS[i])
        }
    })
    it('mutations do not affect originals', () => {
        const cloned = cloneDefaultDsDashboardWidgets()
        cloned[0].minHeight = 9999
        expect(DEFAULT_DS_DASHBOARD_WIDGETS[0].minHeight).not.toBe(9999)
    })
})

// ---------------------------------------------------------------------------
// cloneDefaultPenhorasDashboardWidgets
// ---------------------------------------------------------------------------

describe('cloneDefaultPenhorasDashboardWidgets', () => {
    it('returns same number of widgets', () => {
        expect(cloneDefaultPenhorasDashboardWidgets()).toHaveLength(DEFAULT_PENHORAS_DASHBOARD_WIDGETS.length)
    })
    it('returns deep copies (not same references)', () => {
        const cloned = cloneDefaultPenhorasDashboardWidgets()
        for (let i = 0; i < cloned.length; i++) {
            expect(cloned[i]).toEqual(DEFAULT_PENHORAS_DASHBOARD_WIDGETS[i])
            expect(cloned[i]).not.toBe(DEFAULT_PENHORAS_DASHBOARD_WIDGETS[i])
        }
    })
    it('mutations do not affect originals', () => {
        const cloned = cloneDefaultPenhorasDashboardWidgets()
        cloned[0].minHeight = 9999
        expect(DEFAULT_PENHORAS_DASHBOARD_WIDGETS[0].minHeight).not.toBe(9999)
    })
})

// ---------------------------------------------------------------------------
// parseDashboardWidgets
// ---------------------------------------------------------------------------

describe('parseDashboardWidgets', () => {
    it('returns empty array for non-array input', () => {
        expect(parseDashboardWidgets(null)).toEqual([])
        expect(parseDashboardWidgets(undefined)).toEqual([])
        expect(parseDashboardWidgets('string')).toEqual([])
        expect(parseDashboardWidgets(42)).toEqual([])
        expect(parseDashboardWidgets({})).toEqual([])
    })

    it('returns empty array for empty array', () => {
        expect(parseDashboardWidgets([])).toEqual([])
    })

    it('skips non-object items', () => {
        expect(parseDashboardWidgets([null, 42, 'str'])).toEqual([])
    })

    it('skips items with invalid type', () => {
        expect(parseDashboardWidgets([{ type: 'invalid-type' }])).toEqual([])
        expect(parseDashboardWidgets([{ type: 123 }])).toEqual([])
        expect(parseDashboardWidgets([{}])).toEqual([])
    })

    it('parses a valid kpi widget with defaults', () => {
        const result = parseDashboardWidgets([{ id: 'w1', type: 'kpi-registos' }])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('w1')
        expect(result[0].type).toBe('kpi-registos')
        expect(result[0].size).toBe('kpi')
        expect(result[0].column).toBe('side')
        expect(result[0].colSpan).toBe(1) // side column forces colSpan=1
        expect(result[0].minHeight).toBe(clampDashboardWidgetHeight(110))
    })

    it('parses a valid chart widget with defaults', () => {
        const result = parseDashboardWidgets([{ id: 'c1', type: 'chart-status' }])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('wide')
        expect(result[0].column).toBe('main')
        expect(result[0].colSpan).toBe(2)
    })

    it('parses a valid list widget with defaults', () => {
        const result = parseDashboardWidgets([{ id: 'l1', type: 'list-top-gestores' }])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('normal')
        expect(result[0].column).toBe('main')
        expect(result[0].colSpan).toBe(1)
    })

    it('respects provided size, column, minHeight, colSpan overrides', () => {
        const result = parseDashboardWidgets([
            { id: 'x1', type: 'chart-status', size: 'normal', column: 'main', minHeight: 300, colSpan: 3 },
        ])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('normal')
        expect(result[0].column).toBe('main')
        expect(result[0].minHeight).toBe(300)
        expect(result[0].colSpan).toBe(3)
    })

    it('forces colSpan=1 when column is "side"', () => {
        const result = parseDashboardWidgets([
            { id: 'x2', type: 'chart-status', column: 'side', colSpan: 3 },
        ])
        expect(result[0].colSpan).toBe(1)
    })

    it('generates id when missing or blank', () => {
        const result = parseDashboardWidgets([{ type: 'kpi-iva' }])
        expect(result).toHaveLength(1)
        expect(typeof result[0].id).toBe('string')
        expect(result[0].id.length).toBeGreaterThan(0)

        const result2 = parseDashboardWidgets([{ id: '  ', type: 'kpi-iva' }])
        expect(result2[0].id).not.toBe('  ')
    })

    it('clamps minHeight within bounds', () => {
        const result = parseDashboardWidgets([{ id: 'h1', type: 'kpi-registos', minHeight: 5 }])
        expect(result[0].minHeight).toBe(DASHBOARD_WIDGET_MIN_HEIGHT)

        const result2 = parseDashboardWidgets([{ id: 'h2', type: 'kpi-registos', minHeight: 99999 }])
        expect(result2[0].minHeight).toBe(DASHBOARD_WIDGET_MAX_HEIGHT)
    })

    it('handles multiple widgets, filtering out invalid ones', () => {
        const result = parseDashboardWidgets([
            { id: 'a', type: 'kpi-registos' },
            { type: 'bogus' },
            null,
            { id: 'b', type: 'chart-status' },
        ])
        expect(result).toHaveLength(2)
        expect(result[0].type).toBe('kpi-registos')
        expect(result[1].type).toBe('chart-status')
    })
})

// ---------------------------------------------------------------------------
// parseDsDashboardWidgets
// ---------------------------------------------------------------------------

describe('parseDsDashboardWidgets', () => {
    it('returns empty array for non-array input', () => {
        expect(parseDsDashboardWidgets(null)).toEqual([])
        expect(parseDsDashboardWidgets('string')).toEqual([])
    })

    it('skips items with invalid type', () => {
        expect(parseDsDashboardWidgets([{ type: 'not-a-ds-type' }])).toEqual([])
    })

    it('parses valid ds widget', () => {
        const result = parseDsDashboardWidgets([{ id: 'd1', type: 'ds-status' }])
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('ds-status')
        expect(result[0].size).toBe('normal')
        expect(result[0].column).toBe('main')
    })

    it('parses ds-recibos as kpi/side', () => {
        const result = parseDsDashboardWidgets([{ id: 'd2', type: 'ds-recibos' }])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('kpi')
        expect(result[0].column).toBe('side')
        expect(result[0].colSpan).toBe(1)
    })

    it('parses ds-mensal as wide', () => {
        const result = parseDsDashboardWidgets([{ id: 'd3', type: 'ds-mensal' }])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('wide')
        expect(result[0].colSpan).toBe(2)
    })

    it('rejects recibos widget types', () => {
        expect(parseDsDashboardWidgets([{ id: 'r1', type: 'kpi-registos' }])).toEqual([])
    })

    it('generates id when missing', () => {
        const result = parseDsDashboardWidgets([{ type: 'ds-status' }])
        expect(result).toHaveLength(1)
        expect(typeof result[0].id).toBe('string')
        expect(result[0].id.length).toBeGreaterThan(0)
    })
})

// ---------------------------------------------------------------------------
// parsePenhorasDashboardWidgets
// ---------------------------------------------------------------------------

describe('parsePenhorasDashboardWidgets', () => {
    it('returns empty array for non-array input', () => {
        expect(parsePenhorasDashboardWidgets(null)).toEqual([])
        expect(parsePenhorasDashboardWidgets(42)).toEqual([])
    })

    it('skips items with invalid type', () => {
        expect(parsePenhorasDashboardWidgets([{ type: 'not-a-penhoras-type' }])).toEqual([])
    })

    it('parses valid penhoras widget', () => {
        const result = parsePenhorasDashboardWidgets([{ id: 'p1', type: 'penhoras-status' }])
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('penhoras-status')
        expect(result[0].size).toBe('normal')
        expect(result[0].column).toBe('main')
        expect(result[0].colSpan).toBe(1)
    })

    it('parses penhoras-mensal as wide', () => {
        const result = parsePenhorasDashboardWidgets([{ id: 'p2', type: 'penhoras-mensal' }])
        expect(result).toHaveLength(1)
        expect(result[0].size).toBe('wide')
        expect(result[0].colSpan).toBe(2)
    })

    it('rejects ds or recibos widget types', () => {
        expect(parsePenhorasDashboardWidgets([{ type: 'ds-status' }])).toEqual([])
        expect(parsePenhorasDashboardWidgets([{ type: 'kpi-registos' }])).toEqual([])
    })

    it('generates id when missing', () => {
        const result = parsePenhorasDashboardWidgets([{ type: 'penhoras-status' }])
        expect(result).toHaveLength(1)
        expect(typeof result[0].id).toBe('string')
        expect(result[0].id.length).toBeGreaterThan(0)
    })

    it('forces colSpan=1 when column is "side"', () => {
        const result = parsePenhorasDashboardWidgets([
            { id: 'p3', type: 'penhoras-status', column: 'side', colSpan: 3 },
        ])
        expect(result[0].colSpan).toBe(1)
    })
})
