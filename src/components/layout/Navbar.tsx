import { Link } from 'react-router-dom'
import { Button } from '../common/Button'
import { useAuth } from '../../hooks/useAuth'

export function Navbar() {
  const { user, logOut } = useAuth()

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          resumage
        </Link>
        {user ? (
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link to="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link to="/resume-db" className="hover:text-slate-900">
              Resume database
            </Link>
            <Link to="/templates" className="hover:text-slate-900">
              Templates
            </Link>
            <Link to="/generate" className="hover:text-slate-900">
              Generate
            </Link>
            <Link to="/settings" className="hover:text-slate-900">
              Settings
            </Link>
          </nav>
        ) : null}
      </div>
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
