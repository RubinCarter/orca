# Lift Git Action Restrictions

## Problem

Source Control disables several git actions before the user can try them, even when the underlying git command already returns a clear error:

- `source-control-dropdown-items.ts` renders every dropdown row but marks many rows disabled based on predicted state.
- Dropdown remote rows block no-op or likely-failing commands such as zero-ahead Push, zero-behind Pull/Fast-forward, diverged Fast-forward, dirty Rebase from Base, and zero-ahead Force Push.
- Dropdown Publish/Create Review rows block several states that already have a concrete command or a good validation message.
- `source-control-primary-unpublished-action.ts` blocks Publish Branch when the local branch has no commits ahead, even though publishing can still create the remote branch at the current HEAD.
- `source-control-primary-action.ts` routes partially staged files to `Stage All`, blocking a normal staged commit.
- `source-control-commit-eligibility.ts` treats partial staging as a commit-disabled reason.
- `SourceControl.tsx` and `store/slices/editor.ts` already surface commit, remote, and hosted-review failures through inline notices and toasts.

## Goal

Make Source Control action surfaces less paternalistic: when the app has enough information to invoke a concrete git/review operation, let the user click it and rely on existing inline/toast error handling if git or the provider rejects it.

## Non-goals

- Do not intentionally allow duplicate operations in the same renderer while a commit, remote action, abort, generation, or review creation is already in flight.
- Do not bypass required command inputs that currently fail silently, such as an empty commit message, no selected worktree, or a missing rebase base ref.
- Do not change main-process git behavior, provider creation APIs, or remote error classifiers.
- Do not redesign Source Control layout, button styling, icons, or menu ordering.
- Do not add GitHub-only review terminology; keep generic hosted-review copy for GitLab, Azure DevOps, and Gitea.
- Do not add a cross-window distributed operation lock. Other windows, terminals, and external git commands can race; git/provider validation remains the source of truth.

## Design

1. Relax commit eligibility for partially staged files.
   - `Commit`, `Commit & Push`, and `Commit & Sync` should be enabled when staged files and a non-empty message exist, even if the same path also has unstaged hunks.
   - Keep disabled states for no staged files, no message, unresolved conflicts, and in-flight operations because `handleCommit` returns before git runs for those cases.
   - Keep the message field enabled only for the existing empty-message blocker; partial staging should no longer lock the field.

2. Stop using `Stage All` as the primary action for partial staging.
   - If staged files and a message exist, the primary should stay `Commit`.
   - If there are only unstaged or untracked changes, keep `Stage All` as the primary.
   - Create-review intent can still use Stage All as an additive preparation path when it is the selected action; do not regress the intent flow's ability to stage and commit dirty changes.

3. Let unpublished-branch primary Publish run when a branch exists.
   - If there is no upstream and the current branch is known, the clean-tree primary should be `Publish Branch` even when `branchCommitsAhead === 0`.
   - Keep detached HEAD, linked-review target, PR-loading, and merged-review guards because those states either cannot safely parameterize a branch publish or are waiting on review ownership.
   - Dirty trees with only unstaged/untracked changes can still use `Stage All` as the primary; Publish Branch remains available from the dropdown when its branch target is valid.

4. Make dropdown remote/review rows invoke-first whenever a handler exists.
   - Keep same-renderer busy flags disabled: `isCommitting`, `isRemoteOperationActive`, abort busy, review detail generation, review creation, and create-review intent.
   - Keep rows disabled when the renderer cannot safely parameterize a command: no active worktree target, detached HEAD for branch push/publish/review creation, no upstream or linked-review push target for pull/push/sync, no remote base ref for rebase, unsupported hosted-review provider, or an existing hosted review.
   - Treat `upstreamStatus === undefined` as a loading state only for upstream-dependent rows. Commit rows and Fetch do not need upstream counts; Publish/Pull/Push/Sync/Fast-forward/Force Push should wait so a tracked branch does not flash as unpublished during worktree switches.
   - Treat hosted-review eligibility loading as Create Review loading, not a whole-dropdown lock.
   - Enable no-op or predicted-failure rows when their handler can run: Push with zero ahead, Pull with zero behind, Sync when already in sync, Fast-forward on diverged/clean branches, Force Push with zero ahead, Publish Branch with no branch commits, and Rebase with dirty files. Use visible hint text for likely prerequisites; do not rely on tooltips alone for critical guidance.

5. Make direct Create Review clicks surface eligibility errors instead of silently returning.
   - `handleCreatePullRequest` currently returns if `hostedReviewCreation?.canCreate` is false, and the header click handler returns early for disabled actions.
   - For supported blocked reasons with useful user feedback (`dirty`, `default_branch`, `no_upstream`, `needs_push`, `needs_sync`, `auth_required`), allow the row/header click and set `createPrIntentNotice` using provider-localized copy.
   - Keep `detached_head`, `unsupported_provider`, `existing_review`, `fork_head_unsupported`, null/loading eligibility, and missing title/base submit blockers non-clickable or locally guarded unless the implementation also supplies a concrete, visible notice.
   - When eligibility says `canCreate`, keep using `createHostedReview`; the main/runtime preflight revalidates branch, dirty state, upstream, ahead/behind, and auth for local and SSH contexts before calling the provider.

6. Update focused unit tests.
   - Change tests that assert restrictive disabled states into tests that assert clickable rows with explanatory titles/hints.
   - Add regression tests for partial staged commit enablement, zero-ahead unpublished primary publish, and blocked Create Review dropdown/header enablement.

## Data Flow

- Git status and hosted-review eligibility feed `resolvePrimaryAction`, `resolveCreatePrHeaderAction`, and `resolveDropdownItems`.
- The resolvers return labels, titles, hints, and disabled booleans.
- `CommitArea` disables DOM controls only when those booleans are true.
- Enabled clicks call `handleActionInvoke`.
- `handleActionInvoke` calls `handleCommit`, `runCompoundCommitAction`, `runRemoteAction`, `runCreatePrIntent`, or `handleCreatePullRequest`.
- Git/provider failures flow to existing toasts and inline notices through `resolveRemoteOperationErrorMessage`, `setRemoteActionErrors`, `setCommitErrors`, and `setCreatePrIntentNoticeForWorktree`.
- Remote handlers already pass `connectionId`, owner-runtime settings, and `pushTarget`; do not add local-path-only shortcuts.

## Edge Cases

- Upstream status is `undefined`: keep upstream-dependent rows disabled to avoid re-publishing an already tracked branch during the worktree-switch loading window; Fetch and commit actions can remain available.
- In-flight operations: keep affected actions disabled within the current renderer to avoid duplicate pushes, pulls, commits, rebases, aborts, and review creation.
- Multi-window/external mutation: another Orca window, terminal, or SSH-side process can still mutate the repo between render and click. Do not promise renderer consistency here; rely on git/provider errors and refresh status after each action.
- SSH-backed worktrees: continue passing `connectionId`, `runtimeTargetSettings`, and `pushTarget` through existing handlers; no local path assumptions.
- Detached HEAD: keep branch publish/push/review creation disabled because there is no branch ref to push.
- Dirty rebase and pull/fast-forward: allow the click; git rejection should surface via existing rebase/pull/fast-forward error messages.
- Empty commit message or no staged files: keep commit disabled because `handleCommit` currently returns false without a user-visible error.
- Partially staged files: `git commit` commits the index and leaves unstaged hunks behind; this is the requested behavior, not an error.
- Publish with no branch commits: this may succeed by creating a remote branch at the current HEAD. That is acceptable on both the primary and dropdown surfaces; do not describe it as a guaranteed failure.
- Push/Force Push with zero ahead and Pull/Fast-forward with zero behind may succeed as no-ops. Still refresh status afterwards so the UI does not look stale.
- Sync is not free: `syncBranch` fetches, reads upstream status, pulls or force-pushes, may read status again, and conditionally pushes. Keep the busy state and spinner behavior because this can be network-visible latency.
- Unsupported hosted-review provider or existing review: keep Create Review disabled because there is no create operation to retry.
- Auth-required Create Review: allow click and show a provider-specific authentication notice instead of doing nothing.
- GitLab/Azure DevOps/Gitea copy: keep using hosted-review localization so generic review UI does not regress to GitHub-only language.
- Stale Create Review eligibility: if the UI thought the branch was ready, `createHostedReview` revalidates in main/runtime and returns provider-localized validation errors. Do not duplicate that preflight in the renderer.

## Test Plan

- Unit: `src/renderer/src/components/right-sidebar/source-control-commit-eligibility.test.ts` should verify partially staged commits are eligible when staged files and a message exist, and the message field is not locked solely because of partial staging.
- Unit: `src/renderer/src/components/right-sidebar/source-control-primary-action.test.ts` should verify partial staging keeps `Commit` primary when staged files and a message exist, and a clean unpublished branch with zero branch commits resolves to enabled `Publish Branch`.
- Unit: `src/renderer/src/components/right-sidebar/source-control-dropdown-items.test.ts` should verify predicted-failure remote rows are enabled while still locked during busy/loading states.
- Unit: `src/renderer/src/components/right-sidebar/source-control-primary-action.create-pr-intent.test.ts`, `source-control-create-pr-intent-state.test.ts`, and dropdown tests should verify blocked-but-supported Create Review states remain clickable or route to intent where appropriate.
- Unit/React: `CommitArea.test.tsx` should continue to cover inline commit/remote/Create Review notices; add header-toolbar or SourceControl coverage if the blocked Create Review header becomes clickable.
- Electron: validate the Source Control split button and dropdown in clean, dirty/staged, and blocked Create Review states.

## UI Quality Bar

No layout redesign. The split button, header Create Review button, dropdown density, disabled opacity for truly disabled rows, and inline notice styling must continue to match `docs/STYLEGUIDE.md` and adjacent Source Control controls. Enabled rows that are likely to fail should look like normal menu items, with concise visible hint text when the prerequisite matters; tooltips can repeat details but must not be the only place critical feedback appears.

## Review Screenshots

1. Source Control dropdown on a clean tracked branch: formerly disabled no-op remote rows such as Push/Pull/Sync are clickable-looking, while in-flight/loading rows still show disabled styling only when applicable.
2. Source Control with staged plus unstaged changes in the same file and a commit message: primary button is `Commit`, not `Stage All`, and dropdown commit rows are enabled.
3. Source Control Create Review blocked state, such as dirty/no-upstream/needs-push/auth-required: row/header remains visible and clickable-looking with explanatory hint or inline notice copy.
4. Adjacent smoke: an in-flight remote or hosted review operation still disables actions and shows spinner/disabled styling.

## Rollout

1. Adjust commit eligibility and primary action resolution for partial staging.
2. Relax dropdown disabled booleans while keeping same-renderer busy, missing-target, upstream-loading, and unsupported-provider guards.
3. Add blocked Create Review notice handling for enabled-but-ineligible direct Create Review clicks.
4. Update resolver and component tests.
5. Run typecheck, lint, focused tests, then Electron validation screenshots.
6. Do not add new max-lines lint disables; split concrete resolver modules if the implementation needs more room.

## Lightweight Eng Review

- Scope: Reduced to renderer source-control action availability and notices; no main-process git/provider changes.
- Architecture/data flow: Keep the existing pure resolver -> click handler -> store action flow. The only behavior shift is fewer resolver-level disabled flags and a visible notice for blocked direct Create Review attempts.
- Failure modes covered:
  - Stale upstream loading still disables upstream-dependent rows, while Fetch/commit do not need to wait for counts.
  - Duplicate operations stay blocked through existing same-renderer busy flags.
  - Missing worktree/base/branch targets remain non-clickable or no-op guarded.
  - Dirty pull/rebase/fast-forward and no-op push/pull/force-push rely on existing git error formatting.
  - Hosted-review provider differences stay behind localized provider copy, eligibility provider checks, and main/runtime preflight validation.
- Test coverage required:
  - Resolver unit tests for partial staging commit enablement.
  - Dropdown unit tests for clickable predicted-failure rows and still-disabled loading/busy rows.
  - Blocked Create Review unit/React coverage for visible notice behavior where feasible.
  - Electron screenshots for dropdown, partial staging, Create Review blocked, and busy-state smoke.
- Performance/blast radius: No new polling, persistence, or watchers. Fewer disabled checks are render-time pure resolver changes; newly enabled clicks can run existing network git/provider IPC that was previously blocked.
- UI quality bar: UI-visible but not redesigned; Electron validation should confirm enabled/disabled affordances remain consistent with Source Control density, typography, spacing, tooltip, hint, and inline notice patterns in `docs/STYLEGUIDE.md`.
- Required review screenshots:
  1. Clean tracked branch dropdown with formerly restricted rows visible as enabled.
  2. Partially staged file with commit message showing `Commit` primary and enabled commit rows.
  3. Blocked Create Review state showing clickable-looking action plus explanatory hint/notice.
  4. In-flight operation smoke showing actions still disabled.
- Residual risks:
  - Some newly clickable no-op git commands may produce generic git errors if the runtime does not classify that exact stderr yet; acceptable because the request prefers attempted actions over preemptive restriction.
  - Renderer busy flags do not coordinate across multiple Orca windows. Concurrent clicks from another window or terminal can still race and must be handled by git/provider validation plus post-action refresh.
