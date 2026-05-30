import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  WorkspaceSpaceAnalysis,
  WorkspaceSpaceWorktree
} from '../../../../shared/workspace-space-types'

type EffectCallback = () => void | (() => void)
type StateUpdater<T> = T | ((current: T) => T)

const hookRuntime = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  index: 0,
  values: [] as unknown[]
}))

const storeBox = vi.hoisted(() => ({
  state: {} as Record<string, unknown>
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return {
    ...actual,
    useCallback: <T,>(callback: T) => callback,
    useEffect: (effect: EffectCallback) => {
      hookRuntime.effects.push(effect)
    },
    useMemo: <T,>(factory: () => T) => factory(),
    useRef: <T,>(initialValue: T) => {
      const index = hookRuntime.index
      hookRuntime.index += 1
      if (hookRuntime.values[index] === undefined) {
        hookRuntime.values[index] = { current: initialValue }
      }
      return hookRuntime.values[index] as { current: T }
    },
    useState: <T,>(initialValue: T | (() => T)) => {
      const index = hookRuntime.index
      hookRuntime.index += 1
      if (hookRuntime.values[index] === undefined) {
        hookRuntime.values[index] =
          typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
      }
      const setState = (value: StateUpdater<T>): void => {
        const current = hookRuntime.values[index] as T
        hookRuntime.values[index] =
          typeof value === 'function' ? (value as (current: T) => T)(current) : value
      }
      return [hookRuntime.values[index] as T, setState] as const
    }
  }
})

vi.mock('../../store', () => {
  const useAppStore = ((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeBox.state)) as {
    (selector: (state: Record<string, unknown>) => unknown): unknown
    getState: () => Record<string, unknown>
  }
  useAppStore.getState = () => storeBox.state
  return { useAppStore }
})

vi.mock('../../store/slices/hosted-review', () => ({
  getHostedReviewCacheKey: (
    repoPath: string,
    branch: string,
    settings?: { activeRuntimeEnvironmentId?: string | null } | null,
    repoId?: string | null
  ) => `${settings?.activeRuntimeEnvironmentId ?? 'local'}::${repoId ?? repoPath}::${branch}`
}))

vi.mock('@/lib/agent-status', () => ({
  detectAgentStatusFromTitle: vi.fn(() => null),
  isExplicitAgentStatusFresh: vi.fn(() => true)
}))

vi.mock('@/lib/tab-has-live-pty', () => ({
  tabHasLivePty: vi.fn(() => false)
}))

vi.mock('@/lib/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' ')
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('../right-sidebar/git-status-refresh', () => ({
  refreshGitStatusForWorktree: vi.fn()
}))

vi.mock('../sidebar/delete-worktree-flow', () => ({
  runWorktreeBatchDelete: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}))

import { WorkspaceSpaceManagerPanel } from './WorkspaceSpaceManagerPanel'

function makeWorktree(index: number): WorkspaceSpaceWorktree {
  return {
    worktreeId: `wt-${index}`,
    repoId: 'repo',
    repoDisplayName: 'repo',
    repoPath: '/repo',
    displayName: `workspace-${index}`,
    path: `/workspaces/workspace-${index}`,
    branch: 'refs/heads/main',
    isMainWorktree: true,
    isRemote: false,
    isSparse: false,
    canDelete: false,
    lastActivityAt: 0,
    status: 'ok',
    error: null,
    scannedAt: 0,
    sizeBytes: index + 1,
    reclaimableBytes: 0,
    skippedEntryCount: 0,
    topLevelItems: [],
    omittedTopLevelItemCount: 0,
    omittedTopLevelSizeBytes: 0
  }
}

function makeAnalysis(worktrees: WorkspaceSpaceWorktree[]): WorkspaceSpaceAnalysis {
  return {
    scannedAt: 1,
    totalSizeBytes: worktrees.reduce((sum, worktree) => sum + worktree.sizeBytes, 0),
    reclaimableBytes: 0,
    worktreeCount: worktrees.length,
    scannedWorktreeCount: worktrees.length,
    unavailableWorktreeCount: 0,
    repos: [
      {
        repoId: 'repo',
        displayName: 'repo',
        path: '/repo',
        isRemote: false,
        worktreeCount: worktrees.length,
        scannedWorktreeCount: worktrees.length,
        unavailableWorktreeCount: 0,
        totalSizeBytes: 0,
        reclaimableBytes: 0,
        error: null
      }
    ],
    worktrees
  }
}

function seedStore(worktrees: WorkspaceSpaceWorktree[]): void {
  storeBox.state = {
    activeWorktreeId: null,
    agentStatusByPaneKey: {},
    agentStatusEpoch: 0,
    browserTabsByWorktree: {},
    cancelWorkspaceSpaceScan: vi.fn(),
    deleteStateByWorktreeId: {},
    editorDrafts: {},
    fetchUpstreamStatus: vi.fn(),
    gitStatusByWorktree: {},
    hostedReviewCache: {},
    issueCache: {},
    linearIssueCache: {},
    migrationUnsupportedByPtyId: {},
    openFiles: [],
    ptyIdsByTabId: {},
    refreshWorkspaceSpace: vi.fn(),
    remoteStatusesByWorktree: {},
    removeWorkspaceSpaceWorktrees: vi.fn(),
    removeWorktree: vi.fn().mockResolvedValue({ ok: true }),
    repos: [],
    retainedAgentsByPaneKey: {},
    runtimePaneTitlesByTabId: {},
    setGitStatus: vi.fn(),
    setUpstreamStatus: vi.fn(),
    settings: {},
    tabsByWorktree: {},
    updateWorktreeGitIdentity: vi.fn(),
    workspaceSpaceAnalysis: makeAnalysis(worktrees),
    workspaceSpaceScanError: null,
    workspaceSpaceScanProgress: null,
    workspaceSpaceScanning: false,
    worktreesByRepo: {}
  }
}

describe('WorkspaceSpaceManagerPanel', () => {
  beforeEach(() => {
    hookRuntime.effects = []
    hookRuntime.index = 0
    hookRuntime.values = []
  })

  it('does not overflow when scanned workspace results contain many rows', () => {
    seedStore(Array.from({ length: 130_000 }, (_, index) => makeWorktree(index)))

    expect(() => WorkspaceSpaceManagerPanel()).not.toThrow()
  })
})
