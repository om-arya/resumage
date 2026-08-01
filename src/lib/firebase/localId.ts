const LOCAL_ID_PREFIX = 'local:'

/** Mints an id for an entity that exists only in local draft state, not yet in Firestore. */
export function newLocalId(): string {
  return `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`
}

export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX)
}
