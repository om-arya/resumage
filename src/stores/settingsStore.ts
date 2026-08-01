import { create } from 'zustand'
import { saveGenerationSettings, subscribeToGenerationSettings } from '../lib/firebase/firestoreCollection'
import { DEFAULT_GENERATION_SETTINGS } from '../lib/generation/defaultSettings'
import type { GenerationSettings } from '../types/resumeDb'

interface SettingsState {
  uid: string | null
  loading: boolean
  settings: GenerationSettings

  subscribe: (uid: string) => void
  unsubscribeAll: () => void
  saveSettings: (settings: GenerationSettings) => Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useSettingsStore = create<SettingsState>((set, get) => ({
  uid: null,
  loading: true,
  settings: DEFAULT_GENERATION_SETTINGS,

  subscribe(uid) {
    if (get().uid === uid) return
    get().unsubscribeAll()
    set({ uid, loading: true })
    unsubscribe = subscribeToGenerationSettings(uid, (settings) =>
      set({ settings: settings ?? DEFAULT_GENERATION_SETTINGS, loading: false }),
    )
  },

  unsubscribeAll() {
    unsubscribe?.()
    unsubscribe = null
    set({ uid: null, loading: true, settings: DEFAULT_GENERATION_SETTINGS })
  },

  async saveSettings(settings) {
    const uid = get().uid
    if (!uid) return
    await saveGenerationSettings(uid, settings)
  },
}))
