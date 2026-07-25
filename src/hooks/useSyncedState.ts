import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Local editable state that resets to `value` whenever `value` changes (e.g. a
 * fresh Firestore snapshot), using React's render-time "adjusting state" pattern
 * instead of a useEffect — avoids the extra render an effect-based sync causes.
 */
export function useSyncedState<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): [T, Dispatch<SetStateAction<T>>] {
  const [prevValue, setPrevValue] = useState(value)
  const [state, setState] = useState(value)
  if (!isEqual(prevValue, value)) {
    setPrevValue(value)
    setState(value)
  }
  return [state, setState]
}
