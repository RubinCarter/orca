import { describe, expect, it } from 'vitest'
import type { RetainedAgentEntry } from '@/store/slices/agent-status'
import type { OpenFile } from '@/store/slices/editor'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'
import type { Tab, TabGroup, TerminalTab, Worktree } from '../../../shared/types'
import { buildSearchableWorkspaceTabs, searchWorkspaceTabs } from './workspace-tab-palette-search'

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'wt-1',
    repoId: 'repo-1',
    path: '/tmp/wt-1',
    head: 'abc123',
    branch: 'refs/heads/feature/workspace-tab-search',
    isBare: false,
    isMainWorktree: false,
    displayName: 'Palette Worktree',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}

function makeUnifiedTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'unified-terminal-1',
    entityId: 'terminal-1',
    groupId: 'group-1',
    worktreeId: 'wt-1',
    contentType: 'terminal',
    label: 'Unified Label',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

function makeTerminalTab(overrides: Partial<TerminalTab> = {}): TerminalTab {
  return {
    id: 'terminal-1',
    ptyId: 'pty-1',
    worktreeId: 'wt-1',
    title: 'Raw Shell Title',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

function makeOpenFile(overrides: Partial<OpenFile> = {}): OpenFile {
  return {
    id: '/tmp/wt-1/src/app.ts',
    filePath: '/tmp/wt-1/src/app.ts',
    relativePath: 'src/app.ts',
    worktreeId: 'wt-1',
    language: 'typescript',
    isDirty: false,
    mode: 'edit',
    ...overrides
  }
}

function makeGroup(overrides: Partial<TabGroup> = {}): TabGroup {
  return {
    id: 'group-1',
    worktreeId: 'wt-1',
    activeTabId: 'unified-terminal-1',
    tabOrder: ['unified-terminal-1'],
    ...overrides
  }
}

function makeAgentEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'Implement the websocket retry loop',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: 'terminal-1:leaf-a',
    tabId: 'terminal-1',
    worktreeId: 'wt-1',
    stateHistory: [],
    agentType: 'codex',
    providerSession: { key: 'session_id', id: 'sess-live' },
    ...overrides
  }
}

function buildEntries(overrides: Partial<Parameters<typeof buildSearchableWorkspaceTabs>[0]> = {}) {
  const worktree = makeWorktree()
  const tab = makeUnifiedTab()
  return buildSearchableWorkspaceTabs({
    worktrees: [worktree],
    repoMap: new Map([[worktree.repoId, { displayName: 'repo/orca' }]]),
    worktreeOrder: new Map([[worktree.id, 0]]),
    unifiedTabsByWorktree: { [worktree.id]: [tab] },
    tabsByWorktree: { [worktree.id]: [makeTerminalTab()] },
    openFiles: [],
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    sleepingAgentSessionsByPaneKey: {},
    activeGroupIdByWorktree: { [worktree.id]: 'group-1' },
    groupsByWorktree: { [worktree.id]: [makeGroup()] },
    activeWorktreeId: worktree.id,
    activeTabType: 'terminal',
    activeTabId: 'terminal-1',
    activeTabIdByWorktree: { [worktree.id]: 'terminal-1' },
    activeFileId: null,
    activeFileIdByWorktree: {},
    activeTabTypeByWorktree: { [worktree.id]: 'terminal' },
    generatedTitlesEnabled: true,
    ...overrides
  })
}

describe('workspace-tab-palette-search', () => {
  it('uses terminal tab title precedence and honors generated-title disabling', () => {
    const enabledEntries = buildEntries({
      tabsByWorktree: {
        'wt-1': [
          makeTerminalTab({
            customTitle: 'Custom Title',
            quickCommandLabel: 'Quick Label',
            generatedTitle: 'Generated Label'
          })
        ]
      }
    })
    expect(searchWorkspaceTabs(enabledEntries, 'custom')[0]?.title).toBe('Custom Title')

    const disabledEntries = buildEntries({
      generatedTitlesEnabled: false,
      tabsByWorktree: {
        'wt-1': [
          makeTerminalTab({
            title: 'Raw Shell Title',
            generatedTitle: 'Generated Label'
          })
        ]
      }
    })
    expect(searchWorkspaceTabs(disabledEntries, 'generated')).toHaveLength(0)
    expect(searchWorkspaceTabs(disabledEntries, 'raw')[0]?.title).toBe('Raw Shell Title')
  })

  it('falls back to the unified terminal label when the legacy terminal record is gone', () => {
    const entries = buildEntries({
      tabsByWorktree: { 'wt-1': [] },
      unifiedTabsByWorktree: {
        'wt-1': [makeUnifiedTab({ customLabel: 'Fallback Terminal' })]
      }
    })

    expect(searchWorkspaceTabs(entries, 'fallback')[0]?.title).toBe('Fallback Terminal')
  })

  it('indexes editor-family tabs through existing editor labels and paths', () => {
    const file = makeOpenFile({
      id: '/tmp/wt-1/docs/readme.md:preview',
      filePath: '/tmp/wt-1/docs/readme.md',
      relativePath: 'docs/readme.md',
      mode: 'markdown-preview'
    })
    const entries = buildEntries({
      unifiedTabsByWorktree: {
        'wt-1': [
          makeUnifiedTab({
            id: 'editor-preview',
            entityId: file.id,
            contentType: 'editor',
            label: 'ignored'
          }),
          makeUnifiedTab({
            id: 'missing-diff',
            entityId: '/tmp/wt-1/missing.ts',
            contentType: 'diff'
          })
        ]
      },
      openFiles: [file],
      activeTabType: 'editor',
      activeTabId: null,
      activeTabIdByWorktree: {},
      activeFileId: file.id,
      activeFileIdByWorktree: { 'wt-1': file.id },
      activeTabTypeByWorktree: { 'wt-1': 'editor' },
      groupsByWorktree: {
        'wt-1': [makeGroup({ activeTabId: 'editor-preview', tabOrder: ['editor-preview'] })]
      }
    })

    expect(entries.map((entry) => entry.tab.id)).toEqual(['editor-preview'])
    expect(searchWorkspaceTabs(entries, 'preview')[0]?.title).toBe('readme.md (preview)')
    expect(searchWorkspaceTabs(entries, 'docs/readme')[0]?.secondaryRange).toEqual({
      start: 0,
      end: 11
    })
  })

  it('attaches live, retained, and sleeping agent metadata only to matching terminal tabs', () => {
    const retainedEntry = makeAgentEntry({
      paneKey: 'terminal-1:leaf-b',
      prompt: 'Retained branch cleanup',
      tabId: undefined,
      providerSession: { key: 'session_id', id: 'sess-retained' }
    })
    const retained: RetainedAgentEntry = {
      entry: retainedEntry,
      worktreeId: 'wt-1',
      tab: makeTerminalTab({ id: 'terminal-1', title: 'Retained Title' }),
      agentType: 'codex',
      startedAt: 1
    }
    const sleeping: SleepingAgentSessionRecord = {
      paneKey: 'terminal-1:leaf-c',
      tabId: 'terminal-1',
      worktreeId: 'wt-1',
      agent: 'codex',
      providerSession: { key: 'session_id', id: 'sess-sleeping' },
      prompt: 'Sleeping deployment notes',
      state: 'waiting',
      capturedAt: 1,
      updatedAt: 1,
      origin: 'worktree-sleep'
    }
    const entries = buildEntries({
      agentStatusByPaneKey: {
        'terminal-1:leaf-a': makeAgentEntry(),
        'terminal-2:leaf-x': makeAgentEntry({
          paneKey: 'terminal-2:leaf-x',
          tabId: 'terminal-2',
          prompt: 'Wrong tab prompt'
        }),
        'terminal-1:leaf-y': makeAgentEntry({
          paneKey: 'terminal-1:leaf-y',
          worktreeId: 'wt-other',
          prompt: 'Wrong worktree prompt'
        })
      },
      retainedAgentsByPaneKey: { [retained.entry.paneKey]: retained },
      sleepingAgentSessionsByPaneKey: { [sleeping.paneKey]: sleeping }
    })

    expect(searchWorkspaceTabs(entries, 'websocket')[0]?.secondaryText).toBe(
      'Implement the websocket retry loop'
    )
    expect(searchWorkspaceTabs(entries, 'retained')[0]?.secondaryText).toBe(
      'Retained branch cleanup'
    )
    expect(searchWorkspaceTabs(entries, 'sess-sleeping')).toHaveLength(1)
    expect(searchWorkspaceTabs(entries, 'wrong tab')).toHaveLength(0)
    expect(searchWorkspaceTabs(entries, 'wrong worktree')).toHaveLength(0)
  })

  it('deduplicates live, retained, and sleeping metadata by pane key with live preferred', () => {
    const retainedEntry = makeAgentEntry({
      paneKey: 'terminal-1:leaf-a',
      prompt: 'Retained duplicate prompt'
    })
    const entries = buildEntries({
      agentStatusByPaneKey: {
        'terminal-1:leaf-a': makeAgentEntry({ prompt: 'Live duplicate prompt' })
      },
      retainedAgentsByPaneKey: {
        'terminal-1:leaf-a': {
          entry: retainedEntry,
          worktreeId: 'wt-1',
          tab: makeTerminalTab(),
          agentType: 'codex',
          startedAt: 1
        }
      },
      sleepingAgentSessionsByPaneKey: {
        'terminal-1:leaf-a': {
          paneKey: 'terminal-1:leaf-a',
          tabId: 'terminal-1',
          worktreeId: 'wt-1',
          agent: 'codex',
          providerSession: { key: 'session_id', id: 'sess-sleeping' },
          prompt: 'Sleeping duplicate prompt',
          state: 'waiting',
          capturedAt: 1,
          updatedAt: 1
        }
      }
    })

    expect(searchWorkspaceTabs(entries, 'live duplicate')[0]?.secondaryText).toBe(
      'Live duplicate prompt'
    )
    expect(searchWorkspaceTabs(entries, 'retained duplicate')).toHaveLength(0)
    expect(searchWorkspaceTabs(entries, 'sleeping duplicate')).toHaveLength(0)
  })

  it('orders empty-query results by current tab, current worktree, and tab position', () => {
    const current = makeUnifiedTab({ id: 'tab-current', entityId: 'terminal-current' })
    const sibling = makeUnifiedTab({
      id: 'tab-sibling',
      entityId: 'terminal-sibling',
      sortOrder: 1
    })
    const other = makeUnifiedTab({
      id: 'tab-other',
      entityId: 'terminal-other',
      worktreeId: 'wt-2',
      groupId: 'group-2'
    })
    const entries = buildEntries({
      worktrees: [
        makeWorktree({ id: 'wt-1', displayName: 'Current WT' }),
        makeWorktree({ id: 'wt-2', repoId: 'repo-2', displayName: 'Other WT' })
      ],
      repoMap: new Map([
        ['repo-1', { displayName: 'repo/current' }],
        ['repo-2', { displayName: 'repo/other' }]
      ]),
      worktreeOrder: new Map([
        ['wt-1', 1],
        ['wt-2', 2]
      ]),
      unifiedTabsByWorktree: { 'wt-1': [sibling, current], 'wt-2': [other] },
      tabsByWorktree: {
        'wt-1': [
          makeTerminalTab({ id: 'terminal-sibling', title: 'Sibling' }),
          makeTerminalTab({ id: 'terminal-current', title: 'Current' })
        ],
        'wt-2': [makeTerminalTab({ id: 'terminal-other', worktreeId: 'wt-2', title: 'Other' })]
      },
      groupsByWorktree: {
        'wt-1': [
          makeGroup({
            activeTabId: 'tab-current',
            tabOrder: ['tab-current', 'tab-sibling']
          })
        ],
        'wt-2': [makeGroup({ id: 'group-2', worktreeId: 'wt-2', tabOrder: ['tab-other'] })]
      },
      activeTabId: 'terminal-current',
      activeTabIdByWorktree: { 'wt-1': 'terminal-current' }
    })

    expect(searchWorkspaceTabs(entries, '').map((result) => result.entityId)).toEqual([
      'terminal-current',
      'terminal-sibling',
      'terminal-other'
    ])
  })
})
