# Smart worktree order — redesign

## Problem with the current heuristic

The current "smart" sort (`src/renderer/src/components/sidebar/smart-sort.ts`) is a single weighted sum of seven signals:

| Signal             | Weight |
| ------------------ | -----: |
| Running AI job     |    +60 |
| Recent activity    |    +36 (decays over 24h) |
| Needs attention    |    +35 |
| Unread             |    +18 |
| Open terminal      |    +12 |
| Live branch PR     |    +10 |
| Linked issue       |     +6 |

Weighted sums are the classic heuristic failure mode:

- **Not predictable.** Users can't tell why X is above Y; the answer is "because of an arithmetic combination of seven hidden numbers."
- **Fragile under change.** Every new signal forces a re-tune of all existing weights to avoid regressions. The codebase already has comments justifying weight collisions (e.g. why "36" must exceed `18 + 10 + 6 = 34`).
- **Tests pin numerical scores** (`expect(...).toBe(12)`, `>=35`) rather than ordering invariants — refactors are scary.
- **Conflates user activity with agent activity.** "Recent" already exists for user activity. "Smart" should be answering a different question.

## Context: agent status is default-on, and persists across restart

Two upstream changes make hook-reported agent state a reliable primary signal:

1. **Default-on.** The `experimentalAgentDashboard` flag is removed (PR #1538, `5a2a32b6`). Every worktree has a real, hook-reported agent lifecycle from `src/shared/agent-status-types.ts`:

   - `working` / `blocked` / `waiting` / `done`
   - `stateStartedAt` (when the current state began)
   - `interrupted` (`done` was a Ctrl+C)
   - `stateHistory[]` (rolling log of prior states; renderer-only)

2. **Persisted across restart.** The hook server's per-pane status cache (`lastStatusByPaneKey`) is persisted to `userData/agent-hooks/last-status.json` and rehydrated on launch. After relaunch, every pane's last-known `state` and `stateStartedAt` are restored before any new hook event arrives. Smart sort sees the same agent state it saw at quit.

   Caveat: only the **current** entry is persisted (on-disk shape carries `receivedAt`/`stateStartedAt` alongside the `ParsedAgentStatusPayload`; restored via `AgentStatusIpcPayload` on the IPC, consumed via `setAgentStatus`'s 4th `timing` arg). The renderer's per-pane `stateHistory[]` is rebuilt from live IPC and starts empty after a restart. This affects exactly one case the redesign cares about — see "Cold start after restart" under Edge cases.

   **Sequencing:** the persistence work lands in a separate change (sibling branch `agent-status-preserve-restart`). The smart-sort code can ship before persistence is merged, but the "Smart sees pre-quit state on restart" guarantee only holds once persistence is in. Without persistence, every cold start drops every worktree to Class 4 until each agent's next live hook event repopulates `agentStatusByPaneKey`. Acceptable as an interim state; document it in release notes.

This is a much better signal than terminal-title heuristics. The redesign leans on it as the *primary* ordering signal, not one of seven weighted ones.

---

## The design: "Smart" = status-class first, recency-of-attention second

`Smart` orders by two keys: a strict ordinal class derived from the agent's *current* state, and within each class, the timestamp of the last attention event.

### Why two keys, not one

A pure-recency design (single timestamp axis) lets a `done` worktree outrank a `blocked` worktree if the `done` is 30s newer. With 8+ concurrent agents, that's how users miss a permission prompt. The fix is ~5 LOC: add an ordinal class above the timestamp.

This preserves the "one explainable rule" property — "X is above Y because of state class first, then recency" is still a sentence a user can predict and verify — while keeping urgency invariants. `blocked` can never be outranked by `done`. Working agents stop fighting for the top.

### The class

Each worktree resolves to one of four classes based on its agents' current state (most attention-demanding pane wins — see "Multiple panes" below):

| Class | Members | Why |
|------|--------|----|
| 1 — Needs you | `blocked`, `waiting` | Agent is stuck on the user. Highest priority. |
| 2 — Done | `done` (not `interrupted`) | Output is ready to read. |
| 3 — Working | `working` | Agent is mid-step; don't interrupt. |
| 4 — Idle | no live agent state, or stale (`> AGENT_STATUS_STALE_AFTER_MS`), or `done` + `interrupted` | Treat the same as worktrees that never had an agent. |

`interrupted` `done` (user hit Ctrl+C) is treated as idle, not as Class 2 — interrupting was the user's signal that this turn no longer needs attention.

### The within-class timestamp

Within each class, the timestamp that drives recency depends on the class:

- Class 1 / 2: `stateStartedAt` of the **current** entry. This is the moment the agent entered the attention state.
- Class 3 (working): `stateStartedAt` of the **most recent prior** `done`/`blocked`/`waiting` from the renderer's `stateHistory[]`. If history is empty (e.g. fresh after restart), fall back to `stateStartedAt` of the current `working` entry — the agent has been working since then, with no recorded prior attention event. We do not freshness-check history entries — within-class ordering is comparative, so old timestamps cannot leak across class boundaries (class is set by the *current* entry, which IS freshness-checked).
- Class 4 (idle): `effectiveRecentActivity(worktree, now)` — falls back to `lastActivityAt` with the existing `CREATE_GRACE_MS` floor for new worktrees.

We call this resolved timestamp `attentionTimestamp` per worktree.

### The comparator

```
sortBy: 'smart'
  → class asc                          (1 = Needs you, 4 = Idle)
  → attentionTimestamp desc            (within-class recency)
  → effectiveRecentActivity desc       (final tiebreaker for idle worktrees)
  → displayName asc                    (last-resort tiebreaker)
```

Two keys, three tiebreakers.

### What happens to today's seven signals

| Signal                | Today  | New design                                                                                                |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Running AI job        | +60    | **Removed from sort.** `working` is Class 3 — below `done` and `blocked`. Still shown as a dot on the card. |
| Recent activity       | +36    | **Last-resort tiebreaker** for idle worktrees. Agent class dominates.                                      |
| Needs attention       | +35    | **This *is* Class 1** (`blocked`/`waiting`) — the top of the sort.                                          |
| Unread                | +18    | **Removed from sort.** Already shown as a badge.                                                            |
| Open terminal         | +12    | **Removed from sort.** Already implied by "Active only" filter.                                             |
| Live branch PR        | +10    | **Removed from sort.** Already shown on the card and groupable via `pr-status`.                             |
| Linked issue          | +6     | **Removed from sort.** Already shown on the card.                                                           |

The card decoration stays — we're not removing visual signals, only their effect on order.

---

## Why this is the right shape

- **One rule, two clauses, both explainable.** "X is above Y because X is in a more attention-demanding class than Y, and within the same class because X's agent demanded attention more recently." A user can predict and verify both clauses from visible state (the dot tells them the class; ordering within class is recency).
- **Urgency invariants hold.** A `blocked` worktree is never outranked by a fresher `done`. A `done` worktree is never outranked by a `working` one. Class is strict ordinal, so visual state and rank position never contradict each other.
- **Aligned with the user's actual job.** When you have eight worktrees with eight agents running, the question you want answered is "which ones need me right now, and in what order did they need me?" Not "which one had the most recent OS-level PTY byte."
- **Working agents stop fighting for the top.** Today, every running agent in a 10-worktree project competes for the top slot via `+60`. Under this design, a working agent sits in Class 3 below all `done`/`blocked` worktrees — it stays out of the way until it needs you, at which point it jumps into Class 1 or 2 with a clear reason.
- **Tests can assert orderings, not numbers.** `expect(after('blocked')).toRankAbove(after('done'))` and `expect(within('done').newer).toRankAbove(within('done').older)` are meaningful invariants. `expect(score).toBe(12)` is not.
- **Lean on the new default-on, persisted-across-restart signal.** Agent state is reliable for every user *and* survives quit/relaunch (per "Context" above). The class layer reads `agentStatusByPaneKey` directly, which is hydrated before sort runs.

## Edge cases

1. **Worktree with no agent ever.** No live entry → Class 4 (idle). Sorts below all classes, then by `effectiveRecentActivity`. Same effective behavior as today's "Recent" within the idle group.
2. **Agent transitions `done` → `working`.** Class flips from 2 to 3. The worktree drops below all `done`/`blocked` worktrees. *Within Class 3*, the prior `done` timestamp from `stateHistory[]` drives rank, so it sits at the top of the working group — i.e., "it's the most recently-relevant working agent." This is intentional: once the user has new work running, the *category* of attention has changed, and the visible dot agrees with the position.
3. **User views the worktree.** Class and timestamp do not change on view. The worktree stays where it was. We do not auto-demote on view in v1 — see Open Question #4.
4. **Agent goes `blocked` → `working` → `blocked` quickly.** Each `blocked` transition makes the worktree Class 1 with a fresh `stateStartedAt`. It stays at the top through the back-and-forth, which is correct.
5. **Multiple panes per worktree.** Class is the **min** across all panes (most-attention-demanding wins — Class 1 < 2 < 3 < 4). `attentionTimestamp` is the **max** across panes within the resolved class. Any pane that's blocked pulls the whole worktree to Class 1; among Class-1 worktrees, the most-recent `blocked` event ranks first.
6. **Brand-new worktree with no agent yet.** Class 4 (idle). The existing `CREATE_GRACE_MS` floor on `effectiveRecentActivity` keeps it at the top of the idle group during the post-create window. Already covered today.
7. **Stale agent entries.** An entry whose `updatedAt` is older than `AGENT_STATUS_STALE_AFTER_MS` (30 min) is treated as if no live entry exists — the worktree falls to Class 4. Matches existing freshness logic in `isExplicitAgentStatusFresh`.
8. **Cold start after restart.** Hook server hydrates `lastStatusByPaneKey` from disk before binding the listener; the renderer pulls a snapshot when settings + workspace tabs are ready. Before that snapshot arrives, every worktree is Class 4 — Smart momentarily falls back to `effectiveRecentActivity` ordering (the same key the `recent` sort uses), then re-ranks classes 1/2/3 as soon as the snapshot lands. The snapshot restores `state` and `stateStartedAt` per pane, so Classes 1/2 and current-state-driven Class 3 timestamps work normally. The bootstrap delivers N pane entries through N `setAgentStatus` calls (one sortEpoch bump each); the existing `SORT_SETTLE_MS` debounce in `WorktreeList` coalesces them into a single re-sort.

   The one *narrow* gap: `stateHistory[]` is renderer-only, not persisted. After restart, a pane that's *currently* `working` cannot recover its prior `done`/`blocked` timestamp from before quit — Class 3's within-class timestamp falls back to the current `working` `stateStartedAt`. In practice this only matters when (a) the agent was working at quit time *and* (b) had a prior attention event the user wants reflected in rank. The far-more-common cases — `done`/`blocked` at quit, or `working` agent that did its first attention event in this session — are unaffected.
9. **Agents without hooks (aider, custom scripts).** Class is derived from explicit hook state only. Agents that don't ship hooks land in Class 4 — same as no-agent worktrees. The terminal-title heuristic permission detector is *not* extended into the new sort: Open Question #3 below.

## Implementation sketch

### Files touched

Primary:
- `src/renderer/src/components/sidebar/smart-sort.ts` — comparator rewrite, function deletions
- `src/renderer/src/components/sidebar/smart-attention.ts` — **new file**: `SmartClass`, `WorktreeAttention`, `resolveAttention`, `buildAttentionByWorktree`, `mostRecentAttentionInHistory`
- `src/renderer/src/components/sidebar/smart-sort.test.ts` — replace numerical assertions with ordering invariants
- `src/renderer/src/components/sidebar/smart-attention.test.ts` — **new file**: helper-level tests
- `src/renderer/src/components/WorktreeJumpPalette.tsx` — thread `agentStatusByPaneKey` at lines 227 and 239

No changes:
- `src/shared/agent-status-types.ts` — already provides `AgentStatusEntry`, `AgentStateHistoryEntry.startedAt`, `AgentStateHistoryEntry.interrupted`, `AGENT_STATUS_STALE_AFTER_MS`, `AGENT_STATE_HISTORY_MAX`.
- `src/renderer/src/store/slices/agent-status.ts` — already preserves `interrupted` on `stateHistory` rows (the helper relies on this).
- `src/renderer/src/lib/agent-status.ts` — `isExplicitAgentStatusFresh` is reused as-is.
- `src/main/agent-hooks/server.ts` — persistence is a separate change on the sibling branch.

### Data model

No new persisted fields on the worktree. Class and `attentionTimestamp` are derived at sort time from `agentStatusByPaneKey` (the renderer slice that already aggregates per-pane explicit status). The slice is hydrated on launch from the persisted hook-server cache (see "Context"), so cold-start sorting reflects pre-quit state once the snapshot arrives.

```ts
type SmartClass = 1 | 2 | 3 | 4   // 1=NeedsYou, 2=Done, 3=Working, 4=Idle

type WorktreeAttention = {
  cls: SmartClass
  attentionTimestamp: number   // 0 when class === 4
}
```

### Per-worktree resolution

For each worktree, walk its panes' entries in `agentStatusByPaneKey`:

```ts
function resolveAttention(
  panes: AgentStatusEntry[],     // entries belonging to this worktree's panes
  now: number
): WorktreeAttention {
  let bestCls: SmartClass = 4
  let bestTs = 0

  for (const entry of panes) {
    if (!isExplicitAgentStatusFresh(entry, now, AGENT_STATUS_STALE_AFTER_MS)) continue

    let cls: SmartClass
    let ts: number
    if (entry.state === 'blocked' || entry.state === 'waiting') {
      cls = 1
      ts = entry.stateStartedAt
    } else if (entry.state === 'done') {
      // Why: an interrupted `done` (user pressed Ctrl+C) is the user signalling
      // "I'm done with this turn". Treat as idle, not as Class 2 attention.
      if (entry.interrupted) continue
      cls = 2
      ts = entry.stateStartedAt
    } else {
      // working
      cls = 3
      // Why: within the working class, sort by the most-recent prior attention
      // event so a worktree that just transitioned done→working stays above one
      // that's been working for an hour. Falls back to current stateStartedAt
      // when stateHistory is empty (e.g. fresh after restart — see Edge case 8).
      const prior = mostRecentAttentionInHistory(entry.stateHistory)
      ts = prior ?? entry.stateStartedAt
    }

    // Why min: smaller class number = higher priority. Any pane in a more
    // attention-demanding class promotes the whole worktree.
    if (cls < bestCls || (cls === bestCls && ts > bestTs)) {
      bestCls = cls
      bestTs = ts
    }
  }

  return { cls: bestCls, attentionTimestamp: bestTs }
}

function mostRecentAttentionInHistory(history: AgentStateHistoryEntry[]): number | null {
  let max = 0
  for (const h of history) {
    // Why this works: `setAgentStatus` in `agent-status.ts` already pushes
    // `interrupted` onto history rows when an interrupted `done` transitions
    // out, so we see it on historical entries the same way as on the current.
    if (h.state === 'done' && h.interrupted) continue
    if (h.state === 'done' || h.state === 'blocked' || h.state === 'waiting') {
      if (h.startedAt > max) max = h.startedAt
    }
  }
  return max > 0 ? max : null
}
```

`stateHistory` is bounded at `AGENT_STATE_HISTORY_MAX = 20` — if an agent ping-pongs through 20+ working/done cycles inside one session, the very-oldest attention event scrolls off and the worktree's Class-3 timestamp will refresh to the next-oldest still in history. Acceptable tradeoff; the alternative is unbounded history per pane.

### Build-once-per-sort optimization

`agentStatusByPaneKey` is keyed by `${tabId}:${paneId}`. Build a `tabId → entries[]` index once per sort (the existing `buildExplicitEntriesByTabId` helper does this), then walk each worktree's tabs and accumulate. The aggregate cost is `O(E + N × T × H)` per sort, where E = total entries, N = worktrees, T = tabs/worktree, H = history length. With H bounded at 20 and typical T ≤ 4, this is comfortably below the existing decorate-sort-undecorate path.

### The comparator

```ts
function buildSmartComparator(
  attentionByWorktree: Map<string, WorktreeAttention>,
  now: number
) {
  return (a: Worktree, b: Worktree) => {
    const aw = attentionByWorktree.get(a.id) ?? IDLE
    const bw = attentionByWorktree.get(b.id) ?? IDLE
    return (
      aw.cls - bw.cls ||                         // 1 < 2 < 3 < 4
      bw.attentionTimestamp - aw.attentionTimestamp ||
      effectiveRecentActivity(b, now) - effectiveRecentActivity(a, now) ||
      a.displayName.localeCompare(b.displayName)
    )
  }
}
const IDLE: WorktreeAttention = { cls: 4, attentionTimestamp: 0 }
```

### Stable rank during interaction

The current implementation uses `precomputedScores` to keep `Array.sort` stable across the comparator's O(N log N) calls. The new design preserves this: build `attentionByWorktree` once before sort and pass it into the comparator. No score-snapshot indirection (`SmartSortOverride`) is needed — the resolved class/timestamp is already a frozen pre-sort decoration.

For the *currently-focused* worktree specifically, we do not freeze its position. If the user's active worktree transitions class while they're interacting, it will move on the next re-sort. This is consistent with today's behavior. If we later find users want "stable rank for the focused tab during a single editing session," it's a separate, bounded change.

### Code to delete

- `computeSmartScore`, `computeSmartScoreFromSignals`
- `hasRecentPRSignal` (caller in smart-sort only; PR cache stays for grouping)
- `SmartSortOverride` and the `smartSortOverrides` parameter — overrides existed to freeze decay-based scores; class/timestamp don't decay between events
- `precomputedScores` parameter (replaced by `attentionByWorktree`)
- `CREATE_GRACE_MS` *override* path stays for `recent`, and is reused as the Class 4 tiebreaker — no behavior change there

### Caller updates

Every caller of `sortWorktreesSmart` (and the smart branch of `buildWorktreeComparator`) MUST thread `agentStatusByPaneKey`. With the terminal-title heuristic dropped from sort (Open Question #3), a caller that omits agent status collapses every worktree to Class 4 — no fallback signal carries the ranking.

Callers today (verify before each edit):

- `src/renderer/src/components/sidebar/visible-worktrees.ts:179` — already threads `state.agentStatusByPaneKey` (no change needed).
- `src/renderer/src/components/sidebar/visible-worktrees.ts:188` — already threads `state.agentStatusByPaneKey` (no change needed).
- `src/renderer/src/components/sidebar/WorktreeList.tsx:652` — uses `buildWorktreeComparator`; verify it threads agent status (it does today via the parent state read).
- `src/renderer/src/components/WorktreeJumpPalette.tsx:227` and `:239` — currently `sortWorktreesSmart(visibleWorktrees, tabsByWorktree, repoMap, prCache)` (4 args). **Must change** to pass `agentStatusByPaneKey` from the store.

Make `agentStatusByPaneKey` **non-optional** in the new `sortWorktreesSmart` signature. Why: a forgotten caller fails type-check rather than silently regressing palette ordering to "all Class 4". Same for the `agentStatusByPaneKey` parameter on `buildWorktreeComparator`'s smart branch.

### Implementation plan (step-by-step)

This section is the implementation handoff. Follow in order; each step lands a coherent, testable change.

**Step 1 — Add the class + attention helpers.**
- New file: `src/renderer/src/components/sidebar/smart-attention.ts`.
- Export `SmartClass = 1 | 2 | 3 | 4`, `WorktreeAttention = { cls: SmartClass; attentionTimestamp: number }`, the constant `IDLE: WorktreeAttention = { cls: 4, attentionTimestamp: 0 }`.
- Implement `resolveAttention(panes, now)` and `mostRecentAttentionInHistory(history)` exactly as in "Per-worktree resolution" above.
- Unit tests for the helper directly (faster to iterate than going through the full sort): one entry per class, multi-pane min-class/max-timestamp, interrupted-done skip, history-only-interrupted fallback, stale-entry skip.

**Step 2 — Build the per-worktree attention map.**
- Add `buildAttentionByWorktree(worktrees, tabsByWorktree, agentStatusByPaneKey, now)` to `smart-attention.ts`.
- Reuse the existing `buildExplicitEntriesByTabId` index from `smart-sort.ts` (move it into `smart-attention.ts` if cleaner — it's only used by the smart path).
- Walk each worktree's tabs, collect their `AgentStatusEntry`s, call `resolveAttention`, store result in a `Map<worktreeId, WorktreeAttention>`.

**Step 3 — Rewrite the comparator.**
- In `smart-sort.ts`, replace the smart branch of `buildWorktreeComparator` with the class-then-recency comparator from "The comparator" section.
- Replace `precomputedScores` parameter with `attentionByWorktree: Map<string, WorktreeAttention>`.
- Make `agentStatusByPaneKey` non-optional on this parameter list (TypeScript will surface every caller).
- Delete `SmartSortOverride`, `smartSortOverrides`, `getSmartSortCandidate`, `precomputedScores`, `computeSmartScore`, `computeSmartScoreFromSignals`, `hasRecentPRSignal`. Keep `effectiveRecentActivity` and `CREATE_GRACE_MS` (used by `recent` and Class 4 tiebreaker).

**Step 4 — Rewrite `sortWorktreesSmart`.**
- Build `attentionByWorktree` once via `buildAttentionByWorktree`.
- Pass it into the comparator.
- Keep the existing cold-start branch (`!hasAnyLivePty`) using persisted `sortOrder` as today — see Open Question #5.

**Step 5 — Update callers.**
- Update `WorktreeJumpPalette.tsx:227` and `:239` to pass `state.agentStatusByPaneKey`.
- Run `pnpm typecheck` to confirm no other callers slipped through.

**Step 6 — Rewrite tests.**
- Replace numerical-score assertions in `smart-sort.test.ts` with the ordering invariants listed in "Tests to rewrite" below.
- Add a new test file `smart-attention.test.ts` for the `resolveAttention` helper.
- Add the palette regression test (covered in "Tests to rewrite").

**Step 7 — Verify and ship.**
- `pnpm typecheck && pnpm test smart-sort smart-attention`.
- Manual smoke: open Orca with several worktrees + agents in different states, switch to Smart sort, verify ordering matches the class table.
- Confirm no new console errors when `agentStatusByPaneKey` is empty (e.g., very early in app startup).

**What this design depends on, in order:**
1. Default-on agent status — **already merged on `main`** (PR #1538).
2. Persistence of `lastStatusByPaneKey` across restart — **separate change on the sibling branch** `agent-status-preserve-restart`. Smart-sort code can ship before this; the "Smart sees pre-quit state after restart" guarantee comes online when persistence merges. Verify the sibling branch's `AgentStatusIpcPayload` and `setAgentStatus`'s 4th `timing` arg are already present before relying on Edge case 8's claim about restored timestamps.

### Tests to rewrite

`smart-sort.test.ts` asserts numerical scores in a few places. New tests assert ordering invariants:

- A worktree whose agent is `blocked` ranks above one whose agent is `done`, regardless of which `stateStartedAt` is newer (class invariant).
- A worktree whose agent is `done` ranks above one whose agent is `working` (class invariant).
- Two `blocked` worktrees: the one whose `stateStartedAt` is more recent ranks first.
- A worktree with `state='working'` and a prior `done` in `stateHistory` ranks above another `working` worktree with no history.
- A `working` worktree whose history contains only interrupted-`done` entries falls back to the current `stateStartedAt` (the helper returns null and `??` activates).
- `interrupted` `done` worktrees rank in Class 4, not Class 2.
- Stale entries (`updatedAt > AGENT_STATUS_STALE_AFTER_MS` ago) are ignored — worktree falls to Class 4.
- Class 4 ties break on `effectiveRecentActivity`, then `displayName`.
- `working` transitions never promote a worktree above a `blocked` one.
- **Palette caller regression**: `WorktreeJumpPalette` ranks a `blocked` worktree above a `working` one when both flow through `sortWorktreesSmart` with `agentStatusByPaneKey` threaded — pins that the palette path uses class, not the dropped heuristic.

## Open questions

1. **Should we persist `attentionTimestamp` per worktree?** Recommendation: **no, for v1.** The hook-server cache persistence (sibling branch) covers the practical cold-start case — restart restores per-pane current state. A second persistence layer for worktree-level attention is redundant and adds a migration. Revisit only if users report cross-restart staleness in the `stateHistory`-only edge case (Edge case 8).
2. **Should viewing the worktree clear/demote the class?** Recommendation: **no for v1.** Keeping Class membership tied to objective agent state (not user view) means the dot, badge, and rank position tell a consistent story. The unread badge already records "you haven't seen it yet" and is the right place for view-acknowledged semantics. If users complain that the top of the list is stuck on something they already handled, the simplest follow-up is "demote on activation if and only if the unread badge clears" — small, scoped, additive.
3. **What about the heuristic permission-prompt detector for no-hook agents?** Recommendation: **drop it from sort.** The heuristic is fragile (terminal-title-string matching) and the new design is built on hook state. Agents without hooks (aider, custom shell scripts) land in Class 4 — same rank position as today's `recent` would give them. The detector continues to drive the per-card status dot for visibility, but no longer feeds into ranking. Trading a small visible-rank regression for non-hook agents in exchange for a much simpler, harder-to-fool comparator.
4. **What about a user actively typing in a no-agent worktree?** With Class 4 idle worktrees ordered by `effectiveRecentActivity`, an active no-agent worktree ranks at the top of Class 4 (above truly-stale ones) but still below every Class 1/2/3 worktree. For users whose primary workflow is "type in a worktree without an agent," Smart will feel agent-centric. **This is by design** — that's what `recent` is for. We should consider renaming the `lastActivityAt` tiebreaker logic if user feedback suggests confusion, but no change in v1.
5. **Migration.** Existing users with `sortBy: 'smart'` keep that selection — they get the new behavior automatically. The persisted `sortOrder` snapshot (used in cold-start before any PTY is alive) becomes meaningless under the new comparator; we discard it on first warm sort and re-snapshot. First cold start after this lands uses the pre-existing `sortOrder` snapshot until the persisted hook-server cache hydrates and the first warm sort runs (~1 frame after the bootstrap snapshot arrives), then the snapshot is overwritten. Briefly stale-looking ordering on first launch after upgrade is acceptable; no explicit invalidation needed. No user-visible migration needed.
