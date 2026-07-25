import { twMerge } from 'tailwind-merge'

interface MustIncludeToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** "Always include this in generated resumes, regardless of ranking" flag. */
export function MustIncludeToggle({ checked, onChange }: MustIncludeToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={twMerge(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        checked
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50',
      )}
    >
      <span aria-hidden="true">{checked ? '★' : '☆'}</span>
      Must include
    </button>
  )
}
