import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { parseLegacyNumericPaneKey, parsePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalTab } from '../../../../shared/types'

function isActivationConsumableSleepingRecord(record: SleepingAgentSessionRecord): boolean {
  return record.origin === undefined || record.origin === 'worktree-sleep'
}

function getSleepingRecordTabId(record: SleepingAgentSessionRecord): string | undefined {
  const parsed = parsePaneKey(record.paneKey)
  const legacy = parseLegacyNumericPaneKey(record.paneKey)
  return record.tabId ?? parsed?.tabId ?? legacy?.tabId
}

function tabFromSleepingRecord(record: SleepingAgentSessionRecord, tabId: string): TerminalTab {
  return {
    id: tabId,
    ptyId: null,
    worktreeId: record.worktreeId,
    title: record.terminalTitle ?? 'Agent',
    customTitle: null,
    color: null,
    sortOrder: Number.MAX_SAFE_INTEGER,
    createdAt: record.capturedAt,
    launchAgent: record.agent
  }
}

function isLegacyDuplicateOfVisibleTab(
  record: SleepingAgentSessionRecord,
  seenTabIds: ReadonlySet<string>
): boolean {
  const legacy = parseLegacyNumericPaneKey(record.paneKey)
  return legacy !== null && seenTabIds.has(legacy.tabId)
}

function sleepingRecordToRow(record: SleepingAgentSessionRecord): DashboardAgentRow {
  const tabId = getSleepingRecordTabId(record) ?? record.paneKey
  const entry: AgentStatusEntry = {
    paneKey: record.paneKey,
    tabId,
    worktreeId: record.worktreeId,
    agentType: record.agent,
    updatedAt: record.updatedAt,
    stateStartedAt: record.capturedAt,
    stateHistory: [],
    state: 'done',
    prompt: '',
    lastAssistantMessage: 'Slept · resume saved',
    terminalTitle: record.terminalTitle,
    providerSession: record.providerSession
  }
  return {
    paneKey: record.paneKey,
    entry,
    tab: tabFromSleepingRecord(record, tabId),
    agentType: record.agent,
    state: 'idle',
    sleeping: true,
    startedAt: record.capturedAt || record.updatedAt
  }
}

export function buildSleepingAgentRows(args: {
  sleeping: SleepingAgentSessionRecord[] | undefined
  seenPaneKeys: ReadonlySet<string>
  seenTabIds: ReadonlySet<string>
}): DashboardAgentRow[] {
  if (!args.sleeping || args.sleeping.length === 0) {
    return []
  }
  return args.sleeping
    .filter((record) => isActivationConsumableSleepingRecord(record))
    .filter((record) => !args.seenPaneKeys.has(record.paneKey))
    .filter((record) => !isLegacyDuplicateOfVisibleTab(record, args.seenTabIds))
    .sort((a, b) => a.capturedAt - b.capturedAt || a.updatedAt - b.updatedAt)
    .map(sleepingRecordToRow)
}
