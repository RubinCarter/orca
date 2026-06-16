import { translate } from '@/i18n/i18n'
import {
  localizedHostedReviewCopy,
  resolveSupportedHostedReviewCopyProvider
} from '@/i18n/hosted-review-localized-copy'
import type { PrimaryAction, PrimaryActionInputs } from './source-control-primary-action-types'
import { resolveCreatePrIntentEligibility } from './source-control-create-pr-intent-state'

export function resolveCreatePrIntentInFlightPrimaryAction(
  inputs?: Pick<PrimaryActionInputs, 'hostedReviewCreation'>
): PrimaryAction {
  const copy = localizedHostedReviewCopy(
    resolveSupportedHostedReviewCopyProvider(inputs?.hostedReviewCreation?.provider)
  )

  return {
    kind: 'create_pr_intent',
    label: translate(
      'auto.components.right.sidebar.source.control.primary.action.e7ffa46946',
      'Create {{value0}}',
      { value0: copy.shortLabel }
    ),
    title: translate(
      'auto.components.right.sidebar.source.control.primary.action.d37e68f61d',
      'Preparing branch for review…'
    ),
    disabled: true
  }
}

export function resolveCreatePrIntentPrimaryAction(
  inputs: PrimaryActionInputs
): PrimaryAction | null {
  const createPrIntent = resolveCreatePrIntentEligibility({
    stagedCount: inputs.stagedCount,
    hasStageableChanges: inputs.hasStageableChanges,
    hasMessage: inputs.hasMessage,
    hasUnresolvedConflicts: inputs.hasUnresolvedConflicts,
    upstreamStatus: inputs.upstreamStatus,
    hostedReviewCreation: inputs.hostedReviewCreation,
    branchCommitsAhead: inputs.branchCommitsAhead,
    hasCurrentBranch: inputs.hasCurrentBranch
  })
  if (!createPrIntent.eligible) {
    return null
  }
  const copy = localizedHostedReviewCopy(
    resolveSupportedHostedReviewCopyProvider(inputs.hostedReviewCreation?.provider)
  )
  return {
    kind: 'create_pr_intent',
    label: translate(
      'auto.components.right.sidebar.source.control.primary.action.e7ffa46946',
      'Create {{value0}}',
      { value0: copy.shortLabel }
    ),
    title: translate(
      'auto.components.right.sidebar.source.control.primary.action.c72e5e65d1',
      'Prepare this branch and create a {{value0}}',
      { value0: copy.reviewLabel }
    ),
    disabled: false
  }
}

export function resolveCreatePrHeaderAction(inputs: PrimaryActionInputs): PrimaryAction | null {
  if (inputs.isPrIntentInFlight) {
    return resolveCreatePrIntentInFlightPrimaryAction(inputs)
  }

  if (inputs.isCommitting || inputs.isRemoteOperationActive || inputs.hasUnresolvedConflicts) {
    return null
  }

  if (inputs.hostedReviewCreation?.canCreate) {
    const copy = localizedHostedReviewCopy(
      resolveSupportedHostedReviewCopyProvider(inputs.hostedReviewCreation.provider)
    )
    return {
      kind: 'create_pr',
      label: translate(
        'auto.components.right.sidebar.source.control.primary.action.e7ffa46946',
        'Create {{value0}}',
        { value0: copy.shortLabel }
      ),
      title: translate(
        'auto.components.right.sidebar.source.control.primary.action.946a8a05ea',
        'Create a {{value0}} for this branch',
        { value0: copy.reviewLabel }
      ),
      disabled: false
    }
  }

  return resolveCreatePrIntentPrimaryAction(inputs)
}
