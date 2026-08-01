import { describe, expect, it } from 'vitest'
import { getTimeBasedGreeting } from './greeting'

describe('getTimeBasedGreeting', () => {
  it('greets morning hours', () => {
    expect(getTimeBasedGreeting(new Date(2024, 0, 1, 8))).toBe('Good morning')
  })

  it('greets afternoon hours', () => {
    expect(getTimeBasedGreeting(new Date(2024, 0, 1, 14))).toBe('Good afternoon')
  })

  it('greets evening hours', () => {
    expect(getTimeBasedGreeting(new Date(2024, 0, 1, 20))).toBe('Good evening')
  })

  it('greets late-night hours', () => {
    expect(getTimeBasedGreeting(new Date(2024, 0, 1, 2))).toBe('Good night')
  })
})
