import type { DragEndEvent, DragMoveEvent, DragOverEvent } from '@dnd-kit/core'
import type { TabGroup, TabGroupLayoutNode } from '../../../../shared/types'
import { isPaneColumnSplitDropNoOp } from '../../store/slices/pane-column-split-drop-no-op'
import { resolveTabPaneColumnSplitOverTab, type TabPaneColumnSplitTarget } from './tab-insertion'
import {
  resolvePaneColumnEdgeZone,
  TAB_GROUP_TAB_STRIP_HEIGHT_PX,
  type PaneColumnSplitTarget
} from './tab-drop-zone'
import {
  canDropTabForPaneColumnSplit,
  canDropTabIntoPaneBody,
  isPaneDropData,
  isTabDragData,
  type TabDragItemData
} from './useTabDragSplit'

function getTabGroupBodyElement(groupId: string, worktreeId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-tab-group-body-id="${groupId}"][data-worktree-id="${worktreeId}"]`
  )
}

export function getTabGroupPanelRect(groupId: string, worktreeId: string): DOMRect | null {
  return getTabGroupBodyElement(groupId, worktreeId)?.parentElement?.getBoundingClientRect() ?? null
}

export function getTabGroupBodyRect(groupId: string, worktreeId: string): DOMRect | null {
  return getTabGroupBodyElement(groupId, worktreeId)?.getBoundingClientRect() ?? null
}

export function findTabGroupPanelUnderPointer(
  worktreeId: string,
  pointer: { x: number; y: number },
  getPanelRect: (groupId: string, worktreeId: string) => DOMRect | null = getTabGroupPanelRect
): { groupId: string; panelRect: DOMRect } | null {
  const bodies = document.querySelectorAll<HTMLElement>(
    `[data-tab-group-body-id][data-worktree-id="${worktreeId}"]`
  )
  for (const body of bodies) {
    const groupId = body.dataset.tabGroupBodyId
    if (!groupId) {
      continue
    }
    const panelRect = getPanelRect(groupId, worktreeId)
    if (!panelRect) {
      continue
    }
    if (
      pointer.x >= panelRect.left &&
      pointer.x <= panelRect.right &&
      pointer.y >= panelRect.top &&
      pointer.y <= panelRect.bottom
    ) {
      return { groupId, panelRect }
    }
  }
  return null
}

export function resolvePanelEdgePaneColumnSplit({
  activeDrag,
  targetGroupId,
  worktreeId,
  pointer,
  groupsByWorktree,
  layoutByWorktree,
  panelRect: providedPanelRect
}: {
  activeDrag: TabDragItemData
  targetGroupId: string
  worktreeId: string
  pointer: { x: number; y: number }
  groupsByWorktree: Record<string, TabGroup[]>
  layoutByWorktree: Record<string, TabGroupLayoutNode>
  panelRect?: DOMRect | null
}): PaneColumnSplitTarget | null {
  const panelRect = providedPanelRect ?? getTabGroupPanelRect(targetGroupId, worktreeId)
  if (!panelRect) {
    return null
  }
  const bodyRect = getTabGroupBodyRect(targetGroupId, worktreeId)

  const zone = resolvePaneColumnEdgeZone(panelRect, pointer, {
    bodyRect: bodyRect ?? null,
    tabStripHeightPx: TAB_GROUP_TAB_STRIP_HEIGHT_PX
  })
  if (!zone) {
    return null
  }

  const sourceGroup = (groupsByWorktree[worktreeId] ?? []).find(
    (group) => group.id === activeDrag.groupId
  )
  if (
    isPaneColumnSplitDropNoOp({
      sourceGroupId: activeDrag.groupId,
      targetGroupId,
      splitDirection: zone,
      sourceTabCount: sourceGroup?.tabOrder.length ?? 0,
      layout: layoutByWorktree[worktreeId]
    })
  ) {
    return null
  }

  if (activeDrag.groupId === targetGroupId) {
    if (
      !canDropTabIntoPaneBody({
        activeDrag,
        groupsByWorktree,
        overGroupId: targetGroupId,
        worktreeId
      })
    ) {
      return null
    }
  }

  return { groupId: targetGroupId, zone }
}

export function resolveActivePaneColumnSplitTarget({
  event,
  groupsByWorktree,
  layoutByWorktree,
  worktreeId,
  getDragPointer
}: {
  event: DragMoveEvent | DragOverEvent | DragEndEvent
  groupsByWorktree: Record<string, TabGroup[]>
  layoutByWorktree: Record<string, TabGroupLayoutNode>
  worktreeId: string
  getDragPointer: (event: DragMoveEvent | DragOverEvent | DragEndEvent) => {
    x: number
    y: number
  } | null
}): PaneColumnSplitTarget | TabPaneColumnSplitTarget | null {
  const activeData = event.active.data.current
  const pointer = getDragPointer(event)
  if (!isTabDragData(activeData) || !pointer) {
    return null
  }

  const overData = event.over?.data.current

  if (isTabDragData(overData)) {
    const tabSplit = resolveTabPaneColumnSplitOverTab(event, isTabDragData, () => pointer)
    if (
      tabSplit &&
      canDropTabForPaneColumnSplit({
        activeDrag: activeData,
        groupsByWorktree,
        targetGroupId: tabSplit.groupId,
        worktreeId
      })
    ) {
      return tabSplit
    }
    // Why: cross-pane tab-strip drags target insertion slots. Body-edge splits
    // stay on the pane content area, not the tab row.
    if (activeData.groupId !== overData.groupId) {
      return null
    }
  }

  const panelHit = findTabGroupPanelUnderPointer(worktreeId, pointer)
  const targetGroupId =
    panelHit?.groupId ??
    (isTabDragData(overData) ? overData.groupId : null) ??
    (isPaneDropData(overData) ? overData.groupId : null)

  if (!targetGroupId) {
    return null
  }

  return resolvePanelEdgePaneColumnSplit({
    activeDrag: activeData,
    targetGroupId,
    worktreeId,
    pointer,
    groupsByWorktree,
    layoutByWorktree,
    panelRect: panelHit?.groupId === targetGroupId ? panelHit.panelRect : undefined
  })
}
