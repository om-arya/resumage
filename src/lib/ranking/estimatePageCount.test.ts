import { describe, expect, it } from 'vitest'
import { estimatePageCount } from './estimatePageCount'

describe('estimatePageCount', () => {
  it('estimates 1 page for short content', () => {
    expect(estimatePageCount('\\resumeItem{A short bullet}')).toBe(1)
  })

  it('estimates 1 page for an empty document', () => {
    expect(estimatePageCount('')).toBe(1)
  })

  it('estimates more pages for proportionally longer content', () => {
    const short = estimatePageCount('word '.repeat(50))
    const long = estimatePageCount('word '.repeat(5000))
    expect(long).toBeGreaterThan(short)
  })

  it('never returns less than 1', () => {
    expect(estimatePageCount('x')).toBeGreaterThanOrEqual(1)
  })
})
