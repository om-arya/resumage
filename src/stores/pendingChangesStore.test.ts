import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePendingChangesStore } from './pendingChangesStore'

function resetStore() {
  usePendingChangesStore.setState({
    dirtyKeys: new Set(),
    isDirty: false,
    isSaving: false,
    error: null,
  })
}

describe('pendingChangesStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('markDirty flips isDirty true and tracks the key', () => {
    act(() => usePendingChangesStore.getState().markDirty('sections:1'))
    const state = usePendingChangesStore.getState()
    expect(state.isDirty).toBe(true)
    expect(state.dirtyKeys.has('sections:1')).toBe(true)
  })

  it('markClean removes the key and clears isDirty once none remain', () => {
    act(() => usePendingChangesStore.getState().markDirty('sections:1'))
    act(() => usePendingChangesStore.getState().markClean('sections:1'))
    const state = usePendingChangesStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.dirtyKeys.has('sections:1')).toBe(false)
  })

  it('saveAll calls the registered flush for every dirty key and marks them clean', async () => {
    const flushA = vi.fn().mockResolvedValue(undefined)
    const flushB = vi.fn().mockResolvedValue(undefined)
    const unregisterA = usePendingChangesStore.getState().registerFlush('a', flushA)
    const unregisterB = usePendingChangesStore.getState().registerFlush('b', flushB)
    act(() => usePendingChangesStore.getState().markDirty('a'))
    act(() => usePendingChangesStore.getState().markDirty('b'))

    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(flushA).toHaveBeenCalledTimes(1)
    expect(flushB).toHaveBeenCalledTimes(1)
    expect(usePendingChangesStore.getState().isDirty).toBe(false)
    unregisterA()
    unregisterB()
  })

  it('saveAll is a no-op when nothing is dirty', async () => {
    const flush = vi.fn().mockResolvedValue(undefined)
    const unregister = usePendingChangesStore.getState().registerFlush('a', flush)

    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(flush).not.toHaveBeenCalled()
    unregister()
  })

  it('saveAll records an error and leaves the key dirty when a flush rejects', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('network down'))
    const unregister = usePendingChangesStore.getState().registerFlush('a', flush)
    act(() => usePendingChangesStore.getState().markDirty('a'))

    await act(async () => {
      await expect(usePendingChangesStore.getState().saveAll()).rejects.toThrow('network down')
    })

    const state = usePendingChangesStore.getState()
    expect(state.error).toBe('network down')
    expect(state.isSaving).toBe(false)
    unregister()
  })

  it('registerFlush returns an unregister function that removes the flusher', async () => {
    const flush = vi.fn().mockResolvedValue(undefined)
    const unregister = usePendingChangesStore.getState().registerFlush('a', flush)
    unregister()
    act(() => usePendingChangesStore.getState().markDirty('a'))

    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(flush).not.toHaveBeenCalled()
  })
})
