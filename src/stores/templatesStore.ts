import { create } from 'zustand'
import {
  createResumeDbDoc,
  deleteResumeDbDoc,
  getResumeDbCollectionDocs,
  resumeDbCollectionIsEmpty,
  setActiveTemplateId as setActiveTemplateIdDoc,
  subscribeToActiveTemplateId,
  subscribeToResumeDbCollection,
  updateResumeDbDoc,
} from '../lib/firebase/firestoreCollection'
import { JAKES_RESUME_TEMPLATE } from '../lib/template/jakesResumeTemplate'
import type { ResumeTemplate } from '../types/template'

const BUILT_IN_TEMPLATE_FIELDS = [
  'name',
  'latexPreamble',
  'latexPostamble',
  'mainBodyLatex',
  'sectionWrapperLatex',
  'entryWrapperLatex',
  'bulletWrapperLatex',
  'bulletListWrapperLatex',
  'skillRowWrapperLatex',
  'skillListSeparator',
  'headerWrapperLatex',
] as const satisfies readonly Exclude<keyof ResumeTemplate, 'id' | 'isBuiltIn'>[]

function builtInSeedData(): Record<string, string> {
  return Object.fromEntries(BUILT_IN_TEMPLATE_FIELDS.map((field) => [field, JAKES_RESUME_TEMPLATE[field]]))
}

async function ensureDefaultTemplateSeeded(uid: string): Promise<void> {
  const isEmpty = await resumeDbCollectionIsEmpty(uid, 'templates')
  if (isEmpty) {
    const newId = await createResumeDbDoc(uid, 'templates', {
      ...builtInSeedData(),
      isBuiltIn: true,
      order: 0,
    })
    await setActiveTemplateIdDoc(uid, newId)
    return
  }

  const existingTemplates = await getResumeDbCollectionDocs<ResumeTemplate>(uid, 'templates')

  // Backfill: accounts that seeded Jake's Resume before `isBuiltIn` existed
  // never got the flag written, since seeding only runs once per account.
  // Also covers accounts already correctly flagged.
  const builtIn = existingTemplates.find(
    (template) =>
      template.isBuiltIn ||
      (template.name === JAKES_RESUME_TEMPLATE.name && template.latexPreamble === JAKES_RESUME_TEMPLATE.latexPreamble),
  )
  if (!builtIn) return

  // Self-heal: the built-in template is read-only, so it's always safe to
  // resync it to the current seed data — this is how fixes to the seed
  // constant (e.g. a Tectonic-incompatible preamble line) reach accounts
  // that already seeded a copy, not just new signups.
  const seedData = builtInSeedData()
  const needsUpdate =
    !builtIn.isBuiltIn || BUILT_IN_TEMPLATE_FIELDS.some((field) => builtIn[field] !== seedData[field])
  if (needsUpdate) {
    await updateResumeDbDoc(uid, 'templates', builtIn.id, { ...seedData, isBuiltIn: true })
  }
}

interface TemplatesState {
  uid: string | null
  loading: boolean
  templates: ResumeTemplate[]
  activeTemplateId: string | null

  subscribe: (uid: string) => void
  unsubscribeAll: () => void

  createTemplate: (name: string, base: Omit<ResumeTemplate, 'id' | 'name'>) => Promise<string>
  updateTemplate: (id: string, patch: Partial<Omit<ResumeTemplate, 'id'>>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setActiveTemplate: (id: string) => Promise<void>
}

/** Selector: the live active template, falling back to the seed constant while data is still loading. */
export function selectActiveTemplate(
  state: Pick<TemplatesState, 'templates' | 'activeTemplateId'>,
): ResumeTemplate {
  return state.templates.find((template) => template.id === state.activeTemplateId) ?? JAKES_RESUME_TEMPLATE
}

/** Non-reactive read for use in plain (non-React) code, e.g. resumeDbStore actions. */
export function getActiveTemplate(): ResumeTemplate {
  return selectActiveTemplate(useTemplatesStore.getState())
}

let unsubscribers: Array<() => void> = []

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  uid: null,
  loading: true,
  templates: [],
  activeTemplateId: null,

  subscribe(uid) {
    if (get().uid === uid) return
    get().unsubscribeAll()
    set({ uid, loading: true })

    void ensureDefaultTemplateSeeded(uid).finally(() => {
      if (get().uid !== uid) return
      unsubscribers.push(
        subscribeToResumeDbCollection<ResumeTemplate>(uid, 'templates', (templates) =>
          set({ templates, loading: false }),
        ),
        subscribeToActiveTemplateId(uid, (activeTemplateId) => set({ activeTemplateId })),
      )
    })
  },

  unsubscribeAll() {
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers = []
    set({ uid: null, loading: true, templates: [], activeTemplateId: null })
  },

  async createTemplate(name, base) {
    const uid = get().uid
    if (!uid) return ''
    const newId = await createResumeDbDoc(uid, 'templates', {
      ...base,
      name,
      isBuiltIn: false,
      // Not part of ResumeTemplate's shape — exists purely so the generic
      // orderBy('order') query in subscribeToResumeDbCollection includes this doc.
      order: get().templates.length,
    })
    return newId
  },

  async updateTemplate(id, patch) {
    const uid = get().uid
    if (!uid) return
    const existing = get().templates.find((template) => template.id === id)
    if (existing?.isBuiltIn) {
      throw new Error("Jake's Resume is a read-only default — duplicate it to make changes.")
    }
    await updateResumeDbDoc(uid, 'templates', id, patch)
  },

  async deleteTemplate(id) {
    const uid = get().uid
    if (!uid) return
    const existing = get().templates.find((template) => template.id === id)
    if (existing?.isBuiltIn) {
      throw new Error("Jake's Resume is a read-only default and can't be deleted.")
    }
    await deleteResumeDbDoc(uid, 'templates', id)
  },

  async setActiveTemplate(id) {
    const uid = get().uid
    if (!uid) return
    await setActiveTemplateIdDoc(uid, id)
  },
}))
