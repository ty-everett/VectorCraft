import type { AiStatus, GeneratedMaterial, Material } from '../types'

interface CraftResult {
  material: GeneratedMaterial
  fallback: boolean
}

type StatusListener = (status: AiStatus) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

const DEFAULT_STATUS: AiStatus = {
  phase: 'idle',
  task: null,
  label: 'On-device models are asleep',
  progress: null,
  device: null,
}

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
      if (message.type === 'progress') {
        const task = message.task === 'embeddings' ? 'embeddings' : 'generator'
        const file = typeof message.file === 'string' ? message.file : 'model weights'
        this.emit({
          phase: 'loading',
          task,
          label: `Caching ${file} locally`,
          progress: typeof message.progress === 'number' ? message.progress : null,
          device: message.device === 'webgpu' ? 'webgpu' : 'wasm',
        })
        return
      }
      if (message.type === 'status') {
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
        })
        return
      }
      const id = typeof message.id === 'string' ? message.id : ''
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      if (message.type === 'error') pending.reject(new Error(String(message.message)))
      else pending.resolve(message.result)
    }
    this.worker.onerror = (event) => {
      this.emit({ phase: 'error', label: 'Local model worker failed — safe fallback active' })
      this.pending.forEach(({ reject }) => reject(new Error(event.message)))
      this.pending.clear()
    }
    return this.worker
  }

  private request<T>(payload: Record<string, unknown>): Promise<T> {
    const id = crypto.randomUUID()
    const worker = this.ensureWorker()
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      worker.postMessage({ ...payload, id })
    })
  }

  initialize(): Promise<{ device: 'webgpu' | 'wasm' }> {
    return this.request({ type: 'init' })
  }

  craft(first: Material, second: Material): Promise<CraftResult> {
    return this.request({ type: 'craft', first, second })
  }

  search(query: string, materials: Material[]): Promise<string[]> {
    return this.request({ type: 'search', query, materials })
  }
}

export const localAi = new LocalAiClient()
