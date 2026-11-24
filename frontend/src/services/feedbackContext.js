/**
 * Where a report came from, and which build sent it.
 *
 * Pure: the caller passes a pathname, so the same helpers work in a browser and
 * in a test run. The backend caps every field; these are the client's mirror.
 */

const LEVEL_STAGE = /^\/level\/(\d+)\/stage\/(\d+)/

/**
 * The build label attached to a report.
 *
 * A deploy can pin it with VITE_APP_VERSION (a commit sha works); without it the
 * Vite mode tells us production from development, which is the question that
 * actually matters when a bug will not reproduce.
 */
export const APP_VERSION = import.meta.env?.VITE_APP_VERSION || import.meta.env?.MODE || 'unknown'

/**
 * Split a pathname into the page and the puzzle coordinates inside it.
 * @param {string} pathname
 * @returns {{ page: string, context: { levelId: number, stageIdx: number } | null }}
 */
export function describeLocation(pathname) {
  const path = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : '/'
  const match = LEVEL_STAGE.exec(path)
  if (!match) return { page: path, context: null }
  return {
    page: path,
    context: { levelId: Number(match[1]), stageIdx: Number(match[2]) },
  }
}
