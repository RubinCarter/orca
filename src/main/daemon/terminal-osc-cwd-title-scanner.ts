import { extractLastOscTitle } from '../../shared/agent-detection'
import { parseFileUriPath } from './osc7-file-uri'

const OSC_SCAN_TAIL_LIMIT = 4096

function extractOscScanTail(input: string): string {
  const lastOsc = input.lastIndexOf('\x1b]')
  const lastEscape = input.endsWith('\x1b') ? input.length - 1 : -1
  const start = Math.max(lastOsc, lastEscape)
  if (start === -1) {
    return ''
  }
  const suffix = input.slice(start)
  if (suffix.includes('\x07') || suffix.includes('\x1b\\')) {
    return ''
  }
  return suffix.slice(-OSC_SCAN_TAIL_LIMIT)
}

/** Regex-side mirror of the OSC sequences the emulator tracks outside xterm:
 *  OSC 7 cwd updates and OSC 0/2 titles. Keeps an unterminated-sequence tail
 *  so sequences split across PTY chunks still parse. */
export class TerminalOscCwdTitleScanner {
  private scanTail = ''
  cwd: string | null = null
  lastTitle: string | null = null

  scan(data: string): void {
    const input = this.scanTail + data
    this.scanTail = extractOscScanTail(input)
    this.scanOsc7(input)
    const lastTitle = extractLastOscTitle(input)
    if (lastTitle !== null) {
      this.lastTitle = lastTitle
    }
  }

  private scanOsc7(data: string): void {
    // OSC-7 format: ESC ] 7 ; <uri> BEL  or  ESC ] 7 ; <uri> ST
    // BEL = \x07, ST = ESC \
    // oxlint-disable-next-line no-control-regex -- terminal escape sequences require control chars
    const osc7Re = /\x1b\]7;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
    let match: RegExpExecArray | null
    while ((match = osc7Re.exec(data)) !== null) {
      const parsed = parseFileUriPath(match[1])
      if (parsed) {
        this.cwd = parsed
      }
    }
  }
}
