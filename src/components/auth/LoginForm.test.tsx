import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function renderLoginForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: null,
    initializing: false,
    loading: false,
    error: null,
    signUp: vi.fn(),
    logIn: vi.fn().mockResolvedValue(true),
    logOut: vi.fn(),
    resetPassword: vi.fn(),
  })
})

describe('LoginForm', () => {
  it('shows validation errors and does not call logIn for invalid input', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(mockedUseAuth().logIn).not.toHaveBeenCalled()
  })

  it('calls logIn with entered credentials on valid submit', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockedUseAuth().logIn).toHaveBeenCalledWith('user@example.com', 'password1')
    })
  })

  it('displays an auth error message from the hook', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      initializing: false,
      loading: false,
      error: 'Incorrect email or password.',
      signUp: vi.fn(),
      logIn: vi.fn(),
      logOut: vi.fn(),
      resetPassword: vi.fn(),
    })
    renderLoginForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })
})
