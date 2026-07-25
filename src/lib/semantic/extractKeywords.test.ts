import { describe, expect, it } from 'vitest'
import { extractKeywords } from './extractKeywords'

describe('extractKeywords', () => {
  it('matches a dictionary term case-insensitively', () => {
    expect(extractKeywords('Built services with python and REACT')).toEqual(
      expect.arrayContaining(['Python', 'React']),
    )
  })

  it('does not match a term as a substring of a longer word', () => {
    const found = extractKeywords('Built a JavaScript application')
    expect(found).toContain('JavaScript')
    expect(found).not.toContain('Java')
  })

  it('matches terms containing special regex characters', () => {
    expect(extractKeywords('Wrote C++ and C# services')).toEqual(
      expect.arrayContaining(['C++', 'C#']),
    )
  })

  it('dedupes repeated mentions of the same term', () => {
    const found = extractKeywords('Python, python, PYTHON')
    expect(found.filter((term) => term === 'Python')).toHaveLength(1)
  })

  it('returns an empty array when nothing matches', () => {
    expect(extractKeywords('Led a bake sale fundraiser')).toEqual([])
  })

  it('respects a custom dictionary', () => {
    expect(extractKeywords('used Widgetize daily', ['Widgetize'])).toEqual(['Widgetize'])
  })
})
