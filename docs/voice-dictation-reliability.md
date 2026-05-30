# Voice Dictation Reliability

## Problem

- `SttService.stopDictation()` posts `stop` and waits only for a worker `stopped` message. Worker-thread `error`/`exit` and stop timeout are terminal outcomes too; today they clear state through other paths or terminate the worker while the stop waiter depends on the full timeout and the renderer's stopped-session fallback.
- The stop timeout path removes worker listeners and terminates without emitting a lifecycle `stopped` event. Desktop dictation eventually recovers through `waitForStoppedSession()`'s 1s fallback, but the UI lifecycle should not depend on that grace timer.
- Warm-worker reuse happens before `getModelState()`. If a model is deleted while its worker is idle, a later dictation can reuse the stale recognizer even though Settings reports the model unavailable.
- `DictationController` stops a hold-to-talk session on any `keyup` after the shortcut starts. Releasing an unrelated key while still holding the dictation chord can end recording early.
- `stt-worker.ts` builds model, token, and vocab paths with string `/` joins. These are local model paths and should use Node path utilities on every platform.

## Root Cause

- Stop lifecycle handling has no single terminal-settle path for `stopped`, worker `error`, worker `exit`, and timeout.
- Warm-worker validity is treated as stronger than the model manager's current state.
- Hold-to-talk tracks a boolean gesture, not the key and modifiers that started it.
- Worker path assembly predates the cross-platform rule used elsewhere in the speech stack.

## Non-goals

- Do not change the speech model catalog, model download flow, or STT engine choice.
- Do not redesign the dictation indicator.
- Do not change mobile dictation protocol semantics.
- Do not add Electron UI validation; this run explicitly skips that yolo-lite stage.
- Do not add model-file fingerprinting or same-ID replacement detection. This fix only rejects warm reuse when the model manager no longer reports the model as `ready`.

## Design

1. In `SttService`, add per-worker stop-in-flight handling tied to the captured worker and owner so concurrent stop calls for the same owner join the same promise and do not post duplicate `stop` messages. Owner mismatch checks still apply before joining.
2. Make that stop promise resolve on exactly one terminal outcome: worker `stopped` message, worker `error`, worker `exit`, or `STOP_DICTATION_TIMEOUT_MS`. Stop-time worker failure is reported through the existing `error` lifecycle event, not by rejecting stop callers.
3. For `stopped`, keep the worker warm: clear only `activeOwner` and `eventSink`, retain `activeModelId` and `activeHotwordsFilePath`, and schedule idle teardown.
4. For worker `error`, worker `exit`, or timeout during stop, treat the worker as unreusable: remove stop listeners, terminate if it has not already exited, clear `worker`, `activeOwner`, `activeModelId`, `activeHotwordsFilePath`, and `eventSink` only if the captured worker is still current. Timeout settlement must not wait longer than `STOP_DICTATION_TIMEOUT_MS` for `worker.terminate()` to finish.
5. When stop completes without a worker `stopped` message, emit one synthetic `stopped` lifecycle event through the captured sink before clearing it. Do not emit a duplicate when the worker already sent `stopped`.
6. Recheck `getModelState(modelId)` before warm-worker reuse. If the model is no longer `ready`, tear down the idle worker and fail start with the existing not-ready error instead of reusing stale recognizer state.
7. Add focused `SttService` tests for stop-time worker `exit`, stop-time worker `error`, concurrent stop callers sharing one stop message/promise, synthetic `stopped` on forced teardown, timeout cleanup, and stale warm-worker invalidation after model state changes.
8. Add `dictation-hold-release.ts` in the dictation component folder. Capture the starting `KeyboardEvent` after `keybindingMatchesAction()` succeeds: primary key/code plus the modifier booleans that were down at start.
9. Use that helper from `DictationController`. Stop hold-to-talk only when the primary key is released or one of the captured required modifiers is released; ignore unrelated key releases. Blur, visibility loss, and hold-mode effect cleanup still cancel the session.
10. Add pure helper tests for primary-key release, required modifier release, unrelated key release, extra modifier/key interactions, and repeat keydown preserving the original gesture.
11. Replace worker model/token/vocab path string concatenation with `path.join`.

## Edge Cases

- Worker `error` can race with a user stop and the IPC error handler's follow-up stop. The stop-in-flight promise must make both callers settle from the same terminal outcome.
- A stale terminal event from an old worker must not clear a newly started worker; every cleanup path must compare against the captured worker.
- Stale stop bookkeeping from an old worker must not make a later worker look stopped or stop-in-flight; clear stop-in-flight state only if it still belongs to the captured worker/promise.
- Stop during startup before a worker exists should keep the existing cancellation tombstone behavior.
- A model deleted while dictation is active may finish the active session, but idle warm reuse after deletion must be rejected.
- Hold-to-talk must stop if the user releases the non-modifier key first or releases any modifier captured at start.
- Hold-to-talk must ignore unrelated key releases while the starting chord is still held.
- If keybindings or voice settings change while hold-to-talk is active, the existing effect cleanup should cancel rather than leave a dangling recording.
- Paths must remain valid for packaged and dev builds on macOS, Linux, and Windows.

## Rollout

1. Update `SttService.stopDictation()` stop settling, synthetic lifecycle event, concurrency handling, and warm-worker model-state validation.
2. Add the focused main-process service tests.
3. Add the hold-release helper and tests.
4. Wire the helper into `DictationController`.
5. Replace worker path string concatenation with `path.join`.
6. Run focused tests plus typecheck/lint where practical; skip Electron validation per request.
