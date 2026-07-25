import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { twMerge } from 'tailwind-merge'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useDraftEntity } from '../../hooks/useDraftEntity'
import { generateSectionLatex } from '../../lib/template/generateDefaultLatex'
import { LatexOverrideSection } from './LatexOverrideSection'
import { MustIncludeToggle } from './MustIncludeToggle'
import { SortableItem } from './SortableItem'
import { SortableList } from './SortableList'
import { EntryCard } from './EntryCard'
import { SkillRowCard } from './SkillRowCard'
import type { Section } from '../../types/resumeDb'

interface SectionCardProps {
  section: Section
}

export function SectionCard({ section }: SectionCardProps) {
  const entries = useResumeDbStore(
    useShallow((state) => state.entries.filter((e) => e.sectionId === section.id)),
  )
  const skillRows = useResumeDbStore(
    useShallow((state) => state.skillRows.filter((r) => r.sectionId === section.id)),
  )
  const updateSection = useResumeDbStore((state) => state.updateSection)
  const deleteSection = useResumeDbStore((state) => state.deleteSection)
  const setMustInclude = useResumeDbStore((state) => state.setMustInclude)
  const addEntry = useResumeDbStore((state) => state.addEntry)
  const addSkillRow = useResumeDbStore((state) => state.addSkillRow)
  const reorderEntries = useResumeDbStore((state) => state.reorderEntries)
  const reorderSkillRows = useResumeDbStore((state) => state.reorderSkillRows)
  const [newItemName, setNewItemName] = useState('')

  const { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex } = useDraftEntity(
    {
      key: `sections:${section.id}`,
      fields: { displayName: section.displayName },
      latex: section.latex,
      isLatexOverridden: section.isLatexOverridden,
      generateLatex: (f) => generateSectionLatex(f.displayName),
      onFlush: (patch) => updateSection(section.id, patch),
    },
  )

  async function handleAddItem(event: FormEvent) {
    event.preventDefault()
    if (!newItemName.trim()) return
    if (section.sectionType === 'entries') {
      await addEntry(section.id, {
        title: newItemName.trim(),
        organization: '',
        startDate: '',
        endDate: '',
        location: '',
      })
    } else {
      await addSkillRow(section.id, newItemName.trim())
    }
    setNewItemName('')
  }

  return (
    <section
      className={twMerge(
        'flex flex-col gap-3 rounded-lg border border-slate-200 p-4',
        section.mustInclude && 'border-l-4 border-l-amber-400',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mt-2 text-xs text-slate-400">
          {section.sectionType === 'entries' ? 'Entries & Bullets' : 'Rows & Items'}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <MustIncludeToggle
            checked={section.mustInclude}
            onChange={(checked) => setMustInclude('sections', section.id, checked)}
          />
          <button
            type="button"
            className="text-xs text-red-600 underline"
            onClick={() => deleteSection(section.id)}
          >
            Delete section
          </button>
        </div>
      </div>

      <Input
        id={`section-name-${section.id}`}
        label="Section name"
        value={fields.displayName}
        onChange={(e) => updateFields({ displayName: e.target.value })}
      />

      <LatexOverrideSection
        latex={latex}
        isLatexOverridden={isLatexOverridden}
        onChange={setLatex}
        onRevertToAuto={revertToAutoLatex}
      />

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
        {section.sectionType === 'entries' ? (
          <SortableList ids={entries.map((e) => e.id)} onReorder={reorderEntries}>
            {entries.map((entry) => (
              <SortableItem key={entry.id} id={entry.id}>
                <EntryCard entry={entry} />
              </SortableItem>
            ))}
          </SortableList>
        ) : (
          <SortableList ids={skillRows.map((r) => r.id)} onReorder={reorderSkillRows}>
            {skillRows.map((row) => (
              <SortableItem key={row.id} id={row.id}>
                <SkillRowCard skillRow={row} />
              </SortableItem>
            ))}
          </SortableList>
        )}
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            aria-label={section.sectionType === 'entries' ? 'New entry title' : 'New row title'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={section.sectionType === 'entries' ? 'New entry title…' : 'New row title…'}
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
          <Button type="submit" className="w-auto px-3 py-1.5 text-sm">
            {section.sectionType === 'entries' ? 'Add entry' : 'Add row'}
          </Button>
        </form>
      </div>
    </section>
  )
}
