import { describe, it, expect } from 'vitest'
import { getInitialDsEntryForm, dsFormToPayload, dsRecordToForm } from '../dsHelpers'
import type { DsEntryForm, DsRecord } from '../../types'

/* ---------------------------------------------------------------------------
 * Helper: build a minimal DsRecord with required fields filled in.
 * Override any field via the `overrides` parameter.
 * --------------------------------------------------------------------------- */
function makeDsRecord(overrides: Partial<DsRecord> = {}): DsRecord {
  return {
    id: 'rec-1',
    estadoId: 'status-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

/* ---------------------------------------------------------------------------
 * Helper: build a full DsEntryForm with all fields empty (except estadoId).
 * --------------------------------------------------------------------------- */
function makeEmptyForm(overrides: Partial<DsEntryForm> = {}): DsEntryForm {
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
    dataEscritura: '',
    dataFechoCrm: '',
    comissaoLoja: '',
    ivaCgdRaw: '',
    totalComissaoLojaCmIva: '',
    comissaoGestor: '',
    percentagem: '',
    pagComissaoGestor: '',
    estadoId: 'status-1',
    ...overrides,
  }
}

// ─── getInitialDsEntryForm ───────────────────────────────────────────────────

describe('getInitialDsEntryForm', () => {
  it('sets estadoId to the provided defaultStatusId', () => {
    const form = getInitialDsEntryForm('my-status-id')
    expect(form.estadoId).toBe('my-status-id')
  })

  it('sets dataEscritura to today in YYYY-MM-DD format', () => {
    const form = getInitialDsEntryForm('s1')
    const today = new Date().toISOString().slice(0, 10)
    expect(form.dataEscritura).toBe(today)
  })

  it('initialises all string fields to empty string (except dataEscritura and estadoId)', () => {
    const form = getInitialDsEntryForm('s1')
    const emptyFields: (keyof DsEntryForm)[] = [
      'gestora', 'proponentes', 'referencia', 'produto',
      'entidadeBancaria', 'liderCalculo', 'recibo', 'faltaReciboGestora',
      'valor', 'dataFechoCrm', 'comissaoLoja', 'ivaCgdRaw',
      'totalComissaoLojaCmIva', 'comissaoGestor', 'percentagem',
      'pagComissaoGestor',
    ]
    for (const field of emptyFields) {
      expect(form[field], `expected "${field}" to be empty string`).toBe('')
    }
  })

  it('returns a new object on every call (no shared references)', () => {
    const a = getInitialDsEntryForm('s1')
    const b = getInitialDsEntryForm('s1')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

// ─── dsFormToPayload ─────────────────────────────────────────────────────────

describe('dsFormToPayload', () => {
  it('always includes estadoId', () => {
    const payload = dsFormToPayload(makeEmptyForm({ estadoId: 'abc-123' }))
    expect(payload.estadoId).toBe('abc-123')
  })

  it('converts empty string fields to undefined', () => {
    const payload = dsFormToPayload(makeEmptyForm())
    expect(payload.gestora).toBeUndefined()
    expect(payload.proponentes).toBeUndefined()
    expect(payload.referencia).toBeUndefined()
    expect(payload.produto).toBeUndefined()
    expect(payload.entidadeBancaria).toBeUndefined()
    expect(payload.liderCalculo).toBeUndefined()
    expect(payload.recibo).toBeUndefined()
    expect(payload.faltaReciboGestora).toBeUndefined()
    expect(payload.pagComissaoGestor).toBeUndefined()
    expect(payload.dataEscritura).toBeUndefined()
    expect(payload.dataFechoCrm).toBeUndefined()
  })

  it('converts whitespace-only string fields to undefined (trims first)', () => {
    const payload = dsFormToPayload(makeEmptyForm({
      gestora: '   ',
      proponentes: '\t',
      recibo: ' \n ',
    }))
    expect(payload.gestora).toBeUndefined()
    expect(payload.proponentes).toBeUndefined()
    expect(payload.recibo).toBeUndefined()
  })

  it('preserves non-empty trimmed string fields', () => {
    const payload = dsFormToPayload(makeEmptyForm({
      gestora: ' Alice ',
      proponentes: 'Bob',
      referencia: 'REF-001',
    }))
    expect(payload.gestora).toBe('Alice')
    expect(payload.proponentes).toBe('Bob')
    expect(payload.referencia).toBe('REF-001')
  })

  it('stores raw value and parsed number for valor', () => {
    const payload = dsFormToPayload(makeEmptyForm({ valor: '1.234,56' }))
    expect(payload.valorRaw).toBe('1.234,56')
    expect(payload.valor).toBe(1234.56)
  })

  it('stores raw value and parsed number for comissaoLoja', () => {
    const payload = dsFormToPayload(makeEmptyForm({ comissaoLoja: '500,00' }))
    expect(payload.comissaoLojaRaw).toBe('500,00')
    expect(payload.comissaoLoja).toBe(500)
  })

  it('stores raw value and parsed number for totalComissaoLojaCmIva', () => {
    const payload = dsFormToPayload(makeEmptyForm({ totalComissaoLojaCmIva: '100,50' }))
    expect(payload.totalComissaoLojaCmIvaRaw).toBe('100,50')
    expect(payload.totalComissaoLojaCmIva).toBe(100.5)
  })

  it('stores raw value and parsed number for comissaoGestor', () => {
    const payload = dsFormToPayload(makeEmptyForm({ comissaoGestor: '250,75' }))
    expect(payload.comissaoGestorRaw).toBe('250,75')
    expect(payload.comissaoGestor).toBe(250.75)
  })

  it('stores raw value and parsed number for percentagem', () => {
    const payload = dsFormToPayload(makeEmptyForm({ percentagem: '12,5' }))
    expect(payload.percentagemRaw).toBe('12,5')
    expect(payload.percentagem).toBe(12.5)
  })

  it('returns undefined for parsed numeric fields when the form value is empty', () => {
    const payload = dsFormToPayload(makeEmptyForm())
    expect(payload.valor).toBeUndefined()
    expect(payload.comissaoLoja).toBeUndefined()
    expect(payload.totalComissaoLojaCmIva).toBeUndefined()
    expect(payload.comissaoGestor).toBeUndefined()
    expect(payload.percentagem).toBeUndefined()
  })

  it('returns undefined for raw fields when the form value is empty', () => {
    const payload = dsFormToPayload(makeEmptyForm())
    expect(payload.valorRaw).toBeUndefined()
    expect(payload.comissaoLojaRaw).toBeUndefined()
    expect(payload.totalComissaoLojaCmIvaRaw).toBeUndefined()
    expect(payload.comissaoGestorRaw).toBeUndefined()
    expect(payload.percentagemRaw).toBeUndefined()
    expect(payload.ivaCgdRaw).toBeUndefined()
  })

  it('preserves date fields when they have values', () => {
    const payload = dsFormToPayload(makeEmptyForm({
      dataEscritura: '2025-06-15',
      dataFechoCrm: '2025-06-20',
    }))
    expect(payload.dataEscritura).toBe('2025-06-15')
    expect(payload.dataFechoCrm).toBe('2025-06-20')
  })

  it('preserves pagComissaoGestor when it has a value', () => {
    const payload = dsFormToPayload(makeEmptyForm({ pagComissaoGestor: 'Pago' }))
    expect(payload.pagComissaoGestor).toBe('Pago')
  })

  it('preserves ivaCgdRaw when it has a value', () => {
    const payload = dsFormToPayload(makeEmptyForm({ ivaCgdRaw: 'sem_iva' }))
    expect(payload.ivaCgdRaw).toBe('sem_iva')
  })
})

// ─── dsRecordToForm ──────────────────────────────────────────────────────────

describe('dsRecordToForm', () => {
  it('converts undefined string fields to empty strings', () => {
    const form = dsRecordToForm(makeDsRecord())
    expect(form.gestora).toBe('')
    expect(form.proponentes).toBe('')
    expect(form.referencia).toBe('')
    expect(form.produto).toBe('')
    expect(form.entidadeBancaria).toBe('')
    expect(form.liderCalculo).toBe('')
    expect(form.recibo).toBe('')
    expect(form.faltaReciboGestora).toBe('')
    expect(form.dataEscritura).toBe('')
    expect(form.dataFechoCrm).toBe('')
    expect(form.pagComissaoGestor).toBe('')
  })

  it('preserves existing string field values', () => {
    const form = dsRecordToForm(makeDsRecord({
      gestora: 'Alice',
      proponentes: 'Bob & Carol',
      referencia: 'REF-999',
      produto: 'Produto X',
      entidadeBancaria: 'CGD',
      liderCalculo: 'LC1',
      recibo: 'R-100',
      faltaReciboGestora: 'Sim',
      pagComissaoGestor: 'Pendente',
    }))
    expect(form.gestora).toBe('Alice')
    expect(form.proponentes).toBe('Bob & Carol')
    expect(form.referencia).toBe('REF-999')
    expect(form.produto).toBe('Produto X')
    expect(form.entidadeBancaria).toBe('CGD')
    expect(form.liderCalculo).toBe('LC1')
    expect(form.recibo).toBe('R-100')
    expect(form.faltaReciboGestora).toBe('Sim')
    expect(form.pagComissaoGestor).toBe('Pendente')
  })

  it('formats numeric fields with comma decimal separator via toFormNumber', () => {
    const form = dsRecordToForm(makeDsRecord({
      valor: 1234.56,
      comissaoLoja: 500,
      totalComissaoLojaCmIva: 100.5,
      comissaoGestor: 250.75,
      percentagem: 12.5,
    }))
    expect(form.valor).toBe('1234,56')
    expect(form.comissaoLoja).toBe('500,00')
    expect(form.totalComissaoLojaCmIva).toBe('100,50')
    expect(form.comissaoGestor).toBe('250,75')
    expect(form.percentagem).toBe('12,50')
  })

  it('returns empty string for undefined numeric fields', () => {
    const form = dsRecordToForm(makeDsRecord())
    expect(form.valor).toBe('')
    expect(form.comissaoLoja).toBe('')
    expect(form.totalComissaoLojaCmIva).toBe('')
    expect(form.comissaoGestor).toBe('')
    expect(form.percentagem).toBe('')
  })

  it('formats zero numeric fields as "0,00"', () => {
    const form = dsRecordToForm(makeDsRecord({
      valor: 0,
      comissaoLoja: 0,
    }))
    expect(form.valor).toBe('0,00')
    expect(form.comissaoLoja).toBe('0,00')
  })

  it('preserves estadoId from record', () => {
    const form = dsRecordToForm(makeDsRecord({ estadoId: 'my-estado' }))
    expect(form.estadoId).toBe('my-estado')
  })

  it('preserves date fields from record', () => {
    const form = dsRecordToForm(makeDsRecord({
      dataEscritura: '2025-03-10',
      dataFechoCrm: '2025-03-15',
    }))
    expect(form.dataEscritura).toBe('2025-03-10')
    expect(form.dataFechoCrm).toBe('2025-03-15')
  })

  // --- ivaCgdRaw fallback logic ---

  it('uses record.ivaCgdRaw when it is present', () => {
    const form = dsRecordToForm(makeDsRecord({
      ivaCgdRaw: 'sem_iva',
      ivaCgdValor: 99.99,
    }))
    expect(form.ivaCgdRaw).toBe('sem_iva')
  })

  it('falls back to toFormNumber(record.ivaCgdValor) when ivaCgdRaw is undefined', () => {
    const form = dsRecordToForm(makeDsRecord({
      ivaCgdRaw: undefined,
      ivaCgdValor: 42.5,
    }))
    expect(form.ivaCgdRaw).toBe('42,50')
  })

  it('falls back to toFormNumber(record.ivaCgdValor) when ivaCgdRaw is null-ish', () => {
    const record = makeDsRecord({ ivaCgdValor: 100 })
    // Ensure ivaCgdRaw is not set at all (undefined via omission)
    delete (record as Record<string, unknown>).ivaCgdRaw
    const form = dsRecordToForm(record)
    expect(form.ivaCgdRaw).toBe('100,00')
  })

  it('returns empty string for ivaCgdRaw when both ivaCgdRaw and ivaCgdValor are undefined', () => {
    const form = dsRecordToForm(makeDsRecord())
    // toFormNumber(undefined) returns ''
    expect(form.ivaCgdRaw).toBe('')
  })
})
