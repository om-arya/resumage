import { create } from 'zustand'
import { observeAuthState } from '../lib/firebase/auth'
import type { AuthUser } from '../types/auth'

interface AuthState {
  user: AuthUser | null
  initializing: boolean
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  initializing: true,
}))

export function initAuthListener() {
  return observeAuthState((firebaseUser) => {
    useAuthStore.setState({
      user: firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null,
      initializing: false,
    })
  })
}
