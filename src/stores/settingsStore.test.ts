import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from './settingsStore'
import { saveGenerationSettings, subscribeToGenerationSettings } from '../lib/firebase/firestoreCollection'
import { DEFAULT_GENERATION_SETTINGS } from '../lib/generation/defaultSettings'
import type { GenerationSettings } from '../types/resumeDb'

vi.mock('../lib/firebase/firestoreCollection', () => ({
  subscribeToGenerationSettings: vi.fn(() => () => {}),
  saveGenerationSettings: vi.fn(),
}))

const mockedSubscribe = vi.mocked(subscribeToGenerationSettings)
const mockedSave = vi.mocked(saveGenerationSettings)

function resetStore() {
  useSettingsStore.setState({ uid: null, loading: true, settings: DEFAULT_GENERATION_SETTINGS })
}

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSave.mockResolvedValue(undefined)
    resetStore()
  })

  it('falls back to defaults until the Firestore doc has settings saved', () => {
    let onChange: (settings: GenerationSettings | null) => void = () => {}
    mockedSubscribe.mockImplementation((_uid, cb) => {
      onChange = cb
      return () => {}
    })

    act(() => useSettingsStore.getState().subscribe('u1'))
    act(() => onChange(null))

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_GENERATION_SETTINGS)
    expect(useSettingsStore.getState().loading).toBe(false)
  })

  it('adopts the live settings once the listener delivers them', () => {
    let onChange: (settings: GenerationSettings | null) => void = () => {}
    mockedSubscribe.mockImplementation((_uid, cb) => {
      onChange = cb
      return () => {}
    })
    const saved: GenerationSettings = {
      pageConstraints: { minPages: 1, maxPages: 2, minTopMarginIn: 0.5, maxTopMarginIn: 1, sideMarginIn: 0.5 },
      sectionOrderMode: 'aiOptimized',
    }

    act(() => useSettingsStore.getState().subscribe('u1'))
    act(() => onChange(saved))

    expect(useSettingsStore.getState().settings).toEqual(saved)
  })

  it('saveSettings writes through to Firestore for the current uid', async () => {
    mockedSubscribe.mockReturnValue(() => {})
    act(() => useSettingsStore.getState().subscribe('u1'))
    const next: GenerationSettings = {
      pageConstraints: { minPages: 1, maxPages: 3, minTopMarginIn: 0.5, maxTopMarginIn: 1, sideMarginIn: 0.5 },
      sectionOrderMode: 'fixed',
    }

    await act(async () => {
      await useSettingsStore.getState().saveSettings(next)
    })

    expect(mockedSave).toHaveBeenCalledWith('u1', next)
  })

  it('unsubscribeAll resets to defaults', () => {
    mockedSubscribe.mockReturnValue(() => {})
    act(() => useSettingsStore.getState().subscribe('u1'))
    act(() => useSettingsStore.getState().unsubscribeAll())

    const state = useSettingsStore.getState()
    expect(state.uid).toBeNull()
    expect(state.settings).toEqual(DEFAULT_GENERATION_SETTINGS)
  })
})
