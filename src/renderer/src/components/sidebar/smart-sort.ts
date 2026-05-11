import type { Worktree, Repo, TerminalTab } from '../../../../shared/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { IDLE, buildAttentionByWorktree, type WorktreeAttention } from './smart-attention'

type SortBy = 'name' | 'smart' | 'recent' | 'repo'

// Why: a newly-created worktree's lastActivityAt is stamped at the moment
// createLocalWorktree finishes git + setup-runner prep (often several seconds
// after the user clicked Create). During and after that window, ambient PTY
// bumps on OTHER worktrees (data flush, exit, reconnect) can push the new
// worktree below them in Recent sort. This grace period gives the new
// worktree a floor of `createdAt + CREATE_GRACE_MS` in the Recent comparator
// so it stays on top until the user has had a chance to notice it. 5 min is
// long enough for the user to interact, short enough that steady-state
// ordering resumes quickly.
export const CREATE_GRACE_MS = 5 * 60 * 1000

/**
 * Rank a worktree in Recent sort using `lastActivityAt`, but with a floor of
 * `createdAt + CREATE_GRACE_MS` *only during* the grace window (i.e. while
 * `now < createdAt + CREATE_GRACE_MS`). Once the window has elapsed, returns
 * `lastActivityAt` unchanged. Returns `lastActivityAt` unchanged for worktrees
 * without `createdAt` (discovered on disk, or persisted before this field
 * existed).
 */
export function effectiveRecentActivity(worktree: Worktree, now: number): number {
  const { lastActivityAt, createdAt } = worktree
  // Why bound by now: a worktree with createdAt set but no subsequent activity
  // should not retain artificially-high recency forever; the floor exists to
  // absorb the noisy creation window only. Without this bound, a worktree
  // created days ago and never touched would keep ranking as if its activity
  // were `createdAt + 5min`, masking truly fresher worktrees indefinitely.
  if (createdAt === undefined || now >= createdAt + CREATE_GRACE_MS) {
    return lastActivityAt
  }
  return Math.max(lastActivityAt, createdAt + CREATE_GRACE_MS)
}

/**
 * Build a comparator for sorting worktrees based on the current sort mode.
 *
 * Smart mode requires `attentionByWorktree` — a per-worktree class +
 * timestamp map built once before sorting (see `buildAttentionByWorktree`).
 * Without it, every worktree collapses to Class 4 (idle) and the comparator
 * silently degrades to recent-activity ordering, so callers MUST thread the
 * map for smart mode.
 */
export function buildWorktreeComparator(
  sortBy: SortBy,
  repoMap: Map<string, Repo>,
  now: number = Date.now(),
  attentionByWorktree: Map<string, WorktreeAttention> | null = null
): (a: Worktree, b: Worktree) => number {
  return (a, b) => {
    switch (sortBy) {
      case 'name':
        return a.displayName.localeCompare(b.displayName)
      case 'smart': {
        const aw = attentionByWorktree?.get(a.id) ?? IDLE
        const bw = attentionByWorktree?.get(b.id) ?? IDLE
        return (
          // Why: 1 < 2 < 3 < 4 — lower class outranks higher.
          aw.cls - bw.cls ||
          // Why: within a class, the more recent attention event ranks first.
          bw.attentionTimestamp - aw.attentionTimestamp ||
          // Why: idle worktrees fall through to recency (and the create-grace
          // floor for brand-new worktrees) before alphabetical.
          effectiveRecentActivity(b, now) - effectiveRecentActivity(a, now) ||
          a.displayName.localeCompare(b.displayName)
        )
      }
      case 'recent':
        // Why effectiveRecentActivity (not raw lastActivityAt): newly-created
        // worktrees get a CREATE_GRACE_MS floor on top of lastActivityAt so
        // ambient PTY bumps in other worktrees don't immediately push them
        // down. See CREATE_GRACE_MS above.
        //
        // Why not sortOrder: sortOrder is a snapshot of the smart-sort
        // ranking that only gets repersisted while the user is in "Smart"
        // mode, so it's frozen in Recent mode and ignores new terminal
        // events, meta edits, etc. lastActivityAt is the real "recency"
        // signal — bumped by bumpWorktreeActivity (PTY spawn, background
        // events) and by meaningful meta edits (comment, isUnread).
        return (
          effectiveRecentActivity(b, now) - effectiveRecentActivity(a, now) ||
          a.displayName.localeCompare(b.displayName)
        )
      case 'repo': {
        const ra = repoMap.get(a.repoId)?.displayName ?? ''
        const rb = repoMap.get(b.repoId)?.displayName ?? ''
        const cmp = ra.localeCompare(rb)
        return cmp !== 0 ? cmp : a.displayName.localeCompare(b.displayName)
      }
      default: {
        const _exhaustive: never = sortBy
        return _exhaustive
      }
    }
  }
}

/**
 * Sort worktrees by the smart-attention comparator (status class first,
 * recency-of-attention second). On cold start (no live PTYs yet), falls back
 * to persisted `sortOrder` descending so the sidebar restores the pre-quit
 * order until the agent-status snapshot lands.
 *
 * Both the palette and `getVisibleWorktreeIds()` import this to avoid
 * duplicating the cold/warm branching logic.
 *
 * `agentStatusByPaneKey` is required: the comparator depends on it for class
 * resolution, and a forgotten caller would silently regress every worktree to
 * Class 4.
 */
export function sortWorktreesSmart(
  worktrees: Worktree[],
  tabsByWorktree: Record<string, TerminalTab[]>,
  repoMap: Map<string, Repo>,
  agentStatusByPaneKey: Record<string, AgentStatusEntry>
): Worktree[] {
  const hasAnyLivePty = Object.values(tabsByWorktree)
    .flat()
    .some((t) => t.ptyId)

  if (!hasAnyLivePty) {
    // Cold start: use persisted sortOrder snapshot until the agent-status
    // snapshot lands and a warm sort runs.
    return [...worktrees].sort(
      (a, b) => b.sortOrder - a.sortOrder || a.displayName.localeCompare(b.displayName)
    )
  }

  const now = Date.now()
  const attentionByWorktree = buildAttentionByWorktree(
    worktrees,
    tabsByWorktree,
    agentStatusByPaneKey,
    now
  )

  return [...worktrees].sort(buildWorktreeComparator('smart', repoMap, now, attentionByWorktree))
}
