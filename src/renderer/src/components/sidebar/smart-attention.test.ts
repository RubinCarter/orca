import { describe, expect, it } from 'vitest'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStateHistoryEntry,
  type AgentStatusEntry
} from '../../../../shared/agent-status-types'
import {
  IDLE,
  buildAttentionByWorktree,
  mostRecentAttentionInHistory,
  resolveAttention
} from './smart-attention'
import type { TerminalTab, Worktree } from '../../../../shared/types'

const NOW = new Date('2026-03-27T12:00:00.000Z').getTime()

function makeEntry(overrides: Partial<AgentStatusEntry> & { paneKey: string }): AgentStatusEntry {
  return {
    state: overrides.state ?? 'working',
    prompt: overrides.prompt ?? '',
    updatedAt: overrides.updatedAt ?? NOW - 30_000,
    stateStartedAt: overrides.stateStartedAt ?? overrides.updatedAt ?? NOW - 30_000,
    agentType: overrides.agentType ?? 'codex',
    paneKey: overrides.paneKey,
    terminalTitle: overrides.terminalTitle,
    stateHistory: overrides.stateHistory ?? [],
    interrupted: overrides.interrupted
  }
}

function makeHistory(
  state: AgentStateHistoryEntry['state'],
  startedAt: number,
  interrupted = false
): AgentStateHistoryEntry {
  return { state, prompt: '', startedAt, interrupted: interrupted || undefined }
}

describe('mostRecentAttentionInHistory', () => {
  it('returns null on an empty history', () => {
    expect(mostRecentAttentionInHistory([])).toBeNull()
  })

  it('returns the latest done/blocked/waiting startedAt', () => {
    const result = mostRecentAttentionInHistory([
      makeHistory('working', NOW - 5_000),
      makeHistory('done', NOW - 4_000),
      makeHistory('working', NOW - 3_000),
      makeHistory('blocked', NOW - 2_000),
      makeHistory('working', NOW - 1_000)
    ])
    expect(result).toBe(NOW - 2_000)
  })

  it('skips interrupted done rows', () => {
    expect(
      mostRecentAttentionInHistory([
        makeHistory('done', NOW - 4_000),
        makeHistory('done', NOW - 1_000, true)
      ])
    ).toBe(NOW - 4_000)
  })

  it('returns null when only interrupted dones exist', () => {
    expect(mostRecentAttentionInHistory([makeHistory('done', NOW - 1_000, true)])).toBeNull()
  })

  it('ignores working rows entirely', () => {
    expect(
      mostRecentAttentionInHistory([
        makeHistory('working', NOW - 1_000),
        makeHistory('working', NOW - 2_000)
      ])
    ).toBeNull()
  })
})

describe('resolveAttention', () => {
  it('returns idle when there are no panes', () => {
    expect(resolveAttention([], NOW)).toEqual(IDLE)
  })

  it('classifies a blocked pane as Class 1 with stateStartedAt', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'blocked',
      stateStartedAt: NOW - 60_000,
      updatedAt: NOW - 30_000
    })
    expect(resolveAttention([entry], NOW)).toEqual({ cls: 1, attentionTimestamp: NOW - 60_000 })
  })

  it('classifies a waiting pane as Class 1', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'waiting',
      stateStartedAt: NOW - 60_000,
      updatedAt: NOW - 30_000
    })
    expect(resolveAttention([entry], NOW).cls).toBe(1)
  })

  it('classifies a done pane as Class 2', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'done',
      stateStartedAt: NOW - 90_000,
      updatedAt: NOW - 30_000
    })
    expect(resolveAttention([entry], NOW)).toEqual({ cls: 2, attentionTimestamp: NOW - 90_000 })
  })

  it('treats interrupted done as idle', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'done',
      interrupted: true,
      stateStartedAt: NOW - 90_000,
      updatedAt: NOW - 30_000
    })
    expect(resolveAttention([entry], NOW)).toEqual(IDLE)
  })

  it('classifies a working pane with prior done as Class 3 with the prior timestamp', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'working',
      stateStartedAt: NOW - 10_000,
      updatedAt: NOW - 1_000,
      stateHistory: [makeHistory('done', NOW - 5 * 60_000)]
    })
    expect(resolveAttention([entry], NOW)).toEqual({
      cls: 3,
      attentionTimestamp: NOW - 5 * 60_000
    })
  })

  it('falls back to current stateStartedAt when working has no prior attention history', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'working',
      stateStartedAt: NOW - 10_000,
      updatedAt: NOW - 1_000,
      stateHistory: []
    })
    expect(resolveAttention([entry], NOW)).toEqual({
      cls: 3,
      attentionTimestamp: NOW - 10_000
    })
  })

  it('falls back when history contains only interrupted done rows', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'working',
      stateStartedAt: NOW - 10_000,
      updatedAt: NOW - 1_000,
      stateHistory: [makeHistory('done', NOW - 60_000, true)]
    })
    expect(resolveAttention([entry], NOW)).toEqual({
      cls: 3,
      attentionTimestamp: NOW - 10_000
    })
  })

  it('skips stale entries (updatedAt older than the freshness window)', () => {
    const entry = makeEntry({
      paneKey: 't:1',
      state: 'blocked',
      stateStartedAt: NOW - AGENT_STATUS_STALE_AFTER_MS - 60_000,
      updatedAt: NOW - AGENT_STATUS_STALE_AFTER_MS - 60_000
    })
    expect(resolveAttention([entry], NOW)).toEqual(IDLE)
  })

  it('takes the most attention-demanding class across multiple panes', () => {
    const blocked = makeEntry({
      paneKey: 't:1',
      state: 'blocked',
      stateStartedAt: NOW - 30_000,
      updatedAt: NOW - 1_000
    })
    const done = makeEntry({
      paneKey: 't:2',
      state: 'done',
      stateStartedAt: NOW - 5_000,
      updatedAt: NOW - 1_000
    })
    const working = makeEntry({
      paneKey: 't:3',
      state: 'working',
      stateStartedAt: NOW - 1_000,
      updatedAt: NOW - 100
    })
    expect(resolveAttention([done, working, blocked], NOW).cls).toBe(1)
  })

  it('within the resolved class, takes the freshest attention timestamp across panes', () => {
    const olderBlocked = makeEntry({
      paneKey: 't:1',
      state: 'blocked',
      stateStartedAt: NOW - 60_000,
      updatedAt: NOW - 1_000
    })
    const newerBlocked = makeEntry({
      paneKey: 't:2',
      state: 'blocked',
      stateStartedAt: NOW - 5_000,
      updatedAt: NOW - 1_000
    })
    expect(resolveAttention([olderBlocked, newerBlocked], NOW)).toEqual({
      cls: 1,
      attentionTimestamp: NOW - 5_000
    })
  })
})

describe('buildAttentionByWorktree', () => {
  function makeWorktree(id: string): Worktree {
    return {
      id,
      repoId: 'repo-1',
      path: `/tmp/${id}`,
      branch: `refs/heads/${id}`,
      head: 'abc',
      isBare: false,
      isMainWorktree: false,
      linkedIssue: null,
      linkedPR: null,
      linkedLinearIssue: null,
      isArchived: false,
      comment: '',
      isUnread: false,
      isPinned: false,
      displayName: id,
      sortOrder: 0,
      lastActivityAt: 0
    }
  }

  function makeTab(id: string, worktreeId: string): TerminalTab {
    return {
      id,
      ptyId: 'pty',
      worktreeId,
      title: 'bash',
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 0
    }
  }

  it('returns IDLE for worktrees with no tabs', () => {
    const w = makeWorktree('wt-1')
    const map = buildAttentionByWorktree([w], {}, {}, NOW)
    expect(map.get(w.id)).toEqual(IDLE)
  })

  it('aggregates entries across multiple panes on the same tab', () => {
    const w = makeWorktree('wt-1')
    const tab = makeTab('tab-1', w.id)
    const entries: Record<string, AgentStatusEntry> = {
      'tab-1:1': makeEntry({
        paneKey: 'tab-1:1',
        state: 'working',
        stateStartedAt: NOW - 10_000,
        updatedAt: NOW - 1_000
      }),
      'tab-1:2': makeEntry({
        paneKey: 'tab-1:2',
        state: 'blocked',
        stateStartedAt: NOW - 5_000,
        updatedAt: NOW - 1_000
      })
    }
    const map = buildAttentionByWorktree([w], { [w.id]: [tab] }, entries, NOW)
    expect(map.get(w.id)).toEqual({ cls: 1, attentionTimestamp: NOW - 5_000 })
  })

  it('skips malformed paneKeys (no colon)', () => {
    const w = makeWorktree('wt-1')
    const tab = makeTab('tab-1', w.id)
    const map = buildAttentionByWorktree(
      [w],
      { [w.id]: [tab] },
      {
        malformed: makeEntry({
          paneKey: 'malformed',
          state: 'blocked',
          stateStartedAt: NOW - 1_000,
          updatedAt: NOW - 100
        })
      },
      NOW
    )
    expect(map.get(w.id)).toEqual(IDLE)
  })
})
