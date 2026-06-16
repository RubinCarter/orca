import type {
  GlobalSettings,
  PersistedUIState,
  WorktreeCardMode,
  WorktreeCardProperty
} from './types'

export const TASK_WORKTREE_CARD_PROPERTIES: WorktreeCardProperty[] = ['issue', 'linear-issue']

export const DEFAULT_WORKTREE_CARD_PROPERTIES: WorktreeCardProperty[] = [
  'status',
  'unread',
  ...TASK_WORKTREE_CARD_PROPERTIES,
  'comment',
  'ports',
  // Why: agent activity is the primary reason users opt into the feature, so
  // the Default mode keeps it inline on each card while Compact removes the
  // extra row.
  'inline-agents'
]

export const COMPACT_WORKTREE_CARD_PROPERTIES: WorktreeCardProperty[] = ['status', 'unread']

const WORKTREE_CARD_PROPERTY_ORDER: WorktreeCardProperty[] = [
  'status',
  'unread',
  'branch',
  'issue',
  'linear-issue',
  'comment',
  'ports',
  'inline-agents'
]

export function normalizeWorktreeCardProperties(
  properties: readonly WorktreeCardProperty[] | null | undefined
): WorktreeCardProperty[] {
  const normalized: WorktreeCardProperty[] = []
  const source = properties ?? DEFAULT_WORKTREE_CARD_PROPERTIES
  for (const property of WORKTREE_CARD_PROPERTY_ORDER) {
    if (source.includes(property) && !normalized.includes(property)) {
      normalized.push(property)
    }
  }
  return normalized
}

export function getWorktreeCardModeProperties(mode: WorktreeCardMode): WorktreeCardProperty[] {
  return mode === 'Compact'
    ? [...COMPACT_WORKTREE_CARD_PROPERTIES]
    : [...DEFAULT_WORKTREE_CARD_PROPERTIES]
}

export function getWorktreeCardModeUpdates(mode: WorktreeCardMode): {
  settings: Pick<GlobalSettings, 'compactWorktreeCards'>
  ui: Pick<PersistedUIState, 'worktreeCardProperties' | '_worktreeCardModeDefaulted'>
} {
  return {
    settings: { compactWorktreeCards: mode === 'Compact' },
    ui: {
      worktreeCardProperties: getWorktreeCardModeProperties(mode),
      _worktreeCardModeDefaulted: true
    }
  }
}
