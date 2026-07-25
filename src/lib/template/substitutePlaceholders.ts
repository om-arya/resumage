/**
 * Replaces only the `{{KEY}}` placeholders present in `values`; any other
 * `{{KEY}}` in `template` is left untouched. This lets callers partially
 * resolve a wrapper string now (e.g. entry fields) and leave the rest
 * (e.g. {{BULLETS}}) for a later render pass once child entities are known.
 */
export function substitutePlaceholders(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value),
    template,
  )
}
