import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../common/Spinner'

export function PublicOnlyRoute() {
  const user = useAuthStore((state) => state.user)
  const initializing = useAuthStore((state) => state.initializing)

  if (initializing) return <Spinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
