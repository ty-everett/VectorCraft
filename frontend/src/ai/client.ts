import type { AiStatus, GeneratedMaterial, Material } from '../types'
import { fallbackMaterial } from '../lib/crafting'
import { reportError, signal } from '../lib/telemetry'

interface CraftResult {
  material: GeneratedMaterial
  fallback: boolean
  runtime: {
    device: 'webgpu' | 'wasm' | null
    profile: AiStatus['profile']
    modelLabel: string | null
    modelSize: string | null
  }
}

type StatusListener = (status: AiStatus) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timeout: number
  operation: string
}

const DEFAULT_STATUS: AiStatus = {
  phase: 'idle',
  task: null,
  label: 'On-device models are asleep',
  progress: null,
  device: null,
  profile: null,
  modelLabel: null,
  modelSize: null,
}

const REQUEST_TIMEOUT_MS = 180_000

export class LocalAiClient {
  private worker: Worker | null = null
  private pending = new Map<string, PendingRequest>()
  private listeners = new Set<StatusListener>()
  private status: AiStatus = DEFAULT_STATUS

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  private emit(next: Partial<AiStatus>): void {
    this.status = { ...this.status, ...next }
    this.listeners.forEach((listener) => listener(this.status))
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      const message = event.data
      if (message.type === 'diagnostic') {
        reportError(new Error(typeof message.message === 'string' ? message.message : 'Local AI worker failure'), 'worker', {
          operation: message.operation,
          workerErrorName: message.name,
          workerStack: message.stack,
          device: message.device,
          profile: message.profile,
          modelLabel: message.generatorLabel,
          modelSize: message.generatorSize,
        })
        return
      }
      if (message.type === 'progress') {
        this.refreshTimeouts()
        const task = message.task === 'embeddings' ? 'embeddings' : 'generator'
        const file = typeof message.file === 'string' ? message.file : 'model weights'
        this.emit({
          phase: 'loading',
          task,
          label: `Caching ${file} locally`,
          progress: typeof message.progress === 'number' ? message.progress : null,
          device: message.device === 'webgpu' ? 'webgpu' : 'wasm',
          profile: message.profile === 'desktop-webgpu' ? 'desktop-webgpu' : 'portable-wasm',
          modelLabel: typeof message.generatorLabel === 'string' ? message.generatorLabel : this.status.modelLabel,
          modelSize: typeof message.generatorSize === 'string' ? message.generatorSize : this.status.modelSize,
        })
        return
      }
      if (message.type === 'status') {
        this.refreshTimeouts()
        const task = message.task === 'embeddings' ? 'embeddings' : 'generator'
        const phase = message.phase as AiStatus['phase']
        const labels: Record<AiStatus['phase'], string> = {
          idle: 'On-device models are asleep',
          loading: task === 'generator' ? 'Loading the local crafting model' : 'Loading semantic search',
          ready: task === 'generator' ? 'Local crafting model ready' : 'Semantic search ready',
          working: 'Crafting entirely on this device',
          error: 'Local model unavailable — safe fallback active',
        }
        this.emit({
          phase,
          task,
          label: labels[phase],
          progress: phase === 'loading' ? this.status.progress : null,
          device: message.device === 'webgpu' ? 'webgpu' : 'wasm',
          profile: message.profile === 'desktop-webgpu' ? 'desktop-webgpu' : 'portable-wasm',
          modelLabel: typeof message.generatorLabel === 'string' ? message.generatorLabel : this.status.modelLabel,
          modelSize: typeof message.generatorSize === 'string' ? message.generatorSize : this.status.modelSize,
        })
        return
      }
      const id = typeof message.id === 'string' ? message.id : ''
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      window.clearTimeout(pending.timeout)
      if (message.type === 'error') pending.reject(new Error(String(message.message)))
      else pending.resolve(message.result)
    }
    this.worker.onerror = (event) => {
      this.emit({ phase: 'error', label: 'Local model worker failed — safe fallback active' })
      reportError(new Error(event.message), 'worker', { filename: event.filename?.split('/').at(-1), line: event.lineno, column: event.colno })
      this.pending.forEach(({ reject }) => reject(new Error(event.message)))
      this.pending.clear()
      this.worker?.terminate()
      this.worker = null
    }
    return this.worker
  }

  private refreshTimeouts(): void {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timeout)
      pending.timeout = window.setTimeout(() => this.timeoutRequest(id), REQUEST_TIMEOUT_MS)
    }
  }

  private timeoutRequest(id: string): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    this.worker?.terminate()
    this.worker = null
    const error = new Error(`Local AI ${pending.operation} timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds without progress`)
    this.emit({ phase: 'error', label: 'Local model timed out — safe fallback active' })
    reportError(error, 'local-ai', { operation: pending.operation, ...this.status })
    pending.reject(error)
  }

  private request<T>(payload: Record<string, unknown>): Promise<T> {
    const id = globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const worker = this.ensureWorker()
    return new Promise<T>((resolve, reject) => {
      const operation = typeof payload.type === 'string' ? payload.type : 'request'
      const timeout = window.setTimeout(() => this.timeoutRequest(id), REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout, operation })
      worker.postMessage({ ...payload, id })
    })
  }

  async initialize(): Promise<{ device: 'webgpu' | 'wasm' }> {
    const result = await this.request<{ device: 'webgpu' | 'wasm' }>({ type: 'init' })
    signal('ai.model_ready', 'model-lab', { ...this.status })
    return result
  }

  async craft(first: Material, second: Material): Promise<CraftResult> {
    try {
      return await this.request({ type: 'craft', first, second })
    } catch (error) {
      reportError(error, 'local-ai', { operation: 'craft', ...this.status })
      return {
        material: fallbackMaterial(first, second),
        fallback: true,
        runtime: {
          device: this.status.device,
          profile: this.status.profile,
          modelLabel: this.status.modelLabel,
          modelSize: this.status.modelSize,
        },
      }
    }
  }

  search(query: string, materials: Material[]): Promise<string[]> {
    return this.request({ type: 'search', query, materials })
  }
}

export const localAi = new LocalAiClient()
