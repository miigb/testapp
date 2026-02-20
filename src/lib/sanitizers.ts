/**
 * Filter sanitizers — validate and normalise raw filter values from
 * localStorage, saved views, or URL params before passing them to API calls.
 * Pure functions — no side effects.
 */

import type { DsRecordFilters, PenhorasRecordFilters, RecordFilters } from '../types'

function parseNumericFilter(value: unknown, min: number, max: number): number | 'todos' {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return 'todos'
    return numeric
}

export function sanitizeDsFilters(input: unknown): DsRecordFilters {
    const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

    return {
        estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
        gestora: typeof payload.gestora === 'string' ? payload.gestora : '',
        entidadeBancaria: typeof payload.entidadeBancaria === 'string' ? payload.entidadeBancaria : '',
        produto: typeof payload.produto === 'string' ? payload.produto : '',
        reciboEstado:
            payload.reciboEstado === 'com-recibo' || payload.reciboEstado === 'sem-recibo' ? payload.reciboEstado : 'todos',
        ano: parseNumericFilter(payload.ano, 2000, 9999),
        mes: parseNumericFilter(payload.mes, 1, 12),
        page: 1,
        pageSize: 300,
    }
}

export function sanitizePenhorasFilters(input: unknown): PenhorasRecordFilters {
    const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

    return {
        estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
        gestor: typeof payload.gestor === 'string' ? payload.gestor : '',
        acto: typeof payload.acto === 'string' ? payload.acto : '',
        ano: parseNumericFilter(payload.ano, 2000, 9999),
        mes: parseNumericFilter(payload.mes, 1, 12),
        page: 1,
        pageSize: 300,
    }
}

export function sanitizeDashboardFilters(input: unknown): RecordFilters {
    const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

    return {
        tipo: payload.tipo === 'exequente' || payload.tipo === 'executado' ? payload.tipo : 'todos',
        estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
        mes: parseNumericFilter(payload.mes, 1, 12),
        ano: parseNumericFilter(payload.ano, 2000, 9999),
        exequente: typeof payload.exequente === 'string' ? payload.exequente : '',
        gestor: typeof payload.gestor === 'string' ? payload.gestor : '',
        page: 1,
        pageSize: 300,
    }
}
