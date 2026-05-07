import { ArrowRight, X } from 'lucide-react'

import { useAppStore } from '@/store'
import { getConnectionId } from '@/lib/connection-context'
import type { WorkspaceVisibleTabType } from '../../../../shared/types'

type MacPermissionsHintProps = {
  activeView: 'terminal' | 'settings' | 'tasks'
  activeTabType: WorkspaceVisibleTabType
  activeWorktreeId: string | null
}

// One-line dismissible breadcrumb that points users at Settings → Permissions
// before they hit a silent permission-denied failure. Passive structural hint
// shown unconditionally on local Mac terminals, complementing the targeted
// pty-output keyword detector in pty-connection.ts.
export function MacPermissionsHint({
  activeView,
  activeTabType,
  activeWorktreeId
}: MacPermissionsHintProps): React.JSX.Element | null {
  const dismissed = useAppStore((s) => s.terminalMacPermissionsHintDismissed)
  const dismiss = useAppStore((s) => s.dismissTerminalMacPermissionsHint)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)

  // Why: TCC (the macOS permission system) is host-local — a Mac client
  // SSH'd into a remote worktree can't grant permissions on the remote, and
  // a non-Mac client never needs them. Gate hard on both.
  const isMac = navigator.userAgent.includes('Mac')
  const isLocalWorktree = getConnectionId(activeWorktreeId) === null
  const isTerminalView =
    activeView === 'terminal' && activeTabType === 'terminal' && activeWorktreeId !== null

  if (!isMac || !isTerminalView || !isLocalWorktree || dismissed) {
    return null
  }

  const handleOpenSettings = (): void => {
    openSettingsTarget({
      pane: 'developer-permissions',
      repoId: null,
      sectionId: 'developer-permissions'
    })
    openSettingsPage()
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex-1 truncate">Need macOS device permissions for CLIs?</span>
      <button
        type="button"
        onClick={handleOpenSettings}
        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-foreground underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Settings · Permissions
        <ArrowRight className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Dismiss permissions hint"
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
