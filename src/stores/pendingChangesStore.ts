import { create } from 'zustand'

type FlushFn = () => Promise<void>

const flushers = new Map<string, { flush: FlushFn; tier: number }>()

interface PendingChangesState {
  dirtyKeys: Set<string>
  isDirty: boolean
  isSaving: boolean
  error: string | null
}

interface PendingChangesActions {
  markDirty: (key: string) => void
  markClean: (key: string) => void
  /**
   * Registers the function that persists `key`'s current draft; returns an
   * unregister callback. `tier` controls save order (lower first, same tier
   * runs in parallel) — see `FLUSH_TIER` for why the resume editor needs this.
   */
  registerFlush: (key: string, flush: FlushFn, tier?: number) => () => void
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

    registerFlush(key, flush, tier = 0) {
      flushers.set(key, { flush, tier })
      return () => {
        if (flushers.get(key)?.flush === flush) flushers.delete(key)
      }
    },

    async saveAll() {
      const keys = Array.from(get().dirtyKeys)
      if (keys.length === 0) return
      set({ isSaving: true, error: null })
      try {
        const keysByTier = new Map<number, string[]>()
        for (const key of keys) {
          const tier = flushers.get(key)?.tier ?? 0
          const tierKeys = keysByTier.get(tier) ?? []
          tierKeys.push(key)
          keysByTier.set(tier, tierKeys)
        }
        const tiers = Array.from(keysByTier.keys()).sort((a, b) => a - b)
        for (const tier of tiers) {
          await Promise.all(
            keysByTier.get(tier)!.map(async (key) => {
              const entry = flushers.get(key)
              if (!entry) return
              await entry.flush()
              get().markClean(key)
            }),
          )
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to save changes.' })
        throw err
      } finally {
        set({ isSaving: false })
      }
    },
  }),
)
