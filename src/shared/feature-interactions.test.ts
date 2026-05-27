import { describe, expect, it } from 'vitest'
import {
  FEATURE_INTERACTIONS,
  hasFeatureInteraction,
  normalizeFeatureInteractions,
  type FeatureInteractionId
} from './feature-interactions'

type DefinedFeatureInteractionId = (typeof FEATURE_INTERACTIONS)[number]['id']
type MissingFeatureInteractionId = Exclude<FeatureInteractionId, DefinedFeatureInteractionId>
type ExtraFeatureInteractionId = Exclude<DefinedFeatureInteractionId, FeatureInteractionId>

describe('feature interactions', () => {
  it('defines local interaction semantics for product education features', () => {
    const catalogMatchesPublicUnion: [
      MissingFeatureInteractionId,
      ExtraFeatureInteractionId
    ] extends [never, never]
      ? true
      : never = true
    const expectedIds: FeatureInteractionId[] = [
      'workspace-board',
      'workspace-board-actions',
      'browser',
      'tasks',
      'automations',
      'automation-created',
      'automation-run',
      'browser-annotations',
      'browser-grab',
      'workspace-creation',
      'agent-browser-use',
      'agent-orchestration',
      'ai-commit-generation',
      'ai-pr-generation',
      'claude-account-switching',
      'computer-use',
      'codex-account-switching',
      'floating-workspace',
      'mobile-pairing',
      'notifications',
      'ports',
      'quick-commands',
      'resource-manager',
      'review-notes',
      'ssh',
      'terminal-panes',
      'terminal-tabs',
      'usage-tracking',
      'voice-dictation',
      'workspace-cleanup'
    ]

    expect(catalogMatchesPublicUnion).toBe(true)
    expect(FEATURE_INTERACTIONS.map((feature) => feature.id)).toEqual(expectedIds)
    for (const feature of FEATURE_INTERACTIONS) {
      expect(feature.interaction.length).toBeGreaterThan(0)
    }
  })

  it('normalizes persisted records by removing unknown ids and malformed values', () => {
    expect(
      normalizeFeatureInteractions({
        tasks: { firstInteractedAt: 100 },
        browser: { firstInteractedAt: Number.NaN },
        automations: { firstInteractedAt: 200, interactionCount: 3 },
        'browser-grab': { firstInteractedAt: 250, interactionCount: 0 },
        unknown: { firstInteractedAt: 200 },
        'voice-dictation': { firstInteractedAt: 300 }
      })
    ).toEqual({
      tasks: { firstInteractedAt: 100, interactionCount: 1 },
      automations: { firstInteractedAt: 200, interactionCount: 3 },
      'browser-grab': { firstInteractedAt: 250, interactionCount: 1 },
      'voice-dictation': { firstInteractedAt: 300, interactionCount: 1 }
    })
  })

  it('treats only valid known records as interacted', () => {
    expect(
      hasFeatureInteraction({ tasks: { firstInteractedAt: 100, interactionCount: 1 } }, 'tasks')
    ).toBe(true)
    expect(
      hasFeatureInteraction({ tasks: { firstInteractedAt: 100, interactionCount: 1 } }, 'browser')
    ).toBe(false)
    expect(
      hasFeatureInteraction(
        { tasks: { firstInteractedAt: Number.POSITIVE_INFINITY, interactionCount: 1 } },
        'tasks'
      )
    ).toBe(false)
  })
})
