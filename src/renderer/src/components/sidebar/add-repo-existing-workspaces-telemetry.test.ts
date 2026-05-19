import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../shared/types'
import {
  buildAddRepoExistingWorkspacesTelemetry,
  shouldTrackAddRepoExistingWorkspacesDetected
} from './add-repo-existing-workspaces-telemetry'

function worktree(overrides: Partial<Worktree>): Worktree {
  return {
    id: 'repo::/repo',
    repoId: 'repo',
    path: '/repo',
    head: 'abc',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: true,
    displayName: 'main',
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

describe('add repo existing workspace telemetry', () => {
  it('builds count-only payloads without raw workspace names', () => {
    const payload = buildAddRepoExistingWorkspacesTelemetry('local_folder_picker', [
      worktree({ path: '/repo', displayName: 'main', branch: 'refs/heads/main' }),
      worktree({
        id: 'repo::/repo-feature',
        path: '/repo-feature',
        displayName: 'Feature With User Text',
        branch: 'refs/heads/feature/private-task',
        isMainWorktree: false,
        isSparse: true
      }),
      worktree({
        id: 'repo::/detached',
        path: 'C:\\workspaces\\detached',
        displayName: 'detached',
        branch: '',
        isMainWorktree: false
      })
    ])

    expect(payload).toEqual({
      source: 'local_folder_picker',
      existing_workspace_count: 3,
      existing_linked_workspace_count: 2,
      main_workspace_count: 1,
      branch_named_workspace_count: 2,
      detached_workspace_count: 1,
      custom_named_workspace_count: 1,
      sparse_workspace_count: 1
    })
    expect(JSON.stringify(payload)).not.toContain('private-task')
    expect(JSON.stringify(payload)).not.toContain('Feature With User Text')
  })

  it('omits empty detection payloads and filters new project flows', () => {
    expect(buildAddRepoExistingWorkspacesTelemetry(null, [worktree({})])).toBeNull()
    expect(buildAddRepoExistingWorkspacesTelemetry('local_folder_picker', [])).toBeNull()

    expect(shouldTrackAddRepoExistingWorkspacesDetected('local_folder_picker')).toBe(true)
    expect(shouldTrackAddRepoExistingWorkspacesDetected('runtime_server_path')).toBe(true)
    expect(shouldTrackAddRepoExistingWorkspacesDetected('ssh_remote_path')).toBe(true)
    expect(shouldTrackAddRepoExistingWorkspacesDetected('clone_url')).toBe(false)
    expect(shouldTrackAddRepoExistingWorkspacesDetected('create_project')).toBe(false)
  })
})
