import { Link } from 'react-router-dom'
import { SignUpForm } from '../components/auth/SignUpForm'

export function SignUpPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
      <SignUpForm />
      <Link to="/login" className="text-sm text-slate-600 hover:underline">
        Already have an account? Log in
      </Link>
    </div>
  )
}
