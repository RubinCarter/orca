// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NeedsSetupProjectHostOption,
  ProjectHostSetupOption
} from '@/lib/project-host-setup-options'
import ProjectHostSetupCombobox from './ProjectHostSetupCombobox'

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({
    children,
    disabled,
    onSelect,
    value
  }: {
    children: React.ReactNode
    disabled?: boolean
    onSelect?: (value: string) => void
    value: string
  }) => (
    <button
      type="button"
      data-command-value={value}
      disabled={disabled}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </button>
  )
}))

let container: HTMLDivElement
let root: Root

const readyOption: ProjectHostSetupOption = {
  id: 'local-setup',
  kind: 'ready',
  projectId: 'project-1',
  hostId: 'local',
  repoId: 'local-repo',
  label: 'Local Mac',
  detail: 'Orca',
  path: '/Users/alice/orca'
}

const needsSetupOption: NeedsSetupProjectHostOption = {
  id: 'needs-setup:ssh:builder',
  kind: 'needs-setup',
  projectId: 'project-1',
  hostId: 'ssh:builder',
  label: 'Builder',
  detail: 'Project not set up on this host',
  isAvailable: true
}

const unavailableOption: NeedsSetupProjectHostOption = {
  id: 'needs-setup:runtime:old',
  kind: 'needs-setup',
  projectId: 'project-1',
  hostId: 'runtime:old',
  label: 'Old server',
  detail: 'Update Orca on this host to set up projects',
  isAvailable: false
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

function renderCombobox({
  onValueChange = vi.fn(),
  onNeedsSetupHostSelect = vi.fn()
}: {
  onValueChange?: (setupId: string) => void
  onNeedsSetupHostSelect?: (option: NeedsSetupProjectHostOption) => void
} = {}): void {
  act(() => {
    root.render(
      <ProjectHostSetupCombobox
        options={[readyOption, needsSetupOption]}
        value={readyOption.id}
        onValueChange={onValueChange}
        onNeedsSetupHostSelect={onNeedsSetupHostSelect}
      />
    )
  })
}

describe('ProjectHostSetupCombobox', () => {
  it('routes ready setup rows through onValueChange', () => {
    const onValueChange = vi.fn()
    const onNeedsSetupHostSelect = vi.fn()

    renderCombobox({ onValueChange, onNeedsSetupHostSelect })

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-command-value="local-setup"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onValueChange).toHaveBeenCalledWith('local-setup')
    expect(onNeedsSetupHostSelect).not.toHaveBeenCalled()
  })

  it('routes hosts that need setup through onNeedsSetupHostSelect', () => {
    const onValueChange = vi.fn()
    const onNeedsSetupHostSelect = vi.fn()

    renderCombobox({ onValueChange, onNeedsSetupHostSelect })

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-command-value="needs-setup:ssh:builder"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onValueChange).not.toHaveBeenCalled()
    expect(onNeedsSetupHostSelect).toHaveBeenCalledWith(needsSetupOption)
  })

  it('keeps unavailable setup rows visible but not selectable', () => {
    const onValueChange = vi.fn()
    const onNeedsSetupHostSelect = vi.fn()

    act(() => {
      root.render(
        <ProjectHostSetupCombobox
          options={[readyOption, unavailableOption]}
          value={readyOption.id}
          onValueChange={onValueChange}
          onNeedsSetupHostSelect={onNeedsSetupHostSelect}
        />
      )
    })

    const unavailableButton = container.querySelector<HTMLButtonElement>(
      '[data-command-value="needs-setup:runtime:old"]'
    )
    expect(unavailableButton?.textContent).toContain('Update Orca on this host')
    expect(unavailableButton?.disabled).toBe(true)

    act(() => {
      unavailableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onValueChange).not.toHaveBeenCalled()
    expect(onNeedsSetupHostSelect).not.toHaveBeenCalled()
  })
})
