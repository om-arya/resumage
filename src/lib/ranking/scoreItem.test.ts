import { describe, expect, it } from 'vitest'
import { computeRelevanceScore } from './scoreItem'

describe('computeRelevanceScore', () => {
  it('returns 0 when the item has no embedding', () => {
    expect(computeRelevanceScore(null, [1, 0, 0])).toBe(0)
  })

  it('delegates to cosine similarity when an embedding is present', () => {
    expect(computeRelevanceScore([1, 0], [1, 0])).toBeCloseTo(1)
  })
})
