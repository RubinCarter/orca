import { describe, expect, it } from 'vitest'
import {
  captureDictationHoldGesture,
  shouldStopDictationHold,
  type DictationHoldKeyboardEvent
} from './dictation-hold-release'

function keyEvent(
  input: Partial<DictationHoldKeyboardEvent> & { key: string; code: string }
): DictationHoldKeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...input
  }
}

describe('dictation hold release', () => {
  it('stops when the primary non-modifier key is released', () => {
    const gesture = captureDictationHoldGesture(keyEvent({ key: 'e', code: 'KeyE', metaKey: true }))

    expect(
      shouldStopDictationHold(gesture, keyEvent({ key: 'e', code: 'KeyE', metaKey: true }))
    ).toBe(true)
  })

  it('stops when a required modifier is released', () => {
    const gesture = captureDictationHoldGesture(
      keyEvent({ key: 'E', code: 'KeyE', ctrlKey: true, shiftKey: true })
    )

    expect(
      shouldStopDictationHold(gesture, keyEvent({ key: 'Shift', code: 'ShiftLeft', ctrlKey: true }))
    ).toBe(true)
  })

  it('ignores unrelated key releases while the starting chord is held', () => {
    const gesture = captureDictationHoldGesture(keyEvent({ key: 'e', code: 'KeyE', ctrlKey: true }))

    expect(
      shouldStopDictationHold(gesture, keyEvent({ key: 'a', code: 'KeyA', ctrlKey: true }))
    ).toBe(false)
  })

  it('ignores release of extra modifiers that were not part of the starting chord', () => {
    const gesture = captureDictationHoldGesture(keyEvent({ key: 'e', code: 'KeyE', ctrlKey: true }))

    expect(
      shouldStopDictationHold(gesture, keyEvent({ key: 'Shift', code: 'ShiftLeft', ctrlKey: true }))
    ).toBe(false)
    expect(
      shouldStopDictationHold(
        gesture,
        keyEvent({ key: 'e', code: 'KeyE', ctrlKey: true, shiftKey: true })
      )
    ).toBe(true)
  })

  it('preserves the original gesture across repeat keydowns', () => {
    const gesture = captureDictationHoldGesture(keyEvent({ key: 'e', code: 'KeyE', ctrlKey: true }))
    const repeatedGesture = captureDictationHoldGesture(
      keyEvent({ key: 'E', code: 'KeyE', ctrlKey: true, shiftKey: true }),
      gesture
    )

    expect(repeatedGesture).toBe(gesture)
    expect(repeatedGesture.requiredModifiers.shift).toBe(false)
  })
})
