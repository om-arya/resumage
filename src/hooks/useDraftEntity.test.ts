import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftEntity } from './useDraftEntity'
import { usePendingChangesStore } from '../stores/pendingChangesStore'

interface Fields {
  text: string
}

const generateLatex = (fields: Fields) => `\\item{${fields.text}}`

function resetPendingChanges() {
  usePendingChangesStore.setState({
    dirtyKeys: new Set(),
    isDirty: false,
    isSaving: false,
    error: null,
  })
}

describe('useDraftEntity', () => {
  beforeEach(() => {
    resetPendingChanges()
  })

  it('starts with the persisted fields and live-generated latex', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    expect(result.current.fields).toEqual({ text: 'hello' })
    expect(result.current.latex).toBe('\\item{hello}')
    expect(result.current.isLatexOverridden).toBe(false)
  })

  it('updates the live latex immediately as fields change, and marks dirty', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.updateFields({ text: 'world' }))

    expect(result.current.latex).toBe('\\item{world}')
    expect(usePendingChangesStore.getState().dirtyKeys.has('bullets:1')).toBe(true)
  })

  it('setLatex marks isLatexOverridden true only when it diverges from the generated latex', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.setLatex('\\item{hello}'))
    expect(result.current.isLatexOverridden).toBe(false)

    act(() => result.current.setLatex('\\custom{}'))
    expect(result.current.isLatexOverridden).toBe(true)
    expect(result.current.latex).toBe('\\custom{}')
  })

  it('revertToAutoLatex drops the manual draft back to the generated latex', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\custom{}',
        isLatexOverridden: true,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.revertToAutoLatex())

    expect(result.current.isLatexOverridden).toBe(false)
    expect(result.current.latex).toBe('\\item{hello}')
  })

  it('registers a flush that persists the current draft when the global Save runs', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.updateFields({ text: 'world' }))
    // Let the ref-sync effect commit before the store's flush reads it.
    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(onFlush).toHaveBeenCalledWith({
      fields: { text: 'world' },
      latex: '\\item{world}',
      isLatexOverridden: false,
    })
  })

  it('flushes a manual latex override with isLatexOverridden true', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.setLatex('\\custom{}'))
    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(onFlush).toHaveBeenCalledWith({
      fields: { text: 'hello' },
      latex: '\\custom{}',
      isLatexOverridden: true,
    })
  })

  it('rejects the flush and never calls onFlush when the draft LaTeX is invalid', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDraftEntity<Fields>({
        key: 'bullets:1',
        fields: { text: 'hello' },
        latex: '\\item{hello}',
        isLatexOverridden: false,
        generateLatex,
        onFlush,
      }),
    )

    act(() => result.current.setLatex('\\textbf{unclosed'))

    await act(async () => {
      await expect(usePendingChangesStore.getState().saveAll()).rejects.toThrow(/Invalid LaTeX/)
    })

    expect(onFlush).not.toHaveBeenCalled()
    expect(usePendingChangesStore.getState().dirtyKeys.has('bullets:1')).toBe(true)
  })
})
