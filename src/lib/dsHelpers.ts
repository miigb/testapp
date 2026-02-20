/**
 * DS module domain helpers — pure functions, no React dependencies.
 */

import type { DsEntryForm, DsRecord } from '../types'
import { toFormNumber } from './formatters'
import { parseFormNumber } from './calculations'

export function getInitialDsEntryForm(defaultStatusId: string): DsEntryForm {
    const now = new Date()
    return {
        gestora: '',
        proponentes: '',
        referencia: '',
        produto: '',
        entidadeBancaria: '',
        liderCalculo: '',
        recibo: '',
        faltaReciboGestora: '',
        valor: '',
        dataEscritura: now.toISOString().slice(0, 10),
        dataFechoCrm: '',
        comissaoLoja: '',
        ivaCgdRaw: '',
        totalComissaoLojaCmIva: '',
        comissaoGestor: '',
        percentagem: '',
        pagComissaoGestor: '',
        estadoId: defaultStatusId,
    }
}

export function dsFormToPayload(form: DsEntryForm): Partial<DsRecord> {
    return {
        gestora: form.gestora.trim() || undefined,
        proponentes: form.proponentes.trim() || undefined,
        referencia: form.referencia.trim() || undefined,
        produto: form.produto.trim() || undefined,
        entidadeBancaria: form.entidadeBancaria.trim() || undefined,
        liderCalculo: form.liderCalculo.trim() || undefined,
        recibo: form.recibo.trim() || undefined,
        faltaReciboGestora: form.faltaReciboGestora.trim() || undefined,
        valorRaw: form.valor.trim() || undefined,
        valor: parseFormNumber(form.valor),
        dataEscritura: form.dataEscritura || undefined,
        dataFechoCrm: form.dataFechoCrm || undefined,
        comissaoLojaRaw: form.comissaoLoja.trim() || undefined,
        comissaoLoja: parseFormNumber(form.comissaoLoja),
        ivaCgdRaw: form.ivaCgdRaw.trim() || undefined,
        totalComissaoLojaCmIvaRaw: form.totalComissaoLojaCmIva.trim() || undefined,
        totalComissaoLojaCmIva: parseFormNumber(form.totalComissaoLojaCmIva),
        comissaoGestorRaw: form.comissaoGestor.trim() || undefined,
        comissaoGestor: parseFormNumber(form.comissaoGestor),
        percentagemRaw: form.percentagem.trim() || undefined,
        percentagem: parseFormNumber(form.percentagem),
        pagComissaoGestor: form.pagComissaoGestor || undefined,
        estadoId: form.estadoId,
    }
}

export function dsRecordToForm(record: DsRecord): DsEntryForm {
    return {
        gestora: record.gestora ?? '',
        proponentes: record.proponentes ?? '',
        referencia: record.referencia ?? '',
        produto: record.produto ?? '',
        entidadeBancaria: record.entidadeBancaria ?? '',
        liderCalculo: record.liderCalculo ?? '',
        recibo: record.recibo ?? '',
        faltaReciboGestora: record.faltaReciboGestora ?? '',
        valor: toFormNumber(record.valor),
        dataEscritura: record.dataEscritura ?? '',
        dataFechoCrm: record.dataFechoCrm ?? '',
        comissaoLoja: toFormNumber(record.comissaoLoja),
        ivaCgdRaw: record.ivaCgdRaw ?? toFormNumber(record.ivaCgdValor),
        totalComissaoLojaCmIva: toFormNumber(record.totalComissaoLojaCmIva),
        comissaoGestor: toFormNumber(record.comissaoGestor),
        percentagem: toFormNumber(record.percentagem),
        pagComissaoGestor: record.pagComissaoGestor ?? '',
        estadoId: record.estadoId,
    }
}
