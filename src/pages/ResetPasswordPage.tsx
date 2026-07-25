import { Link } from 'react-router-dom'
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm'

export function ResetPasswordPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>
      <ResetPasswordForm />
      <Link to="/login" className="text-sm text-slate-600 hover:underline">
        Back to log in
      </Link>
    </div>
  )
}
