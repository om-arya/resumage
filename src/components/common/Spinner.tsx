export function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-12">
      <div
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
      />
    </div>
  )
}
