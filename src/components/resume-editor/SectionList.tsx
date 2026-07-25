import { useState, type FormEvent } from 'react'
import { Button } from '../common/Button'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { SortableItem } from './SortableItem'
import { SortableList } from './SortableList'
import { SectionCard } from './SectionCard'
import type { SectionType } from '../../types/resumeDb'

export function SectionList() {
  const sections = useResumeDbStore((state) => state.sections)
  const addSection = useResumeDbStore((state) => state.addSection)
  const reorderSections = useResumeDbStore((state) => state.reorderSections)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionType, setNewSectionType] = useState<SectionType>('entries')

  async function handleAddSection(event: FormEvent) {
    event.preventDefault()
    if (!newSectionName.trim()) return
    await addSection(newSectionName.trim(), newSectionType)
    setNewSectionName('')
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Sections</h2>
      </div>

      <SortableList ids={sections.map((s) => s.id)} onReorder={reorderSections}>
        {sections.map((section) => (
          <SortableItem key={section.id} id={section.id}>
            <SectionCard section={section} />
          </SortableItem>
        ))}
      </SortableList>

      <form onSubmit={handleAddSection} className="flex items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="new-section-name" className="text-sm font-medium text-slate-700">
            New section name
          </label>
          <input
            id="new-section-name"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="e.g. Experience, Projects, Technical Skills"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-section-type" className="text-sm font-medium text-slate-700">
            Type
          </label>
          <select
            id="new-section-type"
            value={newSectionType}
            onChange={(e) => setNewSectionType(e.target.value as SectionType)}
            className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="entries">Entries & Bullets</option>
            <option value="skills">Rows & Items</option>
          </select>
        </div>
        <Button type="submit" className="w-auto px-4 py-2">
          Add section
        </Button>
      </form>
    </section>
  )
}
