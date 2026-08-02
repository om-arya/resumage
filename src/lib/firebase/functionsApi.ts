import { FirebaseError } from 'firebase/app'
import { httpsCallable } from 'firebase/functions'
import { functions } from './config'

/**
 * A genuine Firebase callable-function error (thrown via HttpsError server-side)
 * comes back as a FirebaseError with a `functions/...` code. Anything else —
 * most commonly a raw JSON.parse SyntaxError from an HTML response body —
 * means the request never reached our function at all (not deployed, wrong
 * region, a build failure, etc.), so it gets a much more actionable message.
 */
function toCallableError(err: unknown, functionName: string): Error {
  if (err instanceof FirebaseError && err.code.startsWith('functions/')) {
    return new Error(err.message)
  }
  return new Error(
    `Could not reach the "${functionName}" Cloud Function. Check that it's deployed ` +
      `(Firebase Console → Functions, or "firebase functions:log" for the underlying error) ` +
      'and that it deployed successfully — see the README\'s Cloud Functions section.',
  )
}

interface ExtractJdTextRequest {
  storagePath: string
}

interface ExtractJdTextResponse {
  text: string
}

export async function extractJdText(storagePath: string): Promise<string> {
  const callable = httpsCallable<ExtractJdTextRequest, ExtractJdTextResponse>(functions, 'extractJdText')
  try {
    const result = await callable({ storagePath })
    return result.data.text
  } catch (err) {
    throw toCallableError(err, 'extractJdText')
  }
}

interface CompileLatexRequest {
  latexSource: string
  resumeId: string
}

export interface CompileLatexResponse {
  pdfStoragePath: string
  pageCount: number
  warnings?: string
}

export async function compileLatex(latexSource: string, resumeId: string): Promise<CompileLatexResponse> {
  const callable = httpsCallable<CompileLatexRequest, CompileLatexResponse>(functions, 'compileLatex')
  try {
    const result = await callable({ latexSource, resumeId })
    return result.data
  } catch (err) {
    throw toCallableError(err, 'compileLatex')
  }
}

interface ParseResumePdfRequest {
  storagePath: string
}

/** One run of text as pdf.js laid it out on the page — position + size, not just the string. */
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

export async function parseResumePdf(storagePath: string): Promise<ResumeTextItem[]> {
  const callable = httpsCallable<ParseResumePdfRequest, ParseResumePdfResponse>(functions, 'parseResumePdf')
  try {
    const result = await callable({ storagePath })
    return result.data.items
  } catch (err) {
    throw toCallableError(err, 'parseResumePdf')
  }
}
