// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_LANGUAGE_ENGLISH } from '../../../shared/ui-language'
import type { AppState } from '@/store/types'
import { useAppStore } from '@/store'
import { i18n } from './i18n'
import { I18nProvider } from './I18nProvider'

// Why: bug 1 is a boot race — on a non-English system the provider kicks off an
// async system-locale switch whose lazy catalog is still loading when the
// persisted language arrives. The removed `i18n.language !== locale` guard read
// the still-active init default and skipped the correction, so the stale
// in-flight switch finished and won. This spec pins the fix's cause: the effect
// must always issue the corrective switch, even when i18n.language already reads
// the target (the exact state the guard mishandled). The full persisted-wins
// behavior over a real in-flight switch is covered by the restart e2e, which
// reproduces the timing window a unit test cannot deterministically hit.

const initialAppState = useAppStore.getInitialState()

function setPersistedUiLanguage(uiLanguage: string): void {
  useAppStore.setState({ settings: { uiLanguage } as AppState['settings'] })
}

describe('I18nProvider persisted-language boot race', () => {
  beforeEach(async () => {
    useAppStore.setState(initialAppState, true)
    await i18n.changeLanguage(UI_LANGUAGE_ENGLISH)
  })

  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    await i18n.changeLanguage(UI_LANGUAGE_ENGLISH)
  })

  it('issues the corrective changeLanguage even when i18n.language already reads the target', async () => {
    // Reproduces the exact skip: the persisted locale is 'en' and i18n.language
    // also reads 'en' (the in-flight system switch has not landed). The old
    // guard saw en === en and never drove i18next to the persisted language.
    setPersistedUiLanguage(UI_LANGUAGE_ENGLISH)
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')

    await act(async () => {
      render(
        <I18nProvider>
          <div />
        </I18nProvider>
      )
    })

    expect(changeLanguageSpy).toHaveBeenCalledWith(UI_LANGUAGE_ENGLISH)
  })
})
