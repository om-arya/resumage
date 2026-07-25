import { describe, expect, it } from 'vitest'
import { substitutePlaceholders } from './substitutePlaceholders'

describe('substitutePlaceholders', () => {
  it('replaces every occurrence of a placeholder present in values', () => {
    const result = substitutePlaceholders('{{A}} and {{A}} and {{B}}', { A: 'x', B: 'y' })
    expect(result).toBe('x and x and y')
  })

  it('leaves placeholders not present in values untouched', () => {
    const result = substitutePlaceholders('{{TITLE}} — {{BULLETS}}', { TITLE: 'Engineer' })
    expect(result).toBe('Engineer — {{BULLETS}}')
  })

  it('returns the template unchanged when values is empty', () => {
    expect(substitutePlaceholders('plain text', {})).toBe('plain text')
  })

  it('substitutes an empty string value', () => {
    expect(substitutePlaceholders('[{{X}}]', { X: '' })).toBe('[]')
  })
})
