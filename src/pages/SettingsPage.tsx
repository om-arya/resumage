import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useSyncedState } from '../hooks/useSyncedState'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import type { GenerationSettings, SectionOrderMode } from '../types/resumeDb'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const loading = useSettingsStore((state) => state.loading)
  const settings = useSettingsStore((state) => state.settings)
  const subscribe = useSettingsStore((state) => state.subscribe)
  const unsubscribeAll = useSettingsStore((state) => state.unsubscribeAll)
  const saveSettings = useSettingsStore((state) => state.saveSettings)

  const [draft, setDraft] = useSyncedState<GenerationSettings>(
    settings,
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    subscribe(user.uid)
    return () => unsubscribeAll()
  }, [user, subscribe, unsubscribeAll])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const isValid = draft.pageConstraints.minPages >= 1 && draft.pageConstraints.maxPages >= draft.pageConstraints.minPages

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      await saveSettings(draft)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Generation settings</h1>
        <p className="text-sm text-slate-600">
          Defaults used every time you generate a resume on the Generate page.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Page constraints</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="min-pages"
            label="Target minimum pages"
            type="number"
            min={1}
            step={1}
            value={draft.pageConstraints.minPages}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                pageConstraints: { ...prev.pageConstraints, minPages: Number(e.target.value) },
              }))
            }
          />
          <Input
            id="max-pages"
            label="Maximum pages"
            type="number"
            min={1}
            step={1}
            value={draft.pageConstraints.maxPages}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                pageConstraints: { ...prev.pageConstraints, maxPages: Number(e.target.value) },
              }))
            }
          />
        </div>
        {!isValid ? (
          <p className="text-sm text-red-600">Maximum pages must be at least the target minimum.</p>
        ) : (
          <p className="text-xs text-slate-500">
            Content is trimmed by relevance to fit within the maximum. If the result ends up under your
            minimum, generation will flag it as a warning rather than inventing content.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Section order</h2>
        <div className="flex flex-col gap-2">
          {(
            [
              { value: 'fixed', label: 'Fixed', description: 'Sections stay in the order you set on the Resume database page.' },
              {
                value: 'aiOptimized',
                label: 'AI-optimized',
                description:
                  'Sections are reordered per generation, most relevant to the job description first. Entries and bullets within a section never reorder.',
              },
            ] satisfies { value: SectionOrderMode; label: string; description: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50"
            >
              <input
                type="radio"
                name="section-order-mode"
                value={option.value}
                checked={draft.sectionOrderMode === option.value}
                onChange={() => setDraft((prev) => ({ ...prev, sectionOrderMode: option.value }))}
                className="mt-1"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900">{option.label}</span>
                <span className="text-xs text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          className="w-auto px-6"
          loading={saving}
          disabled={!isDirty || !isValid}
          onClick={handleSave}
        >
          Save settings
        </Button>
        <span className="text-sm text-slate-500">{isDirty ? 'Unsaved changes' : 'Saved'}</span>
      </div>
    </div>
  )
}
