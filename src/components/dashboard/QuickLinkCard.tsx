import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import { ArrowRightIcon } from './icons'

type Accent = 'indigo' | 'sky' | 'emerald' | 'amber'

const ACCENT_STYLES: Record<Accent, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
}

interface QuickLinkCardProps {
  to: string
  icon: ReactNode
  title: string
  description: string
  accent: Accent
}

export function QuickLinkCard({ to, icon, title, description, accent }: QuickLinkCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className={twMerge('flex h-11 w-11 items-center justify-center rounded-xl', ACCENT_STYLES[accent])}>
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <span className="mt-auto flex items-center gap-1 text-sm font-medium text-slate-400 transition group-hover:gap-2 group-hover:text-slate-900">
        Open <ArrowRightIcon className="h-4 w-4" />
      </span>
    </Link>
  )
}
