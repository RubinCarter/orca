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
    expect(props).not.toContain('pr')
    expect(props).toEqual(DEFAULT_WORKTREE_CARD_PROPERTIES)
  })

  it('defines Compact without extra rows or branch metadata', () => {
    const props = getWorktreeCardModeProperties('Compact')

    expect(props).not.toContain('inline-agents')
    expect(props).not.toContain('issue')
    expect(props).not.toContain('linear-issue')
    expect(props).not.toContain('comment')
    expect(props).not.toContain('ports')
    expect(props).not.toContain('branch')
    expect(props).not.toContain('pr')
  })

  it('keeps status and unread enabled in both presets', () => {
    expect(getWorktreeCardModeProperties('Default')).toEqual(
      expect.arrayContaining(['status', 'unread'])
    )
    expect(getWorktreeCardModeProperties('Compact')).toEqual(
      expect.arrayContaining(['status', 'unread'])
    )
  })

  it('keeps provider-specific task metadata together in Default mode', () => {
    expect(getWorktreeCardModeProperties('Default')).toEqual(
      expect.arrayContaining(TASK_WORKTREE_CARD_PROPERTIES)
    )
  })

  it('normalizes legacy ci and pr away while preserving selected properties', () => {
    expect(normalizeWorktreeCardProperties(['ci', 'branch', 'pr'])).toEqual(['branch'])
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
