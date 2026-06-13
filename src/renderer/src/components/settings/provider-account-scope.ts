import type { GlobalSettings } from '../../../../shared/types'

export type ProviderAccountScope = {
  label: string
  description: string
}

export type ProviderRateLimitScope = {
  label: string
  description: string
}

export function getProviderAccountScope(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined
): ProviderAccountScope {
  const runtimeId = settings?.activeRuntimeEnvironmentId?.trim()
  if (runtimeId) {
    return {
      label: `Remote server: ${runtimeId}`,
      description:
        'Credentials and account checks for this provider are owned by this remote server. Choose a different Host from Settings > Active Server to edit another account scope.'
    }
  }
  return {
    label: 'Local Mac',
    description:
      'Credentials and account checks for this provider are owned by this desktop client. Choose a remote Host from Settings > Active Server to edit server-owned credentials.'
  }
}

export function getProviderRateLimitScope(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined,
  providerLabel: string
): ProviderRateLimitScope {
  const runtimeId = settings?.activeRuntimeEnvironmentId?.trim()
  if (runtimeId) {
    return {
      label: `Remote server: ${runtimeId}`,
      description: `${providerLabel} API budget is fetched from the CLI on this remote server. Choose a different Host from Settings > Active Server to view another budget.`
    }
  }
  return {
    label: 'Local Mac',
    description: `${providerLabel} API budget is fetched from the CLI on this desktop client. Choose a remote Host from Settings > Active Server to view server-owned budgets.`
  }
}
