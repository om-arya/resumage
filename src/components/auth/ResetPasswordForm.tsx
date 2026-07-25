import { useState, type FormEvent } from 'react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { FormError } from '../common/FormError'
import { useAuth } from '../../hooks/useAuth'
import { validateEmail } from '../../utils/validation'

export function ResetPasswordForm() {
  const { resetPassword, loading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationError = validateEmail(email)
    setEmailError(validationError ?? undefined)
    if (validationError) return

    const success = await resetPassword(email)
    if (success) setSent(true)
  }

  if (sent) {
    return (
      <p className="w-full max-w-sm text-sm text-slate-700">
        If an account exists for {email}, a password reset email has been sent.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <Input
        id="reset-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailError}
      />
      <FormError message={error} />
      <Button type="submit" className="w-full" loading={loading}>
        Send reset email
      </Button>
    </form>
  )
}
