import { getRuntimeGitStatus } from '@/runtime/runtime-git-client'
import type { GitStatusResult, GitUpstreamStatus, GlobalSettings } from '../../../../shared/types'

export type GitStatusRefreshDeps = {
  setGitStatus: (worktreeId: string, status: GitStatusResult) => void
  updateWorktreeGitIdentity: (
    worktreeId: string,
    identity: { head?: string; branch?: string }
  ) => void
  setUpstreamStatus: (worktreeId: string, status: GitUpstreamStatus) => void
  fetchUpstreamStatus: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string
  ) => Promise<void>
}

export async function refreshGitStatusForWorktree({
  settings,
  worktreeId,
  worktreePath,
  connectionId,
  deps
}: {
  settings?: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null
  worktreeId: string
  worktreePath: string
  connectionId?: string
  deps: GitStatusRefreshDeps
}): Promise<void> {
  const status = (await getRuntimeGitStatus({
    settings,
    worktreeId,
    worktreePath,
    connectionId
  })) as GitStatusResult

  deps.setGitStatus(worktreeId, status)
  // Why: branch switches can happen inside a terminal. `git status --branch`
  // gives us the new identity without a separate worktree-list poll.
  deps.updateWorktreeGitIdentity(worktreeId, {
    head: status.head,
    branch: status.branch
  })
  if (status.upstreamStatus) {
    deps.setUpstreamStatus(worktreeId, status.upstreamStatus)
    // Why: porcelain status has counts but cannot tell stale post-rebase
    // upstream commits from real remote work. A diverged branch needs the
    // richer explicit probe before the UI offers Pull/Sync.
    if (
      status.upstreamStatus.ahead > 0 &&
      status.upstreamStatus.behind > 0 &&
      status.upstreamStatus.behindCommitsArePatchEquivalent === undefined
    ) {
      await deps.fetchUpstreamStatus(worktreeId, worktreePath, connectionId)
    }
    return
  }
  await deps.fetchUpstreamStatus(worktreeId, worktreePath, connectionId)
}
