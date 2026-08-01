import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { useSyncedState } from './useSyncedState'
import { useRegisteredFlush } from './useRegisteredFlush'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { validateLatex } from '../lib/template/validateLatex'

export interface DraftEntityPatch<TFields> {
  fields: TFields
  latex: string
  isLatexOverridden: boolean
}

interface UseDraftEntityOptions<TFields> {
  /** Unique dirty-tracking/flush-registration key, e.g. `sections:${id}`. */
  key: string
  fields: TFields
  latex: string
  isLatexOverridden: boolean
  isFieldsEqual?: (a: TFields, b: TFields) => boolean
  generateLatex: (fields: TFields) => string
  onFlush: (patch: DraftEntityPatch<TFields>) => Promise<void>
  /** Save order — see `FLUSH_TIER`. Defaults to 0 (no parent dependency). */
  tier?: number
}

/**
 * Local draft for one LaTeX-overridable entity (BasicInfo, Section, Entry,
 * Bullet, SkillRow). Field edits and manual LaTeX edits stay purely local and
 * mark this entity dirty; nothing hits Firestore until the page-level Save
 * button flushes every dirty entity at once. The LaTeX shown is always live:
 * generated fresh from the current fields unless the user has typed a manual
 * override draft, so there's no separate "regenerate" step to trigger.
 */
export function useDraftEntity<TFields>({
  key,
  fields: persistedFields,
  latex: persistedLatex,
  isLatexOverridden: persistedIsOverridden,
  // TFields is always a plain data object here, and callers typically pass a
  // freshly-constructed object literal each render, so reference equality
  // (Object.is) would never consider two equal-content values equal.
  isFieldsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  generateLatex,
  onFlush,
  tier = 0,
}: UseDraftEntityOptions<TFields>) {
  const [fields, setFields] = useSyncedState(persistedFields, isFieldsEqual)
  // null = "follow the fields"; a string = a manually-typed LaTeX draft.
  const [manualLatexDraft, setManualLatexDraft] = useSyncedState<string | null>(
    persistedIsOverridden ? persistedLatex : null,
  )
  const markDirty = usePendingChangesStore((state) => state.markDirty)

  const generatedLatex = generateLatex(fields)
  const latex = manualLatexDraft ?? generatedLatex
  const isLatexOverridden =
    manualLatexDraft !== null && manualLatexDraft.trim() !== generatedLatex.trim()

  const updateFields: Dispatch<SetStateAction<TFields>> = useCallback(
    (value) => {
      setFields(value)
      markDirty(key)
    },
    [setFields, markDirty, key],
  )

  const setLatex = useCallback(
    (nextLatex: string) => {
      setManualLatexDraft(nextLatex)
      markDirty(key)
    },
    [setManualLatexDraft, markDirty, key],
  )

  const revertToAutoLatex = useCallback(() => {
    setManualLatexDraft(null)
    markDirty(key)
  }, [setManualLatexDraft, markDirty, key])

  useRegisteredFlush(
    key,
    useCallback(async () => {
      const generated = generateLatex(fields)
      const finalLatex = manualLatexDraft ?? generated
      const finalIsOverridden = manualLatexDraft !== null && manualLatexDraft.trim() !== generated.trim()
      // Defense in depth beyond LatexOverrideSection's inline warning — invalid
      // LaTeX must never reach Firestore, even if the user saves without noticing it.
      const errors = validateLatex(finalLatex)
      if (errors.length > 0) {
        throw new Error(`Invalid LaTeX: ${errors.join('; ')}`)
      }
      await onFlush({ fields, latex: finalLatex, isLatexOverridden: finalIsOverridden })
    }, [fields, manualLatexDraft, generateLatex, onFlush]),
    tier,
  )

  return { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex }
}
