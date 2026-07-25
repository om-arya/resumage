import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordForm } from './ResetPasswordForm'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: null,
    initializing: false,
    loading: false,
    error: null,
    signUp: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    resetPassword: vi.fn().mockResolvedValue(true),
  })
})

describe('ResetPasswordForm', () => {
  it('shows a validation error and does not call resetPassword for invalid input', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm />)

    await user.click(screen.getByRole('button', { name: /send reset email/i }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(mockedUseAuth().resetPassword).not.toHaveBeenCalled()
  })

  it('calls resetPassword and shows a confirmation on valid submit', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => {
      expect(mockedUseAuth().resetPassword).toHaveBeenCalledWith('user@example.com')
    })
    expect(
      await screen.findByText(/password reset email has been sent/i),
    ).toBeInTheDocument()
  })
})
