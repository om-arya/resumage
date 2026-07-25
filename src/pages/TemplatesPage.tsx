import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useResumeDbStore } from '../stores/resumeDbStore'
import { useTemplatesStore } from '../stores/templatesStore'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { TemplateEditor } from '../components/templates/TemplateEditor'

export function TemplatesPage() {
  const user = useAuthStore((state) => state.user)
  const loading = useTemplatesStore((state) => state.loading)
  const templates = useTemplatesStore((state) => state.templates)
  const activeTemplateId = useTemplatesStore((state) => state.activeTemplateId)
  const subscribeTemplates = useTemplatesStore((state) => state.subscribe)
  const unsubscribeTemplates = useTemplatesStore((state) => state.unsubscribeAll)
  const setActiveTemplate = useTemplatesStore((state) => state.setActiveTemplate)
  const createTemplate = useTemplatesStore((state) => state.createTemplate)
  const deleteTemplate = useTemplatesStore((state) => state.deleteTemplate)

  const subscribeResumeDb = useResumeDbStore((state) => state.subscribe)
  const unsubscribeResumeDb = useResumeDbStore((state) => state.unsubscribeAll)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')

  useEffect(() => {
    if (!user) return
    subscribeTemplates(user.uid)
    return () => unsubscribeTemplates()
  }, [user, subscribeTemplates, unsubscribeTemplates])

  // The live preview renders against the user's actual resume DB content.
  useEffect(() => {
    if (!user) return
    subscribeResumeDb(user.uid)
    return () => unsubscribeResumeDb()
  }, [user, subscribeResumeDb, unsubscribeResumeDb])

  // Falls back to the active (then first) template until the user explicitly picks one.
  const effectiveSelectedId = selectedTemplateId ?? activeTemplateId ?? templates[0]?.id ?? null

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const name = newTemplateName.trim()
    if (!name) return
    const base = templates.find((template) => template.id === activeTemplateId) ?? templates[0]
    if (!base) return
    const newId = await createTemplate(name, {
      latexPreamble: base.latexPreamble,
      latexPostamble: base.latexPostamble,
      mainBodyLatex: base.mainBodyLatex,
      sectionWrapperLatex: base.sectionWrapperLatex,
      entryWrapperLatex: base.entryWrapperLatex,
      bulletWrapperLatex: base.bulletWrapperLatex,
      bulletListWrapperLatex: base.bulletListWrapperLatex,
      skillRowWrapperLatex: base.skillRowWrapperLatex,
      skillListSeparator: base.skillListSeparator,
      headerWrapperLatex: base.headerWrapperLatex,
    })
    setNewTemplateName('')
    setSelectedTemplateId(newId)
  }

  function handleDelete(templateId: string) {
    deleteTemplate(templateId)
    if (effectiveSelectedId === templateId) setSelectedTemplateId(null)
  }

  if (loading) return <Spinner />

  const selectedTemplate = templates.find((template) => template.id === effectiveSelectedId)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>

      <div className="flex flex-col gap-2">
        {templates.map((template) => {
          const isActive = template.id === activeTemplateId
          const isSelected = template.id === effectiveSelectedId
          return (
            <div
              key={template.id}
              className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                isSelected ? 'border-slate-400' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                className="flex-1 text-left font-medium text-slate-900"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                {template.name}
                {isActive ? (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Active
                  </span>
                ) : null}
                {template.isBuiltIn ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Default (read-only)
                  </span>
                ) : null}
              </button>
              <div className="flex items-center gap-3">
                {isActive ? null : (
                  <button
                    type="button"
                    className="text-xs text-slate-600 underline"
                    onClick={() => setActiveTemplate(template.id)}
                  >
                    Set active
                  </button>
                )}
                {template.isBuiltIn ? null : (
                  <button
                    type="button"
                    className="text-xs text-red-600 underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                    disabled={isActive || templates.length <= 1}
                    title={isActive ? 'Set another template active before deleting this one' : undefined}
                    onClick={() => handleDelete(template.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <form
        onSubmit={handleCreate}
        className="flex items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="new-template-name" className="text-sm font-medium text-slate-700">
            New template name (duplicates the active template as a starting point)
          </label>
          <input
            id="new-template-name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="e.g. Compact, Academic CV"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <Button type="submit" className="w-auto px-4 py-2">
          Duplicate as new template
        </Button>
      </form>

      {selectedTemplate ? <TemplateEditor key={selectedTemplate.id} template={selectedTemplate} /> : null}
    </div>
  )
}
