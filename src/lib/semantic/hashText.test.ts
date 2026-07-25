import { describe, expect, it } from 'vitest'
import { hashText } from './hashText'

describe('hashText', () => {
  it('is deterministic for the same input', () => {
    expect(hashText('hello world')).toBe(hashText('hello world'))
  })

  it('produces different hashes for different input', () => {
    expect(hashText('hello world')).not.toBe(hashText('hello world!'))
  })

  it('hashes an empty string without throwing', () => {
    expect(() => hashText('')).not.toThrow()
  })

  it('is sensitive to character order', () => {
    expect(hashText('ab')).not.toBe(hashText('ba'))
  })
})
