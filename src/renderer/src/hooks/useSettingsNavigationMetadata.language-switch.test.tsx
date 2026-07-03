// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UI_LANGUAGE_CHINESE, UI_LANGUAGE_ENGLISH } from '../../../shared/ui-language'
import { i18n } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import { useSettingsNavigationMetadata } from './useSettingsNavigationMetadata'

// Why: bug 2 lives in the hook's memoization, not the pure builder — the plain
// builder tests in useSettingsNavigationMetadata.test.ts translate correctly at
// call time and can never catch a stale useMemo. This spec renders the real
// hook and switches the live locale, so a memo whose deps miss the active
// locale returns the previous language's sections and fails here.

const initialAppState = useAppStore.getInitialState()

// The "General" nav row: distinct en ("General") / zh ("通用") titles, always
// present, no platform/runtime gating.
function generalTitle(sections: SettingsNavSection[]): string | undefined {
  return sections.find((section) => section.id === 'general')?.title
}

describe('useSettingsNavigationMetadata live language switch', () => {
  beforeEach(async () => {
    useAppStore.setState(initialAppState, true)
    await i18n.changeLanguage(UI_LANGUAGE_ENGLISH)
  })

  afterEach(async () => {
    await i18n.changeLanguage(UI_LANGUAGE_ENGLISH)
  })

  it('retranslates nav section titles when the UI language changes without a remount', async () => {
    const { result } = renderHook(() => useSettingsNavigationMetadata())

    // Baseline: the hook memoizes English sections on first render.
    expect(generalTitle(result.current)).toBe('General')

    // Same signal the live Language select fires: useTranslation reruns the hook.
    await act(async () => {
      await i18n.changeLanguage(UI_LANGUAGE_CHINESE)
    })

    // The rerender alone is not enough: the memo must recompute against the new
    // active locale, or the sidebar/Cmd+J stay English until Settings remounts.
    expect(generalTitle(result.current)).toBe('通用')
  })
})
