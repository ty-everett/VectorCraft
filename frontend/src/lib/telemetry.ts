const SIGNAL_ENDPOINT = 'https://usercom.babbage.systems/signals'
const FEEDBACK_ENDPOINT = 'https://usercom.babbage.systems/submit'
const SOURCE = 'vectorcraft'
const RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA || 'local-dev'
const ANONYMOUS_KEY = 'vectorcraft:anonymous-id:v1'
const SESSION_KEY = 'vectorcraft:session-id:v1'
const MAX_CONTEXT_DEPTH = 3
const MAX_STRING_LENGTH = 500

type Context = Record<string, unknown>

const secretKey = /(?:secret|token|password|private|signature|authorization|cookie|wallet|beef|transaction|raw|prompt|response|material|email)/i
const sensitiveValue = /(?:bearer\s+[a-z0-9._-]+|-----BEGIN|\b[A-Za-z0-9+/=_-]{80,}\b|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b)/i

function randomId(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${value}`
}

function storedId(storage: Storage | undefined, key: string, prefix: string): string {
  if (!storage) return randomId(prefix)
  try {
    const current = storage.getItem(key)
    if (current) return current
    const next = randomId(prefix)
    storage.setItem(key, next)
    return next
  } catch {
    return randomId(prefix)
  }
}

export function sanitizeTelemetry(value: unknown, depth = 0): unknown {
  if (depth > MAX_CONTEXT_DEPTH) return '[bounded]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') {
    const clean = value
      .replace(/https?:\/\/[^\s?#]+(?:\?[^\s#]*)?/gi, (url) => url.split('?')[0])
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, MAX_STRING_LENGTH)
    return sensitiveValue.test(clean) ? '[redacted]' : clean
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeTelemetry(item, depth + 1))
  if (typeof value === 'object') {
    const result: Context = {}
    for (const [key, item] of Object.entries(value as Context).slice(0, 30)) {
      result[key] = secretKey.test(key) ? '[redacted]' : sanitizeTelemetry(item, depth + 1)
    }
    return result
  }
  return String(value).slice(0, MAX_STRING_LENGTH)
}

function browserContext(): Context {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string; saveData?: boolean }
  }
  return {
    release: RELEASE_SHA,
    language: nav.language,
    online: nav.onLine,
    mobile: /Mobi|Android|iPhone|iPad/i.test(nav.userAgent),
    appleWebKit: /AppleWebKit/i.test(nav.userAgent),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    deviceMemoryGb: nav.deviceMemory,
    connection: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData,
  }
}

const queue: Context[] = []
let flushTimer: number | null = null

function identifiers(): { anonymousId: string; sessionId: string } {
  return {
    anonymousId: storedId(globalThis.localStorage, ANONYMOUS_KEY, 'anon'),
    sessionId: storedId(globalThis.sessionStorage, SESSION_KEY, 'session'),
  }
}

async function flush(): Promise<void> {
  flushTimer = null
  if (queue.length === 0) return
  const events = queue.splice(0, 50)
  try {
    const response = await fetch(SIGNAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    })
    if (!response.ok) throw new Error(`UserCom returned ${response.status}`)
  } catch {
    // Analytics is deliberately best-effort and must never interrupt play.
  }
}

export function signal(name: string, surface: string, context: Context = {}, tags: string[] = []): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(name)) return
  const ids = identifiers()
  queue.push({
    source: SOURCE,
    name,
    surface,
    path: window.location.pathname,
    url: `${window.location.origin}${window.location.pathname}`,
    anonymousId: ids.anonymousId,
    sessionId: ids.sessionId,
    tags: tags.slice(0, 20),
    context: sanitizeTelemetry({ ...browserContext(), ...context }),
  })
  if (queue.length >= 10) void flush()
  else if (flushTimer == null) flushTimer = window.setTimeout(() => void flush(), 800)
}

export function reportError(
  error: unknown,
  origin: 'react' | 'window' | 'promise' | 'worker' | 'local-ai',
  context: Context = {},
): void {
  const normalized = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown client error')
  signal(`client.${origin}_error`, 'diagnostics', {
    errorName: normalized.name,
    errorMessage: normalized.message,
    stack: normalized.stack,
    ...context,
  }, ['severity:error'])
}

export async function submitFeedback(input: {
  feedback: string
  email?: string
  category: string
  includeDiagnostics: boolean
  diagnostics?: Context
}): Promise<void> {
  const ids = identifiers()
  const context = input.includeDiagnostics
    ? sanitizeTelemetry({ ...browserContext(), category: input.category, ...input.diagnostics })
    : { category: input.category, release: RELEASE_SHA }
  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'feedback',
      feedback: input.feedback.trim(),
      email: input.email?.trim() || undefined,
      subject: `VectorCraft: ${input.category}`,
      source: SOURCE,
      surface: 'feedback-form',
      path: window.location.pathname,
      url: `${window.location.origin}${window.location.pathname}`,
      anonymousId: ids.anonymousId,
      sessionId: ids.sessionId,
      tags: ['intent:feedback', `category:${input.category}`],
      context,
    }),
  })
  if (!response.ok) throw new Error(`Feedback service returned ${response.status}`)
  signal('feedback.client_acknowledged', 'feedback-form', { category: input.category, diagnostics: input.includeDiagnostics })
}

export function installGlobalDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, 'window', {
    filename: event.filename?.split('/').at(-1),
    line: event.lineno,
    column: event.colno,
  })
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, 'promise')
  const onPageHide = () => void flush()
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('pagehide', onPageHide)
  }
}

export const telemetryRelease = RELEASE_SHA
