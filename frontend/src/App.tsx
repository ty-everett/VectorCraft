import { useEffect, useMemo, useRef, useState } from 'react'
import { localAi } from './ai/client'
import { reportError, signal, submitFeedback } from './lib/telemetry'
import {
  STORAGE_KEY,
  findRecipe,
  getSeedRecipe,
  initialGame,
  loadGame,
  materialId,
  pairKey,
  uniqueMaterial,
} from './lib/crafting'
import type { AiStatus, CraftSource, Material, Recipe, SavedGame } from './types'

const RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA || 'local-dev'

interface Toast {
  id: number
  message: string
  tone: 'good' | 'neutral' | 'warning'
}

function FeedbackModal({ onClose, onSent, status }: { onClose: () => void; onSent: () => void; status: AiStatus }) {
  const [feedback, setFeedback] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('idea')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')

  async function send(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (feedback.trim().length < 5 || state === 'sending') return
    setState('sending')
    try {
      await submitFeedback({ feedback, email, category, includeDiagnostics, diagnostics: { ai: status } })
      onSent()
      onClose()
    } catch (error) {
      setState('error')
      reportError(error, 'window', { operation: 'feedback.submit' })
      signal('feedback.failed', 'feedback-form', { category })
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close feedback">×</button>
        <span className="eyebrow">Help shape the world</span>
        <h2 id="feedback-title">Send feedback</h2>
        <p>Tell us what delighted you, broke, or should exist next.</p>
        <form onSubmit={send}>
          <label>Topic
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="idea">Idea</option>
              <option value="bug">Bug</option>
              <option value="local-ai">Local AI</option>
              <option value="accessibility">Accessibility</option>
            </select>
          </label>
          <label>Feedback
            <textarea required minLength={5} maxLength={10000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What happened, or what should we craft next?" />
          </label>
          <label>Email <small>optional, only if you want a reply</small>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
            <span>Include release, browser class, viewport, model profile, and connectivity. Never includes prompts or discoveries.</span>
          </label>
          {state === 'error' && <p className="form-error" role="alert">Feedback could not be sent. Please try again.</p>}
          <button className="primary-action" type="submit" disabled={state === 'sending' || feedback.trim().length < 5}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
        </form>
      </section>
    </div>
  )
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close privacy notice">×</button>
        <span className="eyebrow">Privacy by design</span>
        <h2 id="privacy-title">What stays local</h2>
        <p>Your prompts, model output, discoveries, recipes, and model inference stay in your browser. Hugging Face serves static model files.</p>
        <p>VectorCraft sends privacy-bounded product events and crash diagnostics to UserCom: release, browser class, viewport, model profile, network state, event name, and sanitized errors. It never sends prompts, discoveries, wallet data, secrets, or raw model output.</p>
        <p>Feedback is sent only when you submit the form. Your optional email is used only to reply.</p>
        <button className="primary-action" type="button" onClick={onClose}>Got it</button>
      </section>
    </div>
  )
}

function MaterialCard({ material, onPick }: { material: Material; onPick: (material: Material) => void }) {
  return (
    <button
      className="material-card"
      type="button"
      draggable
      onClick={() => onPick(material)}
      onDragStart={(event) => event.dataTransfer.setData('text/vectorcraft-material', material.id)}
      aria-label={`Add ${material.name} to the forge`}
    >
      <span className="material-emoji" aria-hidden="true">{material.emoji}</span>
      <span className="material-copy">
        <strong>{material.name}</strong>
        <small>{material.description}</small>
      </span>
      <span className="material-add" aria-hidden="true">+</span>
    </button>
  )
}

function ForgeSlot({ index, material, onRemove, onDrop }: {
  index: number
  material: Material | null
  onRemove: () => void
  onDrop: (materialId: string) => void
}) {
  return (
    <div
      className={`forge-slot ${material ? 'filled' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(event.dataTransfer.getData('text/vectorcraft-material'))
      }}
    >
      {material ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${material.name} from slot ${index + 1}`}>
          <span aria-hidden="true">{material.emoji}</span>
          <strong>{material.name}</strong>
          <small>tap to remove</small>
        </button>
      ) : (
        <div className="empty-slot">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <p>Choose or drop an element</p>
        </div>
      )}
    </div>
  )
}

function ModelPanel({ status, onInitialize }: { status: AiStatus; onInitialize: () => void }) {
  const modelName = status.modelLabel ?? (status.device === 'wasm' ? 'SmolLM2 135M Instruct' : 'SmolLM2 360M Instruct')
  const modelSize = status.modelSize ?? (status.device === 'wasm' ? '~137 MB' : '~272 MB')
  return (
    <section className="model-panel panel" aria-labelledby="model-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Local intelligence</span>
          <h2 id="model-heading">Model lab</h2>
        </div>
        <span className={`status-orb ${status.phase}`} aria-hidden="true" />
      </div>

      <div className="model-status" aria-live="polite">
        <span className="chip">{status.device === 'webgpu' ? 'WebGPU' : status.device === 'wasm' ? 'WASM' : 'Auto'}</span>
        <p>{status.label}</p>
      </div>

      {status.phase === 'loading' && (
        <div className="progress-wrap">
          <div className="progress-track"><span style={{ width: `${status.progress ?? 8}%` }} /></div>
          <small>{status.progress == null ? 'Preparing cache…' : `${Math.round(status.progress)}% cached`}</small>
        </div>
      )}

      <div className="model-card">
        <div>
          <span className="model-kicker">CRAFT / OPEN WEIGHTS</span>
          <strong>{modelName}</strong>
          <small>{status.device ? modelSize : '137–272 MB'} · {status.device ? (status.device === 'wasm' ? '8-bit' : '4-bit') : 'adaptive'} ONNX</small>
        </div>
        <span className="license">Apache 2.0</span>
      </div>

      <div className="model-card">
        <div>
          <span className="model-kicker">SEARCH / EMBEDDINGS</span>
          <strong>all-MiniLM-L6-v2</strong>
          <small>~23 MB · 384 dimensions</small>
        </div>
        <span className="license">Apache 2.0</span>
      </div>

      <button className="load-model" type="button" onClick={onInitialize} disabled={status.phase === 'loading' || status.phase === 'working'}>
        {status.phase === 'ready' && status.task === 'generator' ? 'Local model ready' : 'Cache crafting model'}
      </button>

      <p className="privacy-note">
        <span aria-hidden="true">◉</span>
        Prompts, recipes, and model output never leave this browser. Safari automatically uses the memory-safe WASM model.
      </p>
    </section>
  )
}

export default function App() {
  const [game, setGame] = useState<SavedGame>(() => loadGame(localStorage.getItem(STORAGE_KEY)))
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null])
  const [query, setQuery] = useState('')
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null)
  const [isCrafting, setIsCrafting] = useState(false)
  const [lastResultId, setLastResultId] = useState<string | null>(null)
  const [status, setStatus] = useState<AiStatus>({
    phase: 'idle', task: null, label: 'On-device models are asleep', progress: null,
    device: null, profile: null, modelLabel: null, modelSize: null,
  })
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSequence = useRef(0)
  const searchSequence = useRef(0)

  useEffect(() => localAi.subscribe(setStatus), [])
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(game)), [game])

  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) {
      setSemanticIds(null)
      return
    }
    const sequence = ++searchSequence.current
    const timeout = window.setTimeout(() => {
      localAi.search(clean, game.materials)
        .then((ids) => {
          if (sequence === searchSequence.current) {
            setSemanticIds(ids)
            signal('search.completed', 'inventory', { resultCount: ids.length, inventorySize: game.materials.length })
          }
        })
        .catch(() => {
          if (sequence === searchSequence.current) setSemanticIds(null)
        })
    }, 420)
    return () => window.clearTimeout(timeout)
  }, [query, game.materials])

  const materialMap = useMemo(() => new Map(game.materials.map((material) => [material.id, material])), [game.materials])
  const selected = slots.map((id) => id ? materialMap.get(id) ?? null : null) as [Material | null, Material | null]
  const lastResult = lastResultId ? materialMap.get(lastResultId) ?? null : null

  const filteredMaterials = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return [...game.materials].sort((a, b) => b.discoveredAt - a.discoveredAt)
    const lexical = game.materials.filter((material) => `${material.name} ${material.description}`.toLowerCase().includes(clean))
    if (!semanticIds) return lexical
    const ordered = semanticIds.map((id) => materialMap.get(id)).filter((value): value is Material => Boolean(value))
    return [...new Map([...lexical, ...ordered].map((material) => [material.id, material])).values()]
  }, [game.materials, materialMap, query, semanticIds])

  function toast(message: string, tone: Toast['tone'] = 'neutral'): void {
    const id = ++toastSequence.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600)
  }

  function pick(material: Material): void {
    setSlots(([first, second]) => first === null ? [material.id, second] : second === null ? [first, material.id] : [second, material.id])
  }

  function dropIntoSlot(index: number, materialIdValue: string): void {
    if (!materialMap.has(materialIdValue)) return
    setSlots((current) => {
      const next: [string | null, string | null] = [...current]
      next[index] = materialIdValue
      return next
    })
  }

  function commitDiscovery(first: Material, second: Material, generated: { name: string; emoji: string; description: string }, source: CraftSource): Material {
    const unique = uniqueMaterial(generated, game.materials)
    const idBase = materialId(unique.name)
    let id = idBase
    let suffix = 2
    while (materialMap.has(id)) id = `${idBase}-${suffix++}`
    const discoveredAt = Date.now()
    const material: Material = { ...unique, id, parents: [first.id, second.id], discoveredAt, source }
    const recipe: Recipe = { key: pairKey(first.name, second.name), inputs: [first.id, second.id], outputId: id, source, craftedAt: discoveredAt }
    setGame((current) => ({ ...current, materials: [...current.materials, material], recipes: [...current.recipes, recipe], craftCount: current.craftCount + 1 }))
    setLastResultId(id)
    setSlots([null, null])
    return material
  }

  async function craft(): Promise<void> {
    const [first, second] = selected
    if (!first || !second || isCrafting) return
    const existing = findRecipe(game.recipes, first, second)
    if (existing) {
      setLastResultId(existing.outputId)
      setGame((current) => ({ ...current, craftCount: current.craftCount + 1 }))
      setSlots([null, null])
      toast(`Recipe recalled: ${materialMap.get(existing.outputId)?.name ?? 'discovery'}`)
      signal('craft.recalled', 'forge', { inventorySize: game.materials.length })
      return
    }

    setIsCrafting(true)
    try {
      const seed = getSeedRecipe(first, second)
      if (seed) {
        const material = commitDiscovery(first, second, seed, 'seed')
        toast(`Discovered ${material.emoji} ${material.name}`, 'good')
        signal('craft.succeeded', 'forge', { source: 'seed', inventorySize: game.materials.length + 1 })
        return
      }
      signal('craft.ai_started', 'forge', { ...status, inventorySize: game.materials.length })
      const result = await localAi.craft(first, second)
      const source: CraftSource = result.fallback ? 'local-fallback' : 'local-ai'
      const material = commitDiscovery(first, second, result.material, source)
      toast(result.fallback ? `Local fallback forged ${material.name}` : `Local AI discovered ${material.name}`, result.fallback ? 'warning' : 'good')
      signal(result.fallback ? 'craft.fallback_succeeded' : 'craft.ai_succeeded', 'forge', {
        ...result.runtime,
        inventorySize: game.materials.length + 1,
      })
    } finally {
      setIsCrafting(false)
    }
  }

  function reset(): void {
    if (!window.confirm('Reset every VectorCraft discovery on this device?')) return
    setGame(initialGame())
    setSlots([null, null])
    setLastResultId(null)
    toast('World reset to its five origin elements')
  }

  function exportProgress(): void {
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vectorcraft-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast('Progress exported from this browser')
    signal('world.exported', 'inventory', { inventorySize: game.materials.length, craftCount: game.craftCount })
  }

  async function shareGame(): Promise<void> {
    const share = { title: 'VectorCraft', text: 'Craft an infinite world with private, local AI.', url: window.location.origin }
    const nativeShare = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share
    try {
      if (nativeShare) await nativeShare.call(navigator, share)
      else await navigator.clipboard.writeText(share.url)
      toast(nativeShare ? 'Share sheet opened' : 'VectorCraft link copied', 'good')
      signal('growth.share_completed', 'footer', { method: nativeShare ? 'native' : 'clipboard' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      reportError(error, 'window', { operation: 'share' })
      toast('Could not share this time', 'warning')
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="/" aria-label="VectorCraft home">
          <img src="/vectorcraft-mark.svg" alt="" />
          <span><strong>VECTOR</strong>CRAFT</span>
          <small>LOCAL AI LAB</small>
        </a>
        <div className="topbar-center">
          <span className="privacy-pill"><i /> ZERO INFERENCE BACKEND</span>
          <p>Your world exists on this device.</p>
        </div>
        <div className="stats">
          <span><strong>{game.materials.length}</strong><small>discoveries</small></span>
          <span><strong>{game.craftCount}</strong><small>crafts</small></span>
        </div>
      </header>

      <main className="workspace">
        <section className="inventory panel" aria-labelledby="inventory-heading">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Your universe</span>
              <h2 id="inventory-heading">Inventory</h2>
            </div>
            <span className="count-badge">{filteredMaterials.length}</span>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or meaning" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
          </label>
          <p className="search-hint">{query.length >= 2 ? 'Semantic search runs locally' : 'Tap an item or drag it to the forge'}</p>
          <div className="material-list">
            {filteredMaterials.map((material) => <MaterialCard key={material.id} material={material} onPick={pick} />)}
            {filteredMaterials.length === 0 && <div className="empty-search">No discoveries match that idea yet.</div>}
          </div>
          <div className="inventory-actions">
            <button type="button" onClick={exportProgress}>Export world</button>
            <button type="button" onClick={reset}>Reset</button>
          </div>
        </section>

        <section className="forge panel" aria-labelledby="forge-heading">
          <div className="forge-heading">
            <span className="eyebrow">Synthesis chamber</span>
            <h1 id="forge-heading">Craft the unknown.</h1>
            <p>Combine two discoveries. Familiar recipes appear instantly; new ones wake an open model on your device.</p>
          </div>

          <div className="forge-stage">
            <div className="stage-ring ring-one" />
            <div className="stage-ring ring-two" />
            <div className="slot-grid">
              <ForgeSlot index={0} material={selected[0]} onRemove={() => setSlots(([, second]) => [null, second])} onDrop={(id) => dropIntoSlot(0, id)} />
              <div className="plus-sign" aria-hidden="true">+</div>
              <ForgeSlot index={1} material={selected[1]} onRemove={() => setSlots(([first]) => [first, null])} onDrop={(id) => dropIntoSlot(1, id)} />
            </div>
          </div>

          <button className="craft-button" type="button" disabled={!selected[0] || !selected[1] || isCrafting} onClick={craft}>
            <span className="craft-icon" aria-hidden="true">◇</span>
            <span>{isCrafting ? 'LOCAL MODEL IS CRAFTING…' : 'CRAFT DISCOVERY'}</span>
            <small>{selected[0] && selected[1] ? `${selected[0].name} + ${selected[1].name}` : 'SELECT TWO ELEMENTS'}</small>
          </button>

          <div className={`result-card ${lastResult ? 'visible' : ''}`} aria-live="polite">
            {lastResult ? (
              <>
                <span className="result-emoji" aria-hidden="true">{lastResult.emoji}</span>
                <div>
                  <span className="eyebrow">Latest discovery</span>
                  <h2>{lastResult.name}</h2>
                  <p>{lastResult.description}</p>
                </div>
                <span className="source-chip">{lastResult.source === 'local-ai' ? 'LOCAL AI' : lastResult.source === 'seed' ? 'CLASSIC' : 'LOCAL FALLBACK'}</span>
              </>
            ) : (
              <p>Your next discovery will crystallize here.</p>
            )}
          </div>
        </section>

        <ModelPanel status={status} onInitialize={() => {
          signal('ai.cache_requested', 'model-lab', { ...status })
          localAi.initialize().catch((error) => {
            reportError(error, 'local-ai', { operation: 'initialize', ...status })
            toast('The local model could not be cached', 'warning')
          })
        }} />
      </main>

      <footer>
        <p>Forked with attribution from <a href="https://github.com/BloodyFish/OpenAlchemy">OpenAlchemy</a>. Rebuilt for private browser inference.</p>
        <div className="footer-actions">
          <button type="button" onClick={() => { setFeedbackOpen(true); signal('feedback.opened', 'feedback-form') }}>Feedback</button>
          <button type="button" onClick={() => setPrivacyOpen(true)}>Privacy</button>
          <button type="button" onClick={shareGame}>Share</button>
          <a href="https://github.com/ty-everett/VectorCraft">Source</a><span>•</span><span title={RELEASE_SHA}>release {RELEASE_SHA.slice(0, 7)}</span>
        </div>
      </footer>

      {feedbackOpen && <FeedbackModal status={status} onClose={() => setFeedbackOpen(false)} onSent={() => toast('Feedback received — thank you', 'good')} />}
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => <div className={`toast ${item.tone}`} key={item.id}>{item.message}</div>)}
      </div>
    </div>
  )
}
