import { describe, expect, it } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { TerminalTab } from '../../../../shared/types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { buildWorktreeAgentRows } from './worktree-agent-rows'

const PANE_KEY_1 = makePaneKey('tab-1', '22222222-2222-4222-8222-222222222222')
const PANE_KEY_2 = makePaneKey('tab-2', '33333333-3333-4333-8333-333333333333')

function makeTab(id: string, overrides?: Partial<TerminalTab>): TerminalTab {
  return {
    id,
    worktreeId: 'wt-1',
    ptyId: null,
    title: 'Claude',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

function makeEntry(
  paneKey: string,
  startedAt: number,
  overrides?: Partial<AgentStatusEntry>
): AgentStatusEntry {
  return {
    paneKey,
    state: 'done',
    stateStartedAt: startedAt,
    updatedAt: startedAt,
    stateHistory: [],
    prompt: 'finished prompt',
    agentType: 'claude',
    terminalTitle: undefined,
    interrupted: false,
    ...overrides
  }
}

function makeSleeping(
  paneKey: string,
  overrides?: Partial<SleepingAgentSessionRecord>
): SleepingAgentSessionRecord {
  return {
    paneKey,
    tabId: paneKey.slice(0, paneKey.indexOf(':')),
    worktreeId: 'wt-1',
    agent: 'codex',
    providerSession: { key: 'session_id', id: 'session-1' },
    prompt: 'previous prompt',
    state: 'done',
    capturedAt: 2500,
    updatedAt: 2600,
    terminalTitle: 'Codex',
    origin: 'worktree-sleep',
    ...overrides
  }
}

describe('buildWorktreeAgentRows sleeping rows', () => {
  it('appends activation-consumable sleeping records as muted slept rows', () => {
    const rows = buildWorktreeAgentRows({
      tabs: [makeTab('tab-1')],
      entries: [makeEntry(PANE_KEY_1, 1000, { state: 'done', prompt: 'finished' })],
      retained: [],
      sleeping: [makeSleeping(PANE_KEY_2, { capturedAt: 500, updatedAt: 700 })],
      now: 3000
    })

    expect(rows.map((row) => row.paneKey)).toEqual([PANE_KEY_1, PANE_KEY_2])
    expect(rows[1]).toMatchObject({
      sleeping: true,
      state: 'idle',
      agentType: 'codex',
      startedAt: 500,
      entry: {
        state: 'done',
        prompt: '',
        lastAssistantMessage: 'Slept · resume saved',
        providerSession: { key: 'session_id', id: 'session-1' }
      },
      tab: {
        id: 'tab-2',
        worktreeId: 'wt-1',
        launchAgent: 'codex'
      }
    })
  })

  it('derives sleeping row entry tab ids from legacy pane keys when missing', () => {
    const rows = buildWorktreeAgentRows({
      tabs: [],
      entries: [],
      retained: [],
      sleeping: [makeSleeping(PANE_KEY_2, { tabId: undefined })],
      now: 3000
    })

    expect(rows[0]).toMatchObject({
      sleeping: true,
      entry: { tabId: 'tab-2' },
      tab: { id: 'tab-2' }
    })
  })

  it('does not show quit-origin sleeping records or exact duplicates of visible rows', () => {
    const rows = buildWorktreeAgentRows({
      tabs: [makeTab('tab-1')],
      entries: [makeEntry(PANE_KEY_1, 1000, { state: 'done', prompt: 'finished' })],
      retained: [],
      sleeping: [
        makeSleeping(PANE_KEY_1, { capturedAt: 500 }),
        makeSleeping(PANE_KEY_2, { origin: 'quit' })
      ],
      now: 3000
    })

    expect(rows.map((row) => row.paneKey)).toEqual([PANE_KEY_1])
    expect(rows.some((row) => row.sleeping)).toBe(false)
  })

  it('does not show legacy sleeping records for tabs that already have visible rows', () => {
    const rows = buildWorktreeAgentRows({
      tabs: [makeTab('tab-1')],
      entries: [makeEntry(PANE_KEY_1, 1000, { state: 'done', prompt: 'finished' })],
      retained: [],
      sleeping: [
        makeSleeping('tab-1:1', {
          tabId: undefined,
          capturedAt: 500
        })
      ],
      now: 3000
    })

    expect(rows.map((row) => row.paneKey)).toEqual([PANE_KEY_1])
    expect(rows.some((row) => row.sleeping)).toBe(false)
  })

  it('does not show legacy sleeping records with tab ids for tabs that already have rows', () => {
    const rows = buildWorktreeAgentRows({
      tabs: [makeTab('tab-1')],
      entries: [makeEntry(PANE_KEY_1, 1000, { state: 'done', prompt: 'finished' })],
      retained: [],
      sleeping: [
        makeSleeping('tab-1:1', {
          tabId: 'tab-1',
          capturedAt: 500
        })
      ],
      now: 3000
    })

    expect(rows.map((row) => row.paneKey)).toEqual([PANE_KEY_1])
    expect(rows.some((row) => row.sleeping)).toBe(false)
  })
})
