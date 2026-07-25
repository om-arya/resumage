import { useEffect, useRef } from 'react'
import { usePendingChangesStore } from '../stores/pendingChangesStore'

/**
 * Registers `flush` under `key` with the global pending-changes registry so the
 * single page-level Save button can persist this entity's current draft. Always
 * calls the *latest* `flush` (via a ref) without needing to re-register on every
 * render, since `flush` closures typically capture fast-changing local state.
 */
export function useRegisteredFlush(key: string, flush: () => Promise<void>) {
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  const registerFlush = usePendingChangesStore((state) => state.registerFlush)

  useEffect(() => registerFlush(key, () => flushRef.current()), [key, registerFlush])
}
