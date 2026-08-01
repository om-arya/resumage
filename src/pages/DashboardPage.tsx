import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useTemplatesStore } from '../stores/templatesStore'
import { RecentGenerationsList } from '../components/dashboard/RecentGenerationsList'
import { QuickLinkCard } from '../components/dashboard/QuickLinkCard'
import { DatabaseIcon, LayoutIcon, SlidersIcon, SparklesIcon } from '../components/dashboard/icons'
import { getTimeBasedGreeting } from '../utils/greeting'

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const subscribeTemplates = useTemplatesStore((state) => state.subscribe)
  const unsubscribeTemplates = useTemplatesStore((state) => state.unsubscribeAll)

  useEffect(() => {
    if (!user) return
    subscribeTemplates(user.uid)
    return () => unsubscribeTemplates()
  }, [user, subscribeTemplates, unsubscribeTemplates])

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-indigo-600">{getTimeBasedGreeting()}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLinkCard
          to="/resume-db"
          accent="indigo"
          icon={<DatabaseIcon className="h-5 w-5" />}
          title="Resume database"
          description="Manage sections, entries, bullets, and skills."
        />
        <QuickLinkCard
          to="/templates"
          accent="sky"
          icon={<LayoutIcon className="h-5 w-5" />}
          title="Templates"
          description="Edit LaTeX templates and pick your active one."
        />
        <QuickLinkCard
          to="/generate"
          accent="emerald"
          icon={<SparklesIcon className="h-5 w-5" />}
          title="Generate"
          description="Paste a job description, get a tailored PDF."
        />
        <QuickLinkCard
          to="/settings"
          accent="amber"
          icon={<SlidersIcon className="h-5 w-5" />}
          title="Settings"
          description="Page constraints and section ordering."
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent generations</h2>
          <Link to="/generate" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            New generation →
          </Link>
        </div>
        <RecentGenerationsList uid={user.uid} />
      </div>
    </div>
  )
}
