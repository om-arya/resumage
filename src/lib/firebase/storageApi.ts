import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './config'

/** Uploads a JD PDF to the caller's own folder and returns its storage path (for extractJdText). */
export async function uploadJdPdf(uid: string, file: File): Promise<string> {
  const storagePath = `users/${uid}/jdUploads/${Date.now()}-${file.name}`
  await uploadBytes(ref(storage, storagePath), file, { contentType: 'application/pdf' })
  return storagePath
}

export function getPdfDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath))
}

export function deletePdf(storagePath: string): Promise<void> {
  return deleteObject(ref(storage, storagePath))
}
