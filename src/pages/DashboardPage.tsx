import { useAuth } from '../hooks/useAuth'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="text-slate-600">Signed in as {user?.email}</p>
    </div>
  )
}
