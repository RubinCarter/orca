import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKTREE_CARD_PROPERTIES,
  TASK_WORKTREE_CARD_PROPERTIES,
  getWorktreeCardModeProperties,
  getWorktreeCardModeUpdates,
  normalizeWorktreeCardProperties
} from './worktree-card-properties'

describe('worktree card properties', () => {
  it('defines Default with inline agents and without branch', () => {
    const props = getWorktreeCardModeProperties('Default')

    expect(props).toContain('inline-agents')
    expect(props).not.toContain('branch')
    expect(props).toEqual(DEFAULT_WORKTREE_CARD_PROPERTIES)
  })

  it('defines Compact without inline agents or branch', () => {
    const props = getWorktreeCardModeProperties('Compact')

    expect(props).not.toContain('inline-agents')
    expect(props).not.toContain('branch')
  })

  it('keeps status and unread fixed in both modes', () => {
    expect(getWorktreeCardModeProperties('Default')).toEqual(
      expect.arrayContaining(['status', 'unread'])
    )
    expect(getWorktreeCardModeProperties('Compact')).toEqual(
      expect.arrayContaining(['status', 'unread'])
    )
  })

  it('keeps provider-specific task metadata together in both modes', () => {
    expect(getWorktreeCardModeProperties('Default')).toEqual(
      expect.arrayContaining(TASK_WORKTREE_CARD_PROPERTIES)
    )
    expect(getWorktreeCardModeProperties('Compact')).toEqual(
      expect.arrayContaining(TASK_WORKTREE_CARD_PROPERTIES)
    )
  })

  it('normalizes legacy ci away while preserving branch', () => {
    expect(normalizeWorktreeCardProperties(['ci', 'branch', 'pr'])).toEqual([
      'status',
      'unread',
      'branch',
      'pr'
    ])
  })

  it('returns combined mode update payloads', () => {
    expect(getWorktreeCardModeUpdates('Compact')).toEqual({
      settings: { compactWorktreeCards: true },
      ui: {
        worktreeCardProperties: getWorktreeCardModeProperties('Compact'),
        _worktreeCardModeDefaulted: true
      }
    })
  })
})
