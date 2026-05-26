import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultOnboardingState, getDefaultSettings } from '../../../../shared/constants'
import { useAppStore } from '@/store'
import OnboardingFlow from './OnboardingFlow'

describe('OnboardingFlow', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore.setState({
      repos: [],
      settings: getDefaultSettings('/tmp')
    })
    vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
  })

  afterEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    vi.unstubAllGlobals()
  })

  it('renders the tour intro in the standard left-aligned onboarding shell', () => {
    const html = renderToStaticMarkup(
      <OnboardingFlow
        onboarding={{
          ...getDefaultOnboardingState(),
          lastCompletedStep: 5
        }}
        onOnboardingChange={vi.fn()}
      />
    )

    expect(html).toContain('Explore Orca')
    expect(html).toContain('Preview the core workflow.')
    expect(html).toContain('Run agents in isolated workspaces.')
    expect(html).toContain('Orchestrate agents to finish larger tasks.')
    expect(html).toContain('Start tasks from GitHub or Linear.')
    expect(html).toContain('Send webpage elements to agents from the Orca browser.')
    expect(html).not.toContain('Write and preview Markdown.')
    expect(html).toContain('items-start')
    expect(html).toContain('text-left')
    expect(html).toContain('Continue')
    expect(html).toContain('Skip to project setup')
    expect(html).not.toContain('Skip the tour')
  })

  it('keeps agent setup actions out of the footer', () => {
    const html = renderToStaticMarkup(
      <OnboardingFlow
        onboarding={{
          ...getDefaultOnboardingState(),
          lastCompletedStep: 3
        }}
        onOnboardingChange={vi.fn()}
      />
    )

    expect(html).toContain('Set up Orca for agents')
    expect(html).toContain('Turn on advanced Orca capabilities for agents.')
    expect(html).toContain('Set up features')
    expect(html).toContain('Continue')
    expect(html).toContain('Skip to project setup')
    expect(html).not.toContain('>Skip</button>')
  })
})
