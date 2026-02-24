import { describe, it, expect } from 'vitest'
import { sanitizeDsFilters, sanitizePenhorasFilters, sanitizeDashboardFilters } from '../sanitizers'

describe('sanitizeDsFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizeDsFilters({})
    expect(result.estadoId).toBe('todos')
    expect(result.gestora).toBe('')
    expect(result.entidadeBancaria).toBe('')
    expect(result.produto).toBe('')
    expect(result.reciboEstado).toBe('todos')
    expect(result.ano).toBe('todos')
    expect(result.mes).toBe('todos')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })

  it('preserves valid string values', () => {
    const result = sanitizeDsFilters({
      estadoId: 'abc',
      gestora: 'Bank',
      entidadeBancaria: 'Entity',
      produto: 'Product',
    })
    expect(result.estadoId).toBe('abc')
    expect(result.gestora).toBe('Bank')
    expect(result.entidadeBancaria).toBe('Entity')
    expect(result.produto).toBe('Product')
  })

  it('preserves valid numeric values', () => {
    const result = sanitizeDsFilters({ ano: 2025, mes: 3 })
    expect(result.ano).toBe(2025)
    expect(result.mes).toBe(3)
  })

  it('validates reciboEstado enum', () => {
    expect(sanitizeDsFilters({ reciboEstado: 'com-recibo' }).reciboEstado).toBe('com-recibo')
    expect(sanitizeDsFilters({ reciboEstado: 'sem-recibo' }).reciboEstado).toBe('sem-recibo')
    expect(sanitizeDsFilters({ reciboEstado: 'invalid' }).reciboEstado).toBe('todos')
  })

  it('rejects out-of-range months', () => {
    expect(sanitizeDsFilters({ mes: 0 }).mes).toBe('todos')
    expect(sanitizeDsFilters({ mes: 13 }).mes).toBe('todos')
    expect(sanitizeDsFilters({ mes: -1 }).mes).toBe('todos')
  })

  it('accepts boundary months (1 and 12)', () => {
    expect(sanitizeDsFilters({ mes: 1 }).mes).toBe(1)
    expect(sanitizeDsFilters({ mes: 12 }).mes).toBe(12)
  })

  it('rejects out-of-range years', () => {
    expect(sanitizeDsFilters({ ano: 1999 }).ano).toBe('todos')
    expect(sanitizeDsFilters({ ano: 10000 }).ano).toBe('todos')
  })

  it('accepts boundary years', () => {
    expect(sanitizeDsFilters({ ano: 2000 }).ano).toBe(2000)
    expect(sanitizeDsFilters({ ano: 9999 }).ano).toBe(9999)
  })

  it('handles non-object input gracefully', () => {
    expect(sanitizeDsFilters(null).estadoId).toBe('todos')
    expect(sanitizeDsFilters(undefined).estadoId).toBe('todos')
    expect(sanitizeDsFilters('string').estadoId).toBe('todos')
    expect(sanitizeDsFilters(42).estadoId).toBe('todos')
  })

  it('defaults estadoId for whitespace-only strings', () => {
    expect(sanitizeDsFilters({ estadoId: '  ' }).estadoId).toBe('todos')
    expect(sanitizeDsFilters({ estadoId: '' }).estadoId).toBe('todos')
  })

  it('rejects non-numeric ano/mes values', () => {
    expect(sanitizeDsFilters({ ano: 'abc' }).ano).toBe('todos')
    expect(sanitizeDsFilters({ mes: 'abc' }).mes).toBe('todos')
    expect(sanitizeDsFilters({ ano: NaN }).ano).toBe('todos')
    expect(sanitizeDsFilters({ mes: Infinity }).mes).toBe('todos')
  })

  it('always sets page to 1 and pageSize to 300', () => {
    const result = sanitizeDsFilters({ page: 5, pageSize: 50 })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })
})

describe('sanitizePenhorasFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizePenhorasFilters({})
    expect(result.estadoId).toBe('todos')
    expect(result.gestor).toBe('')
    expect(result.acto).toBe('')
    expect(result.ano).toBe('todos')
    expect(result.mes).toBe('todos')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })

  it('preserves valid values', () => {
    const result = sanitizePenhorasFilters({ gestor: 'Maria', acto: 'Penhora', ano: 2024, mes: 12 })
    expect(result.gestor).toBe('Maria')
    expect(result.acto).toBe('Penhora')
    expect(result.ano).toBe(2024)
    expect(result.mes).toBe(12)
  })

  it('preserves valid estadoId', () => {
    const result = sanitizePenhorasFilters({ estadoId: 'active' })
    expect(result.estadoId).toBe('active')
  })

  it('defaults estadoId for empty/whitespace strings', () => {
    expect(sanitizePenhorasFilters({ estadoId: '' }).estadoId).toBe('todos')
    expect(sanitizePenhorasFilters({ estadoId: '   ' }).estadoId).toBe('todos')
  })

  it('handles non-object input gracefully', () => {
    const result = sanitizePenhorasFilters(null)
    expect(result.estadoId).toBe('todos')
    expect(result.gestor).toBe('')
    expect(result.acto).toBe('')
  })

  it('rejects out-of-range months and years', () => {
    expect(sanitizePenhorasFilters({ mes: 0 }).mes).toBe('todos')
    expect(sanitizePenhorasFilters({ mes: 13 }).mes).toBe('todos')
    expect(sanitizePenhorasFilters({ ano: 1999 }).ano).toBe('todos')
  })

  it('always sets page to 1 and pageSize to 300', () => {
    const result = sanitizePenhorasFilters({ page: 10, pageSize: 100 })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })
})

describe('sanitizeDashboardFilters', () => {
  it('returns all defaults for empty input', () => {
    const result = sanitizeDashboardFilters({})
    expect(result.tipo).toBe('todos')
    expect(result.estadoId).toBe('todos')
    expect(result.mes).toBe('todos')
    expect(result.ano).toBe('todos')
    expect(result.exequente).toBe('')
    expect(result.gestor).toBe('')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })

  it('validates tipo enum', () => {
    expect(sanitizeDashboardFilters({ tipo: 'exequente' }).tipo).toBe('exequente')
    expect(sanitizeDashboardFilters({ tipo: 'executado' }).tipo).toBe('executado')
    expect(sanitizeDashboardFilters({ tipo: 'invalid' }).tipo).toBe('todos')
    expect(sanitizeDashboardFilters({ tipo: '' }).tipo).toBe('todos')
  })

  it('preserves valid string values', () => {
    const result = sanitizeDashboardFilters({ exequente: 'John', gestor: 'Anna', estadoId: 'active' })
    expect(result.exequente).toBe('John')
    expect(result.gestor).toBe('Anna')
    expect(result.estadoId).toBe('active')
  })

  it('preserves valid numeric values', () => {
    const result = sanitizeDashboardFilters({ ano: 2024, mes: 6 })
    expect(result.ano).toBe(2024)
    expect(result.mes).toBe(6)
  })

  it('handles non-object input gracefully', () => {
    const result = sanitizeDashboardFilters(null)
    expect(result.tipo).toBe('todos')
    expect(result.estadoId).toBe('todos')
    expect(result.exequente).toBe('')
    expect(result.gestor).toBe('')
  })

  it('rejects out-of-range months and years', () => {
    expect(sanitizeDashboardFilters({ mes: 0 }).mes).toBe('todos')
    expect(sanitizeDashboardFilters({ mes: 13 }).mes).toBe('todos')
    expect(sanitizeDashboardFilters({ ano: 1999 }).ano).toBe('todos')
    expect(sanitizeDashboardFilters({ ano: 10000 }).ano).toBe('todos')
  })

  it('always sets page to 1 and pageSize to 300', () => {
    const result = sanitizeDashboardFilters({ page: 3, pageSize: 500 })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(300)
  })
})
