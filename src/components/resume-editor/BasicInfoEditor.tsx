import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { useResumeDbStore } from '../../stores/resumeDbStore'
import { useTemplatesStore, selectActiveTemplate } from '../../stores/templatesStore'
import { useDraftEntity } from '../../hooks/useDraftEntity'
import { generateBasicInfoLatex } from '../../lib/template/generateDefaultLatex'
import { LatexOverrideSection } from './LatexOverrideSection'
import type { BasicInfoFields } from '../../types/resumeDb'

const EMPTY_FIELDS: BasicInfoFields = { name: '', email: '', phone: '', location: '', links: [] }

export function BasicInfoEditor() {
  const basicInfo = useResumeDbStore((state) => state.basicInfo)
  const saveBasicInfo = useResumeDbStore((state) => state.saveBasicInfo)
  const activeTemplate = useTemplatesStore(selectActiveTemplate)

  const { fields, updateFields, latex, isLatexOverridden, setLatex, revertToAutoLatex } = useDraftEntity(
    {
      key: 'basicInfo',
      fields: basicInfo?.fields ?? EMPTY_FIELDS,
      latex: basicInfo?.latex ?? '',
      isLatexOverridden: basicInfo?.isLatexOverridden ?? false,
      generateLatex: (f) => generateBasicInfoLatex(f, activeTemplate),
      onFlush: saveBasicInfo,
    },
  )

  function updateLink(index: number, patch: Partial<{ label: string; url: string }>) {
    updateFields((prev) => ({
      ...prev,
      links: prev.links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    }))
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-900">Basic info</h2>
      <div className="flex flex-col gap-3">
        <Input
          id="basic-info-name"
          label="Name"
          value={fields.name}
          onChange={(e) => updateFields((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Input
          id="basic-info-email"
          label="Email"
          value={fields.email}
          onChange={(e) => updateFields((prev) => ({ ...prev, email: e.target.value }))}
        />
        <Input
          id="basic-info-phone"
          label="Phone"
          value={fields.phone}
          onChange={(e) => updateFields((prev) => ({ ...prev, phone: e.target.value }))}
        />
        <Input
          id="basic-info-location"
          label="Location"
          value={fields.location}
          onChange={(e) => updateFields((prev) => ({ ...prev, location: e.target.value }))}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Links</span>
          {fields.links.map((link, index) => (
            <div key={index} className="flex items-end gap-2">
              <Input
                id={`basic-info-link-label-${index}`}
                label="Label"
                value={link.label}
                onChange={(e) => updateLink(index, { label: e.target.value })}
              />
              <Input
                id={`basic-info-link-url-${index}`}
                label="URL"
                value={link.url}
                onChange={(e) => updateLink(index, { url: e.target.value })}
              />
              <Button
                type="button"
                className="w-auto bg-white px-3 py-2 text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                onClick={() =>
                  updateFields((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            className="w-auto bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            onClick={() => updateFields((prev) => ({ ...prev, links: [...prev.links, { label: '', url: '' }] }))}
          >
            Add link
          </Button>
        </div>
      </div>
      <LatexOverrideSection
        latex={latex}
        isLatexOverridden={isLatexOverridden}
        onChange={setLatex}
        onRevertToAuto={revertToAutoLatex}
      />
    </section>
  )
}
