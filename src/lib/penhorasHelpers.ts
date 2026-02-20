/**
 * Penhoras module domain helpers — pure functions, no React dependencies.
 */

import type { PenhorasEntryForm, PenhorasRecord } from '../types'

export function getInitialPenhorasEntryForm(defaultStatusId: string): PenhorasEntryForm {
    const now = new Date()
    return {
        pe: '',
        acto: '',
        dataPedido: now.toISOString().slice(0, 10),
        identificacao: '',
        pedido: '',
        gestor: '',
        estadoId: defaultStatusId,
    }
}

export function penhorasFormToPayload(form: PenhorasEntryForm): Partial<PenhorasRecord> {
    return {
        pe: form.pe.trim() || undefined,
        acto: form.acto.trim() || undefined,
        dataPedido: form.dataPedido || undefined,
        identificacao: form.identificacao.trim() || undefined,
        pedido: form.pedido.trim() || undefined,
        gestor: form.gestor.trim() || undefined,
        estadoId: form.estadoId,
    }
}

export function penhorasRecordToForm(record: PenhorasRecord): PenhorasEntryForm {
    return {
        pe: record.pe ?? '',
        acto: record.acto ?? '',
        dataPedido: record.dataPedido ?? '',
        identificacao: record.identificacao ?? '',
        pedido: record.pedido ?? '',
        gestor: record.gestor ?? '',
        estadoId: record.estadoId,
    }
}
