import { create } from 'zustand'
import {
  createResumeDbDoc,
  deleteResumeDbDoc,
  resumeDbCollectionIsEmpty,
  setActiveTemplateId as setActiveTemplateIdDoc,
  subscribeToActiveTemplateId,
  subscribeToResumeDbCollection,
  updateResumeDbDoc,
} from '../lib/firebase/firestoreCollection'
import { JAKES_RESUME_TEMPLATE } from '../lib/template/jakesResumeTemplate'
import type { ResumeTemplate } from '../types/template'

async function ensureDefaultTemplateSeeded(uid: string): Promise<void> {
  const isEmpty = await resumeDbCollectionIsEmpty(uid, 'templates')
  if (!isEmpty) return

  const newId = await createResumeDbDoc(uid, 'templates', {
    name: JAKES_RESUME_TEMPLATE.name,
    latexPreamble: JAKES_RESUME_TEMPLATE.latexPreamble,
    latexPostamble: JAKES_RESUME_TEMPLATE.latexPostamble,
    mainBodyLatex: JAKES_RESUME_TEMPLATE.mainBodyLatex,
    sectionWrapperLatex: JAKES_RESUME_TEMPLATE.sectionWrapperLatex,
    entryWrapperLatex: JAKES_RESUME_TEMPLATE.entryWrapperLatex,
    bulletWrapperLatex: JAKES_RESUME_TEMPLATE.bulletWrapperLatex,
    bulletListWrapperLatex: JAKES_RESUME_TEMPLATE.bulletListWrapperLatex,
    skillRowWrapperLatex: JAKES_RESUME_TEMPLATE.skillRowWrapperLatex,
    skillListSeparator: JAKES_RESUME_TEMPLATE.skillListSeparator,
    headerWrapperLatex: JAKES_RESUME_TEMPLATE.headerWrapperLatex,
    order: 0,
  })
  await setActiveTemplateIdDoc(uid, newId)
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
      // Not part of ResumeTemplate's shape — exists purely so the generic
      // orderBy('order') query in subscribeToResumeDbCollection includes this doc.
      order: get().templates.length,
    })
    return newId
  },

  async updateTemplate(id, patch) {
    const uid = get().uid
    if (!uid) return
    await updateResumeDbDoc(uid, 'templates', id, patch)
  },

  async deleteTemplate(id) {
    const uid = get().uid
    if (!uid) return
    await deleteResumeDbDoc(uid, 'templates', id)
  },

  async setActiveTemplate(id) {
    const uid = get().uid
    if (!uid) return
    await setActiveTemplateIdDoc(uid, id)
  },
}))
