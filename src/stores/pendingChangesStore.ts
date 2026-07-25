import { create } from 'zustand'

type FlushFn = () => Promise<void>

const flushers = new Map<string, FlushFn>()

interface PendingChangesState {
  dirtyKeys: Set<string>
  isDirty: boolean
  isSaving: boolean
  error: string | null
}

interface PendingChangesActions {
  markDirty: (key: string) => void
  markClean: (key: string) => void
  /** Registers the function that persists `key`'s current draft; returns an unregister callback. */
  registerFlush: (key: string, flush: FlushFn) => () => void
  saveAll: () => Promise<void>
}

export const usePendingChangesStore = create<PendingChangesState & PendingChangesActions>(
  (set, get) => ({
    dirtyKeys: new Set(),
    isDirty: false,
    isSaving: false,
    error: null,

    markDirty(key) {
      set((state) => {
        if (state.dirtyKeys.has(key)) return state
        const dirtyKeys = new Set(state.dirtyKeys)
        dirtyKeys.add(key)
        return { dirtyKeys, isDirty: true }
      })
    },

    markClean(key) {
      set((state) => {
        if (!state.dirtyKeys.has(key)) return state
        const dirtyKeys = new Set(state.dirtyKeys)
        dirtyKeys.delete(key)
        return { dirtyKeys, isDirty: dirtyKeys.size > 0 }
      })
    },

    registerFlush(key, flush) {
      flushers.set(key, flush)
      return () => {
        if (flushers.get(key) === flush) flushers.delete(key)
      }
    },

    async saveAll() {
      const keys = Array.from(get().dirtyKeys)
      if (keys.length === 0) return
      set({ isSaving: true, error: null })
      try {
        await Promise.all(
          keys.map(async (key) => {
            const flush = flushers.get(key)
            if (!flush) return
            await flush()
            get().markClean(key)
          }),
        )
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to save changes.' })
        throw err
      } finally {
        set({ isSaving: false })
      }
    },
  }),
)
