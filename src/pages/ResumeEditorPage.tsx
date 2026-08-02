import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useResumeDbStore } from '../stores/resumeDbStore'
import { useTemplatesStore } from '../stores/templatesStore'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { BasicInfoEditor } from '../components/resume-editor/BasicInfoEditor'
import { SectionList } from '../components/resume-editor/SectionList'
import { ImportResumeDialog } from '../components/resume-editor/ImportResumeDialog'

export function ResumeEditorPage() {
  const user = useAuthStore((state) => state.user)
  const [importOpen, setImportOpen] = useState(false)
  const loading = useResumeDbStore((state) => state.loading)
  const subscribe = useResumeDbStore((state) => state.subscribe)
  const unsubscribeAll = useResumeDbStore((state) => state.unsubscribeAll)
  const subscribeTemplates = useTemplatesStore((state) => state.subscribe)
  const unsubscribeTemplates = useTemplatesStore((state) => state.unsubscribeAll)
  const isDirty = usePendingChangesStore((state) => state.isDirty)
  const isSaving = usePendingChangesStore((state) => state.isSaving)
  const error = usePendingChangesStore((state) => state.error)
  const saveAll = usePendingChangesStore((state) => state.saveAll)

  useEffect(() => {
    if (!user) return
    subscribe(user.uid)
    return () => unsubscribeAll()
  }, [user, subscribe, unsubscribeAll])

  useEffect(() => {
    if (!user) return
    subscribeTemplates(user.uid)
    return () => unsubscribeTemplates()
  }, [user, subscribeTemplates, unsubscribeTemplates])

  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  if (loading) return <Spinner />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Resume database</h1>
        <Button type="button" className="w-auto bg-white px-4 text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50" onClick={() => setImportOpen(true)}>
          Import from PDF
        </Button>
      </div>
      {importOpen && user ? <ImportResumeDialog uid={user.uid} onClose={() => setImportOpen(false)} /> : null}
      <BasicInfoEditor />
      <SectionList />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-slate-500">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : isDirty ? (
              'You have unsaved changes.'
            ) : (
              'All changes saved.'
            )}
          </span>
          <Button
            type="button"
            className="w-auto px-6"
            loading={isSaving}
            disabled={!isDirty}
            onClick={() => saveAll()}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
