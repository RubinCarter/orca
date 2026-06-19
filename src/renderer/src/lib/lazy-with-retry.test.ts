// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'

import { loadLazyWithRetry } from './lazy-with-retry'

const RELOAD_GUARD_KEY = 'orca:lazy-chunk-reload-attempted'
const Comp: ComponentType = () => null
const chunkParseError = (): SyntaxError => new SyntaxError("Unexpected token ']'")

function spyOnReload(): ReturnType<typeof vi.fn> {
  const reload = vi.fn()
  // happy-dom's location.reload is a no-op that would otherwise log; replace it.
  vi.spyOn(window.location, 'reload').mockImplementation(reload)
  return reload
}

beforeEach(() => {
  vi.useFakeTimers()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  try {
    window.sessionStorage.clear()
  } catch {
    // ignore — environment without storage
  }
})

describe('loadLazyWithRetry', () => {
  it('retries transient failures with backoff and then resolves', async () => {
    const reload = spyOnReload()
    const factory = vi
      .fn()
      .mockRejectedValueOnce(chunkParseError())
      .mockRejectedValueOnce(chunkParseError())
      .mockResolvedValueOnce({ default: Comp })

    const loaded = loadLazyWithRetry(factory, { retries: 2, baseDelayMs: 250 })
    await vi.advanceTimersByTimeAsync(5000)

    await expect(loaded).resolves.toEqual({ default: Comp })
    expect(factory).toHaveBeenCalledTimes(3)
    expect(reload).not.toHaveBeenCalled()
  })

  it('performs exactly one guarded reload after retries are exhausted', async () => {
    const reload = spyOnReload()
    const factory = vi.fn(() => Promise.reject(chunkParseError()))

    const loaded = loadLazyWithRetry(factory, { retries: 2, baseDelayMs: 250 })
    let settled = false
    void loaded.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await vi.advanceTimersByTimeAsync(5000)

    expect(factory).toHaveBeenCalledTimes(3)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(RELOAD_GUARD_KEY)).toBe('1')
    // The load promise must suspend (never settle) while the page reloads, so the
    // error boundary never flashes.
    expect(settled).toBe(false)
  })

  it('does NOT reload twice — re-throws once the guard is already set', async () => {
    const reload = spyOnReload()
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
    const error = chunkParseError()
    const factory = vi.fn(() => Promise.reject(error))

    const loaded = loadLazyWithRetry(factory, { retries: 2, baseDelayMs: 250 })
    const assertion = expect(loaded).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(5000)
    await assertion

    expect(reload).not.toHaveBeenCalled()
  })

  it('re-throws without reloading when there is no window (SSR / node)', async () => {
    vi.stubGlobal('window', undefined)
    const error = chunkParseError()
    const factory = vi.fn(() => Promise.reject(error))

    const loaded = loadLazyWithRetry(factory, { retries: 1, baseDelayMs: 100 })
    const assertion = expect(loaded).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(5000)
    await assertion

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('clears the reload guard after a successful load', async () => {
    spyOnReload()
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
    const factory = vi.fn(() => Promise.resolve({ default: Comp }))

    await loadLazyWithRetry(factory)

    expect(window.sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull()
  })
})
