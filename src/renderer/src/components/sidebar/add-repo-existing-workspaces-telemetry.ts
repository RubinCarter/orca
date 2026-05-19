import type {
  AddRepoExistingWorkspaceSource,
  EventProps
} from '../../../../shared/telemetry-events'
import type { Worktree } from '../../../../shared/types'

type ExistingWorkspacesDetectedProps = EventProps<'add_repo_existing_workspaces_detected'>

const MAX_REPORTED_WORKSPACES = 50

function countWorkspaces(count: number): number {
  return Math.min(MAX_REPORTED_WORKSPACES, Math.max(0, count))
}

function branchDisplayName(worktree: Worktree): string {
  return worktree.branch.replace(/^refs\/heads\//, '')
}

function pathBasename(pathValue: string): string {
  return (
    pathValue
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .filter(Boolean)
      .at(-1) ?? ''
  )
}

function isCustomDisplayName(worktree: Worktree): boolean {
  const branchName = branchDisplayName(worktree)
  const pathName = pathBasename(worktree.path)
  return Boolean(
    worktree.displayName && worktree.displayName !== branchName && worktree.displayName !== pathName
  )
}

export function buildAddRepoExistingWorkspacesTelemetry(
  source: AddRepoExistingWorkspaceSource | null,
  worktrees: readonly Worktree[]
): ExistingWorkspacesDetectedProps | null {
  if (!source || worktrees.length === 0) {
    return null
  }

  const existing_workspace_count = countWorkspaces(worktrees.length)
  const main_workspace_count = countWorkspaces(
    worktrees.filter((worktree) => worktree.isMainWorktree).length
  )
  const branch_named_workspace_count = countWorkspaces(
    worktrees.filter((worktree) => Boolean(branchDisplayName(worktree))).length
  )
  const sparse_workspace_count = countWorkspaces(
    worktrees.filter((worktree) => worktree.isSparse === true).length
  )

  return {
    source,
    existing_workspace_count,
    existing_linked_workspace_count: countWorkspaces(worktrees.length - main_workspace_count),
    main_workspace_count,
    branch_named_workspace_count,
    detached_workspace_count: countWorkspaces(worktrees.length - branch_named_workspace_count),
    custom_named_workspace_count: countWorkspaces(worktrees.filter(isCustomDisplayName).length),
    sparse_workspace_count
  }
}

export function shouldTrackAddRepoExistingWorkspacesDetected(
  source: AddRepoExistingWorkspaceSource | null
): boolean {
  // Clone/create produce a new project during this flow, so their setup step is
  // not evidence of a pre-existing workspace migration opportunity.
  return (
    source === 'local_folder_picker' ||
    source === 'runtime_server_path' ||
    source === 'ssh_remote_path'
  )
}
