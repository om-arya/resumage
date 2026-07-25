import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { FormError } from '../common/FormError'
import { useAuth } from '../../hooks/useAuth'
import { validateEmail, validatePassword } from '../../utils/validation'

export function LoginForm() {
  const { logIn, loading, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    setFieldErrors({ email: emailError ?? undefined, password: passwordError ?? undefined })
    if (emailError || passwordError) return

    const success = await logIn(email, password)
    if (success) navigate('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <Input
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />
      <Input
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />
      <FormError message={error} />
      <Button type="submit" loading={loading}>
        Log in
      </Button>
    </form>
  )
}
