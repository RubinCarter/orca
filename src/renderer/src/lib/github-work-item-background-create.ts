import { toast } from 'sonner'

import { useAppStore } from '@/store'
import {
  beginBackgroundWorktreePreparation,
  continueBackgroundWorktreeCreation
} from '@/lib/worktree-creation-flow'
import {
  buildGitHubWorkItemBackendStartup,
  buildGitHubWorkItemStartupPlan,
  buildInitialGitHubWorkItemRequest,
  type GitHubWorkItemBackgroundStoreSnapshot,
  resolvePreferredQuickAgentForGitHubWorkItem
} from '@/lib/github-work-item-background-request'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import {
  resolveDirectPrStartPoint,
  resolveDirectSetupDecision
} from '@/lib/launch-work-item-direct-preflight'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import { getSettingsForRepoRuntimeOwner } from '@/lib/repo-runtime-owner'
import type { GitHubWorkItem, SetupDecision } from '../../../shared/types'
import type { TaskSourceContext, WorkspaceRunContext } from '../../../shared/task-source-context'

export type BackgroundGitHubWorkItemCreateResult =
  | { kind: 'background-started' }
  | { kind: 'error' }
  | { kind: 'fallback'; reason: 'repo-missing' | 'setup-ask' | 'pr-start-point' }

type BackgroundGitHubWorkItemCreateDeps = {
  getStore: () => GitHubWorkItemBackgroundStoreSnapshot
  hasPendingCreate: (creationId: string) => boolean
  resolveSetupDecision: typeof resolveDirectSetupDecision
  resolvePrStartPoint: typeof resolveDirectPrStartPoint
  confirmHooks: (
    store: GitHubWorkItemBackgroundStoreSnapshot,
    repoId: string,
    scope: 'setup'
  ) => ReturnType<typeof ensureHooksConfirmed>
  beginBackgroundCreate: typeof beginBackgroundWorktreePreparation
  continueBackgroundCreate: typeof continueBackgroundWorktreeCreation
  removePendingCreate: (creationId: string) => void
  toastError: (message: string) => void
}

export type BackgroundGitHubWorkItemCreateArgs = {
  item: GitHubWorkItem
  repoId: string
  taskSourceContext?: TaskSourceContext | null
  workspaceRunContext?: WorkspaceRunContext | null
  telemetrySource?: WorktreeCreationRequest['telemetrySource']
  openModalFallback: () => void
}

const DEFAULT_DEPS: BackgroundGitHubWorkItemCreateDeps = {
  getStore: () => useAppStore.getState(),
  hasPendingCreate: (creationId) =>
    useAppStore.getState().pendingWorktreeCreations[creationId] != null,
  resolveSetupDecision: resolveDirectSetupDecision,
  resolvePrStartPoint: resolveDirectPrStartPoint,
  confirmHooks: (store, repoId, scope) =>
    ensureHooksConfirmed(store as ReturnType<typeof useAppStore.getState>, repoId, scope),
  beginBackgroundCreate: beginBackgroundWorktreePreparation,
  continueBackgroundCreate: continueBackgroundWorktreeCreation,
  removePendingCreate: (creationId) =>
    useAppStore.getState().removePendingWorktreeCreation(creationId),
  toastError: (message) => toast.error(message)
}

export async function createGitHubWorkItemWorkspaceInBackground(
  args: BackgroundGitHubWorkItemCreateArgs,
  deps: BackgroundGitHubWorkItemCreateDeps = DEFAULT_DEPS
): Promise<BackgroundGitHubWorkItemCreateResult> {
  const store = deps.getStore()
  const repo = store.repos.find((candidate) => candidate.id === args.repoId)
  if (!repo) {
    args.openModalFallback()
    return { kind: 'fallback', reason: 'repo-missing' }
  }

  const initialRequest = buildInitialGitHubWorkItemRequest(args, repo)
  const creationId = deps.beginBackgroundCreate(initialRequest)

  try {
    const repoOwnerSettings = getSettingsForRepoRuntimeOwner(store, args.repoId)
    const setupResolution = await deps.resolveSetupDecision(args.repoId, repo, repoOwnerSettings)
    if (!deps.hasPendingCreate(creationId)) {
      return { kind: 'background-started' }
    }
    if (setupResolution.kind === 'needs-modal') {
      deps.removePendingCreate(creationId)
      args.openModalFallback()
      return { kind: 'fallback', reason: 'setup-ask' }
    }

    let baseBranch: string | undefined
    let pushTarget: WorktreeCreationRequest['pushTarget']
    let branchNameOverride: string | undefined
    let compareBaseRef: string | undefined
    if (args.item.type === 'pr' && args.item.number) {
      try {
        const result = await deps.resolvePrStartPoint(
          args.repoId,
          args.item.number,
          repoOwnerSettings,
          args.item
        )
        baseBranch = result.baseBranch
        pushTarget = result.pushTarget
        branchNameOverride = result.branchNameOverride
        compareBaseRef = result.compareBaseRef
        if (!deps.hasPendingCreate(creationId)) {
          return { kind: 'background-started' }
        }
      } catch (error) {
        if (!deps.hasPendingCreate(creationId)) {
          return { kind: 'background-started' }
        }
        deps.toastError(error instanceof Error ? error.message : 'Unable to resolve pull request.')
        deps.removePendingCreate(creationId)
        args.openModalFallback()
        return { kind: 'fallback', reason: 'pr-start-point' }
      }
    }

    const trustDecision = await deps.confirmHooks(store, args.repoId, 'setup')
    if (!deps.hasPendingCreate(creationId)) {
      return { kind: 'background-started' }
    }
    const setupDecision: SetupDecision =
      trustDecision === 'skip' ? 'skip' : setupResolution.decision
    const agent = await resolvePreferredQuickAgentForGitHubWorkItem(store, repo)
    if (!deps.hasPendingCreate(creationId)) {
      return { kind: 'background-started' }
    }
    const { startupPlan, quickPrompt, quickTelemetry } = buildGitHubWorkItemStartupPlan({
      agent,
      item: args.item,
      repo,
      store
    })
    const backendStartup = buildGitHubWorkItemBackendStartup(agent, startupPlan, quickTelemetry)

    const request: WorktreeCreationRequest = {
      ...initialRequest,
      ...(baseBranch ? { baseBranch } : {}),
      ...(compareBaseRef ? { compareBaseRef } : {}),
      setupDecision,
      ...(pushTarget ? { pushTarget } : {}),
      agent,
      ...(branchNameOverride ? { branchNameOverride } : {}),
      ...(backendStartup ? { startup: backendStartup } : {}),
      startupPlan,
      quickPrompt,
      quickTelemetry
    }

    deps.continueBackgroundCreate(creationId, request)
    return { kind: 'background-started' }
  } catch (error) {
    if (!deps.hasPendingCreate(creationId)) {
      return { kind: 'background-started' }
    }
    deps.removePendingCreate(creationId)
    deps.toastError(error instanceof Error ? error.message : 'Unable to prepare workspace.')
    return { kind: 'error' }
  }
}
