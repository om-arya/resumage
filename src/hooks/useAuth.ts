import { useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import * as authApi from '../lib/firebase/auth'
import { getAuthErrorMessage } from '../utils/authErrorMessages'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const initializing = useAuthStore((state) => state.initializing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAction = useCallback(async (action: () => Promise<unknown>) => {
    setLoading(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const signUp = useCallback(
    (email: string, password: string) => runAction(() => authApi.signUp(email, password)),
    [runAction],
  )
  const logIn = useCallback(
    (email: string, password: string) => runAction(() => authApi.logIn(email, password)),
    [runAction],
  )
  const logOut = useCallback(() => runAction(() => authApi.logOut()), [runAction])
  const resetPassword = useCallback(
    (email: string) => runAction(() => authApi.resetPassword(email)),
    [runAction],
  )

  return { user, initializing, loading, error, signUp, logIn, logOut, resetPassword }
}
