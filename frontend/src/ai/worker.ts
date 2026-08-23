/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers'
import { fallbackMaterial, parseGeneratedMaterial } from '../lib/crafting'
import type { GeneratedMaterial, Material } from '../types'
import { selectRuntimeProfile } from './runtime'

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

env.allowLocalModels = false
env.useBrowserCache = true

type CallablePipeline = (input: unknown, options?: Record<string, unknown>) => Promise<unknown>

interface InitMessage {
  id: string
  type: 'init'
}

interface CraftMessage {
  id: string
  type: 'craft'
  first: Material
  second: Material
}

interface SearchMessage {
  id: string
  type: 'search'
  query: string
  materials: Material[]
}

type WorkerRequest = InitMessage | CraftMessage | SearchMessage

const runtime = selectRuntimeProfile(navigator.userAgent, 'gpu' in navigator, self.isSecureContext)
const device = runtime.device
if (runtime.singleThreadedWasm && env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1
let generatorPromise: Promise<CallablePipeline> | null = null
let embedderPromise: Promise<CallablePipeline> | null = null
const vectorCache = new Map<string, number[]>()

function post(message: unknown): void {
  self.postMessage(message)
}

function progress(task: 'generator' | 'embeddings') {
  return (event: Record<string, unknown>): void => {
    const value = typeof event.progress === 'number' ? Math.max(0, Math.min(100, event.progress)) : null
    const file = typeof event.file === 'string' ? event.file.split('/').at(-1) : null
    post({ type: 'progress', task, progress: value, file, ...runtime })
  }
}

async function getGenerator(): Promise<CallablePipeline> {
  if (!generatorPromise) {
    post({ type: 'status', task: 'generator', phase: 'loading', ...runtime })
    generatorPromise = pipeline('text-generation', runtime.generatorModel, {
      device: device === 'webgpu' ? 'webgpu' : undefined,
      dtype: runtime.generatorDtype,
      progress_callback: progress('generator'),
    }) as unknown as Promise<CallablePipeline>
  }
  const generator = await generatorPromise
  post({ type: 'status', task: 'generator', phase: 'ready', ...runtime })
  return generator
}

async function getEmbedder(): Promise<CallablePipeline> {
  if (!embedderPromise) {
    post({ type: 'status', task: 'embeddings', phase: 'loading', ...runtime })
    embedderPromise = pipeline('feature-extraction', EMBEDDING_MODEL, {
      device: device === 'webgpu' ? 'webgpu' : undefined,
      dtype: 'q8',
      progress_callback: progress('embeddings'),
    }) as unknown as Promise<CallablePipeline>
  }
  const embedder = await embedderPromise
  post({ type: 'status', task: 'embeddings', phase: 'ready', ...runtime })
  return embedder
}

function generatedText(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output
  if (!first || typeof first !== 'object') return ''
  const value = (first as Record<string, unknown>).generated_text
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const last = value.at(-1)
    if (last && typeof last === 'object' && typeof (last as Record<string, unknown>).content === 'string') {
      return (last as Record<string, string>).content
    }
  }
  return ''
}

async function craft(first: Material, second: Material): Promise<{ material: GeneratedMaterial; fallback: boolean }> {
  const generator = await getGenerator()
  post({ type: 'status', task: 'generator', phase: 'working', ...runtime })
  const messages = [
    {
      role: 'system',
      content: 'You are VectorCraft. Return exactly one valid JSON object with name, emoji, and description. Never write commentary or markdown.',
    },
    {
      role: 'user',
      content: `Invent one recognizable, satisfying game discovery from two inputs. Follow these examples exactly.

INPUT: Fire + Water
OUTPUT: {"name":"Steam","emoji":"♨️","description":"Water transformed into rising vapor."}

INPUT: Earth + Air
OUTPUT: {"name":"Dust","emoji":"🌫️","description":"Earth made light enough to travel."}

INPUT: DNA + Earth
OUTPUT: {"name":"Life","emoji":"🌱","description":"A living pattern rooted in matter."}

INPUT: ${first.name} (${first.description}) + ${second.name} (${second.description})
OUTPUT:`,
    },
  ]
  const output = await generator(messages, {
    max_new_tokens: 88,
    min_new_tokens: 12,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.08,
    return_full_text: false,
  })
  const raw = generatedText(output)
  const parsed = parseGeneratedMaterial(raw)
  post({ type: 'status', task: 'generator', phase: 'ready', ...runtime })
  return parsed
    ? { material: parsed, fallback: false }
    : { material: fallbackMaterial(first, second), fallback: true }
}

function asRows(output: unknown): number[][] {
  if (output && typeof output === 'object' && 'tolist' in output) {
    const rows = (output as { tolist: () => unknown }).tolist()
    if (Array.isArray(rows)) return rows as number[][]
  }
  return []
}

function dot(first: number[], second: number[]): number {
  return first.reduce((total, value, index) => total + value * (second[index] ?? 0), 0)
}

async function search(query: string, materials: Material[]): Promise<string[]> {
  const embedder = await getEmbedder()
  const missing = materials.filter((material) => !vectorCache.has(material.id))
  if (missing.length > 0) {
    const output = await embedder(
      missing.map((material) => `${material.name}. ${material.description}`),
      { pooling: 'mean', normalize: true },
    )
    const rows = asRows(output)
    missing.forEach((material, index) => vectorCache.set(material.id, rows[index] ?? []))
  }
  const queryOutput = await embedder(query, { pooling: 'mean', normalize: true })
  const queryVector = asRows(queryOutput)[0] ?? []
  return materials
    .map((material) => ({ id: material.id, score: dot(queryVector, vectorCache.get(material.id) ?? []) }))
    .filter((entry) => entry.score > 0.16)
    .sort((first, second) => second.score - first.score)
    .slice(0, 40)
    .map((entry) => entry.id)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
  const request = event.data
  try {
    if (request.type === 'init') {
      await getGenerator()
      post({ type: 'result', id: request.id, result: runtime })
      return
    }
    if (request.type === 'craft') {
      post({ type: 'result', id: request.id, result: await craft(request.first, request.second) })
      return
    }
    post({ type: 'result', id: request.id, result: await search(request.query, request.materials) })
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    console.error('[VectorCraft local AI worker]', normalized)
    post({
      type: 'diagnostic',
      origin: 'worker',
      operation: request.type,
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      ...runtime,
    })
    if (request.type === 'craft') {
      post({
        type: 'result',
        id: request.id,
        result: { material: fallbackMaterial(request.first, request.second), fallback: true },
      })
    } else {
      post({ type: 'error', id: request.id, message: normalized.message })
    }
    post({ type: 'status', task: request.type === 'search' ? 'embeddings' : 'generator', phase: 'error', ...runtime })
  }
}
