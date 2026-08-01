import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import { useTemplatesStore } from '../../stores/templatesStore'
import { deleteResumeDbDoc, subscribeToRecentGeneratedResumes } from '../../lib/firebase/firestoreCollection'
import { deletePdf, getPdfDownloadUrl } from '../../lib/firebase/storageApi'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { Spinner } from '../common/Spinner'
import { FormError } from '../common/FormError'
import { ClockIcon, DocumentIcon, MeatballsIcon } from './icons'
import type { GeneratedResume } from '../../types/resumeDb'

const RECENT_COUNT = 5
/** Kept in sync with the `duration-*` class on the row below — gives the collapse
 * transition time to finish before the row (and its Firestore doc) is actually gone,
 * so the list beneath it eases up instead of snapping into place. */
const EXIT_ANIMATION_MS = 220

interface RecentGenerationsListProps {
  uid: string
}

/** Snippet of the JD text used for a generation, since there's no title field to show instead. */
function jobDescriptionSnippet(text: string, maxLength = 90): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed
}

interface GenerationActionsMenuProps {
  onDelete: () => void
}

/** The "meatballs" (⋯) menu next to View — currently just holds Delete, but is its own component so more actions can land here later. */
function GenerationActionsMenu({ onDelete }: GenerationActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Generation actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <MeatballsIcon className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-1 w-36 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function RecentGenerationsList({ uid }: RecentGenerationsListProps) {
  const templates = useTemplatesStore((state) => state.templates)
  const [generations, setGenerations] = useState<GeneratedResume[] | null>(null)
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({})
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    return subscribeToRecentGeneratedResumes(uid, RECENT_COUNT, setGenerations)
  }, [uid])

  useEffect(() => {
    if (!generations || generations.length === 0) return
    let cancelled = false
    Promise.all(generations.map(async (gen) => [gen.id, await getPdfDownloadUrl(gen.pdfStoragePath)] as const))
      .then((pairs) => {
        if (!cancelled) setDownloadUrls(Object.fromEntries(pairs))
      })
      .catch(() => {
        // Best-effort: if a link fails to resolve, that row just stays without a "View" action.
      })
    return () => {
      cancelled = true
    }
  }, [generations])

  async function performDelete(gen: GeneratedResume) {
    setDeleteError(null)
    try {
      await deleteResumeDbDoc(uid, 'generatedResumes', gen.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete the generation.')
      // Uncollapse it — the delete didn't actually happen, so it shouldn't stay hidden.
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(gen.id)
        return next
      })
      return
    }
    // Best-effort cleanup — the Firestore doc is already gone (and the list already
    // updated via the live listener), so a failure here just leaves an orphaned PDF.
    deletePdf(gen.pdfStoragePath).catch((err) => {
      console.warn('Failed to delete the PDF for a removed generation.', err)
    })
  }

  /** Collapses the row first (so the list eases up smoothly), then deletes once the transition finishes. */
  function handleDeleteClick(gen: GeneratedResume) {
    setRemovingIds((prev) => new Set(prev).add(gen.id))
    setTimeout(() => performDelete(gen), EXIT_ANIMATION_MS)
  }

  if (generations === null) {
    return (
      <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-10">
        <Spinner />
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
        <DocumentIcon className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-600">You haven&apos;t generated a resume yet.</p>
        <Link
          to="/generate"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Generate your first one
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <FormError message={deleteError} />
      <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {generations.map((gen) => {
          const templateName = templates.find((t) => t.id === gen.templateId)?.name ?? 'a template'
          const downloadUrl = downloadUrls[gen.id]
          return (
            <li
              key={gen.id}
              className={twMerge(
                'animate-fade-slide-in flex max-h-40 items-center justify-between gap-4 p-4 opacity-100 transition-all duration-200 ease-in-out',
                // overflow-hidden only while collapsing — kept off the rest of the time so the
                // actions dropdown (absolutely positioned within this row) isn't clipped.
                removingIds.has(gen.id) && 'pointer-events-none max-h-0 overflow-hidden p-0 opacity-0',
              )}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {jobDescriptionSnippet(gen.jobDescriptionText)}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                  {formatRelativeTime(gen.createdAt.toDate())} · {templateName} · {gen.pageCount} page
                  {gen.pageCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Loading…</span>
                )}
                <GenerationActionsMenu onDelete={() => handleDeleteClick(gen)} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
