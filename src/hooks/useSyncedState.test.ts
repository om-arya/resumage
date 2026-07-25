import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSyncedState } from './useSyncedState'

describe('useSyncedState', () => {
  it('initializes from the given value', () => {
    const { result } = renderHook(() => useSyncedState('a'))
    expect(result.current[0]).toBe('a')
  })

  it('resets local state when the incoming value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useSyncedState(value), {
      initialProps: { value: 'a' },
    })

    act(() => result.current[1]('locally edited'))
    expect(result.current[0]).toBe('locally edited')

    rerender({ value: 'b' })
    expect(result.current[0]).toBe('b')
  })

  it('does not clobber local edits when the incoming value is unchanged', () => {
    const { result, rerender } = renderHook(({ value }) => useSyncedState(value), {
      initialProps: { value: 'a' },
    })

    act(() => result.current[1]('locally edited'))
    rerender({ value: 'a' })

    expect(result.current[0]).toBe('locally edited')
  })

  it('uses a custom equality function when provided', () => {
    const isEqual = (a: { text: string }, b: { text: string }) => a.text === b.text
    const { result, rerender } = renderHook(({ value }) => useSyncedState(value, isEqual), {
      initialProps: { value: { text: 'a' } },
    })

    act(() => result.current[1]({ text: 'locally edited' }))
    // A new object with the same `text` should NOT reset local edits.
    rerender({ value: { text: 'a' } })
    expect(result.current[0]).toEqual({ text: 'locally edited' })

    rerender({ value: { text: 'b' } })
    expect(result.current[0]).toEqual({ text: 'b' })
  })
})
