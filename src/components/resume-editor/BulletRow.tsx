import { twMerge } from 'tailwind-merge'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useTemplatesStore, selectActiveTemplate } from '../../stores/templatesStore'
import { useDraftEntity } from '../../hooks/useDraftEntity'
import { generateBulletLatex } from '../../lib/template/generateDefaultLatex'
import { LatexOverrideSection } from './LatexOverrideSection'
import { MustIncludeToggle } from './MustIncludeToggle'
import type { Bullet } from '../../types/resumeDb'

interface BulletRowProps {
  bullet: Bullet
}

export function BulletRow({ bullet }: BulletRowProps) {
  const updateBullet = useResumeDbStore((state) => state.updateBullet)
  const deleteBullet = useResumeDbStore((state) => state.deleteBullet)
  const setMustInclude = useResumeDbStore((state) => state.setMustInclude)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)

  const { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex } = useDraftEntity(
    {
      key: `bullets:${bullet.id}`,
      fields: { text: bullet.text },
      latex: bullet.latex,
      isLatexOverridden: bullet.isLatexOverridden,
      generateLatex: (f) => generateBulletLatex(f.text, activeTemplate),
      onFlush: (patch) => updateBullet(bullet.id, patch),
    },
  )

  return (
    <div
      className={twMerge(
        'flex flex-col gap-2 rounded-md border border-slate-200 p-3',
        bullet.mustInclude && 'border-l-4 border-l-amber-400',
      )}
    >
      <div className="flex items-center justify-end gap-3">
        <MustIncludeToggle
          checked={bullet.mustInclude}
          onChange={(checked) => setMustInclude('bullets', bullet.id, checked)}
        />
        <button
          type="button"
          className="text-xs text-red-600 underline"
          onClick={() => deleteBullet(bullet.id)}
        >
          Delete bullet
        </button>
      </div>
      <textarea
        aria-label="Bullet text"
        value={fields.text}
        onChange={(e) => updateFields({ text: e.target.value })}
        rows={2}
        className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />
      <LatexOverrideSection
        latex={latex}
        isLatexOverridden={isLatexOverridden}
        onChange={setLatex}
        onRevertToAuto={revertToAutoLatex}
      />
    </div>
  )
}
