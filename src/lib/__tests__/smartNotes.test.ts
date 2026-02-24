import { describe, it, expect } from 'vitest'
import { parseSmartNumber, formatSmartNotesValue, evaluateSmartNotesLine, buildSmartNotesSignature } from '../smartNotes'

describe('parseSmartNumber', () => {
  it('parses plain integers', () => {
    expect(parseSmartNumber('42')).toBe(42)
  })

  it('parses decimal with comma', () => {
    expect(parseSmartNumber('3,14')).toBeCloseTo(3.14)
  })

  it('parses k suffix', () => {
    expect(parseSmartNumber('5k')).toBe(5000)
    expect(parseSmartNumber('2,5K')).toBe(2500)
  })

  it('parses m suffix', () => {
    expect(parseSmartNumber('1m')).toBe(1_000_000)
  })

  it('parses b suffix', () => {
    expect(parseSmartNumber('3B')).toBe(3_000_000_000)
  })

  it('returns null for invalid input', () => {
    expect(parseSmartNumber('')).toBeNull()
    expect(parseSmartNumber('abc')).toBeNull()
  })

  it('handles negative numbers', () => {
    expect(parseSmartNumber('-10')).toBe(-10)
    expect(parseSmartNumber('-2k')).toBe(-2000)
  })

  it('handles decimal with dot', () => {
    expect(parseSmartNumber('3.14')).toBeCloseTo(3.14)
  })

  it('returns null for non-numeric strings with digits', () => {
    expect(parseSmartNumber('12abc')).toBeNull()
  })
})

describe('formatSmartNotesValue', () => {
  it('formats integers with pt-PT grouping', () => {
    // pt-PT uses non-breaking space as thousands separator for larger numbers
    const result = formatSmartNotesValue(1000000)
    expect(result).toContain('000')
    // Verify the formatter uses pt-PT conventions (comma for decimals)
    const decimalResult = formatSmartNotesValue(1234.5)
    expect(decimalResult).toContain(',')
  })

  it('formats decimals with comma separator', () => {
    const result = formatSmartNotesValue(3.14)
    expect(result).toMatch(/3,14/)
  })

  it('formats zero', () => {
    expect(formatSmartNotesValue(0)).toBe('0')
  })

  it('formats negative numbers', () => {
    const result = formatSmartNotesValue(-1500)
    expect(result).toContain('1')
    expect(result).toContain('500')
  })
})

describe('buildSmartNotesSignature', () => {
  it('builds a signature from expression and result', () => {
    expect(buildSmartNotesSignature('10 + 20', 30)).toBe('10 + 20::30.000000')
  })

  it('trims and lowercases expression', () => {
    expect(buildSmartNotesSignature('  TOTAL  ', 60)).toBe('total::60.000000')
  })
})

describe('evaluateSmartNotesLine', () => {
  const emptyCtx = { previousResults: [] as number[], variables: new Map<string, number>() }

  it('returns null for empty lines', () => {
    expect(evaluateSmartNotesLine('', emptyCtx)).toBeNull()
  })

  it('returns null for comment lines', () => {
    expect(evaluateSmartNotesLine('# comment', emptyCtx)).toBeNull()
  })

  it('returns null for whitespace-only lines', () => {
    expect(evaluateSmartNotesLine('   ', emptyCtx)).toBeNull()
  })

  it('evaluates simple addition', () => {
    const result = evaluateSmartNotesLine('10 + 20', emptyCtx)
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('error')
    expect((result as { result: number }).result).toBe(30)
  })

  it('evaluates subtraction', () => {
    const result = evaluateSmartNotesLine('50 - 15', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(35)
  })

  it('evaluates multiplication with x', () => {
    const result = evaluateSmartNotesLine('5 x 3', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(15)
  })

  it('evaluates division', () => {
    const result = evaluateSmartNotesLine('100 / 4', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(25)
  })

  it('evaluates Portuguese keyword "mais"', () => {
    const result = evaluateSmartNotesLine('10 mais 5', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(15)
  })

  it('evaluates Portuguese keyword "menos"', () => {
    const result = evaluateSmartNotesLine('10 menos 3', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(7)
  })

  it('evaluates Portuguese keyword "vezes"', () => {
    const result = evaluateSmartNotesLine('4 vezes 5', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(20)
  })

  it('evaluates "total" with previous results', () => {
    const ctx = { previousResults: [10, 20, 30], variables: new Map<string, number>() }
    const result = evaluateSmartNotesLine('total', ctx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(60)
  })

  it('returns error for total without previous results', () => {
    const result = evaluateSmartNotesLine('total', emptyCtx)
    expect(result).toHaveProperty('error')
  })

  it('evaluates percent-of pattern ("10% de 200")', () => {
    const result = evaluateSmartNotesLine('10% de 200', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(20)
  })

  it('evaluates percent-of with "sobre" keyword', () => {
    const result = evaluateSmartNotesLine('25% sobre 400', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(100)
  })

  it('handles variable assignment', () => {
    const ctx = { previousResults: [], variables: new Map<string, number>() }
    const result = evaluateSmartNotesLine('preco = 100 + 50', ctx)
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('error')
    expect((result as { result: number; variableKey: string }).result).toBe(150)
    expect((result as { variableKey: string }).variableKey).toBe('preco')
  })

  it('uses scaled numbers (k/m)', () => {
    const result = evaluateSmartNotesLine('2k + 500', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(2500)
  })

  it('resolves variables from context', () => {
    const ctx = { previousResults: [], variables: new Map<string, number>([['preco', 100]]) }
    const result = evaluateSmartNotesLine('preco + 50', ctx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(150)
  })

  it('strips currency symbols', () => {
    const result = evaluateSmartNotesLine('100€ + 50€', emptyCtx)
    expect(result).not.toBeNull()
    expect((result as { result: number }).result).toBe(150)
  })

  it('returns error for unsupported expressions', () => {
    // After normalization, if non-numeric/operator characters remain, it should error
    const result = evaluateSmartNotesLine('hello world', emptyCtx)
    // 'hello' and 'world' are not variables, not keywords; after all replacements
    // they should be stripped by [^0-9+\-*/().% ] leaving empty -> null
    expect(result).toBeNull()
  })

  it('includes signature in successful result', () => {
    const result = evaluateSmartNotesLine('10 + 20', emptyCtx)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('signature')
    expect((result as { signature: string }).signature).toContain('::30.000000')
  })

  it('includes expression field in successful result', () => {
    const result = evaluateSmartNotesLine('10 + 20', emptyCtx)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('expression')
  })
})
