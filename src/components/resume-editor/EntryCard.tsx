import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { twMerge } from 'tailwind-merge'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useDraftEntity } from '../../hooks/useDraftEntity'
import { generateEntryLatex } from '../../lib/template/generateDefaultLatex'
import { JAKES_RESUME_TEMPLATE } from '../../lib/template/jakesResumeTemplate'
import { LatexOverrideSection } from './LatexOverrideSection'
import { MustIncludeToggle } from './MustIncludeToggle'
import { SortableItem } from './SortableItem'
import { SortableList } from './SortableList'
import { BulletRow } from './BulletRow'
import type { Entry, EntryFields } from '../../types/resumeDb'

interface EntryCardProps {
  entry: Entry
}

export function EntryCard({ entry }: EntryCardProps) {
  const bullets = useResumeDbStore(
    useShallow((state) => state.bullets.filter((b) => b.entryId === entry.id)),
  )
  const updateEntry = useResumeDbStore((state) => state.updateEntry)
  const deleteEntry = useResumeDbStore((state) => state.deleteEntry)
  const setMustInclude = useResumeDbStore((state) => state.setMustInclude)
  const addBullet = useResumeDbStore((state) => state.addBullet)
  const reorderBullets = useResumeDbStore((state) => state.reorderBullets)
  const [newBulletText, setNewBulletText] = useState('')
  // Entries that already have a title start collapsed; a freshly-added blank one starts open.
  const [collapsed, setCollapsed] = useState(() => Boolean(entry.fields.title))

  const { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex } =
    useDraftEntity<EntryFields>({
      key: `entries:${entry.id}`,
      fields: entry.fields,
      latex: entry.latex,
      isLatexOverridden: entry.isLatexOverridden,
      generateLatex: (f) => generateEntryLatex(f, JAKES_RESUME_TEMPLATE),
      onFlush: (patch) => updateEntry(entry.id, patch),
    })

  async function handleAddBullet(event: FormEvent) {
    event.preventDefault()
    if (!newBulletText.trim()) return
    await addBullet(entry.id, entry.sectionId, newBulletText.trim())
    setNewBulletText('')
  }

  const summary = [fields.title || 'Untitled entry', fields.organization].filter(Boolean).join(' · ')

  return (
    <div
      className={twMerge(
        'flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3',
        entry.mustInclude && 'border-l-4 border-l-amber-400',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-slate-400">{collapsed ? '▶' : '▼'}</span>
          <span className="truncate font-medium text-slate-900">{summary}</span>
          {collapsed && bullets.length > 0 ? (
            <span className="shrink-0 text-xs text-slate-400">
              {bullets.length} bullet{bullets.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-3">
          <MustIncludeToggle
            checked={entry.mustInclude}
            onChange={(checked) => setMustInclude('entries', entry.id, checked)}
          />
          <button
            type="button"
            className="text-xs text-red-600 underline"
            onClick={() => deleteEntry(entry.id)}
          >
            Delete entry
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              id={`entry-title-${entry.id}`}
              label="Title"
              value={fields.title}
              onChange={(e) => updateFields((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Input
              id={`entry-org-${entry.id}`}
              label="Organization"
              value={fields.organization}
              onChange={(e) => updateFields((prev) => ({ ...prev, organization: e.target.value }))}
            />
            <Input
              id={`entry-start-${entry.id}`}
              label="Start date"
              value={fields.startDate}
              onChange={(e) => updateFields((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <Input
              id={`entry-end-${entry.id}`}
              label="End date"
              value={fields.endDate}
              onChange={(e) => updateFields((prev) => ({ ...prev, endDate: e.target.value }))}
            />
            <Input
              id={`entry-location-${entry.id}`}
              label="Location"
              value={fields.location}
              onChange={(e) => updateFields((prev) => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <LatexOverrideSection
            latex={latex}
            isLatexOverridden={isLatexOverridden}
            onChange={setLatex}
            onRevertToAuto={revertToAutoLatex}
          />

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <span className="text-sm font-medium text-slate-700">Bullets</span>
            <SortableList
              ids={bullets.map((b) => b.id)}
              onReorder={reorderBullets}
              className="flex flex-col gap-2"
            >
              {bullets.map((bullet) => (
                <SortableItem key={bullet.id} id={bullet.id}>
                  <BulletRow bullet={bullet} />
                </SortableItem>
              ))}
            </SortableList>
            <form onSubmit={handleAddBullet} className="flex gap-2">
              <textarea
                aria-label="New bullet text"
                value={newBulletText}
                onChange={(e) => setNewBulletText(e.target.value)}
                rows={1}
                placeholder="New bullet…"
                className="flex-1 rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
              <Button type="submit" className="w-auto shrink-0 px-3 py-2 text-sm">
                Add bullet
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
