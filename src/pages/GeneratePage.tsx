import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useResumeDbStore } from '../stores/resumeDbStore'
import { useTemplatesStore, selectActiveTemplate } from '../stores/templatesStore'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { FormError } from '../components/common/FormError'
import { generateResume } from '../lib/generation/generateResume'
import { getPdfDownloadUrl, uploadJdPdf } from '../lib/firebase/storageApi'
import { extractJdText } from '../lib/firebase/functionsApi'

interface GenerationResult {
  downloadUrl: string
  pageCount: number
  warnings?: string
}

export function GeneratePage() {
  const user = useAuthStore((state) => state.user)
  const loading = useResumeDbStore((state) => state.loading)
  const subscribe = useResumeDbStore((state) => state.subscribe)
  const unsubscribeAll = useResumeDbStore((state) => state.unsubscribeAll)
  const subscribeTemplates = useTemplatesStore((state) => state.subscribe)
  const unsubscribeTemplates = useTemplatesStore((state) => state.unsubscribeAll)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)

  const basicInfo = useResumeDbStore((state) => state.basicInfo)
  const sections = useResumeDbStore((state) => state.sections)
  const entries = useResumeDbStore((state) => state.entries)
  const bullets = useResumeDbStore((state) => state.bullets)
  const skillRows = useResumeDbStore((state) => state.skillRows)
  const skills = useResumeDbStore((state) => state.skills)

  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

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

  async function handleUploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    setError(null)
    setExtracting(true)
    try {
      const storagePath = await uploadJdPdf(user.uid, file)
      const text = await extractJdText(storagePath)
      setJobDescriptionText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from the PDF.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    if (!user || !jobDescriptionText.trim()) return
    setError(null)
    setResult(null)
    setGenerating(true)
    try {
      const generation = await generateResume({
        uid: user.uid,
        jobDescriptionText,
        template: activeTemplate,
        basicInfo,
        sections,
        entries,
        bullets,
        skillRows,
        skills,
      })
      const downloadUrl = await getPdfDownloadUrl(generation.pdfStoragePath)
      setResult({ downloadUrl, pageCount: generation.pageCount, warnings: generation.warnings })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the resume.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Generate a tailored resume</h1>
      <p className="text-sm text-slate-600">
        Using <strong>{activeTemplate.name}</strong>. Change the active template on the{' '}
        <Link to="/templates" className="underline">
          Templates
        </Link>{' '}
        page.
      </p>

      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="jd-text" className="text-sm font-medium text-slate-700">
            Job description
          </label>
          <textarea
            id="jd-text"
            value={jobDescriptionText}
            onChange={(e) => setJobDescriptionText(e.target.value)}
            rows={10}
            placeholder="Paste the job description here…"
            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-600">
          <label htmlFor="jd-pdf" className="flex items-center gap-2">
            or upload a PDF:
            <input
              id="jd-pdf"
              type="file"
              accept="application/pdf"
              onChange={handleUploadPdf}
              disabled={extracting}
              className="text-sm"
            />
          </label>
          {extracting ? <span className="text-slate-500">Extracting text…</span> : null}
        </div>

        <FormError message={error} />

        <Button
          type="submit"
          className="w-auto px-6"
          loading={generating}
          disabled={!jobDescriptionText.trim()}
        >
          Generate resume
        </Button>
      </form>

      {result ? (
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
          <p className="text-sm text-slate-700">
            Generated a {result.pageCount}-page resume using {activeTemplate.name}.
          </p>
          {result.warnings ? (
            <p className="text-xs text-amber-700">Compiler warnings: {result.warnings}</p>
          ) : null}
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Download PDF
          </a>
        </div>
      ) : null}
    </div>
  )
}
