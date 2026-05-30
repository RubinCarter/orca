export type DictationHoldKeyboardEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
>

export type DictationHoldGesture = {
  primaryKey: string
  primaryCode: string
  requiredModifiers: {
    alt: boolean
    control: boolean
    meta: boolean
    shift: boolean
  }
}

function normalizePrimaryKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key
}

export function captureDictationHoldGesture(
  event: DictationHoldKeyboardEvent,
  currentGesture: DictationHoldGesture | null = null
): DictationHoldGesture {
  if (currentGesture) {
    return currentGesture
  }
  return {
    primaryKey: normalizePrimaryKey(event.key),
    primaryCode: event.code,
    requiredModifiers: {
      alt: event.altKey,
      control: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey
    }
  }
}

function primaryKeyWasReleased(
  gesture: DictationHoldGesture,
  event: DictationHoldKeyboardEvent
): boolean {
  if (gesture.primaryCode && event.code) {
    return gesture.primaryCode === event.code
  }
  return gesture.primaryKey === normalizePrimaryKey(event.key)
}

function requiredModifierWasReleased(
  gesture: DictationHoldGesture,
  event: DictationHoldKeyboardEvent
): boolean {
  const required = gesture.requiredModifiers
  return (
    (required.alt && !event.altKey) ||
    (required.control && !event.ctrlKey) ||
    (required.meta && !event.metaKey) ||
    (required.shift && !event.shiftKey)
  )
}

export function shouldStopDictationHold(
  gesture: DictationHoldGesture,
  event: DictationHoldKeyboardEvent
): boolean {
  return primaryKeyWasReleased(gesture, event) || requiredModifierWasReleased(gesture, event)
}
