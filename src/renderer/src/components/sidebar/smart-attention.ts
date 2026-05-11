import { isExplicitAgentStatusFresh } from '@/lib/agent-status'
import type { TerminalTab, Worktree } from '../../../../shared/types'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStateHistoryEntry,
  type AgentStatusEntry
} from '../../../../shared/agent-status-types'

/**
 * Ordinal class for the "Smart" sort. Lower number = more attention-demanding.
 *   1 — Needs you (`blocked` / `waiting`)
 *   2 — Done (`done`, not interrupted)
 *   3 — Working (`working`)
 *   4 — Idle (no live entry, stale entry, or interrupted `done`)
 *
 * Class is the primary sort key; within a class the comparator falls back to
 * the resolved attention timestamp. See docs/smart-worktree-order-redesign.md.
 */
export type SmartClass = 1 | 2 | 3 | 4

/**
 * Per-worktree resolution computed once before sorting.
 *
 * `attentionTimestamp` semantics depend on the class:
 *   - Class 1 / 2: `stateStartedAt` of the current entry (when the agent
 *     entered the attention state).
 *   - Class 3: `stateStartedAt` of the most recent prior `done`/`blocked`/
 *     `waiting` entry in `stateHistory[]`, falling back to the current
 *     `working` `stateStartedAt` when no prior attention event exists.
 *   - Class 4: `0` — the comparator drops to `effectiveRecentActivity` for
 *     within-class ordering on idle worktrees.
 */
export type WorktreeAttention = {
  cls: SmartClass
  attentionTimestamp: number
}

export const IDLE: WorktreeAttention = { cls: 4, attentionTimestamp: 0 }

/**
 * Walk a pane's state-history rows and return the timestamp of the most
 * recent `done`/`blocked`/`waiting` entry, ignoring `done` rows that were
 * interrupted (the user pressed Ctrl+C — that turn no longer demands
 * attention). Returns `null` when no qualifying row exists.
 */
export function mostRecentAttentionInHistory(history: AgentStateHistoryEntry[]): number | null {
  let max = 0
  for (const h of history) {
    // Why: setAgentStatus preserves `interrupted` on history rows when an
    // interrupted `done` transitions out, so we can filter on history the
    // same way the current entry does.
    if (h.state === 'done' && h.interrupted) {
      continue
    }
    if (h.state === 'done' || h.state === 'blocked' || h.state === 'waiting') {
      if (h.startedAt > max) {
        max = h.startedAt
      }
    }
  }
  return max > 0 ? max : null
}

/**
 * Resolve a worktree's class + attention timestamp from its panes' agent
 * status entries. Stale entries (older than `AGENT_STATUS_STALE_AFTER_MS`)
 * are skipped — the worktree falls to Class 4 if no fresh entry exists.
 *
 * Across multiple panes:
 *   - `cls` is the **min** (most attention-demanding pane wins).
 *   - `attentionTimestamp` is the **max** within the resolved class.
 */
export function resolveAttention(panes: AgentStatusEntry[], now: number): WorktreeAttention {
  let bestCls: SmartClass = 4
  let bestTs = 0

  for (const entry of panes) {
    if (!isExplicitAgentStatusFresh(entry, now, AGENT_STATUS_STALE_AFTER_MS)) {
      continue
    }

    let cls: SmartClass
    let ts: number
    if (entry.state === 'blocked' || entry.state === 'waiting') {
      cls = 1
      ts = entry.stateStartedAt
    } else if (entry.state === 'done') {
      // Why: an interrupted `done` (user pressed Ctrl+C) is the user signalling
      // "I'm done with this turn". Treat as idle, not as Class 2 attention.
      if (entry.interrupted) {
        continue
      }
      cls = 2
      ts = entry.stateStartedAt
    } else {
      // working
      cls = 3
      // Why: within Class 3, sort by the most recent prior attention event so
      // a worktree that just transitioned done→working stays above one that's
      // been working for an hour. Falls back to the current stateStartedAt
      // when stateHistory is empty (e.g. fresh after restart).
      const prior = mostRecentAttentionInHistory(entry.stateHistory)
      ts = prior ?? entry.stateStartedAt
    }

    // Why min on class: smaller class number = higher priority. Any pane in a
    // more attention-demanding class promotes the whole worktree. Within the
    // same class, take the max timestamp so the freshest attention event wins.
    if (cls < bestCls || (cls === bestCls && ts > bestTs)) {
      bestCls = cls
      bestTs = ts
    }
  }

  return { cls: bestCls, attentionTimestamp: bestTs }
}

/**
 * Build a `tabId → entries[]` index over `agentStatusByPaneKey`. Entries are
 * keyed by the `tabId` prefix of their paneKey (paneKey format:
 * `${tabId}:${paneId}`). Doing this once per sort lets each worktree's
 * resolution pay O(T) lookups instead of scanning the full map.
 */
export function buildExplicitEntriesByTabId(
  agentStatusByPaneKey: Record<string, AgentStatusEntry> | undefined
): Map<string, AgentStatusEntry[]> {
  const byTab = new Map<string, AgentStatusEntry[]>()
  if (!agentStatusByPaneKey) {
    return byTab
  }
  for (const entry of Object.values(agentStatusByPaneKey)) {
    const colon = entry.paneKey.indexOf(':')
    // Why: paneKey must be `${tabId}:${paneId}`. Skip malformed entries (no
    // colon or leading colon) rather than bucketing them under an empty tabId.
    if (colon <= 0) {
      continue
    }
    const tabId = entry.paneKey.slice(0, colon)
    const bucket = byTab.get(tabId)
    if (bucket) {
      bucket.push(entry)
    } else {
      byTab.set(tabId, [entry])
    }
  }
  return byTab
}

/**
 * Build the per-worktree attention map consumed by the smart comparator.
 *
 * Cost: O(E + N × T × H) where E = total entries, N = worktrees, T = tabs per
 * worktree, H = history length (bounded at AGENT_STATE_HISTORY_MAX = 20).
 */
export function buildAttentionByWorktree(
  worktrees: Worktree[],
  tabsByWorktree: Record<string, TerminalTab[]> | null,
  agentStatusByPaneKey: Record<string, AgentStatusEntry> | undefined,
  now: number
): Map<string, WorktreeAttention> {
  const byTab = buildExplicitEntriesByTabId(agentStatusByPaneKey)
  const result = new Map<string, WorktreeAttention>()

  for (const worktree of worktrees) {
    const tabs = tabsByWorktree?.[worktree.id]
    if (!tabs || tabs.length === 0) {
      result.set(worktree.id, IDLE)
      continue
    }
    const panes: AgentStatusEntry[] = []
    for (const tab of tabs) {
      const bucket = byTab.get(tab.id)
      if (bucket) {
        for (const entry of bucket) {
          panes.push(entry)
        }
      }
    }
    result.set(worktree.id, resolveAttention(panes, now))
  }

  return result
}
