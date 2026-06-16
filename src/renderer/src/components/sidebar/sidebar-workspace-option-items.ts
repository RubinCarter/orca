import type { WorktreeCardProperty } from '../../../../shared/types'
import { TASK_WORKTREE_CARD_PROPERTIES } from '../../../../shared/constants'
import { translate } from '@/i18n/i18n'

export const GROUP_BY_OPTIONS = [
  {
    id: 'none',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.c2c7a45cda', 'None')
    }
  },
  {
    id: 'workspace-status',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.e029a2d775', 'Status')
    }
  },
  {
    id: 'pr-status',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.0f9b959b31', 'PR')
    }
  },
  {
    id: 'repo',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.2170d553cf', 'Project')
    }
  }
] as const

export type WorktreeCardPropertyOption = {
  id: string
  properties: readonly WorktreeCardProperty[]
  label: string
}

export const WORKTREE_CARD_PROPERTY_OPTIONS: WorktreeCardPropertyOption[] = [
  {
    id: 'status',
    // Why: unread is rendered in the same tiny status lane, so users should
    // only have one Status display decision instead of a separate Unread knob.
    properties: ['status', 'unread'],
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.1a0eec0d35', 'Status')
    }
  },
  {
    id: 'tasks',
    properties: TASK_WORKTREE_CARD_PROPERTIES,
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.b5536d5a88', 'Tasks')
    }
  },
  {
    id: 'comment',
    properties: ['comment'],
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.8d62c68b35', 'Notes')
    }
  },
  {
    id: 'ports',
    properties: ['ports'],
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.2d74665a56', 'Ports')
    }
  },
  {
    id: 'inline-agents',
    properties: ['inline-agents'],
    get label() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.65a9820bd1',
        'Agent statuses'
      )
    }
  },
  {
    id: 'branch',
    properties: ['branch'],
    get label() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.219ebf1961',
        'Branch name'
      )
    }
  }
]

export const SORT_OPTIONS = [
  {
    id: 'name',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.3728165cdd', 'Name')
    },
    description: null
  },
  {
    id: 'smart',
    get label() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.503462f2b4',
        'Agent Activity'
      )
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.b759bb87ee',
        'Agents that need attention, then most recent activity.'
      )
    }
  },
  {
    id: 'recent',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.b451c8b162', 'Recent')
    },
    description: null
  },
  {
    id: 'repo',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.2170d553cf', 'Project')
    },
    description: null
  },
  {
    id: 'manual',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.7b316bdd51', 'Manual')
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.7153d07485',
        'Drag workspaces to arrange them within each group.'
      )
    }
  }
] as const

export const PROJECT_ORDER_OPTIONS = [
  {
    id: 'manual',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.7b316bdd51', 'Manual')
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.6664282a7b',
        'Drag projects to arrange them'
      )
    }
  },
  {
    id: 'recent',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.b451c8b162', 'Recent')
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.af9249c505',
        'Most recent workspace activity'
      )
    }
  }
] as const
