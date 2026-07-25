import { FirebaseError } from 'firebase/app'
import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authErrorMessages'

describe('getAuthErrorMessage', () => {
  it('maps known Firebase auth error codes to friendly messages', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/email-already-in-use', 'x'))).toBe(
      'An account with this email already exists.',
    )
    expect(getAuthErrorMessage(new FirebaseError('auth/wrong-password', 'x'))).toBe(
      'Incorrect email or password.',
    )
  })

  it('falls back to a generic message for unknown Firebase error codes', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/some-new-code', 'x'))).toBe(
      'Something went wrong. Please try again.',
    )
  })

  it('falls back to a generic message for non-Firebase errors', () => {
    expect(getAuthErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
    expect(getAuthErrorMessage('boom')).toBe('Something went wrong. Please try again.')
  })
})
