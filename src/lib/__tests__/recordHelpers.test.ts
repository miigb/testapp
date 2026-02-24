import { describe, it, expect } from 'vitest'
import {
    extractGpeSeFromIndicacoes,
    composeIndicacoes,
    getInitialEntryForm,
    formToPayload,
    recordToForm,
    recordToPatchPayload,
    getUniqueRecordReferences,
    getPrimaryRecordReference,
    getSecondaryRecordReference,
} from '../recordHelpers'
import type { EntryForm, ReceiptRecord } from '../../types'

// ---------------------------------------------------------------------------
// extractGpeSeFromIndicacoes
// ---------------------------------------------------------------------------

describe('extractGpeSeFromIndicacoes', () => {
    it('returns empty for undefined', () => {
        expect(extractGpeSeFromIndicacoes(undefined)).toEqual({ gpeSe: '', text: '' })
    })

    it('returns empty for empty string', () => {
        expect(extractGpeSeFromIndicacoes('')).toEqual({ gpeSe: '', text: '' })
    })

    it('extracts GPESE value and remaining text', () => {
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

    it('is case-insensitive for GPESE prefix', () => {
        const result = extractGpeSeFromIndicacoes('gpese: 42 | text')
        expect(result.gpeSe).toBe('42')
        expect(result.text).toBe('text')
    })

    it('handles multiple text chunks after GPESE', () => {
        const result = extractGpeSeFromIndicacoes('GPESE: 100 | note one | note two')
        expect(result.gpeSe).toBe('100')
        expect(result.text).toBe('note one | note two')
    })
})

// ---------------------------------------------------------------------------
// composeIndicacoes
// ---------------------------------------------------------------------------

describe('composeIndicacoes', () => {
    it('returns undefined when both are empty', () => {
        expect(composeIndicacoes('', '')).toBeUndefined()
    })

    it('returns only GPESE chunk when indicacoes is empty', () => {
        // gpeSe '1234' is parsed as number 1234 -> toFormNumber -> '1234,00'
        expect(composeIndicacoes('1234', '')).toBe('GPESE: 1234,00')
    })

    it('returns only indicacoes when gpeSe is empty', () => {
        expect(composeIndicacoes('', 'Some note')).toBe('Some note')
    })

    it('joins GPESE and indicacoes with separator', () => {
        expect(composeIndicacoes('500', 'A note')).toBe('GPESE: 500,00 | A note')
    })

    it('parses non-numeric gpeSe through number parser (abc -> 0)', () => {
        // 'abc' is cleaned to '' by parseNumber, which becomes 0
        expect(composeIndicacoes('abc', 'note')).toBe('GPESE: 0,00 | note')
    })

    it('preserves truly non-parseable gpeSe when parseFormNumber returns undefined', () => {
        // empty string -> parseFormNumber returns undefined -> trimmedGpeSe = ''
        // so composeIndicacoes('', 'note') only has the note chunk
        expect(composeIndicacoes('', 'note')).toBe('note')
    })
})

// ---------------------------------------------------------------------------
// getInitialEntryForm
// ---------------------------------------------------------------------------

describe('getInitialEntryForm', () => {
    it('returns a form with the given default status', () => {
        const form = getInitialEntryForm('s1')
        expect(form.estadoId).toBe('s1')
        expect(form.tipo).toBe('exequente')
        expect(form.processo).toBe('')
        expect(form.valorIndicado).toBe('')
    })

    it('uses current month and year', () => {
        const form = getInitialEntryForm('s1')
        const now = new Date()
        expect(form.mes).toBe(now.getMonth() + 1)
        expect(form.ano).toBe(now.getFullYear())
    })
})

// ---------------------------------------------------------------------------
// formToPayload
// ---------------------------------------------------------------------------

describe('formToPayload', () => {
    const baseForm: EntryForm = {
        tipo: 'exequente',
        mes: 3,
        ano: 2025,
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
        estadoId: 's1',
        indicacoes: '',
    }

    it('converts numeric string fields to numbers', () => {
        const form: EntryForm = {
            ...baseForm,
            valorIndicado: '1.234,56',
            valorSemIva: '1.003,71',
            iva: '230,85',
        }
        const payload = formToPayload(form)
        expect(payload.valorIndicado).toBeCloseTo(1234.56)
        expect(payload.valorSemIva).toBeCloseTo(1003.71)
        expect(payload.iva).toBeCloseTo(230.85)
    })

    it('sets empty string fields to undefined', () => {
        const payload = formToPayload(baseForm)
        expect(payload.processo).toBeUndefined()
        expect(payload.pe).toBeUndefined()
        expect(payload.gestor).toBeUndefined()
        expect(payload.exequente).toBeUndefined()
    })

    it('preserves non-empty string fields trimmed', () => {
        const form: EntryForm = {
            ...baseForm,
            processo: '  P-001  ',
            gestor: 'Joao ',
        }
        const payload = formToPayload(form)
        expect(payload.processo).toBe('P-001')
        expect(payload.gestor).toBe('Joao')
    })

    it('composes indicacoes from gpeSe + indicacoes', () => {
        const form: EntryForm = {
            ...baseForm,
            gpeSe: '1234',
            indicacoes: 'Some note',
        }
        const payload = formToPayload(form)
        expect(payload.indicacoes).toBe('GPESE: 1234,00 | Some note')
    })

    it('sets indicacoes to undefined when both gpeSe and indicacoes are empty', () => {
        const payload = formToPayload(baseForm)
        expect(payload.indicacoes).toBeUndefined()
    })

    it('always includes tipo, mes, ano, estadoId', () => {
        const payload = formToPayload(baseForm)
        expect(payload.tipo).toBe('exequente')
        expect(payload.mes).toBe(3)
        expect(payload.ano).toBe(2025)
        expect(payload.estadoId).toBe('s1')
    })
})

// ---------------------------------------------------------------------------
// recordToForm
// ---------------------------------------------------------------------------

describe('recordToForm', () => {
    const baseRecord: ReceiptRecord = {
        id: 'r1',
        tipo: 'exequente',
        mes: 3,
        ano: 2025,
        estadoId: 's1',
        createdAt: '',
        updatedAt: '',
        history: [],
    }

    it('converts numbers to PT-formatted strings (comma decimal)', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            valorIndicado: 1234.56,
            valorSemIva: 1003.71,
            iva: 230.85,
        }
        const form = recordToForm(record)
        expect(form.valorIndicado).toBe('1234,56')
        expect(form.valorSemIva).toBe('1003,71')
        expect(form.iva).toBe('230,85')
    })

    it('returns empty string for undefined numeric fields', () => {
        const form = recordToForm(baseRecord)
        expect(form.valorIndicado).toBe('')
        expect(form.valorSemIva).toBe('')
        expect(form.iva).toBe('')
        expect(form.retencao).toBe('')
    })

    it('extracts gpeSe from indicacoes (numeric gpeSe gets formatted)', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            indicacoes: 'GPESE: 999 | Note here',
        }
        const form = recordToForm(record)
        // '999' parses to number 999 -> toFormNumber -> '999,00'
        expect(form.gpeSe).toBe('999,00')
        expect(form.indicacoes).toBe('Note here')
    })

    it('handles indicacoes with no GPESE', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            indicacoes: 'Just some notes',
        }
        const form = recordToForm(record)
        expect(form.gpeSe).toBe('')
        expect(form.indicacoes).toBe('Just some notes')
    })

    it('handles undefined optional string fields', () => {
        const form = recordToForm(baseRecord)
        expect(form.processo).toBe('')
        expect(form.pe).toBe('')
        expect(form.gestor).toBe('')
        expect(form.exequente).toBe('')
    })
})

// ---------------------------------------------------------------------------
// recordToPatchPayload
// ---------------------------------------------------------------------------

describe('recordToPatchPayload', () => {
    it('copies relevant fields from record', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'executado',
            mes: 6,
            ano: 2024,
            processo: 'P-100',
            pe: 'PE-100',
            valorIndicado: 500,
            estadoId: 's2',
            sourceColor: '#FF0000',
            sourceSheet: 'Sheet1',
            createdAt: '2024-01-01',
            updatedAt: '2024-06-01',
            history: [],
        }
        const patch = recordToPatchPayload(record)
        expect(patch.tipo).toBe('executado')
        expect(patch.mes).toBe(6)
        expect(patch.ano).toBe(2024)
        expect(patch.processo).toBe('P-100')
        expect(patch.sourceColor).toBe('#FF0000')
        expect(patch.sourceSheet).toBe('Sheet1')
    })

    it('does not include id, createdAt, updatedAt, or history', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'exequente',
            mes: 1,
            ano: 2025,
            estadoId: 's1',
            createdAt: '2025-01-01',
            updatedAt: '2025-01-02',
            history: [{ id: 'h1', at: '2025-01-01', message: 'created' }],
        }
        const patch = recordToPatchPayload(record)
        expect(patch).not.toHaveProperty('id')
        expect(patch).not.toHaveProperty('createdAt')
        expect(patch).not.toHaveProperty('updatedAt')
        expect(patch).not.toHaveProperty('history')
    })
})

// ---------------------------------------------------------------------------
// getUniqueRecordReferences / getPrimaryRecordReference / getSecondaryRecordReference
// ---------------------------------------------------------------------------

describe('getUniqueRecordReferences', () => {
    const baseRecord: ReceiptRecord = {
        id: 'r1',
        tipo: 'exequente',
        mes: 1,
        ano: 2025,
        estadoId: 's1',
        createdAt: '',
        updatedAt: '',
        history: [],
    }

    it('returns unique non-empty references', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            processo: 'P-001',
            pe: 'PE-001',
            reciboNumero: 'P-001', // duplicate of processo
        }
        const refs = getUniqueRecordReferences(record)
        expect(refs).toHaveLength(2)
        expect(refs).toContain('P-001')
        expect(refs).toContain('PE-001')
    })

    it('skips empty and undefined fields', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            processo: '',
            pe: undefined,
            reciboNumero: 'R-001',
        }
        const refs = getUniqueRecordReferences(record)
        expect(refs).toEqual(['R-001'])
    })

    it('returns empty array when all fields are empty', () => {
        const refs = getUniqueRecordReferences(baseRecord)
        expect(refs).toEqual([])
    })

    it('deduplicates case-insensitively (via normalizeText)', () => {
        const record: ReceiptRecord = {
            ...baseRecord,
            processo: 'p-001',
            pe: 'P-001',
        }
        const refs = getUniqueRecordReferences(record)
        expect(refs).toHaveLength(1)
        expect(refs[0]).toBe('p-001')
    })
})

describe('getPrimaryRecordReference', () => {
    it('returns the first unique reference', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'exequente',
            mes: 1,
            ano: 2025,
            processo: 'P-001',
            pe: 'PE-001',
            estadoId: 's1',
            createdAt: '',
            updatedAt: '',
            history: [],
        }
        expect(getPrimaryRecordReference(record)).toBe('P-001')
    })

    it('returns fallback when no references exist', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'exequente',
            mes: 1,
            ano: 2025,
            estadoId: 's1',
            createdAt: '',
            updatedAt: '',
            history: [],
        }
        expect(getPrimaryRecordReference(record)).toBe('Sem referência')
    })
})

describe('getSecondaryRecordReference', () => {
    it('returns the second unique reference', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'exequente',
            mes: 1,
            ano: 2025,
            processo: 'P-001',
            pe: 'PE-001',
            estadoId: 's1',
            createdAt: '',
            updatedAt: '',
            history: [],
        }
        expect(getSecondaryRecordReference(record)).toBe('PE-001')
    })

    it('returns undefined when only one reference exists', () => {
        const record: ReceiptRecord = {
            id: 'r1',
            tipo: 'exequente',
            mes: 1,
            ano: 2025,
            processo: 'P-001',
            estadoId: 's1',
            createdAt: '',
            updatedAt: '',
            history: [],
        }
        expect(getSecondaryRecordReference(record)).toBeUndefined()
    })
})
