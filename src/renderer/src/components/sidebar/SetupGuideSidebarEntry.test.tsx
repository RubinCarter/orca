import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeatureWallSetupProgress } from '../feature-wall/feature-wall-setup-progress'
import { SetupGuideSidebarEntry } from './SetupGuideSidebarEntry'

const mocks = vi.hoisted(() => ({
  useSetupGuideProgress: vi.fn(),
  openModal: vi.fn(),
  setSetupGuideSidebarDismissed: vi.fn()
}))

let persistedUIReady = true
let activeModal = 'none'
let setupGuideSidebarDismissed = false

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeModal,
      openModal: mocks.openModal,
      persistedUIReady,
      setupGuideSidebarDismissed,
      setSetupGuideSidebarDismissed: mocks.setSetupGuideSidebarDismissed
    })
}))

vi.mock('../setup-guide/use-setup-guide-progress', () => ({
  useSetupGuideProgress: mocks.useSetupGuideProgress
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('../setup-guide/SetupGuideProgressRing', () => ({
  SetupGuideProgressRing: () => <span data-testid="setup-progress-ring" />
}))

function makeProgress(overrides: Partial<FeatureWallSetupProgress> = {}): FeatureWallSetupProgress {
  return {
    ready: true,
    stepDone: {
      'default-agent': false,
      'add-two-repos': false,
      notifications: false,
      'split-terminal': false,
      'two-worktrees': false,
      'task-sources': false,
      'agent-capabilities': false,
      'setup-script': false
    },
    coreDoneCount: 0,
    coreTotal: 8,
    ...overrides
  }
}

describe('SetupGuideSidebarEntry', () => {
  beforeEach(() => {
    persistedUIReady = true
    activeModal = 'none'
    setupGuideSidebarDismissed = false
    mocks.openModal.mockReset()
    mocks.setSetupGuideSidebarDismissed.mockReset()
    mocks.useSetupGuideProgress.mockReturnValue(makeProgress())
  })

  it('does not render before persisted UI hydration is ready', () => {
    persistedUIReady = false

    expect(renderToStaticMarkup(<SetupGuideSidebarEntry />)).not.toContain('Onboarding checklist')
  })

  it('does not render before setup progress readiness settles', () => {
    mocks.useSetupGuideProgress.mockReturnValue(makeProgress({ ready: false }))

    expect(renderToStaticMarkup(<SetupGuideSidebarEntry />)).not.toContain('Onboarding checklist')
  })

  it('renders after persisted UI and setup progress are ready when setup is incomplete', () => {
    expect(renderToStaticMarkup(<SetupGuideSidebarEntry />)).toContain('Onboarding checklist')
  })
})
