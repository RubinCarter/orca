/* eslint-disable max-lines -- Why: this pane owns Source Control AI defaults,
   action recipe drafts, model discovery, and PR defaults in one settings flow. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Terminal } from 'lucide-react'
import type { GlobalSettings, TuiAgent } from '../../../../shared/types'
import type {
  SourceControlAiSettingsPatch,
  SourceControlAiSettings
} from '../../../../shared/source-control-ai-types'
import {
  normalizeSourceControlAiSettings,
  readSourceControlAiModelChoiceForHost,
  selectSourceControlAiModelChoiceForHost
} from '../../../../shared/source-control-ai'
import {
  DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES,
  SOURCE_CONTROL_ACTION_IDS,
  SOURCE_CONTROL_ACTION_LABELS,
  SOURCE_CONTROL_TEXT_ACTION_IDS,
  setSourceControlActionDefault,
  type SourceControlActionId
} from '../../../../shared/source-control-ai-actions'
import {
  CUSTOM_AGENT_ID,
  isCustomAgentId,
  type CommitMessageModelCapability,
  type CustomAgentId
} from '../../../../shared/commit-message-agent-spec'
import { getCommitMessageModelDiscoveryHostKeyForScope } from '../../../../shared/commit-message-host-key'
import { AgentIcon } from '@/lib/agent-catalog'
import { getRuntimeGitScope } from '../../runtime/runtime-git-client'
import { useAppStore } from '../../store'
import { SourceControlActionVariableChips } from '../source-control/SourceControlActionVariableChips'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SearchableSetting } from './SearchableSetting'
import { matchesSettingsSearch } from './settings-search'
import {
  ACTION_DESCRIPTIONS,
  getAgentCatalogForAction,
  getSourceControlAgentArgsPlaceholder
} from './source-control-action-recipe-options'

type CommitMessageAiPaneProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
  writeSourceControlAiSettings?: (patch: SourceControlAiSettingsPatch) => Promise<void>
  onCustomPromptDirtyChange?: (dirty: boolean) => void
  customPromptDiscardSignal?: number
  settingsSearchQuery?: string
}

const DEFAULT_AGENT_VALUE = '__default_agent__'

type ActionRecipeDraftValue = {
  commandInputTemplate: string
  agentArgs: string
}

type ActionRecipeDraftState = {
  values: Record<SourceControlActionId, ActionRecipeDraftValue>
  baseValues: Record<SourceControlActionId, ActionRecipeDraftValue>
}

function resolveAgentArgsPlaceholderAgent(
  selectedAgent: TuiAgent | CustomAgentId | null | undefined,
  defaultTuiAgent: GlobalSettings['defaultTuiAgent']
): TuiAgent | null {
  if (selectedAgent && !isCustomAgentId(selectedAgent)) {
    return selectedAgent
  }
  return defaultTuiAgent && defaultTuiAgent !== 'blank' ? defaultTuiAgent : null
}

function isSourceControlTextAction(actionId: SourceControlActionId): boolean {
  return SOURCE_CONTROL_TEXT_ACTION_IDS.some((candidate) => candidate === actionId)
}

function readSettings(settings: GlobalSettings): SourceControlAiSettings {
  return normalizeSourceControlAiSettings(settings.sourceControlAi, settings.commitMessageAi)
}

function readActionRecipeInputValue(
  config: SourceControlAiSettings,
  actionId: SourceControlActionId
): ActionRecipeDraftValue {
  const recipe = config.actions?.[actionId]
  const value = recipe?.commandInputTemplate
  // Why: execution trims templates, but the controlled textarea must preserve
  // an in-progress trailing space so users can keep typing the next word.
  return {
    commandInputTemplate:
      typeof value === 'string' ? value : DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES[actionId],
    agentArgs: typeof recipe?.agentArgs === 'string' ? recipe.agentArgs : ''
  }
}

function readActionRecipeInputValues(
  config: SourceControlAiSettings
): Record<SourceControlActionId, ActionRecipeDraftValue> {
  return Object.fromEntries(
    SOURCE_CONTROL_ACTION_IDS.map((actionId) => [
      actionId,
      readActionRecipeInputValue(config, actionId)
    ])
  ) as Record<SourceControlActionId, ActionRecipeDraftValue>
}

function serializeActionRecipeInputValues(
  values: Record<SourceControlActionId, ActionRecipeDraftValue>
): string {
  return JSON.stringify(SOURCE_CONTROL_ACTION_IDS.map((actionId) => [actionId, values[actionId]]))
}

export function mergeDiscoveredModelsIntoCommitMessageConfig(
  config: SourceControlAiSettings,
  agentId: TuiAgent,
  models: CommitMessageModelCapability[],
  defaultModelId: string,
  hostKey = 'local'
): SourceControlAiSettings {
  const currentChoice = {
    selectedModelByAgent: config.selectedModelByAgent,
    selectedModelByAgentByHost: config.selectedModelByAgentByHost
  }
  const persisted = readSourceControlAiModelChoiceForHost(currentChoice, hostKey, agentId)
  const nextModelId = models.some((model) => model.id === persisted) ? persisted : defaultModelId
  const selectedModelChoice =
    nextModelId && nextModelId !== persisted
      ? selectSourceControlAiModelChoiceForHost(currentChoice, hostKey, agentId, nextModelId)
      : currentChoice
  return {
    ...config,
    discoveredModelsByAgent:
      hostKey === 'local'
        ? {
            ...config.discoveredModelsByAgent,
            [agentId]: models
          }
        : config.discoveredModelsByAgent,
    discoveredModelsByAgentByHost: {
      ...config.discoveredModelsByAgentByHost,
      [hostKey]: {
        ...config.discoveredModelsByAgentByHost?.[hostKey],
        [agentId]: models
      }
    },
    selectedModelByAgent: selectedModelChoice.selectedModelByAgent ?? config.selectedModelByAgent,
    selectedModelByAgentByHost: selectedModelChoice.selectedModelByAgentByHost
  }
}

export function getCommitMessageSettingsPaneDiscoveryHostKey(
  settings: GlobalSettings,
  activeConnectionId: string | null | undefined,
  hasActiveWorktree: boolean
): string {
  const runtimeScope = hasActiveWorktree
    ? getRuntimeGitScope(settings, activeConnectionId)
    : activeConnectionId
  return getCommitMessageModelDiscoveryHostKeyForScope(runtimeScope)
}

export function CommitMessageAiPane({
  settings,
  updateSettings,
  writeSourceControlAiSettings,
  onCustomPromptDirtyChange,
  customPromptDiscardSignal,
  settingsSearchQuery
}: CommitMessageAiPaneProps): React.JSX.Element {
  const storeSearchQuery = useAppStore((s) => s.settingsSearchQuery)
  const searchQuery = settingsSearchQuery ?? storeSearchQuery
  const config = readSettings(settings)
  const persistedActionRecipeValues = useMemo(
    () => readActionRecipeInputValues(readSettings(settings)),
    [settings]
  )
  const persistedActionRecipeSerialized = useMemo(
    () => serializeActionRecipeInputValues(persistedActionRecipeValues),
    [persistedActionRecipeValues]
  )
  const persistedActionRecipeValuesRef = useRef(persistedActionRecipeValues)
  persistedActionRecipeValuesRef.current = persistedActionRecipeValues
  const [actionRecipeDraftState, setActionRecipeDraftState] = useState<ActionRecipeDraftState>(
    () => ({
      values: persistedActionRecipeValues,
      baseValues: persistedActionRecipeValues
    })
  )
  const [savingActionTemplateIds, setSavingActionTemplateIds] = useState<
    Partial<Record<SourceControlActionId, boolean>>
  >({})
  const actionRecipeDraftSerialized = useMemo(
    () => serializeActionRecipeInputValues(actionRecipeDraftState.values),
    [actionRecipeDraftState.values]
  )
  const actionRecipeBaseSerialized = useMemo(
    () => serializeActionRecipeInputValues(actionRecipeDraftState.baseValues),
    [actionRecipeDraftState.baseValues]
  )
  const actionTemplateDirty = actionRecipeDraftSerialized !== actionRecipeBaseSerialized

  useEffect(() => {
    setActionRecipeDraftState((current) => {
      const currentSerialized = serializeActionRecipeInputValues(current.values)
      const baseSerialized = serializeActionRecipeInputValues(current.baseValues)
      if (
        currentSerialized === baseSerialized ||
        currentSerialized === persistedActionRecipeSerialized
      ) {
        return {
          values: persistedActionRecipeValues,
          baseValues: persistedActionRecipeValues
        }
      }
      return {
        values: current.values,
        baseValues: persistedActionRecipeValues
      }
    })
  }, [persistedActionRecipeSerialized, persistedActionRecipeValues])

  useEffect(() => {
    setActionRecipeDraftState({
      values: persistedActionRecipeValuesRef.current,
      baseValues: persistedActionRecipeValuesRef.current
    })
  }, [customPromptDiscardSignal])

  useEffect(() => {
    onCustomPromptDirtyChange?.(actionTemplateDirty)
  }, [actionTemplateDirty, onCustomPromptDirtyChange])

  useEffect(
    () => () => {
      onCustomPromptDirtyChange?.(false)
    },
    [onCustomPromptDirtyChange]
  )

  const localWriteConfig = (patch: SourceControlAiSettingsPatch): Promise<void> => {
    const current = readSettings(settings)
    const resolvedPatch = typeof patch === 'function' ? patch(current) : patch
    return Promise.resolve(
      updateSettings({
        sourceControlAi: {
          ...current,
          ...resolvedPatch
        }
      })
    )
  }
  const writeConfig = writeSourceControlAiSettings ?? localWriteConfig

  const onToggleEnabled = (): void => {
    void writeConfig({ enabled: !config.enabled })
  }

  const onActionAgentChange = (actionId: SourceControlActionId, value: string): void => {
    const agentId =
      value === DEFAULT_AGENT_VALUE
        ? null
        : value === CUSTOM_AGENT_ID
          ? CUSTOM_AGENT_ID
          : (value as TuiAgent)
    void writeConfig((current) => ({
      actions: setSourceControlActionDefault(current.actions, actionId, { agentId })
    }))
  }

  const onCustomCommandChange = (value: string): void => {
    void writeConfig({ customAgentCommand: value })
  }

  const onActionTemplateChange = (actionId: SourceControlActionId, value: string): void => {
    setActionRecipeDraftState((current) => ({
      ...current,
      values: {
        ...current.values,
        [actionId]: {
          ...current.values[actionId],
          commandInputTemplate: value
        }
      }
    }))
  }

  const onActionAgentArgsChange = (actionId: SourceControlActionId, value: string): void => {
    setActionRecipeDraftState((current) => ({
      ...current,
      values: {
        ...current.values,
        [actionId]: {
          ...current.values[actionId],
          agentArgs: value
        }
      }
    }))
  }

  const saveActionTemplateDraft = async (actionId: SourceControlActionId): Promise<void> => {
    const nextValue = actionRecipeDraftState.values[actionId]
    if (
      JSON.stringify(nextValue) === JSON.stringify(actionRecipeDraftState.baseValues[actionId]) ||
      savingActionTemplateIds[actionId]
    ) {
      return
    }
    setSavingActionTemplateIds((current) => ({ ...current, [actionId]: true }))
    try {
      await writeConfig((current) => {
        return {
          actions: setSourceControlActionDefault(current.actions, actionId, {
            commandInputTemplate: nextValue.commandInputTemplate,
            agentArgs: nextValue.agentArgs
          })
        }
      })
      setActionRecipeDraftState((current) => ({
        values: current.values,
        baseValues: {
          ...current.baseValues,
          [actionId]: nextValue
        }
      }))
    } finally {
      setSavingActionTemplateIds((current) => ({ ...current, [actionId]: false }))
    }
  }

  const discardActionTemplateDraft = (actionId: SourceControlActionId): void => {
    setActionRecipeDraftState((current) => ({
      ...current,
      values: {
        ...current.values,
        [actionId]: current.baseValues[actionId]
      }
    }))
  }

  const appendVariable = (actionId: SourceControlActionId, variable: string): void => {
    setActionRecipeDraftState((current) => {
      const currentTemplate = current.values[actionId].commandInputTemplate
      const separator = currentTemplate.endsWith('\n') || currentTemplate.length === 0 ? '' : ' '
      return {
        ...current,
        values: {
          ...current.values,
          [actionId]: {
            ...current.values[actionId],
            commandInputTemplate: `${currentTemplate}${separator}{${variable}}`
          }
        }
      }
    })
  }

  const onPrDefaultChange = (
    key: keyof NonNullable<SourceControlAiSettings['prCreationDefaults']>,
    value: boolean
  ): void => {
    void writeConfig((current) => ({
      prCreationDefaults: {
        ...current.prCreationDefaults,
        [key]: value
      }
    }))
  }

  const sections: React.ReactNode[] = []
  const customCommandInUse =
    isCustomAgentId(config.agentId) ||
    config.customAgentCommand.trim().length > 0 ||
    SOURCE_CONTROL_TEXT_ACTION_IDS.some(
      (actionId) => config.actions?.[actionId]?.agentId === CUSTOM_AGENT_ID
    )

  if (
    matchesSettingsSearch(searchQuery, {
      title: 'Enable Source Control AI defaults',
      description:
        'Adds action recipes for Source Control commit, pull request, branch-name, and fix actions.',
      keywords: ['ai', 'commit', 'message', 'generate', 'agent', 'enabled']
    })
  ) {
    sections.push(
      <SearchableSetting
        key="enabled"
        title="Enable Source Control AI defaults"
        description="Adds action recipes for Source Control commit, pull request, branch-name, and fix actions."
        keywords={['ai', 'commit', 'message', 'generate', 'agent', 'enabled']}
        className="flex items-center justify-between gap-4 py-2"
      >
        <div className="space-y-1">
          <Label>Enable Source Control AI defaults</Label>
          <p className="text-xs text-muted-foreground">
            Adds AI buttons that run the selected agent with the command template for that action.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={config.enabled}
          onClick={onToggleEnabled}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors ${
            config.enabled ? 'bg-foreground' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform ${
              config.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </SearchableSetting>
    )
  }

  if (
    config.enabled &&
    matchesSettingsSearch(searchQuery, {
      title: 'Action recipes',
      description:
        'Agent, CLI arguments, and command template used by each Source Control AI button.',
      keywords: [
        'agent',
        'arguments',
        'args',
        'cli',
        'command',
        'model',
        'template',
        'fix',
        'checks',
        'commit',
        'pull request'
      ]
    })
  ) {
    sections.push(
      <SearchableSetting
        key="action-recipes"
        title="Action recipes"
        description="Agent, CLI arguments, and command template used by each Source Control AI button."
        keywords={[
          'agent',
          'arguments',
          'args',
          'cli',
          'command',
          'model',
          'template',
          'fix',
          'checks',
          'commit',
          'pull request'
        ]}
        className="space-y-3 px-1 py-2"
      >
        <div className="space-y-0.5">
          <Label>Action recipes</Label>
          <p className="text-xs text-muted-foreground">
            Use variables only when you want Orca to inject context. Leave the agent as default to
            follow your normal agent preference.
          </p>
        </div>
        <div className="space-y-3">
          {SOURCE_CONTROL_ACTION_IDS.map((actionId) => {
            const recipe = config.actions?.[actionId]
            const selectedAgent = recipe?.agentId ?? null
            const draftValue = actionRecipeDraftState.values[actionId]
            const template = draftValue.commandInputTemplate
            const agentArgs = draftValue.agentArgs
            const agentArgsPlaceholder = getSourceControlAgentArgsPlaceholder(
              resolveAgentArgsPlaceholderAgent(selectedAgent, settings.defaultTuiAgent)
            )
            const templateDirty =
              JSON.stringify(draftValue) !==
              JSON.stringify(actionRecipeDraftState.baseValues[actionId])
            const isSavingTemplate = savingActionTemplateIds[actionId] === true
            const agentOptions = getAgentCatalogForAction(actionId, selectedAgent)
            return (
              <div key={actionId} className="rounded-md border border-border px-3 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      {SOURCE_CONTROL_ACTION_LABELS[actionId]}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {ACTION_DESCRIPTIONS[actionId]}
                    </p>
                  </div>
                  <Select
                    value={selectedAgent ?? DEFAULT_AGENT_VALUE}
                    onValueChange={(value) => onActionAgentChange(actionId, value)}
                  >
                    <SelectTrigger size="sm" className="h-8 w-full shrink-0 text-xs sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_AGENT_VALUE}>
                        <span className="flex items-center gap-2">
                          <Terminal className="size-3.5 text-muted-foreground" />
                          Use default agent
                        </span>
                      </SelectItem>
                      {isSourceControlTextAction(actionId) ? (
                        <SelectItem value={CUSTOM_AGENT_ID}>
                          <span className="flex items-center gap-2">
                            <Terminal className="size-3.5 text-muted-foreground" />
                            Custom command
                          </span>
                        </SelectItem>
                      ) : null}
                      {agentOptions.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <span className="flex items-center gap-2">
                            <AgentIcon agent={agent.id} size={14} />
                            {agent.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-muted-foreground">CLI arguments</Label>
                    <Input
                      value={agentArgs}
                      spellCheck={false}
                      placeholder={agentArgsPlaceholder}
                      onChange={(event) => onActionAgentArgsChange(actionId, event.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] text-muted-foreground">Command template</Label>
                    <textarea
                      value={template}
                      rows={3}
                      spellCheck={false}
                      onChange={(event) => onActionTemplateChange(actionId, event.target.value)}
                      className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <SourceControlActionVariableChips
                      actionId={actionId}
                      onInsert={(variable) => appendVariable(actionId, variable)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {templateDirty ? 'Unsaved changes' : 'Saved'}
                  </p>
                  <div className="flex items-center gap-2">
                    {templateDirty ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => discardActionTemplateDraft(actionId)}
                        disabled={isSavingTemplate}
                      >
                        Discard
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => void saveActionTemplateDraft(actionId)}
                      disabled={!templateDirty || isSavingTemplate}
                    >
                      {isSavingTemplate ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SearchableSetting>
    )
  }

  if (
    config.enabled &&
    (customCommandInUse ||
      matchesSettingsSearch(searchQuery, {
        title: 'Custom command',
        description: 'Command line Orca runs when a text recipe uses Custom command.',
        keywords: ['custom', 'command', 'cli', 'binary', 'prompt', 'placeholder']
      }))
  ) {
    sections.push(
      <SearchableSetting
        key="custom-command"
        title="Custom command"
        description="Command line Orca runs when a text recipe uses Custom command."
        keywords={['custom', 'command', 'cli', 'binary', 'prompt', 'placeholder']}
        className="space-y-2 py-2"
      >
        <div className="space-y-0.5">
          <Label htmlFor="source-control-ai-custom-command">Custom command</Label>
          <p className="text-xs text-muted-foreground">
            Used by commit-message, pull-request, and branch-name recipes that select Custom
            command. Use <code className="font-mono">{'{prompt}'}</code> to pass the command input
            as an argument; otherwise Orca pipes it on stdin.
          </p>
        </div>
        <Input
          id="source-control-ai-custom-command"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          value={config.customAgentCommand}
          onChange={(event) => onCustomCommandChange(event.target.value)}
          placeholder="e.g. ollama run llama3.1 {prompt}"
          className="h-8 font-mono text-xs"
        />
      </SearchableSetting>
    )
  }

  if (
    config.enabled &&
    matchesSettingsSearch(searchQuery, {
      title: 'Hosted-review creation defaults',
      description: 'Defaults used when the hosted-review composer opens.',
      keywords: [
        'hosted review',
        'pull request',
        'merge request',
        'pr',
        'draft',
        'template',
        'generate',
        'open'
      ]
    })
  ) {
    const prDefaults = config.prCreationDefaults ?? {}
    const rows: {
      key: keyof NonNullable<SourceControlAiSettings['prCreationDefaults']>
      label: string
      description: string
    }[] = [
      {
        key: 'draft',
        label: 'Draft by default',
        description: 'Create hosted reviews as drafts unless changed in the composer.'
      },
      {
        key: 'useTemplate',
        label: 'Use review template when available',
        description: 'Prefer repository pull request templates when no description is set.'
      },
      {
        key: 'generateDetailsOnOpen',
        label: 'Generate details when opening Create PR',
        description: 'Run hosted-review detail generation once when the composer opens.'
      },
      {
        key: 'openAfterCreate',
        label: 'Open hosted review after creation',
        description: 'Open the created hosted review in your browser after submit.'
      }
    ]
    sections.push(
      <SearchableSetting
        key="pr-creation-defaults"
        title="Hosted-review creation defaults"
        description="Defaults used when the hosted-review composer opens."
        keywords={[
          'hosted review',
          'pull request',
          'merge request',
          'pr',
          'draft',
          'template',
          'generate',
          'open'
        ]}
        className="space-y-3 px-1 py-2"
      >
        <div className="space-y-0.5">
          <Label>Hosted-review creation defaults</Label>
          <p className="text-xs text-muted-foreground">
            Used by repositories that inherit global hosted-review defaults.
          </p>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <label
              key={row.key}
              className="flex items-start justify-between gap-4 rounded-md border border-border px-3 py-2"
            >
              <span className="space-y-0.5">
                <span className="block text-xs font-medium text-foreground">{row.label}</span>
                <span className="block text-[11px] text-muted-foreground">{row.description}</span>
              </span>
              <input
                type="checkbox"
                checked={prDefaults[row.key] === true}
                onChange={(event) => onPrDefaultChange(row.key, event.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
            </label>
          ))}
        </div>
      </SearchableSetting>
    )
  }

  return (
    <div
      id="source-control-ai-settings"
      data-settings-section="source-control-ai-settings"
      className="space-y-4 border-t border-border/40 pt-4"
    >
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">Source Control AI defaults</h3>
        <p className="text-xs text-muted-foreground">
          Used by repositories that have not customized Source Control AI.
        </p>
      </div>
      {sections}
    </div>
  )
}
