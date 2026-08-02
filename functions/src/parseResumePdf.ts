import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import pdfParse from 'pdf-parse'
import { app } from './admin.js'

interface ParseResumePdfRequest {
  storagePath: string
}

/** One run of text as pdf.js laid it out — position + size, not just the string. */
export interface ResumeTextItem {
  text: string
  x: number
  y: number
  width: number
  fontSize: number
  page: number
}

interface ParseResumePdfResponse {
  items: ResumeTextItem[]
}

interface PdfTextContentItem {
  str: string
  transform: number[]
  width: number
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextContentItem[] }>
}

/**
 * Extracts each text run's position and font size from an uploaded resume PDF,
 * not just flattened text — heuristicResumeParser.ts (architecture.md §10) needs
 * layout to tell a name from a job title, a section header from a bullet, none
 * of which survives collapsing a page to a plain string. Reuses pdf-parse's
 * `pagerender` hook (already a dependency, already proven in extractJdText and
 * compileLatex) to reach its bundled pdf.js page object directly.
 */
export const parseResumePdf = onCall<ParseResumePdfRequest>(async (request): Promise<ParseResumePdfResponse> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to parse a resume.')
  }

  const { storagePath } = request.data
  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    throw new HttpsError('invalid-argument', 'storagePath is required.')
  }

  const expectedPrefix = `users/${request.auth.uid}/`
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new HttpsError('permission-denied', 'storagePath must be within your own user folder.')
  }

  const bucket = getStorage(app).bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()
  if (!exists) {
    throw new HttpsError('not-found', `No file found at ${storagePath}.`)
  }

  const [buffer] = await file.download()

  const items: ResumeTextItem[] = []
  let pageNumber = 0
  try {
    await pdfParse(buffer, {
      pagerender: async (pageData: PdfPage) => {
        pageNumber += 1
        const { items: textItems } = await pageData.getTextContent()
        for (const item of textItems) {
          const text = item.str
          if (!text || !text.trim()) continue
          const [a, b, , , x, y] = item.transform
          // hypot(a, b) is the font's effective scale even under rotation/skew, unlike transform[0] alone.
          items.push({ text, x, y, width: item.width, fontSize: Math.hypot(a, b), page: pageNumber })
        }
        return ''
      },
    })
  } catch {
    throw new HttpsError('invalid-argument', 'Could not parse the uploaded file as a PDF.')
  }

  return { items }
})
