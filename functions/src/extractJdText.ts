import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import pdfParse from 'pdf-parse'
import { app } from './admin.js'

interface ExtractJdTextRequest {
  storagePath: string
}

interface ExtractJdTextResponse {
  text: string
}

/**
 * Extracts plain text from a job-description PDF the caller already uploaded
 * to their own Storage folder. Runs with admin privileges (Storage security
 * rules don't apply), so the storagePath is manually checked against the
 * caller's uid — otherwise any signed-in user could read any other user's file.
 */
export const extractJdText = onCall<ExtractJdTextRequest>(async (request): Promise<ExtractJdTextResponse> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to extract job description text.')
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

  let parsed: Awaited<ReturnType<typeof pdfParse>>
  try {
    parsed = await pdfParse(buffer)
  } catch {
    throw new HttpsError('invalid-argument', 'Could not parse the uploaded file as a PDF.')
  }

  return { text: parsed.text }
})
