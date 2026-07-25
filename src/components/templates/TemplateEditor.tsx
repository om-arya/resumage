import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { useSyncedState } from '../../hooks/useSyncedState'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useTemplatesStore } from '../../stores/templatesStore'
import { renderTemplate } from '../../lib/template/renderTemplate'
import type { ResumeTemplate } from '../../types/template'

interface TemplateEditorProps {
  template: ResumeTemplate
}

const FIELD_DEFS: {
  key: Exclude<keyof ResumeTemplate, 'id' | 'isBuiltIn' | 'name'>
  label: string
  rows: number
}[] = [
  { key: 'latexPreamble', label: 'LaTeX preamble', rows: 10 },
  {
    key: 'headerWrapperLatex',
    label: 'Header wrapper — {{NAME}}, {{EMAIL}}, {{PHONE}}, {{LOCATION}}, {{LINKS}}',
    rows: 4,
  },
  { key: 'mainBodyLatex', label: 'Main body — {{HEADER}}, {{SECTIONS}}', rows: 2 },
  {
    key: 'sectionWrapperLatex',
    label: 'Section wrapper — {{SECTION_TITLE}}, {{SECTION_BODY}}',
    rows: 4,
  },
  {
    key: 'entryWrapperLatex',
    label: 'Entry wrapper — {{TITLE}}, {{ORG}}, {{DATES}}, {{LOCATION}}, {{BULLETS}}',
    rows: 4,
  },
  { key: 'bulletListWrapperLatex', label: 'Bullet list wrapper — {{BULLETS}}', rows: 3 },
  { key: 'bulletWrapperLatex', label: 'Bullet wrapper — {{TEXT}}', rows: 1 },
  {
    key: 'skillRowWrapperLatex',
    label: 'Skill row wrapper — {{CATEGORY}}, {{SKILLS_LIST}}',
    rows: 1,
  },
  { key: 'skillListSeparator', label: 'Skill list separator', rows: 1 },
  { key: 'latexPostamble', label: 'LaTeX postamble', rows: 1 },
]

/**
 * Fields on the left, a live-updating rendered-LaTeX preview on the right —
 * assembled with the user's actual resume DB content via renderTemplate.ts.
 * There's no compile step yet (that's Milestone 5 + Tectonic), so "preview"
 * here means the generated .tex source, not a rendered PDF page.
 */
export function TemplateEditor({ template }: TemplateEditorProps) {
  const updateTemplate = useTemplatesStore((state) => state.updateTemplate)
  const basicInfo = useResumeDbStore((state) => state.basicInfo)
  const sections = useResumeDbStore((state) => state.sections)
  const entries = useResumeDbStore((state) => state.entries)
  const bullets = useResumeDbStore((state) => state.bullets)
  const skillRows = useResumeDbStore((state) => state.skillRows)
  const skills = useResumeDbStore((state) => state.skills)

  const [draft, setDraft] = useSyncedState<ResumeTemplate>(
    template,
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  )
  const [saving, setSaving] = useState(false)

  const isReadOnly = Boolean(template.isBuiltIn)
  const isDirty = !isReadOnly && JSON.stringify(draft) !== JSON.stringify(template)

  async function handleSave() {
    setSaving(true)
    try {
      await updateTemplate(draft.id, draft)
    } finally {
      setSaving(false)
    }
  }

  let preview = ''
  let previewError: string | null = null
  try {
    preview = renderTemplate(draft, { basicInfo, sections, entries, bullets, skillRows, skills })
  } catch (err) {
    previewError = err instanceof Error ? err.message : 'Failed to render preview.'
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {isReadOnly ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Jake&apos;s Resume is a read-only default, so it always stays available as a known-good
            fallback. Duplicate it from the list above to customize your own copy.
          </p>
        ) : null}
        <Input
          id="template-name"
          label="Name"
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          readOnly={isReadOnly}
          className={isReadOnly ? 'cursor-not-allowed bg-slate-50 text-slate-500' : ''}
        />
        {FIELD_DEFS.map(({ key, label, rows }) => (
          <div key={key} className="flex flex-col gap-1">
            <label htmlFor={`template-${key}`} className="text-sm font-medium text-slate-700">
              {label}
            </label>
            <textarea
              id={`template-${key}`}
              value={draft[key]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
              rows={rows}
              readOnly={isReadOnly}
              className={twMerge(
                'w-full rounded-md border border-slate-300 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400',
                isReadOnly && 'cursor-not-allowed bg-slate-50 text-slate-500',
              )}
            />
          </div>
        ))}
        {isReadOnly ? null : (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              className="w-auto px-4"
              loading={saving}
              disabled={!isDirty}
              onClick={handleSave}
            >
              Save template
            </Button>
            <span className="text-xs text-slate-500">{isDirty ? 'Unsaved changes' : 'Saved'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 lg:sticky lg:top-4 lg:self-start">
        <span className="text-sm font-medium text-slate-700">Live preview (LaTeX source)</span>
        {previewError ? (
          <p className="text-xs text-red-600">{previewError}</p>
        ) : (
          <pre className="h-[36rem] overflow-auto rounded-md bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">
            {preview}
          </pre>
        )}
      </div>
    </div>
  )
}
