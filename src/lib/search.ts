/**
 * Sanitizes a user-supplied search term for use in PostgREST ilike queries.
 *
 * Two distinct hazards are addressed:
 *   1. PostgREST structure chars — `,  (  )  '  "  \` break the .or() parser
 *      if left in the string; they are stripped entirely.
 *   2. SQL/ilike wildcard chars — `%` and `_` would act as wildcards, and `\`
 *      is the escape character; they are backslash-escaped so they match literally.
 *
 * Strip first, then escape, so the introduced backslashes are never stripped.
 * Returns an empty string when nothing usable remains.
 */
export function sanitizeSearchTerm(q: string): string {
  const stripped = q.replace(/[,()'"\\]/g, '').trim().slice(0, 80)
  return stripped.replace(/[%_\\]/g, '\\$&')
}
