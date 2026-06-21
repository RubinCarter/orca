import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabGroupLayoutNode } from '../../../../shared/types'
import type { TabDragItemData } from './useTabDragSplit'
import {
  findTabGroupPanelUnderPointer,
  resolveActivePaneColumnSplitTarget,
  resolvePanelEdgePaneColumnSplit
} from './tab-group-panel-split-target'
import { TAB_GROUP_TAB_STRIP_HEIGHT_PX } from './tab-drop-zone'

function makeDragData(overrides: Partial<TabDragItemData> = {}): TabDragItemData {
  return {
    kind: 'tab',
    worktreeId: 'wt-1',
    groupId: 'group-1',
    unifiedTabId: 'tab-1',
    visibleTabId: 'tab-1',
    tabType: 'terminal',
    label: 'tab-1',
    ...overrides
  }
}

function makeEvent({
  activeData,
  overData = null,
  pointer = { x: 0, y: 0 }
}: {
  activeData: TabDragItemData
  overData?: TabDragItemData | null
  pointer?: { x: number; y: number }
}) {
  return {
    active: { data: { current: activeData } },
    over: overData
      ? {
          data: { current: overData },
          rect: { left: 500, width: 120, top: 0, height: 32 }
        }
      : null,
    delta: { x: 0, y: 0 },
    activatorEvent: { clientX: pointer.x, clientY: pointer.y }
  } as unknown as Parameters<typeof resolveActivePaneColumnSplitTarget>[0]['event']
}

function mockTabGroupRects(panelRect: DOMRect, bodyRect: DOMRect): void {
  vi.stubGlobal('document', {
    querySelector: vi.fn(() => ({
      getBoundingClientRect: () => bodyRect,
      parentElement: {
        getBoundingClientRect: () => panelRect
      }
    })),
    querySelectorAll: vi.fn(() => [
      {
        dataset: {
          tabGroupBodyId: 'group-2',
          worktreeId: 'wt-1'
        }
      }
    ])
  })
}

const horizontalLayout: TabGroupLayoutNode = {
  type: 'split',
  direction: 'horizontal',
  ratio: 0.5,
  first: { type: 'leaf', groupId: 'group-1' },
  second: { type: 'leaf', groupId: 'group-2' }
}

const twoGroupLayout = {
  'wt-1': [
    { id: 'group-1', worktreeId: 'wt-1', activeTabId: 'tab-1', tabOrder: ['tab-1'] },
    { id: 'group-2', worktreeId: 'wt-1', activeTabId: 'tab-2', tabOrder: ['tab-2'] }
  ]
}

const layoutByWorktree = { 'wt-1': horizontalLayout }

describe('resolvePanelEdgePaneColumnSplit', () => {
  const panelRect = {
    left: 500,
    top: 0,
    width: 400,
    height: 600,
    right: 900,
    bottom: 600
  } as DOMRect
  const bodyRect = {
    left: 500,
    top: TAB_GROUP_TAB_STRIP_HEIGHT_PX,
    width: 400,
    height: 600 - TAB_GROUP_TAB_STRIP_HEIGHT_PX,
    right: 900,
    bottom: 600
  } as DOMRect

  beforeEach(() => {
    mockTabGroupRects(panelRect, bodyRect)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a right-edge split when the pointer is on the outer band', () => {
    expect(
      resolvePanelEdgePaneColumnSplit({
        activeDrag: makeDragData({ groupId: 'group-1' }),
        targetGroupId: 'group-2',
        worktreeId: 'wt-1',
        pointer: { x: 880, y: 300 },
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree
      })
    ).toEqual({ groupId: 'group-2', zone: 'right' })
  })

  it('returns null in the center band so cross-group tab insertion can win', () => {
    expect(
      resolvePanelEdgePaneColumnSplit({
        activeDrag: makeDragData({ groupId: 'group-1' }),
        targetGroupId: 'group-2',
        worktreeId: 'wt-1',
        pointer: { x: 700, y: 300 },
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree
      })
    ).toBeNull()
  })

  it('does not treat the tab strip as a top split edge', () => {
    expect(
      resolvePanelEdgePaneColumnSplit({
        activeDrag: makeDragData({ groupId: 'group-2' }),
        targetGroupId: 'group-1',
        worktreeId: 'wt-1',
        pointer: { x: 650, y: 16 },
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree
      })
    ).toBeNull()
  })

  it('suppresses adjacent sibling pane-column splits that would collapse back to the current layout', () => {
    const group1Panel = {
      left: 0,
      top: 0,
      width: 400,
      height: 600,
      right: 400,
      bottom: 600
    } as DOMRect

    expect(
      resolvePanelEdgePaneColumnSplit({
        activeDrag: makeDragData({ groupId: 'group-2', unifiedTabId: 'tab-2' }),
        targetGroupId: 'group-1',
        worktreeId: 'wt-1',
        pointer: { x: 360, y: 300 },
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree,
        panelRect: group1Panel
      })
    ).toBeNull()
  })
})

describe('resolveActivePaneColumnSplitTarget', () => {
  const panelRect = {
    left: 500,
    top: 0,
    width: 400,
    height: 600,
    right: 900,
    bottom: 600
  } as DOMRect
  const bodyRect = {
    left: 500,
    top: TAB_GROUP_TAB_STRIP_HEIGHT_PX,
    width: 400,
    height: 600 - TAB_GROUP_TAB_STRIP_HEIGHT_PX,
    right: 900,
    bottom: 600
  } as DOMRect

  beforeEach(() => {
    mockTabGroupRects(panelRect, bodyRect)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves cross-group panel-edge splits without an dnd-kit over target', () => {
    expect(findTabGroupPanelUnderPointer('wt-1', { x: 880, y: 300 })?.groupId).toBe('group-2')
    expect(
      resolveActivePaneColumnSplitTarget({
        event: makeEvent({
          activeData: makeDragData({ groupId: 'group-1' }),
          overData: null,
          pointer: { x: 880, y: 300 }
        }),
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree,
        worktreeId: 'wt-1',
        getDragPointer: () => ({ x: 880, y: 300 })
      })
    ).toEqual({ groupId: 'group-2', zone: 'right' })
  })

  it('skips pane-edge splits for cross-group tab-strip hovers', () => {
    expect(
      resolveActivePaneColumnSplitTarget({
        event: makeEvent({
          activeData: makeDragData({ groupId: 'group-2', unifiedTabId: 'tab-2' }),
          overData: makeDragData({
            groupId: 'group-1',
            unifiedTabId: 'tab-1',
            visibleTabId: 'tab-1'
          }),
          pointer: { x: 650, y: 16 }
        }),
        groupsByWorktree: twoGroupLayout,
        layoutByWorktree,
        worktreeId: 'wt-1',
        getDragPointer: () => ({ x: 650, y: 16 })
      })
    ).toBeNull()
  })
})
