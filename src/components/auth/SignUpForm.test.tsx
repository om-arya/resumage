import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignUpForm } from './SignUpForm'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function renderSignUpForm() {
  return render(
    <MemoryRouter>
      <SignUpForm />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: null,
    initializing: false,
    loading: false,
    error: null,
    signUp: vi.fn().mockResolvedValue(true),
    logIn: vi.fn(),
    logOut: vi.fn(),
    resetPassword: vi.fn(),
  })
})

describe('SignUpForm', () => {
  it('shows validation errors and does not call signUp for invalid input', async () => {
    const user = userEvent.setup()
    renderSignUpForm()

    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument()
    expect(mockedUseAuth().signUp).not.toHaveBeenCalled()
  })

  it('shows a mismatch error when passwords differ', async () => {
    const user = userEvent.setup()
    renderSignUpForm()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password2')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(mockedUseAuth().signUp).not.toHaveBeenCalled()
  })

  it('calls signUp with entered credentials on valid submit', async () => {
    const user = userEvent.setup()
    renderSignUpForm()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(mockedUseAuth().signUp).toHaveBeenCalledWith('user@example.com', 'password1')
    })
  })
})
