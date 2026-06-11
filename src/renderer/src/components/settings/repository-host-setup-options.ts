import { getExecutionHostLabel, type ExecutionHostId } from '../../../../shared/execution-host'
import type { ExecutionHostRegistryEntry } from '../../../../shared/execution-host-registry'
import type { ProjectHostSetup, ProjectHostSetupState } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'

export type SetupHostOption = {
  id: ExecutionHostId
  label: string
}

export function getSetupStateLabel(setupState: ProjectHostSetupState): string {
  switch (setupState) {
    case 'ready':
      return translate('auto.components.settings.RepositoryPane.hostSetupStateReady', 'Ready')
    case 'not-set-up':
      return translate(
        'auto.components.settings.RepositoryPane.hostSetupStateNotSetUp',
        'Not set up'
      )
    case 'setting-up':
      return translate(
        'auto.components.settings.RepositoryPane.hostSetupStateSettingUp',
        'Setting up'
      )
    case 'error':
      return translate('auto.components.settings.RepositoryPane.hostSetupStateError', 'Error')
    case 'unsupported':
      return translate(
        'auto.components.settings.RepositoryPane.hostSetupStateUnsupported',
        'Unsupported'
      )
  }
}

export function buildSetupHostOptions({
  projectHostSetups,
  hostOptions
}: {
  projectHostSetups: ProjectHostSetup[]
  hostOptions: readonly ExecutionHostRegistryEntry[]
}): SetupHostOption[] {
  const setupHostIds = new Set(projectHostSetups.map((setup) => setup.hostId))
  return hostOptions
    .filter((host) => !setupHostIds.has(host.id))
    .map((host) => ({
      id: host.id,
      label: host.label || getExecutionHostLabel(host.id)
    }))
}
