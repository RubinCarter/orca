import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GitHubRateLimitPanel } from '@/components/github/github-rate-limit-display'
import { GitLabRateLimitPanel } from '@/components/gitlab/gitlab-rate-limit-display'

type StoreState = {
  settings: { activeRuntimeEnvironmentId: string | null }
}

const mocks = vi.hoisted(() => ({
  store: { current: { settings: { activeRuntimeEnvironmentId: null } } as StoreState }
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(mocks.store.current)
}))

describe('provider rate-limit panels account scope', () => {
  it('shows the local host scope for GitHub API budget', () => {
    mocks.store.current = { settings: { activeRuntimeEnvironmentId: null } }

    const markup = renderToStaticMarkup(<GitHubRateLimitPanel />)

    expect(markup).toContain('Budget scope: Local Mac')
    expect(markup).toContain(
      'GitHub API budget is fetched from the CLI on this desktop client. Choose a remote Host from Settings &gt; Active Server to view server-owned budgets.'
    )
  })

  it('shows the remote server scope for GitLab API budget', () => {
    mocks.store.current = { settings: { activeRuntimeEnvironmentId: 'runtime-1' } }

    const markup = renderToStaticMarkup(<GitLabRateLimitPanel />)

    expect(markup).toContain('Budget scope: Remote server: runtime-1')
    expect(markup).toContain(
      'GitLab API budget is fetched from the CLI on this remote server. Choose a different Host from Settings &gt; Active Server to view another budget.'
    )
  })
})
