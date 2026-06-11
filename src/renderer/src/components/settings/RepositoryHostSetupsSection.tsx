import { useMemo, useState } from 'react'
import { getExecutionHostLabel } from '../../../../shared/execution-host'
import { type ExecutionHostId } from '../../../../shared/execution-host'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host-registry'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import type { Repo } from '../../../../shared/types'
import { useAppStore } from '../../store'
import { getProjectHostSetupProjectionFromState } from '../../store/selectors'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SearchableSetting } from './SearchableSetting'
import { SettingsBadge } from './SettingsFormControls'
import { matchesSettingsSearch } from './settings-search'
import type { SettingsSearchEntry } from './settings-search'
import { translate } from '@/i18n/i18n'
import { buildSetupHostOptions, getSetupStateLabel } from './repository-host-setup-options'

type RepositoryHostSetupsSectionProps = {
  repo: Repo
  forceVisible: boolean
  searchQuery: string
  searchEntries: SettingsSearchEntry[]
}

export function RepositoryHostSetupsSection({
  repo,
  forceVisible,
  searchQuery,
  searchEntries
}: RepositoryHostSetupsSectionProps): React.JSX.Element | null {
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const setupProjectExistingFolder = useAppStore((state) => state.setupProjectExistingFolder)
  const setupProjectClone = useAppStore((state) => state.setupProjectClone)
  const createProjectHostSetup = useAppStore((state) => state.createProjectHostSetup)
  const deleteProjectHostSetup = useAppStore((state) => state.deleteProjectHostSetup)
  const repos = useAppStore((state) => state.repos)
  const sshTargetLabels = useAppStore((state) => state.sshTargetLabels)
  const sshConnectionStates = useAppStore((state) => state.sshConnectionStates)
  const settings = useAppStore((state) => state.settings)
  const runtimeStatusByEnvironmentId = useAppStore((state) => state.runtimeStatusByEnvironmentId)
  const hostLabelOverrides = useMemo(() => getHostDisplayLabelOverrides(settings), [settings])
  const hostOptions = useMemo(
    () =>
      buildExecutionHostRegistry({
        repos,
        settings,
        sshTargetLabels,
        sshConnectionStates,
        runtimeStatusByEnvironmentId,
        hostLabelOverrides
      }),
    [
      repos,
      settings,
      sshTargetLabels,
      sshConnectionStates,
      runtimeStatusByEnvironmentId,
      hostLabelOverrides
    ]
  )
  const projectHostSetupProjection = useAppStore((state) =>
    getProjectHostSetupProjectionFromState(state)
  )
  const selectedProjectHostSetup = projectHostSetupProjection.setups.find(
    (setup) => setup.repoId === repo.id
  )
  const projectHostSetups = selectedProjectHostSetup
    ? projectHostSetupProjection.setups.filter(
        (setup) => setup.projectId === selectedProjectHostSetup.projectId
      )
    : []
  const setupHostOptions = buildSetupHostOptions({
    projectHostSetups,
    hostOptions
  })
  const [selectedSetupHostId, setSelectedSetupHostId] = useState<ExecutionHostId | null>(null)
  const [setupPath, setSetupPath] = useState('')
  const [setupKind, setSetupKind] = useState<'git' | 'folder'>('git')
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneDestination, setCloneDestination] = useState('')
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [isCreatingPendingSetup, setIsCreatingPendingSetup] = useState(false)
  const [deletingSetupId, setDeletingSetupId] = useState<string | null>(null)
  const setupTargetHostId = selectedSetupHostId ?? setupHostOptions[0]?.id ?? null

  if (
    (projectHostSetups.length <= 1 && setupHostOptions.length === 0) ||
    (!forceVisible && !matchesSettingsSearch(searchQuery, searchEntries))
  ) {
    return null
  }

  return (
    <SearchableSetting
      title={translate('auto.components.settings.RepositoryPane.availableHosts', 'Available Hosts')}
      description={translate(
        'auto.components.settings.RepositoryPane.availableHostsDescription',
        'Hosts where this project is set up.'
      )}
      keywords={[repo.displayName, 'host', 'ssh', 'remote', 'vm', 'path']}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <Label className="text-sm font-semibold">
          {translate('auto.components.settings.RepositoryPane.availableHosts', 'Available Hosts')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryPane.availableHostsHelp',
            'Project paths and worktree settings are host-specific; creating a workspace can target any ready setup.'
          )}
        </p>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {projectHostSetups.map((setup) => {
          const isCurrentSetup = setup.repoId === repo.id
          const canOpenSetup = setup.repoId.trim().length > 0
          const canRemoveSetup = !canOpenSetup && deletingSetupId !== setup.id
          return (
            <div
              key={setup.id}
              className={cn(
                'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                isCurrentSetup ? 'bg-muted/30' : ''
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {getExecutionHostLabel(setup.hostId)}
                  </span>
                  <SettingsBadge tone={setup.setupState === 'ready' ? 'accent' : 'muted'}>
                    {getSetupStateLabel(setup.setupState)}
                  </SettingsBadge>
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {setup.path ||
                    translate(
                      'auto.components.settings.RepositoryPane.setupPathPending',
                      'Path pending'
                    )}
                </p>
              </div>
              {isCurrentSetup ? (
                <SettingsBadge>
                  {translate('auto.components.settings.RepositoryPane.currentSetup', 'Current')}
                </SettingsBadge>
              ) : null}
              {!isCurrentSetup && canOpenSetup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    openSettingsPage()
                    openSettingsTarget({ pane: 'repo', repoId: setup.repoId })
                  }}
                >
                  {translate('auto.components.settings.RepositoryPane.openSetup', 'Open')}
                </Button>
              ) : null}
              {canRemoveSetup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setDeletingSetupId(setup.id)
                    await deleteProjectHostSetup({ setupId: setup.id })
                    setDeletingSetupId(null)
                  }}
                >
                  {translate('auto.components.settings.RepositoryPane.removeSetup', 'Remove')}
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
      {selectedProjectHostSetup && setupHostOptions.length > 0 ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">
              {translate(
                'auto.components.settings.RepositoryPane.setupProjectOnHost',
                'Set up on another host'
              )}
            </Label>
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.settings.RepositoryPane.setupProjectOnHostHelp',
                'Choose a host, then import an existing checkout, clone the repository there, or track a setup that will be provisioned later.'
              )}
            </p>
          </div>
          <div className="max-w-48">
            <Select
              value={setupTargetHostId ?? undefined}
              onValueChange={(value) => setSelectedSetupHostId(value as ExecutionHostId)}
            >
              <SelectTrigger className="h-9 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {setupHostOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={setupPath}
              onChange={(event) => setSetupPath(event.target.value)}
              placeholder={translate(
                'auto.components.settings.RepositoryPane.setupExistingFolderPathPlaceholder',
                '/path/to/project/on/host'
              )}
              className="h-9 min-w-0"
            />
            <Select
              value={setupKind}
              onValueChange={(value) => setSetupKind(value as 'git' | 'folder')}
            >
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="git">
                  {translate('auto.components.settings.RepositoryPane.setupKindGit', 'Git repo')}
                </SelectItem>
                <SelectItem value="folder">
                  {translate('auto.components.settings.RepositoryPane.setupKindFolder', 'Folder')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!setupTargetHostId || !setupPath.trim() || isSettingUp}
              onClick={async () => {
                if (!setupTargetHostId || !selectedProjectHostSetup || !setupPath.trim()) {
                  return
                }
                setIsSettingUp(true)
                const result = await setupProjectExistingFolder({
                  projectId: selectedProjectHostSetup.projectId,
                  hostId: setupTargetHostId,
                  path: setupPath.trim(),
                  kind: setupKind,
                  displayName: repo.displayName
                })
                setIsSettingUp(false)
                if (result) {
                  setSetupPath('')
                  setSelectedSetupHostId(null)
                  openSettingsPage()
                  openSettingsTarget({ pane: 'repo', repoId: result.repo.id })
                }
              }}
            >
              {isSettingUp
                ? translate('auto.components.settings.RepositoryPane.settingUpHost', 'Importing...')
                : translate('auto.components.settings.RepositoryPane.setupHost', 'Import')}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              value={cloneUrl}
              onChange={(event) => setCloneUrl(event.target.value)}
              placeholder={translate(
                'auto.components.settings.RepositoryPane.cloneUrlPlaceholder',
                'Repository URL'
              )}
              className="h-9 min-w-0"
            />
            <Input
              value={cloneDestination}
              onChange={(event) => setCloneDestination(event.target.value)}
              placeholder={translate(
                'auto.components.settings.RepositoryPane.cloneDestinationPlaceholder',
                '/destination/on/host'
              )}
              className="h-9 min-w-0"
            />
            <Button
              type="button"
              size="sm"
              disabled={
                !setupTargetHostId || !cloneUrl.trim() || !cloneDestination.trim() || isCloning
              }
              onClick={async () => {
                if (
                  !setupTargetHostId ||
                  !selectedProjectHostSetup ||
                  !cloneUrl.trim() ||
                  !cloneDestination.trim()
                ) {
                  return
                }
                setIsCloning(true)
                const result = await setupProjectClone({
                  projectId: selectedProjectHostSetup.projectId,
                  hostId: setupTargetHostId,
                  url: cloneUrl.trim(),
                  destination: cloneDestination.trim(),
                  displayName: repo.displayName
                })
                setIsCloning(false)
                if (result) {
                  setCloneUrl('')
                  setCloneDestination('')
                  setSelectedSetupHostId(null)
                  openSettingsPage()
                  openSettingsTarget({ pane: 'repo', repoId: result.repo.id })
                }
              }}
            >
              {isCloning
                ? translate('auto.components.settings.RepositoryPane.cloningHost', 'Cloning...')
                : translate('auto.components.settings.RepositoryPane.cloneHost', 'Clone')}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!setupTargetHostId || isCreatingPendingSetup}
              onClick={async () => {
                if (!setupTargetHostId || !selectedProjectHostSetup) {
                  return
                }
                setIsCreatingPendingSetup(true)
                const result = await createProjectHostSetup({
                  projectId: selectedProjectHostSetup.projectId,
                  hostId: setupTargetHostId,
                  displayName: repo.displayName,
                  setupState: 'not-set-up',
                  setupMethod: 'provisioned'
                })
                setIsCreatingPendingSetup(false)
                if (result) {
                  setSelectedSetupHostId(null)
                }
              }}
            >
              {isCreatingPendingSetup
                ? translate(
                    'auto.components.settings.RepositoryPane.creatingPendingSetup',
                    'Creating...'
                  )
                : translate(
                    'auto.components.settings.RepositoryPane.createPendingSetup',
                    'Track setup'
                  )}
            </Button>
          </div>
        </div>
      ) : null}
    </SearchableSetting>
  )
}
