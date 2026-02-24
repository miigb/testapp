import { describe, it, expect } from 'vitest'
import {
  getInitialPenhorasEntryForm,
  penhorasFormToPayload,
  penhorasRecordToForm,
} from '../penhorasHelpers'
import type { PenhorasEntryForm, PenhorasRecord } from '../../types'

/* ---------------------------------------------------------------------------
 * Helper: build a minimal PenhorasRecord with required fields filled in.
 * Override any field via the `overrides` parameter.
 * --------------------------------------------------------------------------- */
function makePenhorasRecord(overrides: Partial<PenhorasRecord> = {}): PenhorasRecord {
  return {
    id: 'rec-1',
    estadoId: 'status-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

/* ---------------------------------------------------------------------------
 * Helper: build a full PenhorasEntryForm with sensible defaults.
 * --------------------------------------------------------------------------- */
function makeForm(overrides: Partial<PenhorasEntryForm> = {}): PenhorasEntryForm {
  return {
    pe: '',
    acto: '',
    dataPedido: '',
    identificacao: '',
    pedido: '',
    gestor: '',
    estadoId: 'status-1',
    ...overrides,
  }
}

// ─── getInitialPenhorasEntryForm ─────────────────────────────────────────────

describe('getInitialPenhorasEntryForm', () => {
  it('sets estadoId to the provided defaultStatusId', () => {
    const form = getInitialPenhorasEntryForm('my-status')
    expect(form.estadoId).toBe('my-status')
  })

  it('sets dataPedido to today in YYYY-MM-DD format', () => {
    const form = getInitialPenhorasEntryForm('s1')
    const today = new Date().toISOString().slice(0, 10)
    expect(form.dataPedido).toBe(today)
  })

  it('initialises all string fields to empty string except dataPedido and estadoId', () => {
    const form = getInitialPenhorasEntryForm('s1')
    expect(form.pe).toBe('')
    expect(form.acto).toBe('')
    expect(form.identificacao).toBe('')
    expect(form.pedido).toBe('')
    expect(form.gestor).toBe('')
  })

  it('returns an object with exactly 7 keys', () => {
    const form = getInitialPenhorasEntryForm('s1')
    expect(Object.keys(form)).toHaveLength(7)
  })

  it('works with an empty string as defaultStatusId', () => {
    const form = getInitialPenhorasEntryForm('')
    expect(form.estadoId).toBe('')
  })
})

// ─── penhorasFormToPayload ───────────────────────────────────────────────────

describe('penhorasFormToPayload', () => {
  it('converts a fully-populated form into a payload preserving all values', () => {
    const form = makeForm({
      pe: 'PE-001',
      acto: 'Acto X',
      dataPedido: '2025-03-15',
      identificacao: 'ID-123',
      pedido: 'Pedido ABC',
      gestor: 'Maria',
      estadoId: 'status-2',
    })
    const payload = penhorasFormToPayload(form)
    expect(payload).toEqual({
      pe: 'PE-001',
      acto: 'Acto X',
      dataPedido: '2025-03-15',
      identificacao: 'ID-123',
      pedido: 'Pedido ABC',
      gestor: 'Maria',
      estadoId: 'status-2',
    })
  })

  it('trims whitespace from string fields', () => {
    const form = makeForm({
      pe: '  PE-001  ',
      acto: '  Acto X  ',
      identificacao: '  ID-123  ',
      pedido: '  Pedido  ',
      gestor: '  Maria  ',
    })
    const payload = penhorasFormToPayload(form)
    expect(payload.pe).toBe('PE-001')
    expect(payload.acto).toBe('Acto X')
    expect(payload.identificacao).toBe('ID-123')
    expect(payload.pedido).toBe('Pedido')
    expect(payload.gestor).toBe('Maria')
  })

  it('converts empty strings to undefined for optional fields', () => {
    const form = makeForm() // all empty strings
    const payload = penhorasFormToPayload(form)
    expect(payload.pe).toBeUndefined()
    expect(payload.acto).toBeUndefined()
    expect(payload.dataPedido).toBeUndefined()
    expect(payload.identificacao).toBeUndefined()
    expect(payload.pedido).toBeUndefined()
    expect(payload.gestor).toBeUndefined()
  })

  it('converts whitespace-only strings to undefined', () => {
    const form = makeForm({
      pe: '   ',
      acto: '\t',
      identificacao: ' \n ',
      pedido: '  ',
      gestor: '   ',
    })
    const payload = penhorasFormToPayload(form)
    expect(payload.pe).toBeUndefined()
    expect(payload.acto).toBeUndefined()
    expect(payload.identificacao).toBeUndefined()
    expect(payload.pedido).toBeUndefined()
    expect(payload.gestor).toBeUndefined()
  })

  it('always includes estadoId even when it is an empty string', () => {
    const form = makeForm({ estadoId: '' })
    const payload = penhorasFormToPayload(form)
    expect(payload.estadoId).toBe('')
  })

  it('preserves dataPedido when set', () => {
    const form = makeForm({ dataPedido: '2025-06-01' })
    const payload = penhorasFormToPayload(form)
    expect(payload.dataPedido).toBe('2025-06-01')
  })

  it('sets dataPedido to undefined when it is an empty string', () => {
    const form = makeForm({ dataPedido: '' })
    const payload = penhorasFormToPayload(form)
    expect(payload.dataPedido).toBeUndefined()
  })

  it('does not add extra keys beyond the 7 expected fields', () => {
    const form = makeForm({ pe: 'PE-1', estadoId: 'st-1' })
    const payload = penhorasFormToPayload(form)
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining(['pe', 'acto', 'dataPedido', 'identificacao', 'pedido', 'gestor', 'estadoId'])
    )
    expect(Object.keys(payload).length).toBeLessThanOrEqual(7)
  })
})

// ─── penhorasRecordToForm ────────────────────────────────────────────────────

describe('penhorasRecordToForm', () => {
  it('converts a fully-populated record to a form preserving all values', () => {
    const record = makePenhorasRecord({
      pe: 'PE-001',
      acto: 'Acto X',
      dataPedido: '2025-03-15',
      identificacao: 'ID-123',
      pedido: 'Pedido ABC',
      gestor: 'Maria',
      estadoId: 'status-2',
    })
    const form = penhorasRecordToForm(record)
    expect(form).toEqual({
      pe: 'PE-001',
      acto: 'Acto X',
      dataPedido: '2025-03-15',
      identificacao: 'ID-123',
      pedido: 'Pedido ABC',
      gestor: 'Maria',
      estadoId: 'status-2',
    })
  })

  it('converts undefined optional fields to empty strings', () => {
    const record = makePenhorasRecord()
    // pe, acto, dataPedido, identificacao, pedido, gestor are all undefined
    const form = penhorasRecordToForm(record)
    expect(form.pe).toBe('')
    expect(form.acto).toBe('')
    expect(form.dataPedido).toBe('')
    expect(form.identificacao).toBe('')
    expect(form.pedido).toBe('')
    expect(form.gestor).toBe('')
  })

  it('preserves estadoId from the record', () => {
    const record = makePenhorasRecord({ estadoId: 'custom-status' })
    const form = penhorasRecordToForm(record)
    expect(form.estadoId).toBe('custom-status')
  })

  it('strips extra record-only fields (id, createdAt, updatedAt, sourceFile, etc.)', () => {
    const record = makePenhorasRecord({
      sourceFile: 'import.xlsx',
      sourceSheet: 'Sheet1',
      sourceRowNumber: 42,
      importBatchId: 'batch-abc',
      rawPayload: { foo: 'bar' },
    })
    const form = penhorasRecordToForm(record)
    const keys = Object.keys(form)
    expect(keys).toHaveLength(7)
    expect(keys).not.toContain('id')
    expect(keys).not.toContain('createdAt')
    expect(keys).not.toContain('updatedAt')
    expect(keys).not.toContain('sourceFile')
    expect(keys).not.toContain('sourceSheet')
    expect(keys).not.toContain('sourceRowNumber')
    expect(keys).not.toContain('importBatchId')
    expect(keys).not.toContain('rawPayload')
  })

  it('handles a mix of set and unset optional fields', () => {
    const record = makePenhorasRecord({
      pe: 'PE-100',
      // acto left undefined
      dataPedido: '2025-07-20',
      // identificacao left undefined
      pedido: 'Pedido Z',
      // gestor left undefined
    })
    const form = penhorasRecordToForm(record)
    expect(form.pe).toBe('PE-100')
    expect(form.acto).toBe('')
    expect(form.dataPedido).toBe('2025-07-20')
    expect(form.identificacao).toBe('')
    expect(form.pedido).toBe('Pedido Z')
    expect(form.gestor).toBe('')
  })

  it('returns an object with exactly the 7 form keys', () => {
    const record = makePenhorasRecord()
    const form = penhorasRecordToForm(record)
    expect(Object.keys(form).sort()).toEqual(
      ['acto', 'dataPedido', 'estadoId', 'gestor', 'identificacao', 'pe', 'pedido']
    )
  })
})
