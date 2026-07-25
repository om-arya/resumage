import {
  addDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  updateDoc as fsUpdateDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from './config'
import type { BasicInfo } from '../../types/resumeDb'

export const RESUME_DB_COLLECTIONS = ['sections', 'entries', 'bullets', 'skillRows', 'skills'] as const
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

/** Batched reorder: writes a fresh 0-based `order` to every doc in `orderedIds`. */
export async function reorderResumeDbDocs(
  uid: string,
  name: ResumeDbCollectionName,
  orderedIds: string[],
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'users', uid, name, id), { order: index, updatedAt: serverTimestamp() })
  })
  await batch.commit()
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
