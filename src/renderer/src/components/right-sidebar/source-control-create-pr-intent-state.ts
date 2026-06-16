import { shouldForcePushWithLeaseForUpstream } from '../../../../shared/git-upstream-status'
import type { HostedReviewCreationEligibility } from '../../../../shared/hosted-review'
import { supportsHostedReviewCreation } from '../../../../shared/hosted-review-creation-providers'
import type { GitUpstreamStatus } from '../../../../shared/types'
import type { PrimaryAction } from './source-control-primary-action-types'

export type CreatePrIntentKind =
  | 'dirty'
  | 'message_required'
  | 'no_upstream'
  | 'needs_push'
  | 'force_push'

export type CreatePrIntentEligibility = {
  eligible: boolean
  kind: CreatePrIntentKind | null
}

export function resolveCreatePrIntentEligibility({
  stagedCount,
  hasStageableChanges,
  hasMessage,
  hasUnresolvedConflicts,
  upstreamStatus,
  hostedReviewCreation,
  branchCommitsAhead,
  hasCurrentBranch = true
}: {
  stagedCount: number
  hasStageableChanges: boolean
  hasMessage: boolean
  hasUnresolvedConflicts: boolean
  upstreamStatus: GitUpstreamStatus | undefined
  hostedReviewCreation?: HostedReviewCreationEligibility | null
  branchCommitsAhead?: number
  hasCurrentBranch?: boolean
}): CreatePrIntentEligibility {
  if (
    hasUnresolvedConflicts ||
    !hasCurrentBranch ||
    !hostedReviewCreation ||
    hostedReviewCreation.canCreate ||
    !supportsHostedReviewCreation(hostedReviewCreation.provider)
  ) {
    return { eligible: false, kind: null }
  }

  if (hostedReviewCreation.blockedReason === 'dirty') {
    if (stagedCount > 0 && !hasMessage) {
      return { eligible: true, kind: 'message_required' }
    }
    return { eligible: stagedCount > 0 || hasStageableChanges, kind: 'dirty' }
  }

  if (hostedReviewCreation.blockedReason === 'no_upstream') {
    const hasPublishableCommits = branchCommitsAhead === undefined ? false : branchCommitsAhead > 0
    return {
      eligible: hasPublishableCommits || stagedCount > 0 || hasStageableChanges,
      kind: 'no_upstream'
    }
  }

  if (hostedReviewCreation.blockedReason === 'needs_push') {
    return { eligible: true, kind: 'needs_push' }
  }

  if (
    hostedReviewCreation.blockedReason === 'needs_sync' &&
    shouldForcePushWithLeaseForUpstream(upstreamStatus)
  ) {
    return { eligible: true, kind: 'force_push' }
  }

  return { eligible: false, kind: null }
}

export function resolveVisibleCreatePrHeaderAction({
  createPrHeaderAction,
  directCreatePrAction,
  isCreatePrIntentInFlight,
  primaryActionKind
}: {
  createPrHeaderAction: PrimaryAction | null
  directCreatePrAction: PrimaryAction | null
  isCreatePrIntentInFlight: boolean
  primaryActionKind: PrimaryAction['kind']
}): PrimaryAction | null {
  if (directCreatePrAction) {
    return null
  }
  // Why: CommitArea already mirrors in-flight Create PR intent on the primary;
  // keeping a second spinning header button stacks redundant spinners once
  // message generation also shows one.
  if (isCreatePrIntentInFlight && primaryActionKind === 'create_pr_intent') {
    return null
  }
  return createPrHeaderAction
}
