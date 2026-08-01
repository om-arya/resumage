import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useSyncedState } from '../../hooks/useSyncedState'
import { useRegisteredFlush } from '../../hooks/useRegisteredFlush'
import { usePendingChangesStore } from '../../stores/pendingChangesStore'
import type { Skill } from '../../types/resumeDb'

interface SkillChipProps {
  skill: Skill
}

export function SkillChip({ skill }: SkillChipProps) {
  const updateSkill = useResumeDbStore((state) => state.updateSkill)
  const deleteSkill = useResumeDbStore((state) => state.deleteSkill)
  const setMustInclude = useResumeDbStore((state) => state.setMustInclude)
  const markDirty = usePendingChangesStore((state) => state.markDirty)
  const [displayName, setDisplayName] = useSyncedState(skill.displayName)

  const key = `skills:${skill.id}`
  useRegisteredFlush(
    key,
    useCallback(() => updateSkill(skill.id, displayName), [displayName, skill.id, updateSkill]),
    2,
  )

  return (
    <div
      className={twMerge(
        'flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5',
        skill.mustInclude ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-slate-50',
      )}
    >
      <input
        aria-label="Skill name"
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value)
          markDirty(key)
        }}
        className="w-24 bg-transparent text-sm outline-none"
      />
      <button
        type="button"
        role="switch"
        aria-checked={skill.mustInclude}
        title="Must include"
        onClick={() => setMustInclude('skills', skill.id, !skill.mustInclude)}
        className={twMerge('leading-none', skill.mustInclude ? 'text-amber-600' : 'text-slate-300 hover:text-slate-400')}
      >
        {skill.mustInclude ? '★' : '☆'}
      </button>
      <button
        type="button"
        aria-label="Delete skill"
        className="text-slate-400 hover:text-red-600"
        onClick={() => deleteSkill(skill.id)}
      >
        ×
      </button>
    </div>
  )
}
