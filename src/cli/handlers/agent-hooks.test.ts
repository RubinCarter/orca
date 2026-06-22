import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultPersistedState } from '../../shared/constants'
import type { PersistedState } from '../../shared/types'
import type { HandlerContext } from '../dispatch'
import { RuntimeClient } from '../runtime-client'

const {
  applyAgentStatusHooksEnabledMock,
  getDefaultUserDataPathMock,
  getManagedAgentHookStatusesMock
} = vi.hoisted(() => ({
  applyAgentStatusHooksEnabledMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(),
  getManagedAgentHookStatusesMock: vi.fn()
}))

vi.mock('../runtime-client', () => {
  class RuntimeClient {
    getCliStatus = vi.fn()
    call = vi.fn()
  }

  class RuntimeClientError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }

  return {
    RuntimeClient,
    RuntimeClientError,
    getDefaultUserDataPath: getDefaultUserDataPathMock
  }
})

vi.mock('../../main/agent-hooks/managed-agent-hook-controls', () => ({
  applyAgentStatusHooksEnabled: applyAgentStatusHooksEnabledMock,
  getManagedAgentHookStatuses: getManagedAgentHookStatusesMock
}))

import { AGENT_HOOK_HANDLERS } from './agent-hooks'

function readDataFile(userDataPath: string): PersistedState {
  return JSON.parse(readFileSync(join(userDataPath, 'orca-data.json'), 'utf-8')) as PersistedState
}

function writeDataFile(userDataPath: string, state: PersistedState): void {
  mkdirSync(userDataPath, { recursive: true })
  writeFileSync(join(userDataPath, 'orca-data.json'), JSON.stringify(state, null, 2), 'utf-8')
}

function createOfflineClient(): HandlerContext['client'] {
  const client = new RuntimeClient()
  vi.spyOn(client, 'getCliStatus').mockResolvedValue({
    id: 'test-status',
    ok: true,
    result: {
      app: { running: false, pid: null },
      runtime: { state: 'not_running', reachable: false, runtimeId: null },
      graph: { state: 'not_running' }
    },
    _meta: { runtimeId: 'test' }
  })
  vi.spyOn(client, 'call').mockRejectedValue(new Error('runtime offline'))
  return client
}

async function runAgentHooksOff(userDataPath: string): Promise<void> {
  getDefaultUserDataPathMock.mockReturnValue(userDataPath)
  await AGENT_HOOK_HANDLERS['agent hooks off']({
    flags: new Map(),
    client: createOfflineClient(),
    cwd: userDataPath,
    json: true
  })
}

describe('agent hooks CLI handler', () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'orca-agent-hooks-cli-'))
    applyAgentStatusHooksEnabledMock.mockReturnValue([])
    getManagedAgentHookStatusesMock.mockReturnValue([])
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('keeps the fresh-profile new card style default when creating offline settings', async () => {
    await runAgentHooksOff(userDataPath)

    const persisted = readDataFile(userDataPath)

    expect(persisted.settings.experimentalNewWorktreeCardStyle).toBe(true)
    expect(persisted.settings.agentStatusHooksEnabled).toBe(false)
  })

  it('defaults missing new card style on while offline-updated onboarding is open', async () => {
    const existing = getDefaultPersistedState(userDataPath)
    delete existing.settings.experimentalNewWorktreeCardStyle
    writeDataFile(userDataPath, existing)

    await runAgentHooksOff(userDataPath)

    expect(readDataFile(userDataPath).settings.experimentalNewWorktreeCardStyle).toBe(true)
  })

  it('preserves an existing explicit new card style opt-out when updating offline settings', async () => {
    const existing = getDefaultPersistedState(userDataPath)
    existing.settings.experimentalNewWorktreeCardStyle = false
    writeDataFile(userDataPath, existing)

    await runAgentHooksOff(userDataPath)

    expect(readDataFile(userDataPath).settings.experimentalNewWorktreeCardStyle).toBe(false)
  })
})
