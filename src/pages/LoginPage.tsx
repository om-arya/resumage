import { Link } from 'react-router-dom'
import { LoginForm } from '../components/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
      <LoginForm />
      <div className="flex justify-between text-sm text-slate-600">
        <Link to="/signup" className="hover:underline">
          Create an account
        </Link>
        <Link to="/reset-password" className="hover:underline">
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
