import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { getConnectionId } from '@/lib/connection-context'
import { getRuntimeGitIgnoredPaths } from '@/runtime/runtime-git-client'
import type { TreeNode } from './file-explorer-types'
import { buildIgnoredSet, isPathIgnored } from './status-display'

const EMPTY_IGNORED_PATHS: readonly string[] = []

export function getVisibleFileExplorerRows(
  flatRows: TreeNode[],
  ignoredSet: Set<string>,
  showGitIgnoredFiles: boolean
): TreeNode[] {
  return showGitIgnoredFiles
    ? flatRows
    : flatRows.filter((row) => !isPathIgnored(ignoredSet, row.relativePath))
}

export function useFileExplorerGitIgnoredRows(
  activeWorktreeId: string | null,
  worktreePath: string | null,
  flatRows: TreeNode[],
  activeRepoSupportsGit: boolean
): {
  visibleFlatRows: TreeNode[]
  rowsByPath: Map<string, TreeNode>
  ignoredByRelativePath: Set<string>
  showGitIgnoredFiles: boolean
  toggleGitIgnoredFiles: () => void
} {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const showGitIgnoredFiles = settings?.showGitIgnoredFiles ?? true
  const [ignoredPathsState, setIgnoredPathsState] = useState<{
    sourceKey: string | null
    paths: string[]
  }>({ sourceKey: null, paths: [] })
  const relativePaths = useMemo(() => flatRows.map((row) => row.relativePath), [flatRows])
  const canLoadIgnoredPaths =
    activeRepoSupportsGit &&
    Boolean(activeWorktreeId) &&
    Boolean(worktreePath) &&
    relativePaths.length > 0
  const ignoredPathsSourceKey = canLoadIgnoredPaths
    ? `${activeWorktreeId ?? ''}\n${worktreePath ?? ''}`
    : null

  useEffect(() => {
    if (!canLoadIgnoredPaths || !activeWorktreeId || !worktreePath) {
      return
    }

    let canceled = false
    const connectionId = getConnectionId(activeWorktreeId) ?? undefined
    const sourceKey = `${activeWorktreeId}\n${worktreePath}`
    void getRuntimeGitIgnoredPaths(
      {
        settings: useAppStore.getState().settings,
        worktreeId: activeWorktreeId,
        worktreePath,
        connectionId
      },
      relativePaths
    )
      .then((nextIgnoredPaths) => {
        if (!canceled) {
          setIgnoredPathsState({ sourceKey, paths: nextIgnoredPaths })
        }
      })
      .catch(() => {
        if (!canceled) {
          setIgnoredPathsState({ sourceKey, paths: [] })
        }
      })

    return () => {
      canceled = true
    }
  }, [activeWorktreeId, canLoadIgnoredPaths, relativePaths, worktreePath])

  const effectiveIgnoredPaths =
    canLoadIgnoredPaths && ignoredPathsState.sourceKey === ignoredPathsSourceKey
      ? ignoredPathsState.paths
      : EMPTY_IGNORED_PATHS
  const ignoredSet = useMemo(() => buildIgnoredSet(effectiveIgnoredPaths), [effectiveIgnoredPaths])
  const visibleFlatRows = useMemo(
    () => getVisibleFileExplorerRows(flatRows, ignoredSet, showGitIgnoredFiles),
    [flatRows, ignoredSet, showGitIgnoredFiles]
  )
  const rowsByPath = useMemo(
    () => new Map(visibleFlatRows.map((row) => [row.path, row])),
    [visibleFlatRows]
  )
  const ignoredByRelativePath = useMemo(
    () => (showGitIgnoredFiles ? ignoredSet : new Set<string>()),
    [ignoredSet, showGitIgnoredFiles]
  )
  const toggleGitIgnoredFiles = useCallback(() => {
    void updateSettings({ showGitIgnoredFiles: !showGitIgnoredFiles })
  }, [showGitIgnoredFiles, updateSettings])

  return {
    visibleFlatRows,
    rowsByPath,
    ignoredByRelativePath,
    showGitIgnoredFiles,
    toggleGitIgnoredFiles
  }
}
