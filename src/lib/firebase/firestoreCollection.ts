import {
  addDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  updateDoc as fsUpdateDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from './config'
import type { BasicInfo, GeneratedResume, GenerationSettings } from '../../types/resumeDb'

export const RESUME_DB_COLLECTIONS = [
  'sections',
  'entries',
  'bullets',
  'skillRows',
  'skills',
  'templates',
  'generatedResumes',
] as const
export type ResumeDbCollectionName = (typeof RESUME_DB_COLLECTIONS)[number]

function collectionRef(uid: string, name: ResumeDbCollectionName) {
  return collection(db, 'users', uid, name)
}

function fromSnapshot<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T
}

/** Live-subscribes to one of a user's flat resume-DB collections, ordered by `order`. */
export function subscribeToResumeDbCollection<T extends { id: string }>(
  uid: string,
  name: ResumeDbCollectionName,
  onChange: (items: T[]) => void,
): () => void {
  const q = query(collectionRef(uid, name), orderBy('order', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => fromSnapshot<T>(docSnap)))
  })
}

/** One-shot emptiness check (no live listener) — used to decide whether to seed default data. */
export async function resumeDbCollectionIsEmpty(uid: string, name: ResumeDbCollectionName): Promise<boolean> {
  const snapshot = await getDocs(query(collectionRef(uid, name), limit(1)))
  return snapshot.empty
}

/** One-shot full read (no live listener, no ordering) — used for migrations/backfills. */
export async function getResumeDbCollectionDocs<T extends { id: string }>(
  uid: string,
  name: ResumeDbCollectionName,
): Promise<T[]> {
  const snapshot = await getDocs(collectionRef(uid, name))
  return snapshot.docs.map((docSnap) => fromSnapshot<T>(docSnap))
}

/** Live-subscribes to a user's most recent generated resumes, newest first — for the dashboard. */
export function subscribeToRecentGeneratedResumes(
  uid: string,
  count: number,
  onChange: (items: GeneratedResume[]) => void,
): () => void {
  const q = query(collectionRef(uid, 'generatedResumes'), orderBy('createdAt', 'desc'), limit(count))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => fromSnapshot<GeneratedResume>(docSnap)))
  })
}

/** Mints a fresh doc id without writing anything — useful when the id must be known before the first write (e.g. a Storage path that embeds it). */
export function newResumeDbDocId(uid: string, name: ResumeDbCollectionName): string {
  return doc(collectionRef(uid, name)).id
}

/** Writes a doc at a specific (already-minted) id, e.g. from newResumeDbDocId. */
export function setResumeDbDoc(
  uid: string,
  name: ResumeDbCollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  return setDoc(doc(db, 'users', uid, name, id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function createResumeDbDoc(
  uid: string,
  name: ResumeDbCollectionName,
  data: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collectionRef(uid, name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export function updateResumeDbDoc(
  uid: string,
  name: ResumeDbCollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  return fsUpdateDoc(doc(db, 'users', uid, name, id), { ...data, updatedAt: serverTimestamp() })
}

export function deleteResumeDbDoc(
  uid: string,
  name: ResumeDbCollectionName,
  id: string,
): Promise<void> {
  return fsDeleteDoc(doc(db, 'users', uid, name, id))
}

/** BasicInfo is embedded directly on the users/{uid} doc, not a subcollection. */
export function subscribeToBasicInfo(
  uid: string,
  onChange: (info: BasicInfo | null) => void,
): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const data = snap.data()
    onChange((data?.basicInfo as BasicInfo | undefined) ?? null)
  })
}

export function saveBasicInfo(uid: string, basicInfo: BasicInfo): Promise<void> {
  return setDoc(doc(db, 'users', uid), { basicInfo }, { merge: true })
}

/** Which of the user's templates (users/{uid}/templates) is currently active — also embedded on the user doc. */
export function subscribeToActiveTemplateId(
  uid: string,
  onChange: (templateId: string | null) => void,
): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    onChange((snap.data()?.activeTemplateId as string | undefined) ?? null)
  })
}

export function setActiveTemplateId(uid: string, templateId: string): Promise<void> {
  return setDoc(doc(db, 'users', uid), { activeTemplateId: templateId }, { merge: true })
}

/** Page-constraint/section-order generation defaults (Milestone 6) — also embedded on the user doc. */
export function subscribeToGenerationSettings(
  uid: string,
  onChange: (settings: GenerationSettings | null) => void,
): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const data = snap.data()
    const pageConstraints = data?.pageConstraints as GenerationSettings['pageConstraints'] | undefined
    const sectionOrderMode = data?.sectionOrderMode as GenerationSettings['sectionOrderMode'] | undefined
    onChange(pageConstraints && sectionOrderMode ? { pageConstraints, sectionOrderMode } : null)
  })
}

export function saveGenerationSettings(uid: string, settings: GenerationSettings): Promise<void> {
  return setDoc(doc(db, 'users', uid), settings, { merge: true })
}
