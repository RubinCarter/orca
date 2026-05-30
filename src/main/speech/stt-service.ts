/* eslint-disable max-lines -- Why: speech worker ownership, warm reuse, and
timeout teardown must stay co-located so dictation lifecycle state cannot drift. */
import { Worker } from 'worker_threads'
import { join } from 'path'
import { app } from 'electron'
import { getCatalogModel } from './model-catalog'
import type { ModelManager } from './model-manager'

export const START_DICTATION_TIMEOUT_MS = 60_000
const STOP_DICTATION_TIMEOUT_MS = 60_000
export const IDLE_WORKER_TEARDOWN_MS = 60 * 60 * 1000

export type SttEvent =
  | { type: 'ready' }
  | { type: 'partial'; text?: string }
  | { type: 'final'; text?: string }
  | { type: 'stopped' }
  | { type: 'error'; error?: string }

export type SttEventSink = (event: SttEvent) => void

type StopInFlight = {
  worker: Worker
  owner: string
  promise: Promise<void>
}

type StopOutcome = 'stopped' | 'error' | 'exit' | 'timeout'

export class SttService {
  private worker: Worker | null = null
  private modelManager: ModelManager
  private activeModelId: string | null = null
  private activeHotwordsFilePath: string | undefined
  private activeOwner: string | null = null
  private startingOwner: string | null = null
  private starting = false
  private canceledOwners = new Set<string>()
  private eventSink: SttEventSink | null = null
  private idleTeardownTimer: NodeJS.Timeout | null = null
  private stopInFlight: StopInFlight | null = null

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager
  }

  async startDictation(
    modelId: string,
    sink: SttEventSink,
    hotwordsFilePath?: string,
    owner = 'desktop'
  ): Promise<void> {
    if (this.starting) {
      if (this.startingOwner !== owner) {
        throw new Error('dictation_already_active')
      }
      return
    }
    if (this.worker && this.activeOwner && this.activeOwner !== owner) {
      throw new Error('dictation_already_active')
    }
    this.starting = true
    this.startingOwner = owner
    this.clearIdleTeardownTimer()

    try {
      await this._startDictation(modelId, sink, hotwordsFilePath, owner)
      if (this.canceledOwners.delete(owner)) {
        await this.stopDictation(owner, { cancelStarting: false })
        throw new Error('dictation_canceled')
      }
      this.activeOwner = owner
    } finally {
      this.starting = false
      this.startingOwner = null
      this.canceledOwners.delete(owner)
    }
  }

  private async _startDictation(
    modelId: string,
    sink: SttEventSink,
    hotwordsFilePath?: string,
    owner = 'desktop'
  ): Promise<void> {
    const reusableWorker = this.worker
    if (
      reusableWorker &&
      this.activeModelId === modelId &&
      this.activeHotwordsFilePath === hotwordsFilePath &&
      this.stopInFlight?.worker !== reusableWorker
    ) {
      const worker = reusableWorker
      if (!this.activeOwner) {
        const modelState = await this.modelManager.getModelState(modelId)
        if (modelState.status !== 'ready') {
          await this.teardownWorker(worker)
          throw new Error(`Model not ready: ${modelState.status}`)
        }
      }
      if (
        this.worker === worker &&
        this.activeModelId === modelId &&
        this.activeHotwordsFilePath === hotwordsFilePath
      ) {
        this.eventSink = sink
        sink({ type: 'ready' })
        return
      }
    }

    if (this.worker) {
      const existingWorker = this.worker
      await this.stopDictation(owner, { cancelStarting: false })
      await this.teardownWorker(existingWorker)
    }

    const manifest = getCatalogModel(modelId)
    if (!manifest) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    const modelState = await this.modelManager.getModelState(modelId)
    if (modelState.status !== 'ready') {
      throw new Error(`Model not ready: ${modelState.status}`)
    }

    const workerPath = this.getWorkerPath()
    const sherpaModulePath = this.getSherpaModulePath()

    this.worker = new Worker(workerPath, {
      workerData: { sherpaModulePath }
    })
    const worker = this.worker

    this.activeModelId = modelId
    this.activeHotwordsFilePath = hotwordsFilePath
    this.eventSink = sink

    const readyPromise = new Promise<void>((resolve, reject) => {
      let settled = false
      let startupTimeout: ReturnType<typeof setTimeout> | null = null
      const cleanup = () => {
        if (startupTimeout) {
          clearTimeout(startupTimeout)
          startupTimeout = null
        }
        worker.off('message', onReadyOrError)
        worker.off('error', onStartupError)
        worker.off('exit', onStartupExit)
      }
      const failStartup = (error: Error): void => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        reject(error)
      }
      const onReadyOrError = (msg: { type: string; text?: string; error?: string }) => {
        if (settled) {
          return
        }
        if (msg.type === 'ready') {
          settled = true
          cleanup()
          resolve()
        } else if (msg.type === 'error') {
          failStartup(new Error(msg.error ?? 'Speech worker failed to initialize'))
        }
      }
      const onStartupError = (err: Error) => {
        failStartup(err)
      }
      const onStartupExit = (code: number) => {
        failStartup(new Error(`Speech worker exited before ready: ${code}`))
      }
      worker.on('message', onReadyOrError)
      worker.on('error', onStartupError)
      worker.on('exit', onStartupExit)
      // Why: a native STT worker can wedge while loading model bindings without
      // emitting ready/error/exit; startup must leave the UI's Starting state.
      startupTimeout = setTimeout(() => {
        failStartup(new Error('Speech worker timed out while starting.'))
      }, START_DICTATION_TIMEOUT_MS)
      startupTimeout.unref?.()
    })

    worker.on('message', (msg: SttEvent) => {
      if (this.worker === worker) {
        this.eventSink?.(msg)
      }
    })

    worker.on('error', (err) => {
      if (this.worker === worker) {
        this.eventSink?.({ type: 'error', error: String(err) })
        this.worker = null
        this.activeModelId = null
        this.activeHotwordsFilePath = undefined
        this.activeOwner = null
        this.eventSink = null
      }
    })

    worker.on('exit', () => {
      if (this.worker === worker) {
        this.worker = null
        this.activeModelId = null
        this.activeHotwordsFilePath = undefined
        this.activeOwner = null
        this.eventSink = null
      }
    })

    const modelDir = this.modelManager.getModelDir(modelId)
    worker.postMessage({
      type: 'init',
      modelDir,
      modelType: manifest.type,
      streaming: manifest.streaming,
      sampleRate: manifest.sampleRate,
      files: manifest.files,
      hotwordsFilePath,
      modelingUnit: manifest.modelingUnit
    })

    try {
      await readyPromise
    } catch (error) {
      worker.removeAllListeners()
      void worker.terminate()
      if (this.worker === worker) {
        this.worker = null
        this.activeModelId = null
        this.activeHotwordsFilePath = undefined
        this.activeOwner = null
        this.eventSink = null
      }
      throw error
    }
  }

  feedAudio(samples: Float32Array, sampleRate: number, owner = 'desktop'): void {
    const currentOwner = this.activeOwner ?? this.startingOwner
    if (!currentOwner) {
      return
    }
    if (currentOwner !== owner) {
      throw new Error('dictation_owner_mismatch')
    }
    this.worker?.postMessage({ type: 'feed', samples, sampleRate }, [samples.buffer as ArrayBuffer])
  }

  async stopDictation(
    owner = 'desktop',
    options: { cancelStarting?: boolean } = { cancelStarting: true }
  ): Promise<void> {
    if (options.cancelStarting !== false && this.startingOwner === owner) {
      this.canceledOwners.add(owner)
    }
    if (!this.worker) {
      return
    }
    const currentOwner = this.activeOwner ?? this.startingOwner
    if (currentOwner && currentOwner !== owner) {
      throw new Error('dictation_owner_mismatch')
    }

    const worker = this.worker
    if (this.stopInFlight?.worker === worker) {
      if (this.stopInFlight.owner !== owner) {
        throw new Error('dictation_owner_mismatch')
      }
      return this.stopInFlight.promise
    }

    const capturedSink = this.eventSink
    let stopPromise!: Promise<void>
    stopPromise = this.createStopPromise(worker, capturedSink).finally(() => {
      if (this.stopInFlight?.worker === worker && this.stopInFlight.promise === stopPromise) {
        this.stopInFlight = null
      }
    })
    this.stopInFlight = { worker, owner, promise: stopPromise }
    worker.postMessage({ type: 'stop' })
    await stopPromise
  }

  private createStopPromise(worker: Worker, capturedSink: SttEventSink | null): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false
      let receivedStopped = false
      let timeout: ReturnType<typeof setTimeout> | null = null

      const cleanup = (): void => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        worker.off('message', onStopped)
        worker.off('error', onError)
        worker.off('exit', onExit)
      }

      const finish = (outcome: StopOutcome): void => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        if (outcome === 'stopped') {
          if (this.worker === worker) {
            this.activeOwner = null
            this.eventSink = null
            this.scheduleIdleTeardown()
          }
          resolve()
          return
        }

        if (!receivedStopped) {
          capturedSink?.({ type: 'stopped' })
        }
        worker.removeAllListeners()
        if (outcome !== 'exit') {
          void worker.terminate().catch(() => undefined)
        }
        if (this.worker === worker) {
          this.worker = null
          this.activeModelId = null
          this.activeHotwordsFilePath = undefined
          this.activeOwner = null
          this.eventSink = null
        }
        resolve()
      }

      const onStopped = (msg: { type: string; text?: string; error?: string }) => {
        if (msg.type === 'stopped') {
          receivedStopped = true
          finish('stopped')
        }
      }

      const onError = (): void => {
        finish('error')
      }

      const onExit = (): void => {
        finish('exit')
      }

      timeout = setTimeout(() => {
        finish('timeout')
      }, STOP_DICTATION_TIMEOUT_MS)
      timeout.unref?.()

      worker.on('message', onStopped)
      worker.on('error', onError)
      worker.on('exit', onExit)
    })
  }

  isActive(): boolean {
    return this.worker !== null
  }

  getActiveModelId(): string | null {
    return this.activeModelId
  }

  private getWorkerPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'app.asar', 'out', 'main', 'stt-worker.js')
    }
    return join(__dirname, 'stt-worker.js')
  }

  private clearIdleTeardownTimer(): void {
    if (this.idleTeardownTimer) {
      clearTimeout(this.idleTeardownTimer)
      this.idleTeardownTimer = null
    }
  }

  private scheduleIdleTeardown(): void {
    this.clearIdleTeardownTimer()
    // Why: keep the native recognizer warm for repeated dictations, but release
    // the ONNX model after a quiet period so long-running Orca sessions don't
    // pin speech memory forever.
    this.idleTeardownTimer = setTimeout(() => {
      void this.teardownIdleWorker()
    }, IDLE_WORKER_TEARDOWN_MS)
    this.idleTeardownTimer.unref?.()
  }

  private async teardownIdleWorker(): Promise<void> {
    this.clearIdleTeardownTimer()
    if (!this.worker || this.activeOwner || this.startingOwner) {
      return
    }
    const worker = this.worker
    await this.teardownWorker(worker)
  }

  private async teardownWorker(worker: Worker): Promise<void> {
    this.clearIdleTeardownTimer()
    if (this.stopInFlight?.worker === worker) {
      await this.stopInFlight.promise
    }
    try {
      worker.postMessage({ type: 'teardown' })
    } catch {
      // The worker may already have exited on a forced stop path.
    }
    worker.removeAllListeners()
    await worker.terminate().catch(() => undefined)
    if (this.worker === worker) {
      this.worker = null
      this.activeModelId = null
      this.activeHotwordsFilePath = undefined
      this.activeOwner = null
      this.eventSink = null
    }
  }

  private getSherpaModulePath(): string {
    // Why: the main sherpa-onnx npm package uses WASM, which cannot access
    // the host filesystem to load model files. The platform-specific native
    // addon (e.g. sherpa-onnx-darwin-arm64) has direct filesystem access
    // and better performance. We resolve its absolute path here because
    // the worker runs from out/main/ where bare require() can't find it.
    const nativePkg =
      process.platform === 'win32' && process.arch === 'x64'
        ? 'sherpa-onnx-win-x64'
        : `sherpa-onnx-${process.platform}-${process.arch}`

    if (app.isPackaged) {
      return join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', nativePkg)
    }

    const resolved = require.resolve(nativePkg)
    return join(resolved, '..')
  }
}
