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

  it('returns 0 for non-numeric text (all alpha chars stripped, Number("") === 0)', () => {
    // After stripping non-numeric characters, 'abc' becomes '' and Number('') === 0
    expect(parseFormNumber('abc')).toBe(0)
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
