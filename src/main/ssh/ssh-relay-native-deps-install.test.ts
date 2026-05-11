// Why: regression coverage for the npm-init bypass + node-pty load-test
// probe in `installNativeDeps`. The original "node-pty is not available"
// bug shipped because every layer that could have caught it (chained
// shell, redirected stderr, swallowing catch, weak presence probe) was
// silent. These tests pin the contract that:
//   1. package.json is written via SFTP BEFORE `npm install` runs (order)
//   2. `npm install` failures propagate so `.install-complete` is NOT
//      written by the deploy caller
//   3. the post-install probe uses `node -e require()` (load-test, not
//      mere directory presence) and warns clearly on MISSING
//   4. SSH-channel failures of the probe itself are NOT swallowed
//      (no `.catch(() => 'MISSING')` confusion)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app' }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('0.1.0+testhash')
}))

vi.mock('./relay-protocol', () => ({
  RELAY_VERSION: '0.1.0',
  RELAY_REMOTE_DIR: '.orca-remote',
  parseUnameToRelayPlatform: vi.fn().mockReturnValue('linux-x64'),
  RELAY_SENTINEL: 'ORCA-RELAY v0.1.0 READY\n',
  RELAY_SENTINEL_TIMEOUT_MS: 10_000
}))

vi.mock('./ssh-relay-deploy-helpers', () => ({
  uploadDirectory: vi.fn().mockResolvedValue(undefined),
  waitForSentinel: vi.fn().mockResolvedValue({
    write: vi.fn(),
    onData: vi.fn(),
    onClose: vi.fn()
  }),
  execCommand: vi.fn(),
  resolveRemoteNodePath: vi.fn().mockResolvedValue('/usr/bin/node')
}))

vi.mock('./ssh-relay-versioned-install', () => ({
  readLocalFullVersion: vi.fn().mockReturnValue('0.1.0+testhash'),
  computeRemoteRelayDir: (home: string, v: string) => `${home}/.orca-remote/relay-${v}`,
  isRelayAlreadyInstalled: vi.fn().mockResolvedValue(false),
  acquireInstallLock: vi.fn().mockResolvedValue(undefined),
  finalizeInstall: vi.fn().mockResolvedValue(undefined),
  abandonInstall: vi.fn().mockResolvedValue(undefined),
  gcOldRelayVersions: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./ssh-connection-utils', () => ({
  shellEscape: (s: string) => `'${s}'`
}))

import { deployAndLaunchRelay } from './ssh-relay-deploy'
import { execCommand } from './ssh-relay-deploy-helpers'
import { parseUnameToRelayPlatform } from './relay-protocol'
import {
  abandonInstall,
  finalizeInstall,
  isRelayAlreadyInstalled
} from './ssh-relay-versioned-install'
import type { SshConnection } from './ssh-connection'

type SftpWriteCapture = {
  paths: string[]
  contents: Record<string, string>
  // Number of execCommand calls observed at the moment ws.end() ran for each
  // captured path. Used to pin "package.json was written before npm install".
  execCallCountAtWrite: Record<string, number>
}

function makeMockConnection(capture: SftpWriteCapture): SshConnection {
  const sftpCreate = (): unknown => ({
    mkdir: vi.fn((_p: string, cb: (err: Error | null) => void) => cb(null)),
    on: vi.fn(),
    once: vi.fn(),
    createWriteStream: vi.fn().mockImplementation((path: string) => {
      capture.paths.push(path)
      let buf = ''
      let closeCb: (() => void) | undefined
      const stub = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'close') {
            closeCb = cb
          }
        }),
        end: vi.fn((data?: string) => {
          if (typeof data === 'string') {
            buf += data
          }
          capture.contents[path] = buf
          capture.execCallCountAtWrite[path] = vi.mocked(execCommand).mock.calls.length
          if (closeCb) {
            setTimeout(closeCb, 0)
          }
        })
      }
      // Why: production code uses ws.once('close', ...). The 'once' wrapper
      // delegates to the same handler-table as 'on' for the test mock.
      return Object.assign(stub, { once: stub.on })
    }),
    end: vi.fn()
  })
  return {
    exec: vi.fn().mockResolvedValue({
      on: vi.fn(),
      stderr: { on: vi.fn() },
      stdin: {},
      stdout: { on: vi.fn() },
      close: vi.fn()
    }),
    sftp: vi.fn().mockImplementation(() => Promise.resolve(sftpCreate()))
  } as unknown as SshConnection
}

type ExecResponse = string | { reject: string }

// Why: actual call order under our mocks is:
//   1: uname  2: $HOME  3: mkdir remoteDir (uploadRelay)
//   4: chmod +x node    5: npm install     6: chmod prebuilds
//   7: probe            8: socket DEAD     9: socket READY
function makeExecResponses(opts: {
  npmInstall: 'ok' | { reject: string }
  probe: 'ok' | 'missing' | { reject: string }
}): ExecResponse[] {
  return [
    'Linux x86_64',
    '/home/u',
    '', // mkdir remoteDir (uploadRelay)
    '', // chmod +x node
    opts.npmInstall === 'ok' ? '' : opts.npmInstall,
    '', // chmod prebuilds
    opts.probe === 'ok'
      ? 'ORCA-NPTY-PROBE-OK\n'
      : opts.probe === 'missing'
        ? 'require error: Cannot find module\nMISSING\n'
        : opts.probe,
    'DEAD',
    'READY'
  ]
}

describe('installNativeDeps (via deployAndLaunchRelay)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  const sftpCapture: SftpWriteCapture = {
    paths: [],
    contents: {},
    execCallCountAtWrite: {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Tests that throw mid-deploy leave unconsumed `mockResolvedValueOnce`
    // entries queued. Without resetting, the next test's first await consumes
    // a leaked response. clearAllMocks doesn't drop the queue (it only clears
    // .mock.calls), so we explicitly mockReset.
    vi.mocked(execCommand).mockReset()
    sftpCapture.paths.length = 0
    for (const k of Object.keys(sftpCapture.contents)) {
      delete sftpCapture.contents[k]
    }
    for (const k of Object.keys(sftpCapture.execCallCountAtWrite)) {
      delete sftpCapture.execCallCountAtWrite[k]
    }
    // Re-prime: factory mockReturnValue / mockResolvedValue survive
    // clearAllMocks, so this is just defense-in-depth in case a test does its
    // own resetAllMocks.
    vi.mocked(parseUnameToRelayPlatform).mockReturnValue('linux-x64')
    vi.mocked(isRelayAlreadyInstalled).mockResolvedValue(false)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  function feed(execResponses: ExecResponse[]): void {
    const mockExec = vi.mocked(execCommand)
    for (const r of execResponses) {
      if (typeof r === 'string') {
        mockExec.mockResolvedValueOnce(r)
      } else {
        mockExec.mockRejectedValueOnce(new Error(r.reject))
      }
    }
  }

  it('writes a hardcoded package.json BEFORE running npm install', async () => {
    const conn = makeMockConnection(sftpCapture)
    feed(makeExecResponses({ npmInstall: 'ok', probe: 'ok' }))

    await deployAndLaunchRelay(conn)

    const pkgPath = sftpCapture.paths.find((p) => p.endsWith('/package.json'))
    expect(pkgPath, 'package.json must be written via SFTP').toBeTruthy()

    const written = sftpCapture.contents[pkgPath as string]
    expect(written).toBeTruthy()
    const parsed = JSON.parse(written) as Record<string, unknown>
    expect(parsed.name).toBe('orca-relay')
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.private).toBe(true)
    // Why: pin commonjs so a future Node default flip doesn't silently
    // break `require('node-pty')`.
    expect(parsed.type).toBe('commonjs')

    const execCalls = vi.mocked(execCommand).mock.calls.map(([, c]) => c)
    const npmInstallIdx = execCalls.findIndex((c) => c.includes('npm install node-pty'))
    expect(npmInstallIdx).toBeGreaterThanOrEqual(0)
    // Pin actual ordering: number of execCommand calls observed at the moment
    // ws.end() ran for package.json must be < the index of `npm install`.
    // Catches a future refactor that fires SFTP-write and npm install via
    // Promise.all (where the final-state assertions above would still pass).
    const writeObservedAt = sftpCapture.execCallCountAtWrite[pkgPath as string]
    expect(writeObservedAt).toBeLessThanOrEqual(npmInstallIdx)
  })

  it('propagates a hard `npm install` failure so the deploy aborts before finalizeInstall', async () => {
    const conn = makeMockConnection(sftpCapture)
    feed(
      makeExecResponses({
        npmInstall: { reject: 'npm ERR! E404 Not Found node-pty' },
        probe: 'ok'
      })
    )

    await expect(deployAndLaunchRelay(conn)).rejects.toThrow(/npm ERR/)

    // The crucial regression: `.install-complete` must NOT have been written.
    // Previously the catch swallowed the throw and finalizeInstall ran anyway.
    expect(vi.mocked(finalizeInstall)).not.toHaveBeenCalled()

    const warnMessages = warnSpy.mock.calls.map((args) => String(args[0] ?? ''))
    expect(warnMessages.some((m) => m.includes('[ssh-relay][NPTY-INSTALL-FAIL]'))).toBe(true)
  })

  it('warns clearly when node-pty installs but require() fails (built-but-unloadable)', async () => {
    const conn = makeMockConnection(sftpCapture)
    feed(makeExecResponses({ npmInstall: 'ok', probe: 'missing' }))

    await deployAndLaunchRelay(conn)

    // Probe failure is non-fatal (graceful degradation), but it MUST log the
    // greppable token so a user filing a bug pastes something that points
    // at the real cause.
    const warnMessages = warnSpy.mock.calls.map((args) => String(args[0] ?? ''))
    expect(warnMessages.some((m) => m.includes('[ssh-relay][NPTY-MISSING]'))).toBe(true)

    // finalizeInstall still runs — relay can serve fs/git/preflight.
    expect(vi.mocked(finalizeInstall)).toHaveBeenCalled()
  })

  it('lets a probe SSH-channel failure bubble up rather than silently mapping to MISSING', async () => {
    const conn = makeMockConnection(sftpCapture)
    feed(
      makeExecResponses({
        npmInstall: 'ok',
        probe: { reject: 'SSH channel closed unexpectedly' }
      })
    )

    await expect(deployAndLaunchRelay(conn)).rejects.toThrow(/SSH channel/)

    // Pin that the rejection actually came from the PROBE call (not some
    // earlier/later exec). Drift in slot ordering would otherwise let this
    // test pass while exercising a different failure path.
    const execCalls = vi.mocked(execCommand).mock.calls.map(([, c]) => c)
    const probeCallIdx = execCalls.findIndex((c) => c.includes('require("node-pty")'))
    expect(probeCallIdx, 'probe must have been invoked').toBeGreaterThanOrEqual(0)

    const warnMessages = warnSpy.mock.calls.map((args) => String(args[0] ?? ''))
    // Channel failure must NOT be conflated with "node-pty missing" or with
    // "npm install failed".
    expect(warnMessages.some((m) => m.includes('[ssh-relay][NPTY-MISSING]'))).toBe(false)
    expect(warnMessages.some((m) => m.includes('[ssh-relay][NPTY-INSTALL-FAIL]'))).toBe(false)

    expect(vi.mocked(finalizeInstall)).not.toHaveBeenCalled()
    // Lock must be released so a future reconnect can retry.
    expect(vi.mocked(abandonInstall)).toHaveBeenCalledTimes(1)
  })

  it('uses `node -e require()` rather than `test -d` so unloadable installs are caught', async () => {
    const conn = makeMockConnection(sftpCapture)
    feed(makeExecResponses({ npmInstall: 'ok', probe: 'ok' }))

    await deployAndLaunchRelay(conn)

    const probeCmds = vi
      .mocked(execCommand)
      .mock.calls.map(([, c]) => c)
      .filter((c) => c.includes(`require("node-pty")`))

    // Why: the probe shape must invoke the deployed node binary against
    // require('node-pty'). A weaker probe (test -d) could pass even when
    // the native binding load is broken.
    expect(probeCmds.length).toBeGreaterThan(0)
    expect(probeCmds[0]).toMatch(/node['"]?\s+-e/)
  })

  it('writes an idempotent package.json (same bytes on every install)', async () => {
    // First install run.
    const conn1 = makeMockConnection(sftpCapture)
    feed(makeExecResponses({ npmInstall: 'ok', probe: 'ok' }))
    await deployAndLaunchRelay(conn1)
    const firstPath = sftpCapture.paths.find((p) => p.endsWith('/package.json')) as string
    const first = sftpCapture.contents[firstPath]

    // Reset capture, run again as if it were a fresh install of the same dir.
    sftpCapture.paths.length = 0
    for (const k of Object.keys(sftpCapture.contents)) {
      delete sftpCapture.contents[k]
    }
    for (const k of Object.keys(sftpCapture.execCallCountAtWrite)) {
      delete sftpCapture.execCallCountAtWrite[k]
    }
    vi.mocked(execCommand).mockReset()

    const conn2 = makeMockConnection(sftpCapture)
    feed(makeExecResponses({ npmInstall: 'ok', probe: 'ok' }))
    await deployAndLaunchRelay(conn2)
    const secondPath = sftpCapture.paths.find((p) => p.endsWith('/package.json')) as string
    const second = sftpCapture.contents[secondPath]

    expect(second).toBe(first)
  })
})
