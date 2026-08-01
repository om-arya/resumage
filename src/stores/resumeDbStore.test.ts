import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useResumeDbStore } from './resumeDbStore'
import { usePendingChangesStore } from './pendingChangesStore'
import {
  deleteResumeDbDoc,
  newResumeDbDocId,
  setResumeDbDoc,
  subscribeToResumeDbCollection,
  updateResumeDbDoc,
} from '../lib/firebase/firestoreCollection'
import { getActiveTemplate } from './templatesStore'
import type { ResumeTemplate } from '../types/template'

let nextMintedId = 0

vi.mock('../lib/firebase/firestoreCollection', () => ({
  newResumeDbDocId: vi.fn(),
  setResumeDbDoc: vi.fn(),
  updateResumeDbDoc: vi.fn(),
  deleteResumeDbDoc: vi.fn(),
  saveBasicInfo: vi.fn(),
  subscribeToBasicInfo: vi.fn(() => () => {}),
  subscribeToResumeDbCollection: vi.fn(() => () => {}),
}))
vi.mock('./templatesStore', () => ({ getActiveTemplate: vi.fn() }))
vi.mock('../lib/semantic/ruleBasedProvider', () => ({
  getSemanticTextProvider: () => ({
    generateSectionOrBulletSemanticText: async (latex: string) => latex,
    generateEntrySemanticText: async () => 'entry semantic text',
    generateSkillSemanticText: async (name: string) => name,
  }),
}))
vi.mock('../lib/semantic/computeSemanticFields', () => ({
  computeSemanticFields: vi.fn(async () => ({ semanticText: '', semanticTextHash: 'hash', embedding: [1] })),
}))

const mockedMintId = vi.mocked(newResumeDbDocId)
const mockedSet = vi.mocked(setResumeDbDoc)
const mockedUpdate = vi.mocked(updateResumeDbDoc)
const mockedDelete = vi.mocked(deleteResumeDbDoc)
const mockedGetActiveTemplate = vi.mocked(getActiveTemplate)

const template: ResumeTemplate = {
  id: 't1',
  name: 'Test',
  latexPreamble: '',
  latexPostamble: '',
  mainBodyLatex: '',
  sectionWrapperLatex: '',
  entryWrapperLatex: '\\entry{{{TITLE}}}\n{{BULLETS}}',
  bulletWrapperLatex: '\\item{{{TEXT}}}',
  bulletListWrapperLatex: '',
  skillRowWrapperLatex: '',
  skillListSeparator: ', ',
  headerWrapperLatex: '',
}

const baseSection = {
  displayName: 'Experience',
  latex: '',
  isLatexOverridden: false,
  semanticText: '',
  semanticTextHash: '',
  embedding: null,
  mustInclude: true,
  order: 0,
  sectionType: 'entries' as const,
  createdAt: null as never,
  updatedAt: null as never,
}

function resetStores() {
  useResumeDbStore.setState({
    uid: 'u1',
    loading: false,
    basicInfo: null,
    sections: [],
    entries: [],
    bullets: [],
    skillRows: [],
    skills: [],
    localIdMap: {},
    pendingDeletes: new Set(),
    optimisticIds: new Set(),
  })
  usePendingChangesStore.setState({ dirtyKeys: new Set(), isDirty: false, isSaving: false, error: null })
}

describe('resumeDbStore — local draft add/save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nextMintedId = 0
    mockedMintId.mockImplementation((_uid, name) => `real-${name}-${++nextMintedId}`)
    mockedSet.mockResolvedValue(undefined)
    mockedGetActiveTemplate.mockReturnValue(template)
    resetStores()
  })

  it('addSection adds a local-only entity and marks it dirty without touching Firestore', () => {
    act(() => useResumeDbStore.getState().addSection('Experience', 'entries'))

    const { sections } = useResumeDbStore.getState()
    expect(sections).toHaveLength(1)
    expect(sections[0].id.startsWith('local:')).toBe(true)
    expect(mockedSet).not.toHaveBeenCalled()
    expect(usePendingChangesStore.getState().isDirty).toBe(true)
  })

  it('updateSection creates the doc in Firestore when flushed for a local id, and resolves the real id', async () => {
    act(() => useResumeDbStore.getState().addSection('Experience', 'entries'))
    const localId = useResumeDbStore.getState().sections[0].id

    await act(async () => {
      await useResumeDbStore.getState().updateSection(localId, {})
    })

    expect(mockedSet).toHaveBeenCalledWith(
      'u1',
      'sections',
      'real-sections-1',
      expect.objectContaining({ displayName: 'Experience' }),
    )
    expect(mockedUpdate).not.toHaveBeenCalled()
    const { sections, localIdMap } = useResumeDbStore.getState()
    expect(sections[0].id).toBe('real-sections-1')
    expect(localIdMap[localId]).toBe('real-sections-1')
  })

  it('updateSection updates in place (no create) for an already-real id', async () => {
    useResumeDbStore.setState({ sections: [{ ...baseSection, id: 'real-1', displayName: 'Old' }] })

    await act(async () => {
      await useResumeDbStore.getState().updateSection('real-1', { fields: { displayName: 'New' } })
    })

    expect(mockedSet).not.toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith(
      'u1',
      'sections',
      'real-1',
      expect.objectContaining({ displayName: 'New' }),
    )
  })

  it('a new entry under a new section resolves its sectionId to the real id once both flush, in tier order', async () => {
    act(() => useResumeDbStore.getState().addSection('Experience', 'entries'))
    const sectionLocalId = useResumeDbStore.getState().sections[0].id
    act(() =>
      useResumeDbStore
        .getState()
        .addEntry(sectionLocalId, { title: 'Engineer', organization: '', startDate: '', endDate: '', location: '' }),
    )
    const entryLocalId = useResumeDbStore.getState().entries[0].id

    // Simulates what SectionCard/EntryCard's useDraftEntity registers on mount.
    const { registerFlush } = usePendingChangesStore.getState()
    registerFlush(`sections:${sectionLocalId}`, () => useResumeDbStore.getState().updateSection(sectionLocalId, {}), 0)
    registerFlush(`entries:${entryLocalId}`, () => useResumeDbStore.getState().updateEntry(entryLocalId, {}), 1)

    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(mockedSet).toHaveBeenNthCalledWith(1, 'u1', 'sections', 'real-sections-1', expect.anything())
    expect(mockedSet).toHaveBeenNthCalledWith(
      2,
      'u1',
      'entries',
      'real-entries-2',
      expect.objectContaining({ sectionId: 'real-sections-1' }),
    )
    expect(usePendingChangesStore.getState().isDirty).toBe(false)
  })

  it('does not show a duplicate when the live listener echoes a create before its write resolves', async () => {
    // setResumeDbDoc resolving is deliberately delayed to simulate the write
    // still being in flight when the listener fires with the same doc.
    let resolveWrite: () => void = () => {}
    mockedSet.mockReturnValue(new Promise<void>((resolve) => (resolveWrite = resolve)))

    act(() => useResumeDbStore.getState().unsubscribeAll())
    act(() => useResumeDbStore.getState().subscribe('u1'))
    const [, , onSectionsChange] = vi
      .mocked(subscribeToResumeDbCollection)
      .mock.calls.find(([, name]) => name === 'sections')!

    act(() => useResumeDbStore.getState().addSection('Experience', 'entries'))
    const localId = useResumeDbStore.getState().sections[0].id

    const flushPromise = act(async () => {
      await useResumeDbStore.getState().updateSection(localId, {})
    })

    // The listener echoes the new doc (real id already known, since we minted
    // it before writing) while the write promise is still unresolved.
    act(() => onSectionsChange([{ ...baseSection, id: 'real-sections-1' }]))
    expect(useResumeDbStore.getState().sections).toHaveLength(1)

    resolveWrite()
    await flushPromise
    expect(useResumeDbStore.getState().sections).toHaveLength(1)
    expect(useResumeDbStore.getState().sections[0].id).toBe('real-sections-1')
  })

  it('deleting a local-only (never-saved) entity just drops it locally with no Firestore call', () => {
    act(() => useResumeDbStore.getState().addSection('Experience', 'entries'))
    const localId = useResumeDbStore.getState().sections[0].id

    act(() => useResumeDbStore.getState().deleteSection(localId))

    expect(useResumeDbStore.getState().sections).toHaveLength(0)
    expect(mockedDelete).not.toHaveBeenCalled()
    expect(usePendingChangesStore.getState().isDirty).toBe(false)
  })

  it('deleting a real entity defers the Firestore delete until Save', async () => {
    useResumeDbStore.setState({ sections: [{ ...baseSection, id: 'real-1' }] })

    act(() => useResumeDbStore.getState().deleteSection('real-1'))

    expect(useResumeDbStore.getState().sections).toHaveLength(0)
    expect(mockedDelete).not.toHaveBeenCalled()
    expect(usePendingChangesStore.getState().isDirty).toBe(true)

    await act(async () => {
      await usePendingChangesStore.getState().saveAll()
    })

    expect(mockedDelete).toHaveBeenCalledWith('u1', 'sections', 'real-1')
  })

  it('a pending-delete real entity does not reappear from a stale snapshot re-merge', () => {
    const section = { ...baseSection, id: 'real-1' }

    // Drive through the real subscribe() so we can capture the onChange callback.
    act(() => useResumeDbStore.getState().unsubscribeAll())
    act(() => useResumeDbStore.getState().subscribe('u1'))
    const [, , onSectionsChange] = vi
      .mocked(subscribeToResumeDbCollection)
      .mock.calls.find(([, name]) => name === 'sections')!

    act(() => onSectionsChange([section]))
    expect(useResumeDbStore.getState().sections).toHaveLength(1)

    act(() => useResumeDbStore.getState().deleteSection('real-1'))
    expect(useResumeDbStore.getState().sections).toHaveLength(0)

    // A stale snapshot event (in flight before the delete lands) must not resurrect it.
    act(() => onSectionsChange([section]))
    expect(useResumeDbStore.getState().sections).toHaveLength(0)
  })
})
