import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useResumeDbStore } from '../stores/resumeDbStore'
import { useTemplatesStore, selectActiveTemplate } from '../stores/templatesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { FormError } from '../components/common/FormError'
import { generateResume, GenerateResumeError } from '../lib/generation/generateResume'
import { getPdfDownloadUrl, uploadJdPdf } from '../lib/firebase/storageApi'
import { extractJdText } from '../lib/firebase/functionsApi'
import type { PageConstraints } from '../types/resumeDb'

interface GenerationResult {
  downloadUrl: string
  pageCount: number
  generatedLatex: string
  warnings?: string
}

function formatPageRange({ minPages, maxPages }: Pick<PageConstraints, 'minPages' | 'maxPages'>): string {
  const pages = minPages === maxPages ? `${maxPages}` : `${minPages}–${maxPages}`
  return `${pages} page${maxPages === 1 && minPages === 1 ? '' : 's'}`
}

export function GeneratePage() {
  const user = useAuthStore((state) => state.user)
  const loading = useResumeDbStore((state) => state.loading)
  const subscribe = useResumeDbStore((state) => state.subscribe)
  const unsubscribeAll = useResumeDbStore((state) => state.unsubscribeAll)
  const subscribeTemplates = useTemplatesStore((state) => state.subscribe)
  const unsubscribeTemplates = useTemplatesStore((state) => state.unsubscribeAll)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)
  const settingsLoading = useSettingsStore((state) => state.loading)
  const settings = useSettingsStore((state) => state.settings)
  const subscribeSettings = useSettingsStore((state) => state.subscribe)
  const unsubscribeSettings = useSettingsStore((state) => state.unsubscribeAll)

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
  const [failedLatex, setFailedLatex] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [showSource, setShowSource] = useState(false)

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
    if (!user) return
    subscribeSettings(user.uid)
    return () => unsubscribeSettings()
  }, [user, subscribeSettings, unsubscribeSettings])

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
    setFailedLatex(null)
    setResult(null)
    setShowSource(false)
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
        maxPages: settings.pageConstraints.maxPages,
        minPages: settings.pageConstraints.minPages,
        sectionOrderMode: settings.sectionOrderMode,
      })
      const downloadUrl = await getPdfDownloadUrl(generation.pdfStoragePath)
      setResult({
        downloadUrl,
        pageCount: generation.pageCount,
        generatedLatex: generation.generatedLatex,
        warnings: generation.warnings,
      })
    } catch (err) {
      if (err instanceof GenerateResumeError) {
        setError(err.message)
        setFailedLatex(err.attemptedLatex)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate the resume.')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (loading || settingsLoading) return <Spinner />

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Generate a tailored resume</h1>
      <p className="text-sm text-slate-600">
        Using <strong>{activeTemplate.name}</strong> ({formatPageRange(settings.pageConstraints)},{' '}
        {settings.sectionOrderMode === 'aiOptimized' ? 'AI-optimized section order' : 'fixed section order'}). Change
        the template on the{' '}
        <Link to="/templates" className="underline">
          Templates
        </Link>{' '}
        page, or these defaults on the{' '}
        <Link to="/settings" className="underline">
          Settings
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
              className="cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed"
            />
          </label>
          {extracting ? <span className="text-slate-500">Extracting text…</span> : null}
        </div>

        <FormError message={error} />
        {failedLatex ? (
          <details className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <summary className="cursor-pointer font-medium">View the LaTeX source that failed to compile</summary>
            <pre className="mt-2 max-h-[28rem] overflow-auto rounded-md bg-white p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">
              {failedLatex}
            </pre>
          </details>
        ) : null}

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
        <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <p className="text-sm text-slate-700">
            Generated a {result.pageCount}-page resume using {activeTemplate.name}.
          </p>
          {result.warnings ? <p className="text-xs text-amber-700">{result.warnings}</p> : null}

          <div className="flex items-center gap-3">
            <a
              href={result.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              View PDF
            </a>
            <button
              type="button"
              onClick={() => setShowSource((prev) => !prev)}
              className="text-sm text-slate-600 underline"
            >
              {showSource ? 'Hide' : 'Show'} LaTeX source
            </button>
          </div>

          <iframe
            title="Generated resume preview"
            src={result.downloadUrl}
            className="h-[36rem] w-full rounded-md border border-slate-200"
          />

          {showSource ? (
            <pre className="max-h-[36rem] overflow-auto rounded-md bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">
              {result.generatedLatex}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
