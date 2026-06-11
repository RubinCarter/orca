import { describe, expect, it } from 'vitest'
import type { ExecutionHostId } from '../../../shared/execution-host'
import type { ExecutionHostRegistryEntry } from '../../../shared/execution-host-registry'
import type { ProjectHostSetup, Repo } from '../../../shared/types'
import { buildProjectHostSetupOptions } from './project-host-setup-options'

function repo(id: string): Repo {
  return {
    id,
    path: `/repos/${id}`,
    displayName: id,
    badgeColor: '#000000',
    addedAt: 1
  }
}

function setup(
  id: string,
  projectId: string,
  hostId: ExecutionHostId,
  repoId: string,
  overrides: Partial<ProjectHostSetup> = {}
): ProjectHostSetup {
  return {
    id,
    projectId,
    hostId,
    repoId,
    path: `/repos/${repoId}`,
    displayName: repoId,
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function host(
  id: ExecutionHostId,
  overrides: Partial<ExecutionHostRegistryEntry> = {}
): ExecutionHostRegistryEntry {
  return {
    id,
    kind: id === 'local' ? 'local' : id.startsWith('ssh:') ? 'ssh' : 'runtime',
    label: id === 'local' ? 'Local Mac' : id.replace(/^ssh:|^runtime:/, ''),
    detail: id === 'local' ? 'This computer' : 'Host',
    health: id === 'local' ? 'local' : 'available',
    ...overrides
  }
}

describe('buildProjectHostSetupOptions', () => {
  it('returns ready setup choices for one project sorted with local first', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo'), repo('remote-repo')],
      projectHostSetups: [
        setup('remote', 'project-1', 'ssh:builder', 'remote-repo'),
        setup('local', 'project-1', 'local', 'local-repo')
      ]
    })

    expect(options.map((option) => option.id)).toEqual(['local', 'remote'])
    expect(options[0]).toMatchObject({ label: 'Local Mac', repoId: 'local-repo' })
    expect(options[1]).toMatchObject({ label: 'builder', repoId: 'remote-repo' })
  })

  it('omits setups that are not ready or cannot create through an eligible repo', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('ready-repo')],
      projectHostSetups: [
        setup('ready', 'project-1', 'local', 'ready-repo'),
        setup('setting-up', 'project-1', 'ssh:builder', 'missing-repo', {
          setupState: 'setting-up'
        }),
        setup('other-project', 'project-2', 'local', 'ready-repo')
      ]
    })

    expect(options.map((option) => option.id)).toEqual(['ready'])
  })

  it('includes known hosts that still need project setup', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo')],
      hosts: [host('local'), host('ssh:builder', { label: 'Builder' })],
      projectHostSetups: [setup('local', 'project-1', 'local', 'local-repo')]
    })

    expect(options).toEqual([
      expect.objectContaining({ id: 'local', kind: 'ready', label: 'Local Mac' }),
      expect.objectContaining({
        id: 'needs-setup:ssh:builder',
        kind: 'needs-setup',
        label: 'Builder',
        detail: 'Project not set up on this host',
        isAvailable: true
      })
    ])
  })

  it('shows pending setup status for known hosts with non-ready setup metadata', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo')],
      hosts: [
        host('local'),
        host('runtime:gpu', { label: 'GPU VM', capabilities: ['project-host-setup.v1'] })
      ],
      projectHostSetups: [
        setup('local', 'project-1', 'local', 'local-repo'),
        setup('gpu-pending', 'project-1', 'runtime:gpu', '', {
          path: '',
          setupState: 'setting-up',
          setupMethod: 'provisioned'
        })
      ]
    })

    expect(options).toEqual([
      expect.objectContaining({ id: 'local', kind: 'ready', label: 'Local Mac' }),
      expect.objectContaining({
        id: 'needs-setup:runtime:gpu',
        kind: 'needs-setup',
        label: 'GPU VM',
        detail: 'Project setup is in progress',
        isAvailable: true
      })
    ])
  })

  it('uses specific pending details for not-set-up, error, and unsupported setup metadata', () => {
    const base = {
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo')],
      projectHostSetups: [setup('local', 'project-1', 'local', 'local-repo')]
    }

    expect(
      buildProjectHostSetupOptions({
        ...base,
        hosts: [host('runtime:gpu', { label: 'GPU VM', capabilities: ['project-host-setup.v1'] })],
        projectHostSetups: [
          ...base.projectHostSetups,
          setup('gpu-pending', 'project-1', 'runtime:gpu', '', {
            path: '',
            setupState: 'not-set-up',
            setupMethod: 'provisioned'
          })
        ]
      }).at(-1)
    ).toMatchObject({ detail: 'Project tracked on this host but not set up' })

    expect(
      buildProjectHostSetupOptions({
        ...base,
        hosts: [host('runtime:gpu', { label: 'GPU VM', capabilities: ['project-host-setup.v1'] })],
        projectHostSetups: [
          ...base.projectHostSetups,
          setup('gpu-pending', 'project-1', 'runtime:gpu', '', {
            path: '',
            setupState: 'error',
            setupMethod: 'provisioned'
          })
        ]
      }).at(-1)
    ).toMatchObject({ detail: 'Project setup needs attention' })

    expect(
      buildProjectHostSetupOptions({
        ...base,
        hosts: [host('runtime:gpu', { label: 'GPU VM', capabilities: ['project-host-setup.v1'] })],
        projectHostSetups: [
          ...base.projectHostSetups,
          setup('gpu-pending', 'project-1', 'runtime:gpu', '', {
            path: '',
            setupState: 'unsupported',
            setupMethod: 'provisioned'
          })
        ]
      }).at(-1)
    ).toMatchObject({ detail: 'Project is unsupported on this host' })
  })

  it('marks incompatible runtime hosts as visible but unavailable', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo')],
      hosts: [
        host('local'),
        host('runtime:gpu', {
          label: 'GPU VM',
          health: 'blocked',
          capabilities: ['project-host-setup.v1']
        })
      ],
      projectHostSetups: [setup('local', 'project-1', 'local', 'local-repo')]
    })

    expect(options).toEqual([
      expect.objectContaining({ id: 'local', kind: 'ready', label: 'Local Mac' }),
      expect.objectContaining({
        id: 'needs-setup:runtime:gpu',
        kind: 'needs-setup',
        label: 'GPU VM',
        detail: 'Orca server version is incompatible',
        isAvailable: false
      })
    ])
  })

  it('marks runtime hosts without project setup capability as unavailable', () => {
    const options = buildProjectHostSetupOptions({
      projectId: 'project-1',
      eligibleRepos: [repo('local-repo')],
      hosts: [host('local'), host('runtime:gpu', { label: 'GPU VM', capabilities: [] })],
      projectHostSetups: [setup('local', 'project-1', 'local', 'local-repo')]
    })

    expect(options.at(-1)).toMatchObject({
      id: 'needs-setup:runtime:gpu',
      kind: 'needs-setup',
      detail: 'Update Orca on this host to set up projects',
      isAvailable: false
    })
  })
})
