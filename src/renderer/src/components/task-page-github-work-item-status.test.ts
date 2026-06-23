import { describe, expect, it } from 'vitest'
import {
  getTaskPageGitHubPRIconTone,
  getTaskPageGitHubWorkItemStateLabel,
  getTaskPageGitHubWorkItemStateTone,
  isTaskPageGitHubDraftPR
} from './task-page-github-work-item-status'

describe('task-page-github-work-item-status', () => {
  it('maps PR states to labels', () => {
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'pr', state: 'draft' })).toBe('Draft')
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'pr', state: 'open' })).toBe('Open')
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'pr', state: 'closed' })).toBe('Closed')
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'pr', state: 'merged' })).toBe('Merged')
  })

  it('maps issue states to labels', () => {
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'issue', state: 'open' })).toBe('Open')
    expect(getTaskPageGitHubWorkItemStateLabel({ type: 'issue', state: 'closed' })).toBe('Closed')
  })

  it('uses GitHub-like neutral draft tones and muted draft icons', () => {
    const draftTone = getTaskPageGitHubWorkItemStateTone({ type: 'pr', state: 'draft' })
    expect(draftTone).toContain('muted')
    expect(draftTone).not.toContain('amber')
    expect(getTaskPageGitHubPRIconTone({ type: 'pr', state: 'draft' })).toContain('muted')
    expect(getTaskPageGitHubPRIconTone({ type: 'pr', state: 'open' })).toContain('emerald')
    expect(isTaskPageGitHubDraftPR({ type: 'pr', state: 'draft' })).toBe(true)
    expect(isTaskPageGitHubDraftPR({ type: 'pr', state: 'open' })).toBe(false)
  })

  it('uses distinct tones for merged and open PRs', () => {
    expect(getTaskPageGitHubWorkItemStateTone({ type: 'pr', state: 'merged' })).toContain('purple')
    expect(getTaskPageGitHubWorkItemStateTone({ type: 'pr', state: 'open' })).toContain('emerald')
  })
})
