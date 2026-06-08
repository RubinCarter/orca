import { toast } from 'sonner'
import { getConnectionId } from '@/lib/connection-context'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { findGithubPrWorkspaceAttachment } from '@/lib/github-work-item-workspace-attachment'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { launchWorkItemDirect } from '@/lib/launch-work-item-direct'
import {
  pickSourceControlLaunchAgent,
  readSourceControlLaunchRecipeAgentId
} from '@/lib/source-control-launch-agent-selection'
import { resolveSourceControlLaunchPlatform } from '@/lib/source-control-launch-platform'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { resolveSourceControlActionRecipe } from '../../../shared/source-control-ai'
import {
  DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES,
  renderSourceControlActionCommandTemplate
} from '../../../shared/source-control-ai-actions'
import { isTuiAgentEnabled } from '../../../shared/tui-agent-selection'
import type {
  GitHubWorkItem,
  TuiAgent,
  WorkspaceCreateTelemetrySource
} from '../../../shared/types'
import type { LaunchSource } from '../../../shared/telemetry-events'

type StartFixChecksAgentArgs = {
  repoId: string
  basePrompt: string
  item?: GitHubWorkItem
  worktreeId?: string | null
  groupId?: string | null
  launchSource: LaunchSource
  telemetrySource?: WorkspaceCreateTelemetrySource
  openModalFallback?: () => void
}

type SavedAgentOverrideResult =
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'launch-default' }
  | { kind: 'blocked' }

async function detectAgentsForConnection(
  connectionId: string | null | undefined
): Promise<TuiAgent[]> {
  const store = useAppStore.getState()
  return typeof connectionId === 'string'
    ? await store.ensureRemoteDetectedAgents(connectionId)
    : await store.ensureDetectedAgents()
}

function isAgentAvailable(agent: TuiAgent, detectedAgents: TuiAgent[]): boolean {
  return (
    detectedAgents.includes(agent) &&
    isTuiAgentEnabled(agent, useAppStore.getState().settings?.disabledTuiAgents)
  )
}

async function resolveSavedAgentOverride(
  savedAgent: TuiAgent | null | undefined,
  connectionId: string | null | undefined
): Promise<SavedAgentOverrideResult> {
  if (!savedAgent) {
    return { kind: 'launch-default' }
  }
  const detectedAgents = await detectAgentsForConnection(connectionId)
  if (!isAgentAvailable(savedAgent, detectedAgents)) {
    toast.error('Saved checks agent is not available on this workspace host.')
    return { kind: 'blocked' }
  }
  return { kind: 'agent', agent: savedAgent }
}

async function pickExistingWorktreeAgent(
  worktreeId: string,
  savedAgent: TuiAgent | null | undefined
): Promise<TuiAgent | null> {
  const connectionId = getConnectionId(worktreeId)
  const detectedAgents = await detectAgentsForConnection(connectionId)
  if (savedAgent) {
    if (isAgentAvailable(savedAgent, detectedAgents)) {
      return savedAgent
    }
    toast.error('Saved checks agent is not available on this workspace host.')
    return null
  }
  const settings = useAppStore.getState().settings
  const agent = pickSourceControlLaunchAgent({
    defaultAgent: settings?.defaultTuiAgent,
    detectedAgents,
    disabledAgents: settings?.disabledTuiAgents
  })
  if (!agent) {
    toast.error('No enabled AI agent was detected on this workspace host.')
  }
  return agent
}

export async function startFixChecksAgent(args: StartFixChecksAgentArgs): Promise<boolean> {
  const store = useAppStore.getState()
  const repo = store.repos.find((candidate) => candidate.id === args.repoId) ?? null
  const recipe = resolveSourceControlActionRecipe({
    settings: store.settings,
    repo,
    actionId: 'fixChecks'
  })
  const savedAgentId = readSourceControlLaunchRecipeAgentId(recipe)
  const commandInput = renderSourceControlActionCommandTemplate(
    recipe.commandInputTemplate ?? DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES.fixChecks,
    { basePrompt: args.basePrompt }
  ).trim()
  if (!commandInput) {
    toast.error('Fix checks prompt is empty. Update Source Control AI settings.')
    return false
  }

  const attachedWorkspace =
    args.worktreeId || !args.item
      ? null
      : findGithubPrWorkspaceAttachment(store.allWorktrees(), args.repoId, args.item.number)
  const targetWorktreeId = args.worktreeId ?? attachedWorkspace?.id ?? null
  if (targetWorktreeId) {
    const targetWorktree = store.allWorktrees().find((worktree) => worktree.id === targetWorktreeId)
    const agent = await pickExistingWorktreeAgent(targetWorktreeId, savedAgentId)
    if (!agent) {
      return false
    }
    if (!activateAndRevealWorktree(targetWorktreeId)) {
      toast.error('Unable to open the workspace attached to this pull request.')
      return false
    }
    const result = launchAgentInNewTab({
      agent,
      worktreeId: targetWorktreeId,
      groupId: args.groupId ?? targetWorktreeId,
      prompt: commandInput,
      agentArgs: recipe.agentArgs,
      promptDelivery: 'submit-after-ready',
      launchPlatform: resolveSourceControlLaunchPlatform({
        connectionId: repo?.connectionId ?? null,
        worktreePath: targetWorktree?.path
      }),
      launchSource: args.launchSource
    })
    if (!result) {
      toast.error('Could not build the agent launch command.')
      return false
    }
    if (result.tabId) {
      focusTerminalTabSurface(result.tabId)
    }
    return true
  }

  if (!args.item || !args.openModalFallback) {
    toast.error('Unable to find a workspace for these checks.')
    return false
  }

  const agentOverride = await resolveSavedAgentOverride(savedAgentId, repo?.connectionId)
  if (agentOverride.kind === 'blocked') {
    return false
  }

  return await launchWorkItemDirect({
    item: { ...args.item, pasteContent: commandInput },
    repoId: args.repoId,
    launchSource: args.launchSource,
    telemetrySource: args.telemetrySource,
    promptDelivery: 'submit-after-ready',
    agentArgs: recipe.agentArgs,
    ...(agentOverride.kind === 'agent' ? { agentOverride: agentOverride.agent } : {}),
    openModalFallback: args.openModalFallback
  })
}
