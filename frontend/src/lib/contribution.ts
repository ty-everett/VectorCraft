import type { RecipeContribution, SignedRecipePacket } from '../types'
import { signRecipe } from './identity'

const ENDPOINT = 'https://usercom.babbage.systems/signals'
const QUEUE_KEY = 'vectorcraft:recipe-contribution-queue:v1'
const ANONYMOUS_KEY = 'vectorcraft:anonymous-id:v1'
const RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA || 'local-dev'

function anonymousId(): string {
  const existing = localStorage.getItem(ANONYMOUS_KEY)
  if (existing) return existing
  const entropy = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('')
  const next = `anon-${entropy}`
  localStorage.setItem(ANONYMOUS_KEY, next)
  return next
}

function readQueue(): SignedRecipePacket[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as unknown
    return Array.isArray(parsed) ? parsed.slice(-200) as SignedRecipePacket[] : []
  } catch {
    return []
  }
}

function writeQueue(queue: SignedRecipePacket[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)))
}

async function deliver(packets: SignedRecipePacket[]): Promise<void> {
  if (packets.length === 0) return
  const events = packets.map((packet) => ({
    source: 'vectorcraft',
    name: 'recipe.contributed',
    surface: 'corpus',
    path: window.location.pathname,
    url: `${window.location.origin}${window.location.pathname}`,
    anonymousId: anonymousId(),
    tags: ['intent:corpus-contribution', `outcome:${packet.payload.outcome}`, `source:${packet.payload.source}`],
    context: {
      release: RELEASE_SHA,
      contributionLicense: 'CC0-1.0',
      packet,
    },
  }))
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  })
  if (!response.ok) throw new Error(`Corpus contribution returned ${response.status}`)
}

let flushPromise: Promise<void> | null = null

async function drainRecipeContributions(): Promise<void> {
  while (true) {
    const batch = readQueue().slice(0, 25)
    if (batch.length === 0) return
    try {
      await deliver(batch)
      const delivered = new Set(batch.map((packet) => packet.signature))
      writeQueue(readQueue().filter((packet) => !delivered.has(packet.signature)))
    } catch {
      // Contributions are durable and retry when connectivity returns.
      return
    }
  }
}

export function flushRecipeContributions(): Promise<void> {
  if (flushPromise) return flushPromise
  flushPromise = drainRecipeContributions().finally(() => { flushPromise = null })
  return flushPromise
}

export async function contributeRecipe(payload: RecipeContribution): Promise<{ packet: SignedRecipePacket; delivered: boolean } | null> {
  try {
    const packet = await signRecipe(payload)
    const queue = [...readQueue(), packet]
    writeQueue(queue)
    await flushRecipeContributions()
    return { packet, delivered: !readQueue().some((queued) => queued.signature === packet.signature) }
  } catch {
    return null
  }
}

export function installContributionRetry(): () => void {
  const retry = () => void flushRecipeContributions()
  window.addEventListener('online', retry)
  void flushRecipeContributions()
  return () => window.removeEventListener('online', retry)
}
