import { useState, type ChangeEvent } from 'react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { FormError } from '../common/FormError'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { uploadResumePdf } from '../../lib/firebase/storageApi'
import { parseResumePdf } from '../../lib/firebase/functionsApi'
import { getResumeParserProvider } from '../../lib/import/heuristicResumeParser'
import { saveBasicInfo as saveBasicInfoDoc } from '../../lib/firebase/firestoreCollection'
import { generateBasicInfoLatex } from '../../lib/template/generateDefaultLatex'
import { selectActiveTemplate, useTemplatesStore } from '../../stores/templatesStore'
import type { ParsedBasicInfoFields, ParsedSection } from '../../lib/import/types'
import type { EntryFields, SectionType } from '../../types/resumeDb'

interface ImportResumeDialogProps {
  uid: string
  onClose: () => void
}

type Phase = 'idle' | 'uploading' | 'parsing' | 'review' | 'importing'

interface ReviewBullet {
  id: string
  text: string
  included: boolean
}

interface ReviewEntry {
  id: string
  fields: EntryFields
  bullets: ReviewBullet[]
  included: boolean
}

interface ReviewSkillRow {
  id: string
  categoryName: string
  skillsText: string
  included: boolean
}

interface ReviewSection {
  id: string
  displayName: string
  sectionType: SectionType
  included: boolean
  entries: ReviewEntry[]
  skillRows: ReviewSkillRow[]
}

interface ReviewDraft {
  basicInfo: ParsedBasicInfoFields
  includeBasicInfo: boolean
  sections: ReviewSection[]
}

function toReviewDraft(basicInfo: ParsedBasicInfoFields, sections: ParsedSection[]): ReviewDraft {
  return {
    basicInfo,
    includeBasicInfo: Boolean(basicInfo.name || basicInfo.email),
    sections: sections.map((section) => ({
      id: crypto.randomUUID(),
      displayName: section.displayName,
      sectionType: section.sectionType,
      included: true,
      entries: section.entries.map((entry) => ({
        id: crypto.randomUUID(),
        fields: entry.fields,
        included: true,
        bullets: entry.bullets.map((text) => ({ id: crypto.randomUUID(), text, included: true })),
      })),
      skillRows: section.skillRows.map((row) => ({
        id: crypto.randomUUID(),
        categoryName: row.categoryName,
        skillsText: row.skills.join(', '),
        included: true,
      })),
    })),
  }
}

/** Confirmed items only, mapped back to the shape resumeDbStore.importParsedResume expects. Sections left with nothing in them after filtering are dropped. */
function toConfirmedSections(draft: ReviewDraft): ParsedSection[] {
  return draft.sections
    .filter((section) => section.included)
    .map((section) => ({
      displayName: section.displayName,
      sectionType: section.sectionType,
      entries: section.entries
        .filter((entry) => entry.included)
        .map((entry) => ({
          fields: entry.fields,
          bullets: entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text),
        })),
      skillRows: section.skillRows
        .filter((row) => row.included)
        .map((row) => ({
          categoryName: row.categoryName,
          skills: row.skillsText
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean),
        })),
    }))
    .filter((section) => section.entries.length > 0 || section.skillRows.length > 0)
}

/**
 * Upload → parse (Cloud Function, layout-aware) → heuristic structuring →
 * review-and-edit → confirm. Nothing touches resumeDbStore until the user
 * hits Import, and even then it lands as local, unsaved drafts (architecture.md §10)
 * for a second look on the page itself before Save changes.
 */
export function ImportResumeDialog({ uid, onClose }: ImportResumeDialogProps) {
  const importParsedResume = useResumeDbStore((state) => state.importParsedResume)
  const existingSectionCount = useResumeDbStore((state) => state.sections.length)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    try {
      setPhase('uploading')
      const storagePath = await uploadResumePdf(uid, file)
      setPhase('parsing')
      const items = await parseResumePdf(storagePath)
      const parsed = await getResumeParserProvider().parseResume(items)
      setDraft(toReviewDraft(parsed.basicInfo, parsed.sections))
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse the uploaded PDF.')
      setPhase('idle')
    }
  }

  async function handleImport() {
    if (!draft) return
    setError(null)
    setPhase('importing')
    try {
      if (draft.includeBasicInfo) {
        const fields = draft.basicInfo
        await saveBasicInfoDoc(uid, {
          fields,
          latex: generateBasicInfoLatex(fields, activeTemplate),
          isLatexOverridden: false,
        })
      }
      // Import replaces the Resume database rather than appending to it — clear
      // out every existing section (cascades to its entries/bullets/skills)
      // before adding the confirmed ones. Both are still just local drafts
      // until the page's own Save button is clicked.
      const { sections: existingSections, deleteSection } = useResumeDbStore.getState()
      existingSections.forEach((section) => deleteSection(section.id))
      const confirmedSections = toConfirmedSections(draft)
      if (confirmedSections.length > 0) importParsedResume(confirmedSections)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import.')
      setPhase('review')
    }
  }

  function updateSection(id: string, patch: Partial<ReviewSection>) {
    setDraft((prev) =>
      prev ? { ...prev, sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : prev,
    )
  }

  function updateEntry(sectionId: string, entryId: string, patch: Partial<ReviewEntry>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId
                ? s
                : { ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) },
            ),
          }
        : prev,
    )
  }

  function updateBullet(sectionId: string, entryId: string, bulletId: string, patch: Partial<ReviewBullet>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId
                ? s
                : {
                    ...s,
                    entries: s.entries.map((e) =>
                      e.id !== entryId
                        ? e
                        : { ...e, bullets: e.bullets.map((b) => (b.id === bulletId ? { ...b, ...patch } : b)) },
                    ),
                  },
            ),
          }
        : prev,
    )
  }

  function updateSkillRow(sectionId: string, rowId: string, patch: Partial<ReviewSkillRow>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId
                ? s
                : { ...s, skillRows: s.skillRows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) },
            ),
          }
        : prev,
    )
  }

  const isBusy = phase === 'uploading' || phase === 'parsing' || phase === 'importing'

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import from PDF</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'importing'}
            className="text-sm text-slate-500 hover:text-slate-900 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <FormError message={error} />

        {phase === 'idle' || phase === 'uploading' || phase === 'parsing' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Upload an existing resume PDF to auto-populate sections, entries, and skills below.
              {existingSectionCount > 0
                ? ' This replaces your current Resume database — every existing section goes away, not just adds to it.'
                : ''}{' '}
              Nothing is saved until you review and confirm here, and even then it only lands as a draft you save
              yourself.
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isBusy}
              className="cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed"
            />
            {phase === 'uploading' ? <p className="text-sm text-slate-500">Uploading…</p> : null}
            {phase === 'parsing' ? <p className="text-sm text-slate-500">Reading layout and structuring content…</p> : null}
          </div>
        ) : null}

        {draft && (phase === 'review' || phase === 'importing') ? (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={draft.includeBasicInfo}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, includeBasicInfo: e.target.checked } : prev))}
                />
                Basic info (replaces your current Basic Info — saved immediately on import)
              </label>
              {draft.includeBasicInfo ? (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <Input
                    id="import-name"
                    label="Name"
                    value={draft.basicInfo.name}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, basicInfo: { ...prev.basicInfo, name: e.target.value } } : prev))}
                  />
                  <Input
                    id="import-email"
                    label="Email"
                    value={draft.basicInfo.email}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, basicInfo: { ...prev.basicInfo, email: e.target.value } } : prev))}
                  />
                  <Input
                    id="import-phone"
                    label="Phone"
                    value={draft.basicInfo.phone}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, basicInfo: { ...prev.basicInfo, phone: e.target.value } } : prev))}
                  />
                  <Input
                    id="import-location"
                    label="Location"
                    value={draft.basicInfo.location}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, basicInfo: { ...prev.basicInfo, location: e.target.value } } : prev))}
                  />
                </div>
              ) : null}
            </div>

            {draft.sections.length === 0 ? (
              <p className="text-sm text-slate-500">No sections were detected — only Basic Info will be imported.</p>
            ) : null}

            {draft.sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={section.included}
                    onChange={(e) => updateSection(section.id, { included: e.target.checked })}
                  />
                  <input
                    value={section.displayName}
                    onChange={(e) => updateSection(section.id, { displayName: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <span className="text-xs text-slate-400">{section.sectionType === 'entries' ? 'Entries' : 'Skills'}</span>
                </div>

                {section.included ? (
                  <div className="flex flex-col gap-3 pl-6">
                    {section.entries.map((entry) => (
                      <div key={entry.id} className="flex flex-col gap-2 border-l-2 border-slate-100 pl-3">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={entry.included}
                            onChange={(e) => updateEntry(section.id, entry.id, { included: e.target.checked })}
                            className="mt-2"
                          />
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <Input
                              id={`entry-title-${entry.id}`}
                              label="Title"
                              value={entry.fields.title}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, { fields: { ...entry.fields, title: e.target.value } })
                              }
                            />
                            <Input
                              id={`entry-org-${entry.id}`}
                              label="Organization"
                              value={entry.fields.organization}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, {
                                  fields: { ...entry.fields, organization: e.target.value },
                                })
                              }
                            />
                            <Input
                              id={`entry-start-${entry.id}`}
                              label="Start date"
                              value={entry.fields.startDate}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, {
                                  fields: { ...entry.fields, startDate: e.target.value },
                                })
                              }
                            />
                            <Input
                              id={`entry-end-${entry.id}`}
                              label="End date"
                              value={entry.fields.endDate}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, { fields: { ...entry.fields, endDate: e.target.value } })
                              }
                            />
                            <Input
                              id={`entry-location-${entry.id}`}
                              label="Location"
                              value={entry.fields.location}
                              onChange={(e) =>
                                updateEntry(section.id, entry.id, {
                                  fields: { ...entry.fields, location: e.target.value },
                                })
                              }
                            />
                          </div>
                        </div>
                        {entry.included && entry.bullets.length > 0 ? (
                          <div className="flex flex-col gap-1 pl-6">
                            {entry.bullets.map((bullet) => (
                              <label key={bullet.id} className="flex items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={bullet.included}
                                  onChange={(e) =>
                                    updateBullet(section.id, entry.id, bullet.id, { included: e.target.checked })
                                  }
                                  className="mt-1"
                                />
                                <input
                                  value={bullet.text}
                                  onChange={(e) => updateBullet(section.id, entry.id, bullet.id, { text: e.target.value })}
                                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                                />
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {section.skillRows.map((row) => (
                      <label key={row.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={(e) => updateSkillRow(section.id, row.id, { included: e.target.checked })}
                        />
                        <input
                          value={row.categoryName}
                          onChange={(e) => updateSkillRow(section.id, row.id, { categoryName: e.target.value })}
                          placeholder="Category (optional)"
                          className="w-32 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                        />
                        <input
                          value={row.skillsText}
                          onChange={(e) => updateSkillRow(section.id, row.id, { skillsText: e.target.value })}
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {draft && (phase === 'review' || phase === 'importing') ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
            {existingSectionCount > 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Importing removes all {existingSectionCount} existing section{existingSectionCount === 1 ? '' : 's'}{' '}
                and replaces them with what&apos;s checked below.
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                className="w-auto bg-white px-4 text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                onClick={onClose}
                disabled={phase === 'importing'}
              >
                Cancel
              </Button>
              <Button type="button" className="w-auto px-6" loading={phase === 'importing'} onClick={handleImport}>
                Import selected
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
