import { create } from 'zustand'
import {
  createResumeDbDoc,
  deleteResumeDbDoc,
  reorderResumeDbDocs,
  saveBasicInfo as saveBasicInfoDoc,
  subscribeToBasicInfo,
  subscribeToResumeDbCollection,
  updateResumeDbDoc,
  type ResumeDbCollectionName,
} from '../lib/firebase/firestoreCollection'
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

function nextOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1
}

/** Patch shape produced by useDraftEntity's flush for any LaTeX-overridable entity. */
type EntityPatch<TFields> = Partial<{
  fields: TFields
  latex: string
  isLatexOverridden: boolean
}>

interface ResumeDbState {
  uid: string | null
  loading: boolean
  basicInfo: BasicInfo | null
  sections: Section[]
  entries: Entry[]
  bullets: Bullet[]
  skillRows: SkillRow[]
  skills: Skill[]

  subscribe: (uid: string) => void
  unsubscribeAll: () => void

  saveBasicInfo: (patch: EntityPatch<BasicInfo['fields']>) => Promise<void>

  addSection: (displayName: string, sectionType: SectionType) => Promise<void>
  updateSection: (id: string, patch: EntityPatch<{ displayName: string }>) => Promise<void>
  deleteSection: (id: string) => Promise<void>
  reorderSections: (orderedIds: string[]) => Promise<void>

  addEntry: (sectionId: string, fields: EntryFields) => Promise<void>
  updateEntry: (id: string, patch: EntityPatch<EntryFields>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  reorderEntries: (orderedIds: string[]) => Promise<void>

  addBullet: (entryId: string, sectionId: string, text: string) => Promise<void>
  updateBullet: (id: string, patch: EntityPatch<{ text: string }>) => Promise<void>
  deleteBullet: (id: string) => Promise<void>
  reorderBullets: (orderedIds: string[]) => Promise<void>

  addSkillRow: (sectionId: string, categoryName: string) => Promise<void>
  updateSkillRow: (id: string, patch: EntityPatch<{ categoryName: string }>) => Promise<void>
  deleteSkillRow: (id: string) => Promise<void>
  reorderSkillRows: (orderedIds: string[]) => Promise<void>

  addSkill: (skillRowId: string, displayName: string) => Promise<void>
  updateSkill: (id: string, displayName: string) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  reorderSkills: (orderedIds: string[]) => Promise<void>

  setMustInclude: (collectionName: ResumeDbCollectionName, id: string, mustInclude: boolean) => Promise<void>
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

  subscribe(uid) {
    if (get().uid === uid) return
    get().unsubscribeAll()
    set({ uid, loading: true })
    unsubscribers = [
      subscribeToBasicInfo(uid, (basicInfo) => set({ basicInfo, loading: false })),
      subscribeToResumeDbCollection<Section>(uid, 'sections', (sections) => set({ sections })),
      subscribeToResumeDbCollection<Entry>(uid, 'entries', (entries) => set({ entries })),
      subscribeToResumeDbCollection<Bullet>(uid, 'bullets', (bullets) => set({ bullets })),
      subscribeToResumeDbCollection<SkillRow>(uid, 'skillRows', (skillRows) => set({ skillRows })),
      subscribeToResumeDbCollection<Skill>(uid, 'skills', (skills) => set({ skills })),
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

  async addSection(displayName, sectionType) {
    const uid = get().uid
    if (!uid) return
    const latex = generateSectionLatex(displayName)
    const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(latex)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: '',
      existingEmbedding: null,
    })
    await createResumeDbDoc(uid, 'sections', {
      displayName,
      latex,
      isLatexOverridden: false,
      ...semantic,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(get().sections),
      sectionType,
    })
  },

  async updateSection(id, patch) {
    const uid = get().uid
    if (!uid) return
    const data: Record<string, unknown> = {}
    if (patch.fields) data.displayName = patch.fields.displayName
    if (patch.latex !== undefined) {
      data.latex = patch.latex
      const existing = get().sections.find((section) => section.id === id)
      const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(patch.latex)
      Object.assign(
        data,
        await computeSemanticFields({
          uid,
          semanticText,
          existingSemanticTextHash: existing?.semanticTextHash ?? '',
          existingEmbedding: existing?.embedding ?? null,
        }),
      )
    }
    if (patch.isLatexOverridden !== undefined) data.isLatexOverridden = patch.isLatexOverridden
    await updateResumeDbDoc(uid, 'sections', id, data)
  },

  async deleteSection(id) {
    const uid = get().uid
    if (!uid) return
    const { entries, bullets, skillRows, skills } = get()
    const entryIds = entries.filter((entry) => entry.sectionId === id).map((entry) => entry.id)
    const bulletIds = bullets.filter((bullet) => bullet.sectionId === id).map((bullet) => bullet.id)
    const skillRowIds = skillRows.filter((row) => row.sectionId === id).map((row) => row.id)
    const skillIds = skills
      .filter((skill) => skillRowIds.includes(skill.skillRowId))
      .map((skill) => skill.id)
    await Promise.all([
      ...bulletIds.map((bulletId) => deleteResumeDbDoc(uid, 'bullets', bulletId)),
      ...entryIds.map((entryId) => deleteResumeDbDoc(uid, 'entries', entryId)),
      ...skillIds.map((skillId) => deleteResumeDbDoc(uid, 'skills', skillId)),
      ...skillRowIds.map((rowId) => deleteResumeDbDoc(uid, 'skillRows', rowId)),
    ])
    await deleteResumeDbDoc(uid, 'sections', id)
  },

  async reorderSections(orderedIds) {
    const uid = get().uid
    if (!uid) return
    await reorderResumeDbDocs(uid, 'sections', orderedIds)
  },

  async addEntry(sectionId, fields) {
    const uid = get().uid
    if (!uid) return
    const siblingEntries = get().entries.filter((entry) => entry.sectionId === sectionId)
    const semanticText = await getSemanticTextProvider().generateEntrySemanticText(fields, [])
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: '',
      existingEmbedding: null,
    })
    await createResumeDbDoc(uid, 'entries', {
      sectionId,
      fields,
      latex: generateEntryLatex(fields, getActiveTemplate()),
      isLatexOverridden: false,
      ...semantic,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingEntries),
    })
  },

  async updateEntry(id, patch) {
    const uid = get().uid
    if (!uid) return
    const data: Record<string, unknown> = {}
    if (patch.fields) {
      data.fields = patch.fields
      const existing = get().entries.find((entry) => entry.id === id)
      // Snapshot of sibling bullets as of *this* save — editing a bullet afterward
      // without re-saving the entry won't retroactively refresh this text.
      const bulletTexts = get()
        .bullets.filter((bullet) => bullet.entryId === id)
        .map((bullet) => bullet.text)
      const semanticText = await getSemanticTextProvider().generateEntrySemanticText(patch.fields, bulletTexts)
      Object.assign(
        data,
        await computeSemanticFields({
          uid,
          semanticText,
          existingSemanticTextHash: existing?.semanticTextHash ?? '',
          existingEmbedding: existing?.embedding ?? null,
        }),
      )
    }
    if (patch.latex !== undefined) data.latex = patch.latex
    if (patch.isLatexOverridden !== undefined) data.isLatexOverridden = patch.isLatexOverridden
    await updateResumeDbDoc(uid, 'entries', id, data)
  },

  async deleteEntry(id) {
    const uid = get().uid
    if (!uid) return
    const bulletIds = get()
      .bullets.filter((bullet) => bullet.entryId === id)
      .map((bullet) => bullet.id)
    await Promise.all(bulletIds.map((bulletId) => deleteResumeDbDoc(uid, 'bullets', bulletId)))
    await deleteResumeDbDoc(uid, 'entries', id)
  },

  async reorderEntries(orderedIds) {
    const uid = get().uid
    if (!uid) return
    await reorderResumeDbDocs(uid, 'entries', orderedIds)
  },

  async addBullet(entryId, sectionId, text) {
    const uid = get().uid
    if (!uid) return
    const siblingBullets = get().bullets.filter((bullet) => bullet.entryId === entryId)
    const latex = generateBulletLatex(text, getActiveTemplate())
    const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(latex)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: '',
      existingEmbedding: null,
    })
    await createResumeDbDoc(uid, 'bullets', {
      entryId,
      sectionId,
      text,
      latex,
      isLatexOverridden: false,
      ...semantic,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingBullets),
    })
  },

  async updateBullet(id, patch) {
    const uid = get().uid
    if (!uid) return
    const data: Record<string, unknown> = {}
    if (patch.fields) data.text = patch.fields.text
    if (patch.latex !== undefined) {
      data.latex = patch.latex
      const existing = get().bullets.find((bullet) => bullet.id === id)
      const semanticText = await getSemanticTextProvider().generateSectionOrBulletSemanticText(patch.latex)
      Object.assign(
        data,
        await computeSemanticFields({
          uid,
          semanticText,
          existingSemanticTextHash: existing?.semanticTextHash ?? '',
          existingEmbedding: existing?.embedding ?? null,
        }),
      )
    }
    if (patch.isLatexOverridden !== undefined) data.isLatexOverridden = patch.isLatexOverridden
    await updateResumeDbDoc(uid, 'bullets', id, data)
  },

  async deleteBullet(id) {
    const uid = get().uid
    if (!uid) return
    await deleteResumeDbDoc(uid, 'bullets', id)
  },

  async reorderBullets(orderedIds) {
    const uid = get().uid
    if (!uid) return
    await reorderResumeDbDocs(uid, 'bullets', orderedIds)
  },

  async addSkillRow(sectionId, categoryName) {
    const uid = get().uid
    if (!uid) return
    const siblingRows = get().skillRows.filter((row) => row.sectionId === sectionId)
    await createResumeDbDoc(uid, 'skillRows', {
      sectionId,
      categoryName,
      latex: generateSkillRowLatex(categoryName, getActiveTemplate()),
      isLatexOverridden: false,
      order: nextOrder(siblingRows),
    })
  },

  async updateSkillRow(id, patch) {
    const uid = get().uid
    if (!uid) return
    const data: Record<string, unknown> = {}
    if (patch.fields) data.categoryName = patch.fields.categoryName
    if (patch.latex !== undefined) data.latex = patch.latex
    if (patch.isLatexOverridden !== undefined) data.isLatexOverridden = patch.isLatexOverridden
    await updateResumeDbDoc(uid, 'skillRows', id, data)
  },

  async deleteSkillRow(id) {
    const uid = get().uid
    if (!uid) return
    const skillIds = get()
      .skills.filter((skill) => skill.skillRowId === id)
      .map((skill) => skill.id)
    await Promise.all(skillIds.map((skillId) => deleteResumeDbDoc(uid, 'skills', skillId)))
    await deleteResumeDbDoc(uid, 'skillRows', id)
  },

  async reorderSkillRows(orderedIds) {
    const uid = get().uid
    if (!uid) return
    await reorderResumeDbDocs(uid, 'skillRows', orderedIds)
  },

  async addSkill(skillRowId, displayName) {
    const uid = get().uid
    if (!uid) return
    const siblingSkills = get().skills.filter((skill) => skill.skillRowId === skillRowId)
    const semanticText = await getSemanticTextProvider().generateSkillSemanticText(displayName)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: '',
      existingEmbedding: null,
    })
    await createResumeDbDoc(uid, 'skills', {
      skillRowId,
      displayName,
      ...semantic,
      mustInclude: DEFAULT_MUST_INCLUDE,
      order: nextOrder(siblingSkills),
    })
  },

  async updateSkill(id, displayName) {
    const uid = get().uid
    if (!uid) return
    const existing = get().skills.find((skill) => skill.id === id)
    const semanticText = await getSemanticTextProvider().generateSkillSemanticText(displayName)
    const semantic = await computeSemanticFields({
      uid,
      semanticText,
      existingSemanticTextHash: existing?.semanticTextHash ?? '',
      existingEmbedding: existing?.embedding ?? null,
    })
    await updateResumeDbDoc(uid, 'skills', id, { displayName, ...semantic })
  },

  async deleteSkill(id) {
    const uid = get().uid
    if (!uid) return
    await deleteResumeDbDoc(uid, 'skills', id)
  },

  async reorderSkills(orderedIds) {
    const uid = get().uid
    if (!uid) return
    await reorderResumeDbDocs(uid, 'skills', orderedIds)
  },

  async setMustInclude(collectionName, id, mustInclude) {
    const uid = get().uid
    if (!uid) return
    await updateResumeDbDoc(uid, collectionName, id, { mustInclude })
  },
}))
