import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, TicketCheck, X } from 'lucide-react'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import type { SkillDiscoveryTarget } from '../../../../shared/skills'
import type { GlobalSettings } from '../../../../shared/types'
import { Button } from '@/components/ui/button'
import {
  GLOBAL_AGENT_SKILL_SOURCE_KINDS,
  useInstalledAgentSkill
} from '@/hooks/useInstalledAgentSkills'
import {
  LINEAR_TICKETS_SKILL_NAME,
  buildAgentFeatureSkillInstallCommand
} from '@/lib/agent-feature-install-commands'
import {
  AGENT_SKILL_CLI_PREREQUISITE_NOTICE,
  ensureOrcaCliAvailableForAgentSkillTerminal,
  isOrcaCliAvailableOnPath
} from '@/lib/agent-skill-cli-prerequisite'
import { cn } from '@/lib/utils'
import { AgentSkillSetupPanel } from '../settings/AgentSkillSetupPanel'
import {
  buildSkillInstallCommandForRuntime,
  ensureWslCliAvailableForAgentSkillTerminal,
  getWslCliDistroRequest,
  type LocalAgentRuntime
} from '../settings/CliSkillRuntimeSetup'
import { translate } from '@/i18n/i18n'

const LOCAL_DISMISS_STORAGE_KEY_PREFIX = 'orca.linearTicketsSkill.setupDismissed'

type LinearAgentSkillSetupPromptProps = {
  linked: boolean
  remote: boolean
  settings?: Pick<
    GlobalSettings,
    | 'localAgentRuntime'
    | 'localAgentWslDistro'
    | 'terminalWindowsShell'
    | 'terminalWindowsWslDistro'
    | 'activeRuntimeEnvironmentId'
  > | null
  currentPlatform?: NodeJS.Platform
  className?: string
}

export function LinearAgentSkillSetupPrompt({
  linked,
  remote,
  settings,
  currentPlatform = getCurrentPlatform(),
  className
}: LinearAgentSkillSetupPromptProps): React.JSX.Element | null {
  const [cliStatus, setCliStatus] = useState<CliInstallStatus | null>(null)
  const [cliLoading, setCliLoading] = useState(linked)
  const [expanded, setExpanded] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const agentRuntime = useMemo(
    () => getLinearPromptAgentRuntime(settings, currentPlatform, remote),
    [currentPlatform, remote, settings]
  )
  const skillDiscoveryTarget = useMemo<SkillDiscoveryTarget | undefined>(
    () =>
      agentRuntime.runtime === 'wsl'
        ? { runtime: 'wsl', wslDistro: agentRuntime.wslDistro }
        : undefined,
    [agentRuntime.runtime, agentRuntime.wslDistro]
  )
  const localDismissStorageKey = getLocalDismissStorageKey(agentRuntime)
  const [localDismissed, setLocalDismissed] = useState(() =>
    readLocalDismissed(localDismissStorageKey)
  )
  const skill = useInstalledAgentSkill(LINEAR_TICKETS_SKILL_NAME, {
    enabled: linked,
    discoveryTarget: skillDiscoveryTarget,
    sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
  })
  const command = useMemo(
    () =>
      buildSkillInstallCommandForRuntime(
        buildAgentFeatureSkillInstallCommand([LINEAR_TICKETS_SKILL_NAME]),
        agentRuntime
      ),
    [agentRuntime]
  )
  const terminalShellOverride = getLinearPromptTerminalShellOverride(
    currentPlatform,
    settings,
    agentRuntime
  )
  const dismissed = remote ? sessionDismissed : localDismissed

  useEffect(() => {
    setLocalDismissed(readLocalDismissed(localDismissStorageKey))
  }, [localDismissStorageKey])

  const refreshCliStatus = useCallback(async (): Promise<void> => {
    if (!linked) {
      setCliStatus(null)
      setCliLoading(false)
      return
    }
    setCliLoading(true)
    try {
      setCliStatus(
        await (agentRuntime.runtime === 'wsl'
          ? window.api.cli.getWslInstallStatus(getWslCliDistroRequest(agentRuntime))
          : window.api.cli.getInstallStatus())
      )
    } catch {
      setCliStatus(null)
    } finally {
      setCliLoading(false)
    }
  }, [agentRuntime, linked])

  useEffect(() => {
    void refreshCliStatus()
  }, [refreshCliStatus])

  if (!linked || dismissed || cliLoading || skill.loading) {
    return null
  }

  const cliAvailable = isOrcaCliAvailableOnPath(cliStatus)
  if (cliAvailable && skill.installed) {
    return null
  }

  const dismiss = (): void => {
    if (remote) {
      setSessionDismissed(true)
      return
    }
    localStorage.setItem(localDismissStorageKey, '1')
    setLocalDismissed(true)
  }

  const missingLabel =
    !cliAvailable && !skill.installed
      ? translate(
          'auto.components.sidebar.LinearAgentSkillSetupPrompt.missingBoth',
          'Orca CLI and Linear agent skill setup are missing.'
        )
      : !cliAvailable
        ? translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.missingCli',
            'Orca CLI setup is missing.'
          )
        : translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.missingSkill',
            'Linear agent skill setup is missing.'
          )

  return (
    <div
      className={cn(
        'mt-1.5 rounded-md border border-worktree-sidebar-border bg-worktree-sidebar-accent/35 px-2.5 py-2 text-[11px] text-muted-foreground',
        className
      )}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <TicketCheck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-medium text-foreground">
            {translate(
              'auto.components.sidebar.LinearAgentSkillSetupPrompt.title',
              'Set up Linear agent skill'
            )}
          </div>
          <p className="leading-snug">
            {missingLabel}{' '}
            {remote
              ? translate(
                  'auto.components.sidebar.LinearAgentSkillSetupPrompt.remoteCopy',
                  'This installs host setup; remote agent environments may need separate setup.'
                )
              : agentRuntime.runtime === 'wsl'
                ? translate(
                    'auto.components.sidebar.LinearAgentSkillSetupPrompt.wslCopy',
                    'Install it for WSL agent handoffs from linked Linear work.'
                  )
                : translate(
                    'auto.components.sidebar.LinearAgentSkillSetupPrompt.hostCopy',
                    'Install it for host agent handoffs from linked Linear work.'
                  )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          aria-label={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.dismiss',
            'Dismiss Linear agent skill setup'
          )}
          onClick={dismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="xs" onClick={() => setExpanded(true)}>
          {translate('auto.components.sidebar.LinearAgentSkillSetupPrompt.setup', 'Set up')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1"
          onClick={() => {
            void refreshCliStatus()
            void skill.refresh()
          }}
        >
          <RefreshCw className="size-3" />
          {translate('auto.components.sidebar.LinearAgentSkillSetupPrompt.recheck', 'Re-check')}
        </Button>
      </div>
      {expanded ? (
        <AgentSkillSetupPanel
          className="mt-2"
          variant="inline"
          title={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.panelTitle',
            'Linear agent skill'
          )}
          description={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.panelDescription',
            'Install the host agent skill for linked Linear task handoffs.'
          )}
          command={command}
          terminalTitle={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.terminalTitle',
            'Install Linear agent skill'
          )}
          terminalAriaLabel={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.terminalAria',
            'Linear agent skill installer terminal'
          )}
          terminalWorktreeId="sidebar-linear-agent-skill-setup"
          terminalShellOverride={terminalShellOverride}
          installed={skill.installed}
          loading={skill.loading}
          error={skill.error}
          installLabel={translate(
            'auto.components.sidebar.LinearAgentSkillSetupPrompt.install',
            'Install'
          )}
          preInstallNotice={AGENT_SKILL_CLI_PREREQUISITE_NOTICE}
          getPrerequisiteStatus={
            agentRuntime.runtime === 'wsl'
              ? () => window.api.cli.getWslInstallStatus(getWslCliDistroRequest(agentRuntime))
              : undefined
          }
          isPrerequisiteAvailable={isOrcaCliAvailableOnPath}
          onBeforeOpenTerminal={async () => {
            const nextStatus =
              agentRuntime.runtime === 'wsl'
                ? await ensureWslCliAvailableForAgentSkillTerminal(agentRuntime)
                : await ensureOrcaCliAvailableForAgentSkillTerminal({
                    onStatusChange: setCliStatus
                  })
            if (agentRuntime.runtime === 'wsl') {
              setCliStatus(nextStatus)
            }
          }}
          onRecheck={async () => {
            await refreshCliStatus()
            await skill.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function getCurrentPlatform(): NodeJS.Platform {
  if (navigator.userAgent.includes('Windows')) {
    return 'win32'
  }
  return navigator.userAgent.includes('Linux') ? 'linux' : 'darwin'
}

function getLinearPromptAgentRuntime(
  settings:
    | Pick<
        GlobalSettings,
        | 'localAgentRuntime'
        | 'localAgentWslDistro'
        | 'terminalWindowsShell'
        | 'terminalWindowsWslDistro'
        | 'activeRuntimeEnvironmentId'
      >
    | null
    | undefined,
  currentPlatform: NodeJS.Platform,
  remote: boolean
): LocalAgentRuntime {
  if (remote) {
    // Why: this prompt opens a local terminal; remote environments need their
    // own setup even when local agent discovery prefers WSL.
    return {
      runtime: 'host',
      label: currentPlatform === 'win32' ? 'Windows' : 'This device'
    }
  }
  const selectedRuntime =
    settings?.localAgentRuntime ?? (settings?.terminalWindowsShell === 'wsl.exe' ? 'wsl' : 'host')
  if (currentPlatform === 'win32' && selectedRuntime === 'wsl') {
    const selectedDistro =
      settings?.localAgentWslDistro?.trim() || settings?.terminalWindowsWslDistro?.trim() || null
    return {
      runtime: 'wsl',
      wslDistro: selectedDistro,
      label: selectedDistro
        ? `WSL ${selectedDistro}`
        : translate('auto.components.sidebar.LinearAgentSkillSetupPrompt.wslLabel', 'WSL default')
    }
  }
  return {
    runtime: 'host',
    label: currentPlatform === 'win32' ? 'Windows' : 'This device'
  }
}

function getLinearPromptTerminalShellOverride(
  currentPlatform: NodeJS.Platform,
  settings:
    | Pick<
        GlobalSettings,
        | 'localAgentRuntime'
        | 'localAgentWslDistro'
        | 'terminalWindowsShell'
        | 'terminalWindowsWslDistro'
        | 'activeRuntimeEnvironmentId'
      >
    | null
    | undefined,
  runtime: LocalAgentRuntime
): string | undefined {
  if (currentPlatform !== 'win32') {
    return undefined
  }
  if (runtime.runtime === 'wsl') {
    return 'powershell.exe'
  }
  return settings?.terminalWindowsShell?.toLowerCase() === 'wsl.exe' ? 'powershell.exe' : undefined
}

function getLocalDismissStorageKey(runtime: LocalAgentRuntime): string {
  if (runtime.runtime !== 'wsl') {
    return `${LOCAL_DISMISS_STORAGE_KEY_PREFIX}.host`
  }
  return `${LOCAL_DISMISS_STORAGE_KEY_PREFIX}.wsl.${runtime.wslDistro?.trim() || 'default'}`
}

function readLocalDismissed(storageKey: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return localStorage.getItem(storageKey) === '1'
}
