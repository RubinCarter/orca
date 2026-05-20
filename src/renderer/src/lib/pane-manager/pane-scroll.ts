import type { Terminal } from '@xterm/xterm'
import type { ScrollState } from './pane-manager-types'

const terminalOutputEpochs = new WeakMap<Terminal, number>()
const deferredScrollRestores = new WeakMap<
  Terminal,
  {
    cancelled: boolean
    rafIds: number[]
    timeoutIds: ReturnType<typeof setTimeout>[]
  }
>()

export function recordTerminalOutput(terminal: Terminal): void {
  terminalOutputEpochs.set(terminal, getTerminalOutputEpoch(terminal) + 1)
}

export function getTerminalOutputEpoch(terminal: Terminal): number {
  return terminalOutputEpochs.get(terminal) ?? 0
}

export function cancelDeferredScrollRestore(terminal: Terminal): void {
  const pending = deferredScrollRestores.get(terminal)
  if (!pending) {
    return
  }
  pending.cancelled = true
  if (typeof cancelAnimationFrame === 'function') {
    for (const rafId of pending.rafIds) {
      cancelAnimationFrame(rafId)
    }
  }
  for (const timeoutId of pending.timeoutIds) {
    clearTimeout(timeoutId)
  }
  deferredScrollRestores.delete(terminal)
}

export function captureScrollState(terminal: Terminal): ScrollState {
  const buf = terminal.buffer.active
  return {
    bufferType: buf.type,
    wasAtBottom: buf.viewportY >= buf.baseY,
    viewportY: buf.viewportY,
    baseY: buf.baseY
  }
}

export function restoreScrollState(terminal: Terminal, state: ScrollState): void {
  cancelDeferredScrollRestore(terminal)
  restoreScrollStateNow(terminal, state)
}

export function restoreScrollStateAfterLayout(terminal: Terminal, state: ScrollState): void {
  cancelDeferredScrollRestore(terminal)
  restoreScrollStateNow(terminal, state)
  if (typeof requestAnimationFrame !== 'function') {
    return
  }

  const pending = {
    cancelled: false,
    rafIds: [] as number[],
    timeoutIds: [] as ReturnType<typeof setTimeout>[]
  }
  const restore = (): void => {
    if (!pending.cancelled) {
      restoreScrollStateNow(terminal, state)
    }
  }
  const cancelPendingRafs = (): void => {
    pending.cancelled = true
    if (typeof cancelAnimationFrame !== 'function') {
      return
    }
    for (const rafId of pending.rafIds) {
      cancelAnimationFrame(rafId)
    }
  }
  const firstRaf = requestAnimationFrame(() => {
    restore()
    if (pending.cancelled) {
      return
    }
    const secondRaf = requestAnimationFrame(restore)
    pending.rafIds.push(secondRaf)
  })
  const timeoutId = setTimeout(() => {
    if (!pending.cancelled) {
      restoreScrollStateNow(terminal, state)
    }
    // Why: background tabs can throttle rAF past the timeout. Once the
    // authoritative timeout restore has run, stale frame callbacks must not
    // later rewind a user-initiated scroll or follow-output jump.
    cancelPendingRafs()
    deferredScrollRestores.delete(terminal)
  }, 80)
  pending.rafIds.push(firstRaf)
  pending.timeoutIds.push(timeoutId)
  deferredScrollRestores.set(terminal, pending)
}

function restoreScrollStateNow(terminal: Terminal, state: ScrollState): void {
  const buf = terminal.buffer.active
  if (state.bufferType === 'alternate' || buf.type !== state.bufferType) {
    return
  }

  if (state.wasAtBottom) {
    terminal.scrollToBottom()
    forceViewportScrollbarSync(terminal)
    return
  }

  terminal.scrollToLine(Math.min(state.viewportY, buf.baseY))
  forceViewportScrollbarSync(terminal)
}

// Why: xterm 6 can leave its scrollbar thumb stale when ydisp is unchanged.
// A synchronous one-line jiggle updates the scrollbar without a visible paint.
function forceViewportScrollbarSync(terminal: Terminal): void {
  const buf = terminal.buffer.active
  if (buf.viewportY > 0) {
    terminal.scrollLines(-1)
    terminal.scrollLines(1)
  } else if (buf.viewportY < buf.baseY) {
    terminal.scrollLines(1)
    terminal.scrollLines(-1)
  }
}
