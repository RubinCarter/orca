import type { WorkspaceStatusDefinition } from '../../../src/shared/types'

export const DEFAULT_MOBILE_WORKSPACE_STATUS_ID = 'in-progress'

export const DEFAULT_MOBILE_WORKSPACE_STATUSES = [
  { id: 'completed', label: 'Done', color: 'conductor-done', icon: 'conductor-done' },
  { id: 'in-review', label: 'In review', color: 'conductor-review', icon: 'conductor-review' },
  {
    id: DEFAULT_MOBILE_WORKSPACE_STATUS_ID,
    label: 'In progress',
    color: 'conductor-progress',
    icon: 'conductor-progress'
  },
  { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' }
] as const satisfies readonly WorkspaceStatusDefinition[]

export function getMobileWorkspaceStatus(
  worktree: { workspaceStatus?: string | null },
  statuses: readonly WorkspaceStatusDefinition[]
): string {
  if (
    worktree.workspaceStatus &&
    statuses.some((status) => status.id === worktree.workspaceStatus)
  ) {
    return worktree.workspaceStatus
  }
  if (statuses.some((status) => status.id === DEFAULT_MOBILE_WORKSPACE_STATUS_ID)) {
    return DEFAULT_MOBILE_WORKSPACE_STATUS_ID
  }
  return statuses[0]?.id ?? DEFAULT_MOBILE_WORKSPACE_STATUS_ID
}

export function getMobileWorkspaceStatusGroupKey(status: string): string {
  return `workspace-status:${encodeURIComponent(status)}`
}
