// eslint-disable-next-line no-control-regex -- intentional terminal escape sequence matching
const OSC_TITLE_RE = /\x1b\]([012]);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g

/**
 * Extract the last OSC title-set sequence from raw PTY data.
 * Agent CLIs set OSC titles to announce identity and status.
 */
export function extractLastOscTitle(data: string): string | null {
  if (!data.includes('\x1b]')) {
    return null
  }
  let last: string | null = null
  for (const m of data.matchAll(OSC_TITLE_RE)) {
    last = m[2]
  }
  return last
}

/**
 * Extract all OSC title-set sequences from raw PTY data, in order.
 * Why separate from extractLastOscTitle: coalesced PTY chunks can contain both
 * working and idle transitions, and UI status trackers need each title.
 */
export function extractAllOscTitles(data: string): string[] {
  if (!data.includes('\x1b]')) {
    return []
  }
  const titles: string[] = []
  for (const m of data.matchAll(OSC_TITLE_RE)) {
    titles.push(m[2])
  }
  return titles
}
