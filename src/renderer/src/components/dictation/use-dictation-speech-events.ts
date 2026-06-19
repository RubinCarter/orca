import { useEffect } from 'react'
import { toast } from 'sonner'
import { insertText, type DictationInsertionTarget } from './dictation-insertion-target'
import { formatFinalTranscriptSegment } from './dictation-final-segments'
import { recordStoppedSession, waitForStoppedSession } from './dictation-stopped-sessions'
import { translate } from '@/i18n/i18n'

type MutableRef<T> = { current: T }

type UseDictationSpeechEventsArgs = {
  activeSessionIdRef: MutableRef<string | null>
  insertionTargetRef: MutableRef<DictationInsertionTarget | null>
  finalTranscriptReceivedRef: MutableRef<boolean>
  intentionalTargetCancellationRef: MutableRef<boolean>
  insertedFinalTranscriptRef: MutableRef<string>
  erroredSessionIdsRef: MutableRef<Set<string>>
  stoppedSessionIdsRef: MutableRef<Set<string>>
  stoppedResolversRef: MutableRef<Map<string, () => void>>
  stopRequestedDuringStartRef: MutableRef<boolean>
  dictationRunRef: MutableRef<number>
  dictationStateRef: MutableRef<string>
  setPartialTranscript: (text: string) => void
  setDictationState: (state: 'idle' | 'starting' | 'listening' | 'stopping' | 'error') => void
  stopCapture: () => void
  discardBufferedAudio: () => void
}

export function useDictationSpeechEvents({
  activeSessionIdRef,
  insertionTargetRef,
  finalTranscriptReceivedRef,
  intentionalTargetCancellationRef,
  insertedFinalTranscriptRef,
  erroredSessionIdsRef,
  stoppedSessionIdsRef,
  stoppedResolversRef,
  stopRequestedDuringStartRef,
  dictationRunRef,
  dictationStateRef,
  setPartialTranscript,
  setDictationState,
  stopCapture,
  discardBufferedAudio
}: UseDictationSpeechEventsArgs): void {
  useEffect(() => {
    const cleanupPartial = window.api.speech.onPartialTranscript((data) => {
      if (data.sessionId !== activeSessionIdRef.current) {
        return
      }
      setPartialTranscript(data.text)
    })

    const cleanupFinal = window.api.speech.onFinalTranscript((data) => {
      if (data.sessionId !== activeSessionIdRef.current || !data.text) {
        return
      }
      setPartialTranscript('')
      finalTranscriptReceivedRef.current = true
      const target = insertionTargetRef.current
      if (target) {
        const textToInsert = formatFinalTranscriptSegment(
          data.text,
          insertedFinalTranscriptRef.current
        )
        insertText(textToInsert, target)
        insertedFinalTranscriptRef.current += textToInsert
      } else if (!intentionalTargetCancellationRef.current) {
        toast.message(
          translate(
            'auto.components.dictation.DictationController.7afff43472',
            'Dictation finished, but no text field was focused.'
          )
        )
      }
    })

    const cleanupStopped = window.api.speech.onStopped((data) => {
      recordStoppedSession(data.sessionId, stoppedSessionIdsRef, stoppedResolversRef)
    })

    const cleanupError = window.api.speech.onError((data) => {
      if (data.sessionId !== activeSessionIdRef.current) {
        return
      }
      const sessionId = data.sessionId
      erroredSessionIdsRef.current.add(sessionId)
      dictationRunRef.current += 1
      activeSessionIdRef.current = null
      toast.error(
        translate(
          'auto.components.dictation.DictationController.de136f1199',
          'Speech error: {{value0}}',
          { value0: data.error }
        )
      )
      dictationStateRef.current = 'stopping'
      setDictationState('stopping')
      stopCapture()
      discardBufferedAudio()
      void (async () => {
        await window.api.speech.stopDictation(sessionId).catch(() => undefined)
        await waitForStoppedSession(sessionId, stoppedSessionIdsRef, stoppedResolversRef)
        insertionTargetRef.current = null
        intentionalTargetCancellationRef.current = false
        stopRequestedDuringStartRef.current = false
        finalTranscriptReceivedRef.current = false
        insertedFinalTranscriptRef.current = ''
        dictationStateRef.current = 'idle'
        setDictationState('idle')
        setPartialTranscript('')
      })()
    })

    return () => {
      cleanupPartial()
      cleanupFinal()
      cleanupStopped()
      cleanupError()
    }
  }, [
    activeSessionIdRef,
    dictationRunRef,
    dictationStateRef,
    discardBufferedAudio,
    erroredSessionIdsRef,
    finalTranscriptReceivedRef,
    insertedFinalTranscriptRef,
    insertionTargetRef,
    intentionalTargetCancellationRef,
    setDictationState,
    setPartialTranscript,
    stopCapture,
    stopRequestedDuringStartRef,
    stoppedResolversRef,
    stoppedSessionIdsRef
  ])
}
