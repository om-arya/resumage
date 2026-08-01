import { create } from 'zustand'
import type { Timestamp } from 'firebase/firestore'
import {
  deleteResumeDbDoc,
  newResumeDbDocId,
  saveBasicInfo as saveBasicInfoDoc,
  setResumeDbDoc,
  subscribeToBasicInfo,
  subscribeToResumeDbCollection,
  updateResumeDbDoc,
} from '../lib/firebase/firestoreCollection'
import { isLocalId, newLocalId } from '../lib/firebase/localId'
import { FLUSH_TIER, type ResumeDbEntityCollection } from '../lib/firebase/flushTiers'
import { usePendingChangesStore } from './pendingChangesStore'
import type {
  BasicInfo,
  Bullet,
  Entry,
  EntryFields,
  Section,
  SectionType,
  Skill,
  SkillRow,
} from '../types/resumeDb'
import {
  generateBulletLatex,
  generateEntryLatex,
  generateSectionLatex,
  generateSkillRowLatex,
} from '../lib/template/generateDefaultLatex'
import { getActiveTemplate } from './templatesStore'
import { getSemanticTextProvider } from '../lib/semantic/ruleBasedProvider'
import { computeSemanticFields } from '../lib/semantic/computeSemanticFields'

const EMPTY_BASIC_INFO: BasicInfo = {
  fields: { name: '', email: '', phone: '', location: '', links: [] },
  latex: '',
  isLatexOverridden: false,
}

const DEFAULT_MUST_INCLUDE = true

// Locally-added entities don't have a real Firestore timestamp yet; nothing
// in the UI reads createdAt/updatedAt, so a placeholder is fine until Save.
const NO_TIMESTAMP = null as unknown as Timestamp

function nextOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1
}

/** Patch shape produced by useDraftEntity's flush for any LaTeX-overridable entity. */
type EntityPatch<TFields> = Partial<{
  fields: TFields
  latex: string
  isLatexOverridden: boolean
}>

/**
 * Merges a live Firestore snapshot with locally-added (not yet saved),
 * locally-created-but-not-yet-confirmed (id already minted, write in flight),
 * and locally-deleted (staged, not yet saved) entities, so none of them gets
 * clobbered or duplicated by the next snapshot event while a draft is pending.
 *
 * The "not yet confirmed" case matters because a create's own Firestore write
 * both mints the id we already swapped into local state *and* fires this same
 * listener with the new doc before our write's promise resolves — without
 * tracking that overlap, the entity would flash as a duplicate for a moment.
 */
function mergeSnapshot<T extends { id: string }>(
  collectionName: ResumeDbEntityCollection,
  firestoreItems: T[],
  previousItems: T[],
  pendingDeletes: Set<string>,
  optimisticIds: Set<string>,
): T[] {
  const kept = firestoreItems.filter((item) => !pendingDeletes.has(`${collectionName}:${item.id}`))
  const keptIds = new Set(kept.map((item) => item.id))
  const overlay = previousItems.filter(
    (item) => !keptIds.has(item.id) && (isLocalId(item.id) || optimisticIds.has(`${collectionName}:${item.id}`)),
  )
  return [...kept, ...overlay]
}

/** Drops ids from `optimisticIds` once the live snapshot confirms them, so the set doesn't grow forever. */
function pruneConfirmedOptimisticIds<T extends { id: string }>(
  collectionName: ResumeDbEntityCollection,
  optimisticIds: Set<string>,
  firestoreItems: T[],
): Set<string> {
  let next: Set<string> | null = null
  for (const item of firestoreItems) {
    const key = `${collectionName}:${item.id}`
    if (optimisticIds.has(key)) {
      next ??= new Set(optimisticIds)
      next.delete(key)
    }
  }
  return next ?? optimisticIds
}

/**
 * Stages a Firestore delete for the Save button instead of deleting immediately:
 * removes the entity from view via `pendingDeletes` (so a stale snapshot can't
 * bring it back) and registers the actual `deleteResumeDbDoc` call as this
 * entity's flush, overriding whatever edit-flush was registered for it. A
 * never-saved (local) entity has nothing to delete remotely — just drop it.
 */
function stageDelete(
  set: (fn: (state: ResumeDbState) => Partial<ResumeDbState>) => void,
  uid: string,
  collectionName: ResumeDbEntityCollection,
  id: string,
): void {
  const key = `${collectionName}:${id}`
  const pending = usePendingChangesStore.getState()
  if (isLocalId(id)) {
    pending.markClean(key)
    return
  }
  set((state) => ({ pendingDeletes: new Set(state.pendingDeletes).add(key) }))
  pending.registerFlush(
    key,
    async () => {
      await deleteResumeDbDoc(uid, collectionName, id)
      set((state) => {
        const next = new Set(state.pendingDeletes)
        next.delete(key)
        return { pendingDeletes: next }
      })
    },
    FLUSH_TIER[collectionName],
  )
  pending.markDirty(key)
}

interface ResumeDbState {
  uid: string | null
  loading: boolean
  basicInfo: BasicInfo | null
  sections: Section[]
  entries: Entry[]
  bullets: Bullet[]
  skillRows: SkillRow[]
  skills: Skill[]
  /** Maps a resolved local id to the real Firestore id it was created under this session. */
  localIdMap: Record<string, string>
  /** `${collection}:${id}` keys for entities deleted locally but not yet flushed. */
  pendingDeletes: Set<string>
  /** `${collection}:${id}` keys for entities just created locally, not yet echoed back by the live listener. */
  optimisticIds: Set<string>

  subscribe: (uid: string) => void
  unsubscribeAll: () => void

  saveBasicInfo: (patch: EntityPatch<BasicInfo['fields']>) => Promise<void>

  addSection: (displayName: string, sectionType: SectionType) => void
  updateSection: (id: string, patch: EntityPatch<{ displayName: string }>) => Promise<void>
  deleteSection: (id: string) => void
  reorderSections: (orderedIds: string[]) => void

  addEntry: (sectionId: string, fields: EntryFields) => void
  updateEntry: (id: string, patch: EntityPatch<EntryFields>) => Promise<void>
  deleteEntry: (id: string) => void
  reorderEntries: (orderedIds: string[]) => void

  addBullet: (entryId: string, sectionId: string, text: string) => void
  updateBullet: (id: string, patch: EntityPatch<{ text: string }>) => Promise<void>
  deleteBullet: (id: string) => void
  reorderBullets: (orderedIds: string[]) => void

  addSkillRow: (sectionId: string, categoryName: string) => void
  updateSkillRow: (id: string, patch: EntityPatch<{ categoryName: string }>) => Promise<void>
  deleteSkillRow: (id: string) => void
  reorderSkillRows: (orderedIds: string[]) => void

  addSkill: (skillRowId: string, displayName: string) => void
  updateSkill: (id: string, displayName: string) => Promise<void>
  deleteSkill: (id: string) => void
  reorderSkills: (orderedIds: string[]) => void

  setMustInclude: (
    collectionName: 'sections' | 'entries' | 'bullets' | 'skills',
    id: string,
    mustInclude: boolean,
  ) => void
}

let unsubscribers: Array<() => void> = []

export const useResumeDbStore = create<ResumeDbState>((set, get) => ({
  uid: null,
  loading: true,
  basicInfo: null,
  sections: [],
  entries: [],
  bullets: [],
  skillRows: [],
  skills: [],
  localIdMap: {},
  pendingDeletes: new Set(),
  optimisticIds: new Set(),

  subscribe(uid) {
    if (get().uid === uid) return
    get().unsubscribeAll()
    set({ uid, loading: true })
    unsubscribers = [
      subscribeToBasicInfo(uid, (basicInfo) => set({ basicInfo, loading: false })),
      subscribeToResumeDbCollection<Section>(uid, 'sections', (sections) =>
        set((state) => ({
          sections: mergeSnapshot('sections', sections, state.sections, state.pendingDeletes, state.optimisticIds),
          optimisticIds: pruneConfirmedOptimisticIds('sections', state.optimisticIds, sections),
        })),
      ),
      subscribeToResumeDbCollection<Entry>(uid, 'entries', (entries) =>
        set((state) => ({
          entries: mergeSnapshot('entries', entries, state.entries, state.pendingDeletes, state.optimisticIds),
          optimisticIds: pruneConfirmedOptimisticIds('entries', state.optimisticIds, entries),
        })),
      ),
      subscribeToResumeDbCollection<Bullet>(uid, 'bullets', (bullets) =>
        set((state) => ({
          bullets: mergeSnapshot('bullets', bullets, state.bullets, state.pendingDeletes, state.optimisticIds),
          optimisticIds: pruneConfirmedOptimisticIds('bullets', state.optimisticIds, bullets),
        })),
      ),
      subscribeToResumeDbCollection<SkillRow>(uid, 'skillRows', (skillRows) =>
        set((state) => ({
          skillRows: mergeSnapshot(
            'skillRows',
            skillRows,
            state.skillRows,
            state.pendingDeletes,
            state.optimisticIds,
          ),
          optimisticIds: pruneConfirmedOptimisticIds('skillRows', state.optimisticIds, skillRows),
        })),
      ),
      subscribeToResumeDbCollection<Skill>(uid, 'skills', (skills) =>
        set((state) => ({
          skills: mergeSnapshot('skills', skills, state.skills, state.pendingDeletes, state.optimisticIds),
          optimisticIds: pruneConfirmedOptimisticIds('skills', state.optimisticIds, skills),
        })),
      ),
    ]
  },

  unsubscribeAll() {
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers = []
    set({
      uid: null,
      loading: true,
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
  },

  async saveBasicInfo(patch) {
    const uid = get().uid
    if (!uid) return
    const current = get().basicInfo ?? EMPTY_BASIC_INFO
    const next: BasicInfo = {
      fields: patch.fields ?? current.fields,
      latex: patch.latex ?? current.latex,
      isLatexOverridden: patch.isLatexOverridden ?? current.isLatexOverridden,
    }
    await saveBasicInfoDoc(uid, next)
  },

  addSection(displayName, sectionType) {
    const uid = get().uid
    if (!uid) return
    const id = newLocalId()
    const section: Section = {
      id,
      displayName,
      latex: generateSectionLatex(displayName),
      isLatexOverridden: false,
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(get().sections),
      sectionType,
      createdAt: NO_TIMESTAMP,
      updatedAt: NO_TIMESTAMP,
    }
    set((state) => ({ sections: [...state.sections, section] }))
    usePendingChangesStore.getState().markDirty(`sections:${id}`)
  },

  async updateSection(id, patch) {
    const uid = get().uid
    if (!uid) return
    const existing = get().sections.find((section) => section.id === id)
    if (!existing) return

    // Mint the id and swap it into local state *before* anything async runs, so
    // the live listener's near-instant echo of the write below (which can beat
    // this function's own awaited write call) never sees a doc whose id doesn't
    // already match something in local state (see mergeSnapshot).
    const writeId = isLocalId(id) ? newResumeDbDocId(uid, 'sections') : id
    if (isLocalId(id)) {
      set((state) => ({
        sections: state.sections.map((section) => (section.id === id ? { ...section, id: writeId } : section)),
        localIdMap: { ...state.localIdMap, [id]: writeId },
        optimisticIds: new Set(state.optimisticIds).add(`sections:${writeId}`),
      }))
    }

    const displayName = patch.fields?.displayName ?? existing.displayName
    const latex = patch.latex ?? existing.latex
    const isLatexOverridden = patch.isLatexOverridden ?? existing.isLatexOverridden
    const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(latex)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: existing.semanticTextHash,
      existingEmbedding: existing.embedding,
    })
    const data = {
      displayName,
      latex,
      isLatexOverridden,
      ...semantic,
      mustInclude: existing.mustInclude,
      order: existing.order,
      sectionType: existing.sectionType,
    }
    if (isLocalId(id)) {
      await setResumeDbDoc(uid, 'sections', writeId, data)
    } else {
      await updateResumeDbDoc(uid, 'sections', id, data)
    }
  },

  deleteSection(id) {
    const uid = get().uid
    if (!uid) return
    const { entries, bullets, skillRows, skills } = get()
    const entryIds = entries.filter((entry) => entry.sectionId === id).map((entry) => entry.id)
    const bulletIds = bullets.filter((bullet) => bullet.sectionId === id).map((bullet) => bullet.id)
    const skillRowIds = skillRows.filter((row) => row.sectionId === id).map((row) => row.id)
    const skillIds = skills
      .filter((skill) => skillRowIds.includes(skill.skillRowId))
      .map((skill) => skill.id)

    bulletIds.forEach((bulletId) => stageDelete(set, uid, 'bullets', bulletId))
    skillIds.forEach((skillId) => stageDelete(set, uid, 'skills', skillId))
    entryIds.forEach((entryId) => stageDelete(set, uid, 'entries', entryId))
    skillRowIds.forEach((rowId) => stageDelete(set, uid, 'skillRows', rowId))
    stageDelete(set, uid, 'sections', id)

    set((state) => ({
      sections: state.sections.filter((section) => section.id !== id),
      entries: state.entries.filter((entry) => !entryIds.includes(entry.id)),
      bullets: state.bullets.filter((bullet) => !bulletIds.includes(bullet.id)),
      skillRows: state.skillRows.filter((row) => !skillRowIds.includes(row.id)),
      skills: state.skills.filter((skill) => !skillIds.includes(skill.id)),
    }))
  },

  reorderSections(orderedIds) {
    const uid = get().uid
    if (!uid) return
    set((state) => ({
      sections: state.sections.map((section) => {
        const order = orderedIds.indexOf(section.id)
        return order === -1 ? section : { ...section, order }
      }),
    }))
    const { markDirty } = usePendingChangesStore.getState()
    orderedIds.forEach((id) => markDirty(`sections:${id}`))
  },

  addEntry(sectionId, fields) {
    const uid = get().uid
    if (!uid) return
    const id = newLocalId()
    const siblingEntries = get().entries.filter((entry) => entry.sectionId === sectionId)
    const entry: Entry = {
      id,
      sectionId,
      fields,
      latex: generateEntryLatex(fields, getActiveTemplate()),
      isLatexOverridden: false,
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingEntries),
      createdAt: NO_TIMESTAMP,
      updatedAt: NO_TIMESTAMP,
    }
    set((state) => ({ entries: [...state.entries, entry] }))
    usePendingChangesStore.getState().markDirty(`entries:${id}`)
  },

  async updateEntry(id, patch) {
    const uid = get().uid
    if (!uid) return
    const existing = get().entries.find((entry) => entry.id === id)
    if (!existing) return

    const sectionId = get().localIdMap[existing.sectionId] ?? existing.sectionId
    const writeId = isLocalId(id) ? newResumeDbDocId(uid, 'entries') : id
    if (isLocalId(id)) {
      set((state) => ({
        entries: state.entries.map((entry) => (entry.id === id ? { ...entry, id: writeId, sectionId } : entry)),
        localIdMap: { ...state.localIdMap, [id]: writeId },
        optimisticIds: new Set(state.optimisticIds).add(`entries:${writeId}`),
      }))
    }

    const fields = patch.fields ?? existing.fields
    const latex = patch.latex ?? existing.latex
    const isLatexOverridden = patch.isLatexOverridden ?? existing.isLatexOverridden
    // Snapshot of sibling bullets as of *this* save — editing a bullet afterward
    // without re-saving the entry won't retroactively refresh this text.
    const bulletTexts = get()
      .bullets.filter((bullet) => bullet.entryId === id)
      .map((bullet) => bullet.text)
    const semanticText = await getSemanticTextProvider().generateEntrySemanticText(fields, bulletTexts)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: existing.semanticTextHash,
      existingEmbedding: existing.embedding,
    })
    const data = {
      sectionId,
      fields,
      latex,
      isLatexOverridden,
      ...semantic,
      mustInclude: existing.mustInclude,
      order: existing.order,
    }
    if (isLocalId(id)) {
      await setResumeDbDoc(uid, 'entries', writeId, data)
    } else {
      await updateResumeDbDoc(uid, 'entries', id, data)
    }
  },

  deleteEntry(id) {
    const uid = get().uid
    if (!uid) return
    const bulletIds = get()
      .bullets.filter((bullet) => bullet.entryId === id)
      .map((bullet) => bullet.id)
    bulletIds.forEach((bulletId) => stageDelete(set, uid, 'bullets', bulletId))
    stageDelete(set, uid, 'entries', id)
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
      bullets: state.bullets.filter((bullet) => !bulletIds.includes(bullet.id)),
    }))
  },

  reorderEntries(orderedIds) {
    const uid = get().uid
    if (!uid) return
    set((state) => ({
      entries: state.entries.map((entry) => {
        const order = orderedIds.indexOf(entry.id)
        return order === -1 ? entry : { ...entry, order }
      }),
    }))
    const { markDirty } = usePendingChangesStore.getState()
    orderedIds.forEach((id) => markDirty(`entries:${id}`))
  },

  addBullet(entryId, sectionId, text) {
    const uid = get().uid
    if (!uid) return
    const id = newLocalId()
    const siblingBullets = get().bullets.filter((bullet) => bullet.entryId === entryId)
    const bullet: Bullet = {
      id,
      entryId,
      sectionId,
      text,
      latex: generateBulletLatex(text, getActiveTemplate()),
      isLatexOverridden: false,
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingBullets),
      createdAt: NO_TIMESTAMP,
      updatedAt: NO_TIMESTAMP,
    }
    set((state) => ({ bullets: [...state.bullets, bullet] }))
    usePendingChangesStore.getState().markDirty(`bullets:${id}`)
  },

  async updateBullet(id, patch) {
    const uid = get().uid
    if (!uid) return
    const existing = get().bullets.find((bullet) => bullet.id === id)
    if (!existing) return

    const entryId = get().localIdMap[existing.entryId] ?? existing.entryId
    const sectionId = get().localIdMap[existing.sectionId] ?? existing.sectionId
    const writeId = isLocalId(id) ? newResumeDbDocId(uid, 'bullets') : id
    if (isLocalId(id)) {
      set((state) => ({
        bullets: state.bullets.map((bullet) =>
          bullet.id === id ? { ...bullet, id: writeId, entryId, sectionId } : bullet,
        ),
        localIdMap: { ...state.localIdMap, [id]: writeId },
        optimisticIds: new Set(state.optimisticIds).add(`bullets:${writeId}`),
      }))
    }

    const text = patch.fields?.text ?? existing.text
    const latex = patch.latex ?? existing.latex
    const isLatexOverridden = patch.isLatexOverridden ?? existing.isLatexOverridden
    const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(latex)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: existing.semanticTextHash,
      existingEmbedding: existing.embedding,
    })
    const data = {
      entryId,
      sectionId,
      text,
      latex,
      isLatexOverridden,
      ...semantic,
      mustInclude: existing.mustInclude,
      order: existing.order,
    }
    if (isLocalId(id)) {
      await setResumeDbDoc(uid, 'bullets', writeId, data)
    } else {
      await updateResumeDbDoc(uid, 'bullets', id, data)
    }
  },

  deleteBullet(id) {
    const uid = get().uid
    if (!uid) return
    stageDelete(set, uid, 'bullets', id)
    set((state) => ({ bullets: state.bullets.filter((bullet) => bullet.id !== id) }))
  },

  reorderBullets(orderedIds) {
    const uid = get().uid
    if (!uid) return
    set((state) => ({
      bullets: state.bullets.map((bullet) => {
        const order = orderedIds.indexOf(bullet.id)
        return order === -1 ? bullet : { ...bullet, order }
      }),
    }))
    const { markDirty } = usePendingChangesStore.getState()
    orderedIds.forEach((id) => markDirty(`bullets:${id}`))
  },

  addSkillRow(sectionId, categoryName) {
    const uid = get().uid
    if (!uid) return
    const id = newLocalId()
    const siblingRows = get().skillRows.filter((row) => row.sectionId === sectionId)
    const skillRow: SkillRow = {
      id,
      sectionId,
      categoryName,
      latex: generateSkillRowLatex(categoryName, getActiveTemplate()),
      isLatexOverridden: false,
      order: nextOrder(siblingRows),
      createdAt: NO_TIMESTAMP,
      updatedAt: NO_TIMESTAMP,
    }
    set((state) => ({ skillRows: [...state.skillRows, skillRow] }))
    usePendingChangesStore.getState().markDirty(`skillRows:${id}`)
  },

  async updateSkillRow(id, patch) {
    const uid = get().uid
    if (!uid) return
    const existing = get().skillRows.find((row) => row.id === id)
    if (!existing) return
    const categoryName = patch.fields?.categoryName ?? existing.categoryName
    const latex = patch.latex ?? existing.latex
    const isLatexOverridden = patch.isLatexOverridden ?? existing.isLatexOverridden
    const sectionId = get().localIdMap[existing.sectionId] ?? existing.sectionId
    const data = { sectionId, categoryName, latex, isLatexOverridden, order: existing.order }
    if (isLocalId(id)) {
      const newId = newResumeDbDocId(uid, 'skillRows')
      set((state) => ({
        skillRows: state.skillRows.map((row) => (row.id === id ? { ...row, id: newId, sectionId } : row)),
        localIdMap: { ...state.localIdMap, [id]: newId },
        optimisticIds: new Set(state.optimisticIds).add(`skillRows:${newId}`),
      }))
      await setResumeDbDoc(uid, 'skillRows', newId, data)
    } else {
      await updateResumeDbDoc(uid, 'skillRows', id, data)
    }
  },

  deleteSkillRow(id) {
    const uid = get().uid
    if (!uid) return
    const skillIds = get()
      .skills.filter((skill) => skill.skillRowId === id)
      .map((skill) => skill.id)
    skillIds.forEach((skillId) => stageDelete(set, uid, 'skills', skillId))
    stageDelete(set, uid, 'skillRows', id)
    set((state) => ({
      skillRows: state.skillRows.filter((row) => row.id !== id),
      skills: state.skills.filter((skill) => !skillIds.includes(skill.id)),
    }))
  },

  reorderSkillRows(orderedIds) {
    const uid = get().uid
    if (!uid) return
    set((state) => ({
      skillRows: state.skillRows.map((row) => {
        const order = orderedIds.indexOf(row.id)
        return order === -1 ? row : { ...row, order }
      }),
    }))
    const { markDirty } = usePendingChangesStore.getState()
    orderedIds.forEach((id) => markDirty(`skillRows:${id}`))
  },

  addSkill(skillRowId, displayName) {
    const uid = get().uid
    if (!uid) return
    const id = newLocalId()
    const siblingSkills = get().skills.filter((skill) => skill.skillRowId === skillRowId)
    const skill: Skill = {
      id,
      skillRowId,
      displayName,
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingSkills),
      createdAt: NO_TIMESTAMP,
      updatedAt: NO_TIMESTAMP,
    }
    set((state) => ({ skills: [...state.skills, skill] }))
    usePendingChangesStore.getState().markDirty(`skills:${id}`)
  },

  async updateSkill(id, displayName) {
    const uid = get().uid
    if (!uid) return
    const existing = get().skills.find((skill) => skill.id === id)
    if (!existing) return

    const skillRowId = get().localIdMap[existing.skillRowId] ?? existing.skillRowId
    const writeId = isLocalId(id) ? newResumeDbDocId(uid, 'skills') : id
    if (isLocalId(id)) {
      set((state) => ({
        skills: state.skills.map((skill) => (skill.id === id ? { ...skill, id: writeId, skillRowId } : skill)),
        localIdMap: { ...state.localIdMap, [id]: writeId },
        optimisticIds: new Set(state.optimisticIds).add(`skills:${writeId}`),
      }))
    }

    const finalDisplayName = displayName.trim() || existing.displayName
    const semanticText = await getSemanticTextProvider().generateSkillSemanticText(finalDisplayName)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: existing.semanticTextHash,
      existingEmbedding: existing.embedding,
    })
    const data = {
      skillRowId,
      displayName: finalDisplayName,
      ...semantic,
      mustInclude: existing.mustInclude,
      order: existing.order,
    }
    if (isLocalId(id)) {
      await setResumeDbDoc(uid, 'skills', writeId, data)
    } else {
      await updateResumeDbDoc(uid, 'skills', id, data)
    }
  },

  deleteSkill(id) {
    const uid = get().uid
    if (!uid) return
    stageDelete(set, uid, 'skills', id)
    set((state) => ({ skills: state.skills.filter((skill) => skill.id !== id) }))
  },

  reorderSkills(orderedIds) {
    const uid = get().uid
    if (!uid) return
    set((state) => ({
      skills: state.skills.map((skill) => {
        const order = orderedIds.indexOf(skill.id)
        return order === -1 ? skill : { ...skill, order }
      }),
    }))
    const { markDirty } = usePendingChangesStore.getState()
    orderedIds.forEach((id) => markDirty(`skills:${id}`))
  },

  setMustInclude(collectionName, id, mustInclude) {
    const uid = get().uid
    if (!uid) return
    switch (collectionName) {
      case 'sections':
        set((state) => ({
          sections: state.sections.map((s) => (s.id === id ? { ...s, mustInclude } : s)),
        }))
        break
      case 'entries':
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, mustInclude } : e)),
        }))
        break
      case 'bullets':
        set((state) => ({
          bullets: state.bullets.map((b) => (b.id === id ? { ...b, mustInclude } : b)),
        }))
        break
      case 'skills':
        set((state) => ({
          skills: state.skills.map((s) => (s.id === id ? { ...s, mustInclude } : s)),
        }))
        break
    }
    usePendingChangesStore.getState().markDirty(`${collectionName}:${id}`)
  },
}))
