// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activateAndRevealWorktree: vi.fn(),
  dismissStaleAgentRowByKey: vi.fn()
}))

type MockSleepingAgentOptions = {
  paneKey?: string
  tabId?: string
}

function mockSleepingAgent({
  paneKey = 'tab-1:11111111-1111-4111-8111-111111111111',
  tabId = paneKey.split(':')[0]
}: MockSleepingAgentOptions = {}): unknown {
  return {
    paneKey,
    tab: { id: tabId },
    agentType: 'codex',
    state: 'idle',
    sleeping: true,
    startedAt: 1000,
    entry: {
      prompt: '',
      state: 'done',
      stateStartedAt: 1000,
      stateHistory: [],
      lastAssistantMessage: 'Slept · resume saved'
    }
  }
}

let mockAgents: unknown[] = []
let mockAgentSendPopoverTargetMode: unknown = null

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      agentActivityDisplayMode: 'compact',
      acknowledgedAgentsByPaneKey: {},
      dropAgentStatus: vi.fn(),
      dismissRetainedAgent: vi.fn(),
      acknowledgeAgents: vi.fn(),
      agentSendPopoverTargetMode: mockAgentSendPopoverTargetMode,
      agentStatusByPaneKey: {},
      agentStatusEpoch: 0,
      tabsByWorktree: {},
      terminalLayoutsByTabId: {},
      sendPromptToSidebarAgentTarget: vi.fn()
    })
}))

vi.mock('./useWorktreeAgentRows', () => ({
  useWorktreeAgentRows: vi.fn(() => mockAgents)
}))

vi.mock('@/components/dashboard/useNow', () => ({
  useNow: vi.fn(() => 2000)
}))

vi.mock('./focused-agent-row-highlight', () => ({
  useFocusedAgentPaneKey: vi.fn(() => null)
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))

vi.mock('../terminal-pane/stale-agent-row', () => ({
  dismissStaleAgentRowByKey: mocks.dismissStaleAgentRowByKey
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

describe('WorktreeCardAgents sleeping rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgents = [mockSleepingAgent()]
    mockAgentSendPopoverTargetMode = null
  })

  it('renders a single compact sleeping row with provider copy and no time chip', async () => {
    const { default: WorktreeCardAgents } = await import('./WorktreeCardAgents')

    const markup = renderToStaticMarkup(<WorktreeCardAgents worktreeId="wt-1" />)

    expect(markup).toContain('compact-agent-row')
    expect(markup).toContain('Codex')
    expect(markup).toContain('Slept · resume saved')
    expect(markup).toContain('title="Codex - Slept · resume saved"')
    expect(markup).not.toContain('>Idle<')
    expect(markup).not.toContain('>now<')
  })

  it('keeps compact sleeping rows inert during send-target selection', async () => {
    mockAgentSendPopoverTargetMode = {
      id: 'send-1',
      worktreeId: 'wt-1',
      source: 'diff-notes',
      status: 'open'
    }
    const { default: WorktreeCardAgents } = await import('./WorktreeCardAgents')

    const markup = renderToStaticMarkup(<WorktreeCardAgents worktreeId="wt-1" />)

    expect(markup).toContain('data-agent-send-target="disabled"')
    expect(markup).toContain('data-disabled-reason="Sleeping agent is not available"')
  })

  it('activates a compact sleeping row without stale-row dismissal', async () => {
    mockAgents = [mockSleepingAgent({ paneKey: 'legacy-pane-key', tabId: 'missing-tab' })]
    const { default: WorktreeCardAgents } = await import('./WorktreeCardAgents')
    const container = document.createElement('div')
    const root: Root = createRoot(container)

    try {
      await act(async () => {
        root.render(<WorktreeCardAgents worktreeId="wt-1" />)
      })
      const row = container.querySelector('.compact-agent-row')

      await act(async () => {
        row?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('wt-1')
      expect(mocks.dismissStaleAgentRowByKey).not.toHaveBeenCalled()
    } finally {
      act(() => root.unmount())
      container.remove()
    }
  })
})
