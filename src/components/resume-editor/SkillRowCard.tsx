import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useTemplatesStore, selectActiveTemplate } from '../../stores/templatesStore'
import { useDraftEntity } from '../../hooks/useDraftEntity'
import { generateSkillRowLatex } from '../../lib/template/generateDefaultLatex'
import { LatexOverrideSection } from './LatexOverrideSection'
import { SortableItem } from './SortableItem'
import { SortableList } from './SortableList'
import { SkillChip } from './SkillChip'
import type { SkillRow } from '../../types/resumeDb'

interface SkillRowCardProps {
  skillRow: SkillRow
}

export function SkillRowCard({ skillRow }: SkillRowCardProps) {
  const skills = useResumeDbStore(
    useShallow((state) => state.skills.filter((s) => s.skillRowId === skillRow.id)),
  )
  const updateSkillRow = useResumeDbStore((state) => state.updateSkillRow)
  const deleteSkillRow = useResumeDbStore((state) => state.deleteSkillRow)
  const addSkill = useResumeDbStore((state) => state.addSkill)
  const reorderSkills = useResumeDbStore((state) => state.reorderSkills)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)
  const [newSkillName, setNewSkillName] = useState('')

  const { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex } = useDraftEntity(
    {
      key: `skillRows:${skillRow.id}`,
      fields: { categoryName: skillRow.categoryName },
      latex: skillRow.latex,
      isLatexOverridden: skillRow.isLatexOverridden,
      generateLatex: (f) => generateSkillRowLatex(f.categoryName, activeTemplate),
      onFlush: (patch) => updateSkillRow(skillRow.id, patch),
    },
  )

  async function handleAddSkill(event: FormEvent) {
    event.preventDefault()
    if (!newSkillName.trim()) return
    await addSkill(skillRow.id, newSkillName.trim())
    setNewSkillName('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-end gap-2">
        <Input
          id={`skillrow-category-${skillRow.id}`}
          label="Category"
          value={fields.categoryName}
          onChange={(e) => updateFields({ categoryName: e.target.value })}
        />
        <button
          type="button"
          className="mb-2 text-xs text-red-600 underline"
          onClick={() => deleteSkillRow(skillRow.id)}
        >
          Delete row
        </button>
      </div>

      <LatexOverrideSection
        latex={latex}
        isLatexOverridden={isLatexOverridden}
        onChange={setLatex}
        onRevertToAuto={revertToAutoLatex}
      />

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <SortableList
          ids={skills.map((s) => s.id)}
          onReorder={reorderSkills}
          className="flex flex-wrap gap-2"
        >
          {skills.map((skill) => (
            <SortableItem key={skill.id} id={skill.id}>
              <SkillChip skill={skill} />
            </SortableItem>
          ))}
        </SortableList>
        <form onSubmit={handleAddSkill} className="flex gap-2">
          <input
            aria-label="New item"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="New item…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
          <Button type="submit" className="w-auto px-3 py-1.5 text-sm">
            Add item
          </Button>
        </form>
      </div>
    </div>
  )
}
