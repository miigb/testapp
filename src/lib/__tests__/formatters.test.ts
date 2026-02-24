import { describe, it, expect } from 'vitest'
import { formatCurrency, formatNumber, toFormNumber, normalizeText, toColor } from '../formatters'

describe('formatCurrency', () => {
  it('returns "-" for undefined', () => {
    expect(formatCurrency(undefined)).toBe('-')
  })

  it('returns "-" for non-number values', () => {
    expect(formatCurrency(undefined)).toBe('-')
    // @ts-expect-error testing non-number input
    expect(formatCurrency(null)).toBe('-')
    // @ts-expect-error testing non-number input
    expect(formatCurrency('abc')).toBe('-')
  })

  it('formats number in EUR with PT locale', () => {
    const result = formatCurrency(1234.5)
    // Node.js ICU may or may not include thousand separator depending on environment
    expect(result).toContain('1234,50')
    expect(result).toMatch(/\u20AC/) // Euro sign
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/0,00/)
    expect(result).toMatch(/\u20AC/)
  })

  it('formats negative numbers', () => {
    const result = formatCurrency(-99.99)
    expect(result).toMatch(/99,99/)
  })
})

describe('formatNumber', () => {
  it('formats with PT locale grouping', () => {
    const result = formatNumber(1234567)
    expect(result).toMatch(/1[\s.]234[\s.]567/)
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats decimal numbers', () => {
    const result = formatNumber(1234.56)
    // Node.js ICU may or may not include thousand separator depending on environment
    expect(result).toContain('1234,56')
  })
})

describe('toFormNumber', () => {
  it('returns empty string for undefined', () => {
    expect(toFormNumber(undefined)).toBe('')
  })

  it('returns empty string for non-number values', () => {
    // @ts-expect-error testing non-number input
    expect(toFormNumber(null)).toBe('')
    // @ts-expect-error testing non-number input
    expect(toFormNumber('abc')).toBe('')
  })

  it('formats with comma decimal separator', () => {
    expect(toFormNumber(123.45)).toBe('123,45')
  })

  it('pads to 2 decimal places', () => {
    expect(toFormNumber(100)).toBe('100,00')
  })

  it('rounds to 2 decimal places', () => {
    expect(toFormNumber(10.999)).toBe('11,00')
    // 5.555 rounds to 5.55 due to IEEE 754 floating point (banker's rounding in toFixed)
    expect(toFormNumber(5.555)).toBe('5,55')
  })

  it('formats zero', () => {
    expect(toFormNumber(0)).toBe('0,00')
  })

  it('formats negative numbers', () => {
    expect(toFormNumber(-42.5)).toBe('-42,50')
  })
})

describe('normalizeText', () => {
  it('returns empty for null', () => {
    expect(normalizeText(null)).toBe('')
  })

  it('returns empty for undefined', () => {
    expect(normalizeText(undefined)).toBe('')
  })

  it('uppercases text', () => {
    expect(normalizeText('hello')).toBe('HELLO')
  })

  it('strips diacritics', () => {
    expect(normalizeText('Joao')).toBe('JOAO')
    expect(normalizeText('cafe')).toBe('CAFE')
  })

  it('uppercases and strips diacritics combined', () => {
    expect(normalizeText('Joao')).toBe('JOAO')
    expect(normalizeText('cafe')).toBe('CAFE')
  })

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('HELLO')
  })

  it('handles accented characters', () => {
    expect(normalizeText('acoes')).toBe('ACOES')
    expect(normalizeText('uniao')).toBe('UNIAO')
  })

  it('converts non-string values via String()', () => {
    expect(normalizeText(123)).toBe('123')
    expect(normalizeText(true)).toBe('TRUE')
  })
})

describe('toColor', () => {
  it('returns valid 6-digit hex color uppercased', () => {
    expect(toColor('#ff0000')).toBe('#FF0000')
    expect(toColor('#AbCdEf')).toBe('#ABCDEF')
    expect(toColor('#000000')).toBe('#000000')
    expect(toColor('#FFFFFF')).toBe('#FFFFFF')
  })

  it('trims whitespace before validating', () => {
    expect(toColor('  #ff0000  ')).toBe('#FF0000')
  })

  it('returns fallback for named colors', () => {
    expect(toColor('red')).toBe('#BFC4CC')
    expect(toColor('blue')).toBe('#BFC4CC')
  })

  it('returns fallback for wrong-length hex', () => {
    expect(toColor('#12345')).toBe('#BFC4CC')
    expect(toColor('#1234567')).toBe('#BFC4CC')
    expect(toColor('#FFF')).toBe('#BFC4CC')
  })

  it('returns fallback for empty string', () => {
    expect(toColor('')).toBe('#BFC4CC')
  })

  it('returns fallback for hex without hash', () => {
    expect(toColor('FF0000')).toBe('#BFC4CC')
  })
})
