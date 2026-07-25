import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import { app } from './admin.js'
import pdfParse from 'pdf-parse'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Fetched by scripts/fetchTectonic.js (functions/package.json postinstall).
const TECTONIC_BINARY = path.join(__dirname, '..', 'bin', 'tectonic')

const MAX_LATEX_SOURCE_LENGTH = 200_000
const COMPILE_TIMEOUT_MS = 45_000

interface CompileLatexRequest {
  latexSource: string
  resumeId: string
}

interface CompileLatexResponse {
  pdfStoragePath: string
  pageCount: number
  warnings?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Compiles a full .tex document (already assembled client-side by
 * renderTemplate.ts — this function never generates or edits LaTeX) via the
 * bundled Tectonic binary, uploads the resulting PDF, and returns its path.
 * `--untrusted` disables shell-escape and other unsafe features regardless of
 * source content (architecture.md §7's "shell-escape stays disabled" guarantee).
 */
export const compileLatex = onCall<CompileLatexRequest>(
  { timeoutSeconds: 60, memory: '1GiB' },
  async (request): Promise<CompileLatexResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to compile a resume.')
    }

    const { latexSource, resumeId } = request.data
    if (!isNonEmptyString(latexSource)) {
      throw new HttpsError('invalid-argument', 'latexSource is required.')
    }
    if (latexSource.length > MAX_LATEX_SOURCE_LENGTH) {
      throw new HttpsError('invalid-argument', 'latexSource is too large.')
    }
    if (!isNonEmptyString(resumeId) || !/^[a-zA-Z0-9_-]+$/.test(resumeId)) {
      throw new HttpsError('invalid-argument', 'resumeId must be a non-empty alphanumeric id.')
    }

    const workDir = await mkdtemp(path.join(tmpdir(), 'resumage-tectonic-'))
    const sourcePath = path.join(workDir, 'resume.tex')
    const outputPath = path.join(workDir, 'resume.pdf')

    try {
      await writeFile(sourcePath, latexSource, 'utf8')

      let stderr = ''
      try {
        const result = await execFileAsync(
          TECTONIC_BINARY,
          ['--outfmt', 'pdf', '--outdir', workDir, '--untrusted', sourcePath],
          { timeout: COMPILE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
        )
        stderr = result.stderr
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'stderr' in err
            ? String((err as { stderr?: unknown }).stderr)
            : err instanceof Error
              ? err.message
              : 'Tectonic failed to compile the LaTeX source.'
        throw new HttpsError('failed-precondition', `LaTeX compilation failed: ${message.slice(0, 4000)}`)
      }

      const pdfBuffer = await readFile(outputPath)
      const parsed = await pdfParse(pdfBuffer)

      const pdfStoragePath = `users/${request.auth.uid}/generatedPdfs/${resumeId}.pdf`
      const bucket = getStorage(app).bucket()
      await bucket.file(pdfStoragePath).save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private, max-age=0, no-cache' },
      })

      return {
        pdfStoragePath,
        pageCount: parsed.numpages,
        warnings: stderr.trim() ? stderr.trim().slice(0, 4000) : undefined,
      }
    } finally {
      await rm(workDir, { recursive: true, force: true })
    }
  },
)
