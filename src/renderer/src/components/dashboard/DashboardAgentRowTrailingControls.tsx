import React from 'react'
import { ChevronDown, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

type Props = {
  expanded: boolean
  hideExpand: boolean
  isSleeping: boolean
  sendTargetStatus?: 'eligible' | 'disabled' | 'sending'
  timeLabel: string | null
  onDismiss: (e: React.MouseEvent) => void
  onInlineSendTargetClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onStopKeyDown: (e: React.KeyboardEvent) => void
  onStopMouseDown: (e: React.MouseEvent) => void
  onToggleExpand: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export function DashboardAgentRowTrailingControls({
  expanded,
  hideExpand,
  isSleeping,
  sendTargetStatus,
  timeLabel,
  onDismiss,
  onInlineSendTargetClick,
  onStopKeyDown,
  onStopMouseDown,
  onToggleExpand
}: Props): React.JSX.Element {
  const showSendTarget = sendTargetStatus === 'eligible' || sendTargetStatus === 'sending'
  const showDismiss = !isSleeping && !sendTargetStatus
  const dismissLabel = translate(
    'auto.components.dashboard.DashboardAgentRow.b06e13fcf7',
    'Dismiss agent'
  )
  const dismissTitle = translate(
    'auto.components.dashboard.DashboardAgentRow.5ae84475cc',
    'Dismiss'
  )
  return (
    // Why: right cluster keeps passive time and dismiss affordance in one
    // place. State belongs in the leading gutter; repeating it here as text
    // makes interrupted rows look like the old badge treatment.
    <span className="relative ml-auto flex h-3.5 w-12 shrink-0 items-center justify-end">
      {showSendTarget && (
        <button
          type="button"
          onClick={onInlineSendTargetClick}
          onMouseDown={onStopMouseDown}
          onKeyDown={onStopKeyDown}
          disabled={sendTargetStatus === 'sending'}
          className={cn(
            'worktree-agent-send-target-button absolute right-0 top-1/2 z-10 inline-flex h-5 -translate-y-1/2 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium leading-none transition-[background-color,border-color,color,opacity]',
            sendTargetStatus === 'sending' && 'cursor-progress opacity-75'
          )}
          aria-label={translate(
            'auto.components.dashboard.DashboardAgentRow.0272969e28',
            'Send to this agent'
          )}
          title={translate(
            'auto.components.dashboard.DashboardAgentRow.0272969e28',
            'Send to this agent'
          )}
        >
          <Send className="size-3" />
          <span>{translate('auto.components.dashboard.DashboardAgentRow.912e136cd9', 'Send')}</span>
        </button>
      )}
      {showDismiss && timeLabel && (
        <span className="relative grid grid-cols-1 grid-rows-1 shrink-0 items-center justify-items-end">
          <span
            className={cn(
              '[grid-area:1/1] pointer-events-none text-[10px] leading-none text-muted-foreground/60',
              'transition-opacity duration-150',
              'group-hover/agent-row:opacity-0'
            )}
            aria-hidden
          >
            {timeLabel}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            onMouseDown={onStopMouseDown}
            onKeyDown={onStopKeyDown}
            className={cn(
              '[grid-area:1/1] inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground',
              'opacity-0 transition-opacity duration-150',
              'group-hover/agent-row:opacity-100 focus-visible:opacity-100'
            )}
            aria-label={dismissLabel}
            title={dismissTitle}
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}
      {showDismiss && !timeLabel && (
        <button
          type="button"
          onClick={onDismiss}
          onMouseDown={onStopMouseDown}
          onKeyDown={onStopKeyDown}
          className={cn(
            'inline-flex shrink-0 items-center justify-center text-muted-foreground/70 hover:text-foreground',
            'opacity-0 transition-opacity duration-150',
            'group-hover/agent-row:opacity-100 focus-visible:opacity-100'
          )}
          aria-label={dismissLabel}
          title={dismissTitle}
        >
          <X className="size-3.5" />
        </button>
      )}
      {!hideExpand && (
        <button
          type="button"
          onClick={onToggleExpand}
          onMouseDown={onStopMouseDown}
          onKeyDown={onStopKeyDown}
          className="inline-flex shrink-0 items-center justify-center text-muted-foreground/60 hover:text-foreground"
          aria-label={
            expanded
              ? translate(
                  'auto.components.dashboard.DashboardAgentRow.a41fb5376e',
                  'Collapse details'
                )
              : translate(
                  'auto.components.dashboard.DashboardAgentRow.a743da52ff',
                  'Expand details'
                )
          }
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-180')}
          />
        </button>
      )}
    </span>
  )
}
