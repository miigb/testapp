/**
 * Domain-specific helpers for the Recibos (receipts) module.
 * Pure functions — no side effects, no React dependencies.
 */

import type { EntryForm, ReceiptRecord, RecordType } from '../types'
import { normalizeText } from './formatters'
import { toFormNumber } from './formatters'
import { parseFormNumber } from './calculations'

// ---- Indicacoes parsing ------------------------------------------------

const INDICACOES_SEPARATOR = ' | '

export function extractGpeSeFromIndicacoes(indicacoes?: string): { gpeSe: string; text: string } {
    if (!indicacoes) return { gpeSe: '', text: '' }

    const chunks = indicacoes
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)

    let gpeSe = ''
    const remaining: string[] = []

    for (const chunk of chunks) {
        const match = chunk.match(/^GPESE:\s*(.+)$/i)
        if (match) {
            gpeSe = match[1].trim()
            continue
        }
        remaining.push(chunk)
    }

    return { gpeSe, text: remaining.join(' | ') }
}

export function composeIndicacoes(gpeSe: string, indicacoes: string): string | undefined {
    const chunks: string[] = []
    const parsedGpeSe = parseFormNumber(gpeSe)
    const trimmedGpeSe = typeof parsedGpeSe === 'number' ? toFormNumber(parsedGpeSe) : gpeSe.trim()
    const trimmedIndicacoes = indicacoes.trim()

    if (trimmedGpeSe) {
        chunks.push(`GPESE: ${trimmedGpeSe}`)
    }
    if (trimmedIndicacoes) {
        chunks.push(trimmedIndicacoes)
    }

    return chunks.length > 0 ? chunks.join(INDICACOES_SEPARATOR) : undefined
}

// ---- Form helpers -------------------------------------------------------

export function getInitialEntryForm(defaultStatusId: string): EntryForm {
    const now = new Date()
    return {
        tipo: 'exequente',
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
        processo: '',
        pe: '',
        reciboNumero: '',
        dataLevantamento: '',
        dataRecibo: '',
        valorIndicado: '',
        valorSemIva: '',
        iva: '',
        retencao: '',
        valorEmissao: '',
        meu5: '',
        outrasTaxas: '',
        gpeSe: '',
        gestor: '',
        exequente: '',
        descricaoValor: '',
        estadoId: defaultStatusId,
        indicacoes: '',
    }
}

export function formToPayload(form: EntryForm): Partial<ReceiptRecord> & { tipo: RecordType; mes: number; ano: number } {
    return {
        tipo: form.tipo,
        mes: form.mes,
        ano: form.ano,
        processo: form.processo.trim() || undefined,
        pe: form.pe.trim() || undefined,
        reciboNumero: form.reciboNumero.trim() || undefined,
        dataLevantamento: form.dataLevantamento || undefined,
        dataRecibo: form.dataRecibo || undefined,
        valorIndicado: parseFormNumber(form.valorIndicado),
        valorSemIva: parseFormNumber(form.valorSemIva),
        iva: parseFormNumber(form.iva),
        retencao: parseFormNumber(form.retencao),
        valorEmissao: parseFormNumber(form.valorEmissao),
        meu5: parseFormNumber(form.meu5),
        outrasTaxas: parseFormNumber(form.outrasTaxas),
        gestor: form.gestor.trim() || undefined,
        exequente: form.exequente.trim() || undefined,
        descricaoValor: form.descricaoValor.trim() || undefined,
        estadoId: form.estadoId,
        indicacoes: composeIndicacoes(form.gpeSe, form.indicacoes),
    }
}

export function recordToForm(record: ReceiptRecord): EntryForm {
    const parsedIndicacoes = extractGpeSeFromIndicacoes(record.indicacoes)
    const parsedGpeSe = parseFormNumber(parsedIndicacoes.gpeSe)
    return {
        tipo: record.tipo,
        mes: record.mes,
        ano: record.ano,
        processo: record.processo ?? '',
        pe: record.pe ?? '',
        reciboNumero: record.reciboNumero ?? '',
        dataLevantamento: record.dataLevantamento ?? '',
        dataRecibo: record.dataRecibo ?? '',
        valorIndicado: toFormNumber(record.valorIndicado),
        valorSemIva: toFormNumber(record.valorSemIva),
        iva: toFormNumber(record.iva),
        retencao: toFormNumber(record.retencao),
        valorEmissao: toFormNumber(record.valorEmissao),
        meu5: toFormNumber(record.meu5),
        outrasTaxas: toFormNumber(record.outrasTaxas),
        gpeSe: typeof parsedGpeSe === 'number' ? toFormNumber(parsedGpeSe) : parsedIndicacoes.gpeSe,
        gestor: record.gestor ?? '',
        exequente: record.exequente ?? '',
        descricaoValor: record.descricaoValor ?? '',
        estadoId: record.estadoId,
        indicacoes: parsedIndicacoes.text,
    }
}

export function recordToPatchPayload(record: ReceiptRecord): Partial<ReceiptRecord> {
    return {
        tipo: record.tipo,
        mes: record.mes,
        ano: record.ano,
        processo: record.processo,
        pe: record.pe,
        reciboNumero: record.reciboNumero,
        dataLevantamento: record.dataLevantamento,
        dataRecibo: record.dataRecibo,
        valorIndicado: record.valorIndicado,
        valorSemIva: record.valorSemIva,
        iva: record.iva,
        retencao: record.retencao,
        valorEmissao: record.valorEmissao,
        meu5: record.meu5,
        outrasTaxas: record.outrasTaxas,
        gestor: record.gestor,
        exequente: record.exequente,
        descricaoValor: record.descricaoValor,
        estadoId: record.estadoId,
        indicacoes: record.indicacoes,
        sourceColor: record.sourceColor,
        sourceSheet: record.sourceSheet,
    }
}

// ---- Record reference helpers ----------------------------------------

export function getUniqueRecordReferences(record: ReceiptRecord): string[] {
    const candidates = [record.processo, record.pe, record.reciboNumero]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))

    return candidates.filter(
        (value, index, list) => list.findIndex((candidate) => normalizeText(candidate) === normalizeText(value)) === index,
    )
}

export function getPrimaryRecordReference(record: ReceiptRecord): string {
    return getUniqueRecordReferences(record)[0] ?? 'Sem referência'
}

export function getSecondaryRecordReference(record: ReceiptRecord): string | undefined {
    return getUniqueRecordReferences(record)[1]
}
