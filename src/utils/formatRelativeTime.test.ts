import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

const now = new Date(2024, 5, 15, 12, 0, 0)

describe('formatRelativeTime', () => {
  it('formats seconds', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 30 * 1000), now)).toBe('30 seconds ago')
  })

  it('formats minutes', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000), now)).toBe('5 minutes ago')
  })

  it('formats hours', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000), now)).toBe('3 hours ago')
  })

  it('formats days', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), now)).toBe('2 days ago')
  })

  it('formats future dates', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 60 * 60 * 1000), now)).toBe('in 1 hour')
  })
})
