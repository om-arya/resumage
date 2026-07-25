import { describe, expect, it } from 'vitest'
import { validateEmail, validatePassword, validatePasswordConfirmation } from './validation'

describe('validateEmail', () => {
  it('rejects empty input', () => {
    expect(validateEmail('')).toBe('Email is required.')
  })

  it('rejects malformed emails', () => {
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.')
  })

  it('accepts a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('rejects empty input', () => {
    expect(validatePassword('')).toBe('Password is required.')
  })

  it('rejects passwords under 8 characters', () => {
    expect(validatePassword('short')).toBe('Password must be at least 8 characters.')
  })

  it('accepts a password of 8+ characters', () => {
    expect(validatePassword('longenough')).toBeNull()
  })
})

describe('validatePasswordConfirmation', () => {
  it('rejects empty confirmation', () => {
    expect(validatePasswordConfirmation('password1', '')).toBe('Confirm your password.')
  })

  it('rejects mismatched confirmation', () => {
    expect(validatePasswordConfirmation('password1', 'password2')).toBe(
      'Passwords do not match.',
    )
  })

  it('accepts matching confirmation', () => {
    expect(validatePasswordConfirmation('password1', 'password1')).toBeNull()
  })
})
