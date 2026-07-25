import { Link } from 'react-router-dom'
import { Button } from '../common/Button'
import { useAuth } from '../../hooks/useAuth'

export function Navbar() {
  const { user, logOut } = useAuth()

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
      <Link to="/" className="text-lg font-semibold text-slate-900">
        resumage
      </Link>
      {user ? (
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user.email}</span>
          <Button className="w-auto px-3 py-1.5 text-sm" onClick={() => logOut()}>
            Log out
          </Button>
        </div>
      ) : null}
    </header>
  )
}
