import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { FormError } from '../common/FormError'
import { useAuth } from '../../hooks/useAuth'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../../utils/validation'

export function SignUpForm() {
  const { signUp, loading, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    const confirmError = validatePasswordConfirmation(password, confirmPassword)
    setFieldErrors({
      email: emailError ?? undefined,
      password: passwordError ?? undefined,
      confirmPassword: confirmError ?? undefined,
    })
    if (emailError || passwordError || confirmError) return

    const success = await signUp(email, password)
    if (success) navigate('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <Input
        id="signup-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />
      <Input
        id="signup-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />
      <Input
        id="signup-confirm-password"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
      />
      <FormError message={error} />
      <Button type="submit" loading={loading}>
        Sign up
      </Button>
    </form>
  )
}
