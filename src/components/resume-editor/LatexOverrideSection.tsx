interface LatexOverrideSectionProps {
  latex: string
  isLatexOverridden: boolean
  onChange: (latex: string) => void
  onRevertToAuto: () => void
}

/**
 * Always-live LaTeX preview/editor, shared by every entity editor. When the
 * fields change, `latex` (computed by the caller via useDraftEntity) updates
 * immediately — there's nothing to "regenerate" on demand.
 */
export function LatexOverrideSection({
  latex,
  isLatexOverridden,
  onChange,
  onRevertToAuto,
}: LatexOverrideSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-label="LaTeX source"
        value={latex}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
      />
      <div className="flex items-center gap-3 text-xs">
        {isLatexOverridden ? (
          <span className="font-medium text-amber-700">Custom LaTeX</span>
        ) : (
          <span className="text-slate-400">Auto-generated</span>
        )}
        {isLatexOverridden ? (
          <button type="button" className="text-slate-600 underline" onClick={onRevertToAuto}>
            Revert to auto-generated
          </button>
        ) : null}
      </div>
    </div>
  )
}
