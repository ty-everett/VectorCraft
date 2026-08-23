import { useEffect, useMemo, useRef, useState } from 'react'
import { localAi } from './ai/client'
import { Workbench } from './components/Workbench'
import { contributeRecipe, installContributionRetry } from './lib/contribution'
import {
  ENGINE_VERSION,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  achievementsFor,
  dailyChallenge,
  findRecipe,
  getCorpusRecipe,
  initialGame,
  loadGame,
  materialId,
  mergeGames,
  pairKey,
  recipeId,
  recipesForMaterial,
  stableHash,
  usesForMaterial,
} from './lib/crafting'
import { signRecipe } from './lib/identity'
import { haptic, playCue } from './lib/playful'
import { reportError, signal, submitFeedback } from './lib/telemetry'
import type { AiStatus, CraftSource, GeneratedMaterial, Material, Recipe, RecipeContribution, SavedGame, WorkspaceItem } from './types'

const RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA || 'local-dev'
const ACHIEVEMENTS: Record<string, { icon: string; name: string; description: string }> = {
  'first-spark': { icon: '✦', name: 'First Spark', description: 'Craft your first discovery.' },
  'world-builder': { icon: '🌍', name: 'World Builder', description: 'Discover ten elements.' },
  'deep-chain': { icon: '🪜', name: 'Deep Chain', description: 'Reach generation five.' },
  'local-mind': { icon: '🧠', name: 'Local Mind', description: 'Complete an on-device AI craft.' },
  curator: { icon: '★', name: 'Curator', description: 'Favorite three discoveries.' },
  'daily-ritual': { icon: '☀️', name: 'Daily Ritual', description: 'Complete a daily challenge.' },
}

interface Toast { id: number; message: string; tone: 'good' | 'neutral' | 'warning' }
interface Placement { consumed: [string, string]; x: number; y: number }

function sourceLabel(source: CraftSource): string {
  if (source === 'corpus') return 'CORPUS'
  if (source === 'local-ai') return 'LOCAL AI'
  if (source === 'collapsed') return 'MERGED'
  return 'LOCAL FALLBACK'
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
      onSent(); onClose()
    } catch (error) {
      setState('error'); reportError(error, 'window', { operation: 'feedback.submit' }); signal('feedback.failed', 'feedback-form', { category })
    }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close feedback">×</button>
      <span className="eyebrow">Help shape the world</span><h2 id="feedback-title">Send feedback</h2><p>Tell us what delighted you, broke, or should exist next.</p>
      <form onSubmit={send}>
        <label>Topic<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="idea">Idea</option><option value="bug">Bug</option><option value="local-ai">Local AI</option><option value="accessibility">Accessibility</option></select></label>
        <label>Feedback<textarea required minLength={5} maxLength={10000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What happened, or what should we craft next?" /></label>
        <label>Email <small>optional, only if you want a reply</small><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label className="check-row"><input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} /><span>Include release, browser class, viewport, model profile, and connectivity. Recipe contributions are recorded separately from feedback.</span></label>
        {state === 'error' && <p className="form-error" role="alert">Feedback could not be sent. Please try again.</p>}
        <button className="primary-action" type="submit" disabled={state === 'sending' || feedback.trim().length < 5}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
      </form>
    </section>
  </div>
}

function ContributionModal({ onAccept, onPrivacy }: { onAccept: () => void; onPrivacy: () => void }) {
  return <div className="modal-backdrop contribution-backdrop"><section className="modal-card contribution-card" role="dialog" aria-modal="true" aria-labelledby="contribution-title">
    <span className="contribution-sigil" aria-hidden="true">✦</span><span className="eyebrow">A world we build together</span><h2 id="contribution-title">Craft locally. Teach the corpus.</h2>
    <p>The language model and its raw response stay on this device. Every craft contributes the two ingredient names and emoji, the final discovery name, emoji and description, whether it was new, recalled or semantically merged, its generation, and optional clan tag.</p>
    <p>Each recipe is anonymously signed by a device-local game identity and contributed under CC0 so it can be reviewed, deduplicated, and promoted into VectorCraft’s deterministic built-in corpus. No account, free-form prompt, wallet, transaction, secret, or unrelated saved state is included.</p>
    <div className="contribution-flow"><span>YOU CRAFT</span><i>→</i><span>LOCAL AI</span><i>→</i><span>SIGNED RECIPE</span><i>→</i><span>BETTER CORPUS</span></div>
    <div className="modal-actions"><button className="secondary-action" type="button" onClick={onPrivacy}>Review exact fields</button><button className="primary-action" type="button" onClick={onAccept}>Enter the workshop</button></div>
    <small>Continuing acknowledges this recipe-contribution behavior. See Privacy for the exact fields.</small>
  </section></div>
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <button className="modal-close" type="button" onClick={onClose} aria-label="Close privacy notice">×</button><span className="eyebrow">Local intelligence, shared recipes</span><h2 id="privacy-title">What leaves this browser</h2>
    <p>Inference, raw model responses, the complete inventory, workspace layout, favorites, private signing key, and model cache stay on this device.</p>
    <p>Every craft contributes its two ingredient names and emoji, final name/emoji/description, source, outcome, semantic-collapse score when present, generation, model profile, daily challenge ID, optional clan tag, timestamp, release, public device key, and signature to UserCom under CC0.</p>
    <p>Bounded product events and crash diagnostics exclude craft content. Feedback is sent only when you submit it; optional email is used only to reply. Wallets, transactions, secrets, raw prompts, and unrelated application state are never contributed.</p>
    <button className="primary-action" type="button" onClick={onClose}>Got it</button>
  </section></div>
}

function SettingsModal({ game, onChange, onClose }: { game: SavedGame; onChange: (next: SavedGame['settings']) => void; onClose: () => void }) {
  const [settings, setSettings] = useState(game.settings)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button className="modal-close" type="button" onClick={onClose} aria-label="Close settings">×</button><span className="eyebrow">Workshop controls</span><h2 id="settings-title">Settings</h2>
    <label className="setting-row"><span><strong>Sound</strong><small>Procedural cues for placing, discovering and merging.</small></span><input type="checkbox" checked={settings.sound} onChange={(event) => setSettings({ ...settings, sound: event.target.checked })} /></label>
    <label className="setting-row"><span><strong>Haptics</strong><small>Short vibration cues when the browser supports them.</small></span><input type="checkbox" checked={settings.haptics} onChange={(event) => setSettings({ ...settings, haptics: event.target.checked })} /></label>
    <label>Clan tag <small>optional; included in future signed recipes</small><input value={settings.clanTag} maxLength={24} onChange={(event) => setSettings({ ...settings, clanTag: event.target.value.replace(/[^\p{L}\p{N} _-]/gu, '') })} placeholder="e.g. Vector Guild" /></label>
    <button className="primary-action" type="button" onClick={() => { onChange(settings); onClose() }}>Save settings</button>
  </section></div>
}

function ImportModal({ candidate, onMerge, onReplace, onClose }: { candidate: SavedGame; onMerge: () => void; onReplace: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="import-title"><button className="modal-close" onClick={onClose} aria-label="Cancel import">×</button>
    <span className="eyebrow">Versioned world import</span><h2 id="import-title">Bring in {candidate.materials.length} discoveries?</h2><p>The file contains {candidate.recipes.length} recipes and {candidate.achievements.length} achievements. Choose whether to merge it with this device or replace the current world.</p>
    <div className="modal-actions"><button className="secondary-action" onClick={onMerge}>Merge worlds</button><button className="primary-action" onClick={onReplace}>Replace world</button></div>
  </section></div>
}

function ForgeSlot({ index, material, onRemove, onDrop }: { index: number; material: Material | null; onRemove: () => void; onDrop: (id: string) => void }) {
  return <div className={`forge-slot ${material ? 'filled' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(event.dataTransfer.getData('text/vectorcraft-material')) }}>
    {material ? <button type="button" onClick={onRemove} aria-label={`Remove ${material.name} from slot ${index + 1}`}><span aria-hidden="true">{material.emoji}</span><strong>{material.name}</strong><small>tap to remove</small></button> : <div className="empty-slot"><span>{String(index + 1).padStart(2, '0')}</span><p>Choose or drop an element</p></div>}
  </div>
}

function ModelPanel({ status, onInitialize }: { status: AiStatus; onInitialize: () => void }) {
  const modelName = status.modelLabel ?? (status.device === 'wasm' ? 'SmolLM2 135M Instruct' : 'SmolLM2 360M Instruct')
  const modelSize = status.modelSize ?? (status.device === 'wasm' ? '~137 MB' : '~272 MB')
  return <section className="model-panel panel" aria-labelledby="model-heading"><div className="panel-heading"><div><span className="eyebrow">Local intelligence</span><h2 id="model-heading">Model lab</h2></div><span className={`status-orb ${status.phase}`} aria-hidden="true" /></div>
    <div className="model-status" aria-live="polite"><span className="chip">{status.device === 'webgpu' ? 'WebGPU' : status.device === 'wasm' ? 'WASM' : 'Auto'}</span><p>{status.label}</p></div>
    {status.phase === 'loading' && <div className="progress-wrap"><div className="progress-track"><span style={{ width: `${status.progress ?? 8}%` }} /></div><small>{status.progress == null ? 'Preparing cache…' : `${Math.round(status.progress)}% cached`}</small></div>}
    <div className="model-card"><div><span className="model-kicker">CRAFT / OPEN WEIGHTS</span><strong>{modelName}</strong><small>{status.device ? modelSize : '137–272 MB'} · deterministic greedy ONNX</small></div><span className="license">Apache 2.0</span></div>
    <div className="model-card"><div><span className="model-kicker">SEARCH + SEMANTIC MERGE</span><strong>all-MiniLM-L6-v2</strong><small>~23 MB · 384 dimensions · 0.86 collapse threshold</small></div><span className="license">Apache 2.0</span></div>
    <button className="load-model" type="button" onClick={onInitialize} disabled={status.phase === 'loading' || status.phase === 'working'}>{status.phase === 'ready' && status.task === 'generator' ? 'Local model ready' : 'Cache crafting model'}</button>
    <p className="privacy-note"><span aria-hidden="true">◉</span>Inference stays local. Final recipes are signed and contributed to improve the deterministic corpus.</p>
  </section>
}

function MaterialCard({ material, favorite, onPick, onFavorite, onInspect }: { material: Material; favorite: boolean; onPick: () => void; onFavorite: () => void; onInspect: () => void }) {
  return <article className={`material-card ${favorite ? 'favorite' : ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('text/vectorcraft-material', material.id)}>
    <button className="material-main" type="button" onClick={onPick} aria-label={`Add ${material.name} to the forge`}><span className="material-emoji" aria-hidden="true">{material.emoji}</span><span className="material-copy"><strong>{material.name}</strong><small>{material.description}</small></span><span className="generation-badge">G{material.generation}</span></button>
    <div className="material-tools"><button type="button" onClick={onFavorite} aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${material.name}`}>{favorite ? '★' : '☆'}</button><button type="button" onClick={onInspect} aria-label={`Inspect ${material.name}`}>↗</button></div>
  </article>
}

export default function App() {
  const [game, setGame] = useState<SavedGame>(() => loadGame(localStorage.getItem(STORAGE_KEY), localStorage.getItem(LEGACY_STORAGE_KEY)))
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null])
  const [mode, setMode] = useState<'forge' | 'workbench'>('forge')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name' | 'generation' | 'usage'>('recent')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null)
  const [isCrafting, setIsCrafting] = useState(false)
  const [lastResultId, setLastResultId] = useState<string | null>(null)
  const [lastResultSource, setLastResultSource] = useState<CraftSource | null>(null)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const [selectedWorkbenchId, setSelectedWorkbenchId] = useState<string | null>(null)
  const [workbenchPending, setWorkbenchPending] = useState<{ x: number; y: number } | null>(null)
  const [status, setStatus] = useState<AiStatus>({ phase: 'idle', task: null, label: 'On-device models are asleep', progress: null, device: null, profile: null, modelLabel: null, modelSize: null })
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importCandidate, setImportCandidate] = useState<SavedGame | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSequence = useRef(0)
  const workspaceSequence = useRef(0)
  const searchSequence = useRef(0)
  const challenge = useMemo(() => dailyChallenge(), [])

  useEffect(() => localAi.subscribe(setStatus), [])
  useEffect(() => installContributionRetry(), [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); localStorage.removeItem(LEGACY_STORAGE_KEY) }, [game])

  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) { setSemanticIds(null); return }
    const sequence = ++searchSequence.current
    const timeout = window.setTimeout(() => {
      localAi.search(clean, game.materials).then((ids) => {
        if (sequence === searchSequence.current) { setSemanticIds(ids); signal('search.completed', 'inventory', { resultCount: ids.length, inventorySize: game.materials.length }) }
      }).catch(() => { if (sequence === searchSequence.current) setSemanticIds(null) })
    }, 420)
    return () => window.clearTimeout(timeout)
  }, [query, game.materials])

  const materialMap = useMemo(() => new Map(game.materials.map((material) => [material.id, material])), [game.materials])
  const selected = slots.map((id) => id ? materialMap.get(id) ?? null : null) as [Material | null, Material | null]
  const lastResult = lastResultId ? materialMap.get(lastResultId) ?? null : null
  const inspected = inspectId ? materialMap.get(inspectId) ?? null : null
  const selectedWorkbench = selectedWorkbenchId ? game.workspace.find((item) => item.id === selectedWorkbenchId) ?? null : null
  const selectedWorkbenchMaterial = selectedWorkbench ? materialMap.get(selectedWorkbench.materialId) ?? null : null
  const challengeComplete = game.completedChallenges.some((item) => item.id === challenge.id)

  const filteredMaterials = useMemo(() => {
    const clean = query.trim().toLowerCase()
    let values = favoritesOnly ? game.materials.filter((item) => game.favorites.includes(item.id)) : [...game.materials]
    if (clean) {
      const lexical = values.filter((material) => `${material.name} ${material.description}`.toLowerCase().includes(clean))
      const semantic = semanticIds?.map((id) => materialMap.get(id)).filter((item): item is Material => Boolean(item)) ?? []
      values = [...new Map([...lexical, ...semantic].map((material) => [material.id, material])).values()]
    }
    return values.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'generation' ? b.generation - a.generation || b.discoveredAt - a.discoveredAt : sort === 'usage' ? b.craftCount - a.craftCount || b.lastCraftedAt - a.lastCraftedAt : b.discoveredAt - a.discoveredAt)
  }, [favoritesOnly, game.favorites, game.materials, materialMap, query, semanticIds, sort])

  function toast(message: string, tone: Toast['tone'] = 'neutral'): void {
    const id = ++toastSequence.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3900)
  }

  function workspaceId(materialIdValue: string): string {
    return `work-${stableHash(`${materialIdValue}:${Date.now()}:${++workspaceSequence.current}`)}`
  }

  function pick(material: Material): void {
    playCue('place', game.settings.sound); haptic(8, game.settings.haptics)
    if (mode === 'workbench') { placeOnWorkbench(material.id); return }
    setSlots(([first, second]) => first === null ? [material.id, second] : second === null ? [first, material.id] : [second, material.id])
  }

  function placeOnWorkbench(materialIdValue: string, x = 16 + ((game.workspace.length * 13) % 68), y = 20 + ((game.workspace.length * 17) % 58)): void {
    if (!materialMap.has(materialIdValue)) return
    const item: WorkspaceItem = { id: workspaceId(materialIdValue), materialId: materialIdValue, x, y }
    setGame((current) => ({ ...current, workspace: [...current.workspace, item] }))
    setSelectedWorkbenchId(item.id)
  }

  function contribution(first: Material, second: Material, output: Material, recipe: Recipe, outcome: RecipeContribution['outcome'], collapsedInto?: string): RecipeContribution {
    return {
      schemaVersion: 1, engineVersion: ENGINE_VERSION, recipeId: recipe.id, recipeKey: recipe.key,
      inputs: [{ name: first.name, emoji: first.emoji }, { name: second.name, emoji: second.emoji }],
      output: { name: output.name, emoji: output.emoji, description: output.description }, source: recipe.source, outcome,
      collapsedInto, similarity: recipe.similarity, generation: output.generation, modelProfile: recipe.modelProfile,
      challengeId: recipe.key === challenge.recipeKey ? challenge.id : undefined, clanTag: game.settings.clanTag || undefined, craftedAt: new Date(recipe.lastCraftedAt).toISOString(),
    }
  }

  async function performCraft(firstId: string, secondId: string, placement?: Placement): Promise<Material | null> {
    if (isCrafting) return null
    const firstSelection = materialMap.get(firstId); const secondSelection = materialMap.get(secondId)
    if (!firstSelection || !secondSelection) return null
    const [first, second] = [firstSelection, secondSelection].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)) as [Material, Material]
    setIsCrafting(true)
    if (placement) setWorkbenchPending({ x: placement.x, y: placement.y })
    const now = Date.now(); const key = pairKey(first.name, second.name)
    try {
      const existingRecipe = findRecipe(game.recipes, first, second)
      let output: Material
      let recipe: Recipe
      let outcome: RecipeContribution['outcome'] = 'new'
      let collapsedInto: string | undefined
      let nextMaterials = [...game.materials]
      let nextRecipes = [...game.recipes]
      let inferenceTelemetry: Record<string, unknown> = {}

      if (existingRecipe) {
        const known = materialMap.get(existingRecipe.outputId)
        if (!known) throw new Error('Recipe output is missing')
        output = { ...known, craftCount: known.craftCount + 1, lastCraftedAt: now }
        recipe = { ...existingRecipe, craftCount: existingRecipe.craftCount + 1, lastCraftedAt: now }
        nextMaterials = nextMaterials.map((item) => item.id === output.id ? output : item)
        nextRecipes = nextRecipes.map((item) => item.key === recipe.key ? recipe : item)
        outcome = 'recalled'
      } else {
        let generated: GeneratedMaterial
        let source: CraftSource = 'corpus'
        let similarity: number | undefined
        let modelProfile: string | undefined
        const corpus = getCorpusRecipe(first, second)
        if (corpus) generated = corpus
        else {
          signal('craft.ai_started', mode, { ...status, inventorySize: game.materials.length })
          const result = await localAi.craft(first, second, game.materials)
          generated = result.material
          source = result.fallback ? 'local-fallback' : 'local-ai'
          modelProfile = result.runtime.profile ?? undefined
          inferenceTelemetry = { device: result.runtime.device, modelProfile: result.runtime.profile, modelLabel: result.runtime.modelLabel, modelSize: result.runtime.modelSize }
          if (result.similar) { collapsedInto = result.similar.id; similarity = result.similar.score; source = 'collapsed' }
        }
        const exact = game.materials.find((item) => item.name.toLowerCase() === generated.name.toLowerCase())
        const collapsed = collapsedInto ? materialMap.get(collapsedInto) : exact
        if (collapsed) {
          output = { ...collapsed, craftCount: collapsed.craftCount + 1, lastCraftedAt: now }
          nextMaterials = nextMaterials.map((item) => item.id === output.id ? output : item)
          source = 'collapsed'; similarity ??= 1; collapsedInto = output.id; outcome = 'collapsed'
        } else {
          output = { id: materialId(generated.name), ...generated, discoveredAt: now, lastCraftedAt: now, craftCount: 1, generation: Math.max(first.generation, second.generation) + 1, parents: [first.id, second.id], source }
          nextMaterials.push(output)
        }
        recipe = { id: recipeId(key), key, inputs: [first.id, second.id], outputId: output.id, source, craftedAt: now, lastCraftedAt: now, craftCount: 1, similarity, modelProfile }
        nextRecipes.push(recipe)
      }

      const completedChallenges = key === challenge.recipeKey && !challengeComplete ? [...game.completedChallenges, { id: challenge.id, completedAt: now, recipeKey: key }] : game.completedChallenges
      let workspace = game.workspace
      if (placement) workspace = [...workspace.filter((item) => !placement.consumed.includes(item.id)), { id: workspaceId(output.id), materialId: output.id, x: placement.x, y: placement.y }]
      let nextGame: SavedGame = { ...game, materials: nextMaterials, recipes: nextRecipes, craftCount: game.craftCount + 1, completedChallenges, workspace }
      const earned = achievementsFor(nextGame)
      const newAchievements = earned.filter((id) => !game.achievements.includes(id))
      nextGame = { ...nextGame, achievements: [...new Set([...game.achievements, ...earned])] }
      setGame(nextGame); setLastResultId(output.id); setLastResultSource(recipe.source); setSlots([null, null]); setSelectedWorkbenchId(placement ? workspace.at(-1)?.id ?? null : selectedWorkbenchId)
      if (outcome === 'collapsed') { playCue('collapse', game.settings.sound); haptic([10, 30, 10], game.settings.haptics); toast(`Merged with ${output.emoji} ${output.name} — too similar to duplicate`, 'neutral') }
      else if (outcome === 'recalled') { playCue('recall', game.settings.sound); haptic(8, game.settings.haptics); toast(`Recipe recalled: ${output.emoji} ${output.name}`) }
      else { playCue('discovery', game.settings.sound); haptic([15, 35, 20], game.settings.haptics); toast(`Discovered ${output.emoji} ${output.name}`, 'good') }
      if (key === challenge.recipeKey && !challengeComplete) { toast(`Daily challenge complete: ${challenge.emoji} ${challenge.target}`, 'good'); signal('challenge.completed', 'daily-challenge', { challengeId: challenge.id }) }
      newAchievements.forEach((id, index) => window.setTimeout(() => { playCue('achievement', game.settings.sound); toast(`Achievement unlocked: ${ACHIEVEMENTS[id]?.name ?? id}`, 'good') }, 450 * (index + 1)))
      void contributeRecipe(contribution(first, second, output, recipe, outcome, collapsedInto)).then((result) => signal(result?.delivered ? 'recipe.contribution_sent' : result ? 'recipe.contribution_queued' : 'recipe.contribution_failed', 'corpus', { outcome, source: recipe.source }))
      signal(outcome === 'recalled' ? 'craft.recalled' : outcome === 'collapsed' ? 'craft.collapsed' : recipe.source === 'corpus' ? 'craft.succeeded' : recipe.source === 'local-ai' ? 'craft.ai_succeeded' : 'craft.fallback_succeeded', mode, { source: recipe.source, inventorySize: nextMaterials.length, generation: output.generation, modelProfile: recipe.modelProfile, similarity: recipe.similarity, ...inferenceTelemetry })
      return output
    } catch (error) {
      playCue('error', game.settings.sound); haptic([40, 30, 40], game.settings.haptics); reportError(error, 'local-ai', { operation: 'craft' }); toast('The craft slipped. Try again.', 'warning'); return null
    } finally { setIsCrafting(false); setWorkbenchPending(null) }
  }

  function moveWorkbench(id: string, x: number, y: number): void { setGame((current) => ({ ...current, workspace: current.workspace.map((item) => item.id === id ? { ...item, x, y } : item) })) }
  function combineWorkbench(firstItemId: string, secondItemId: string, x: number, y: number): void {
    const first = game.workspace.find((item) => item.id === firstItemId); const second = game.workspace.find((item) => item.id === secondItemId)
    if (first && second) void performCraft(first.materialId, second.materialId, { consumed: [first.id, second.id], x, y })
  }
  function duplicateWorkbench(): void { if (selectedWorkbench) placeOnWorkbench(selectedWorkbench.materialId, Math.min(92, selectedWorkbench.x + 7), Math.max(7, selectedWorkbench.y - 7)) }
  function removeWorkbench(): void { if (!selectedWorkbench) return; setGame((current) => ({ ...current, workspace: current.workspace.filter((item) => item.id !== selectedWorkbench.id) })); setSelectedWorkbenchId(null) }
  function splitMaterial(material: Material, workspaceItem?: WorkspaceItem | null): void {
    const provenance = recipesForMaterial(game.recipes, material.id)[0]
    if (!provenance) { playCue('error', game.settings.sound); toast(`${material.name} has no known recipe to split`, 'warning'); return }
    if (workspaceItem) {
      const left = materialMap.get(provenance.inputs[0]); const right = materialMap.get(provenance.inputs[1]); if (!left || !right) return
      setGame((current) => ({ ...current, workspace: [...current.workspace.filter((item) => item.id !== workspaceItem.id), { id: workspaceId(left.id), materialId: left.id, x: Math.max(4, workspaceItem.x - 8), y: workspaceItem.y }, { id: workspaceId(right.id), materialId: right.id, x: Math.min(92, workspaceItem.x + 8), y: workspaceItem.y }] }))
    } else setSlots(provenance.inputs)
    playCue('place', game.settings.sound); toast(`Split ${material.name} into its known ingredients`); signal('recipe.split', mode, { generation: material.generation })
  }

  function favorite(id: string): void {
    setGame((current) => {
      const favorites = current.favorites.includes(id) ? current.favorites.filter((item) => item !== id) : [...current.favorites, id]
      const next = { ...current, favorites }
      const earned = achievementsFor(next)
      if (earned.includes('curator') && !current.achievements.includes('curator')) {
        window.setTimeout(() => { playCue('achievement', current.settings.sound); toast('Achievement unlocked: Curator', 'good') })
      }
      return { ...next, achievements: [...new Set([...current.achievements, ...earned])] }
    })
  }

  function exportProgress(): void {
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `vectorcraft-v2-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); toast('Versioned world exported'); signal('world.exported', 'inventory', { inventorySize: game.materials.length, craftCount: game.craftCount })
  }
  async function importFile(file: File): Promise<void> { try { const text = await file.text(); const parsed = JSON.parse(text) as Record<string, unknown>; if (parsed.version !== 1 && parsed.version !== 2) throw new Error('Unsupported save version'); if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.recipes)) throw new Error('Invalid save structure'); setImportCandidate(loadGame(text)) } catch (error) { reportError(error, 'window', { operation: 'world.import' }); toast('That file is not a valid VectorCraft world', 'warning') } }

  async function cardBlob(material: Material, recipe?: Recipe): Promise<Blob | null> {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630; const ctx = canvas.getContext('2d'); if (!ctx) return null
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, '#08111f'); gradient.addColorStop(0.55, '#14213d'); gradient.addColorStop(1, '#24113d'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 630)
    ctx.fillStyle = '#70f5ce'; ctx.font = '700 28px system-ui'; ctx.fillText('VECTORCRAFT  ·  LOCAL AI DISCOVERY', 70, 78)
    ctx.fillStyle = '#ffffff'; ctx.font = '120px system-ui'; ctx.fillText(material.emoji, 72, 270); ctx.font = '700 72px system-ui'; ctx.fillText(material.name, 240, 220)
    ctx.fillStyle = '#a8b4cc'; ctx.font = '30px system-ui'; ctx.fillText(material.description.slice(0, 62), 242, 275)
    ctx.fillStyle = '#7c89a6'; ctx.font = '24px system-ui'; ctx.fillText(`GENERATION ${material.generation}  ·  ${sourceLabel(material.source)}`, 242, 325)
    if (recipe) { const first = materialMap.get(recipe.inputs[0]); const second = materialMap.get(recipe.inputs[1]); if (first && second) { ctx.fillStyle = '#d8e1f4'; ctx.font = '600 34px system-ui'; ctx.fillText(`${first.emoji} ${first.name}  +  ${second.emoji} ${second.name}`, 242, 405) } }
    ctx.fillStyle = '#70f5ce'; ctx.font = '26px system-ui'; ctx.fillText('vectorcraft.metanet.app', 70, 566)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }

  async function shareMaterial(material: Material): Promise<void> {
    const recipe = recipesForMaterial(game.recipes, material.id)[0]; const first = recipe ? materialMap.get(recipe.inputs[0]) : null; const second = recipe ? materialMap.get(recipe.inputs[1]) : null
    const text = `${material.emoji} I crafted ${material.name}${first && second ? ` from ${first.name} + ${second.name}` : ''} in VectorCraft.`; const blob = await cardBlob(material, recipe); const file = blob ? new File([blob], `vectorcraft-${material.id}.png`, { type: 'image/png' }) : null
    const nativeShare = typeof navigator.share === 'function'
    try {
      if (nativeShare && file && navigator.canShare?.({ files: [file] })) await navigator.share({ title: `VectorCraft: ${material.name}`, text, url: window.location.origin, files: [file] })
      else if (nativeShare) await navigator.share({ title: `VectorCraft: ${material.name}`, text, url: window.location.origin })
      else { await navigator.clipboard.writeText(`${text} ${window.location.origin}`); toast('Recipe card text copied', 'good') }
      signal('growth.recipe_shared', 'item-detail', { generation: material.generation, method: nativeShare ? 'native' : 'clipboard' })
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) { reportError(error, 'window', { operation: 'share.recipe' }); toast('Could not share this recipe', 'warning') } }
  }

  async function copySignedPacket(material: Material): Promise<void> {
    const recipe = recipesForMaterial(game.recipes, material.id)[0]; if (!recipe) { toast('Origin elements do not have recipe packets', 'warning'); return }
    const first = materialMap.get(recipe.inputs[0]); const second = materialMap.get(recipe.inputs[1]); if (!first || !second) return
    try { const packet = await signRecipe(contribution(first, second, material, recipe, 'recalled')); await navigator.clipboard.writeText(JSON.stringify(packet, null, 2)); toast('Signed recipe packet copied', 'good'); signal('recipe.packet_copied', 'item-detail', { generation: material.generation }) } catch (error) { reportError(error, 'window', { operation: 'recipe.packet' }); toast('Could not create the signed packet', 'warning') }
  }

  function reset(): void { if (!window.confirm('Reset every VectorCraft discovery and workbench item on this device?')) return; setGame(initialGame()); setSlots([null, null]); setLastResultId(null); setLastResultSource(null); setInspectId(null); toast('World reset to its five origin elements') }

  return <div className="app-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar"><a className="brand" href="/" aria-label="VectorCraft home"><img src="/vectorcraft-mark.svg" alt="" /><span><strong>VECTOR</strong>CRAFT</span><small>LOCAL AI LAB</small></a><div className="topbar-center"><span className="privacy-pill"><i /> LOCAL INFERENCE · SHARED RECIPES</span><p>Deterministic worlds, built together.</p></div><div className="stats"><span><strong>{game.materials.length}</strong><small>discoveries</small></span><span><strong>{game.craftCount}</strong><small>crafts</small></span><span><strong>{game.achievements.length}</strong><small>badges</small></span></div></header>
    <nav className="mode-switch" aria-label="Play mode"><button className={mode === 'forge' ? 'active' : ''} onClick={() => setMode('forge')}>◇ Forge</button><button className={mode === 'workbench' ? 'active' : ''} onClick={() => setMode('workbench')}>✦ Workbench</button></nav>
    <main className={`workspace ${mode === 'workbench' ? 'workbench-mode' : ''}`}>
      <section className="inventory panel" aria-labelledby="inventory-heading"><div className="panel-heading"><div><span className="eyebrow">Your universe</span><h2 id="inventory-heading">Inventory</h2></div><span className="count-badge">{filteredMaterials.length}</span></div>
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or meaning" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label>
        <div className="inventory-filters"><select aria-label="Sort inventory" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Newest</option><option value="name">A–Z</option><option value="generation">Deepest</option><option value="usage">Most used</option></select><button className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly(!favoritesOnly)}>★ Favorites</button></div>
        <p className="search-hint">{query.length >= 2 ? 'Semantic search runs locally' : mode === 'workbench' ? 'Tap to place, or drag onto the table' : 'Tap to forge · star to pin · arrow for details'}</p>
        <div className="material-list">{filteredMaterials.map((material) => <MaterialCard key={material.id} material={material} favorite={game.favorites.includes(material.id)} onPick={() => pick(material)} onFavorite={() => favorite(material.id)} onInspect={() => setInspectId(material.id)} />)}{filteredMaterials.length === 0 && <div className="empty-search">No discoveries match that idea yet.</div>}</div>
        <div className="inventory-actions"><button onClick={exportProgress}>Export</button><label className="button-label">Import<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = '' }} /></label><button onClick={reset}>Reset</button></div>
      </section>

      {mode === 'forge' ? <section className="forge panel" aria-labelledby="forge-heading"><div className="forge-heading"><span className="eyebrow">Synthesis chamber</span><h1 id="forge-heading">Craft the unknown.</h1><p>Known recipes resolve instantly. New pairs wake a deterministic open model, then MiniLM merges anything semantically redundant.</p></div>
        <article className={`daily-challenge ${challengeComplete ? 'complete' : ''}`}><span>{challengeComplete ? '✓' : 'TODAY'}</span><div><strong>{challenge.emoji} {challengeComplete ? challenge.target : 'Mystery recipe'}</strong><small>{challengeComplete ? 'Challenge complete' : `${challenge.first} + ${challenge.second}`}</small></div></article>
        <div className="forge-stage"><div className="stage-ring ring-one" /><div className="stage-ring ring-two" /><div className="slot-grid"><ForgeSlot index={0} material={selected[0]} onRemove={() => setSlots(([, second]) => [null, second])} onDrop={(id) => materialMap.has(id) && setSlots(([, second]) => [id, second])} /><div className="plus-sign" aria-hidden="true">+</div><ForgeSlot index={1} material={selected[1]} onRemove={() => setSlots(([first]) => [first, null])} onDrop={(id) => materialMap.has(id) && setSlots(([first]) => [first, id])} /></div></div>
        <button className="craft-button" type="button" disabled={!selected[0] || !selected[1] || isCrafting} onClick={() => selected[0] && selected[1] && void performCraft(selected[0].id, selected[1].id)}><span className="craft-icon" aria-hidden="true">◇</span><span>{isCrafting ? 'LOCAL MODELS ARE CRAFTING…' : 'CRAFT DISCOVERY'}</span><small>{selected[0] && selected[1] ? `${selected[0].name} + ${selected[1].name}` : 'SELECT TWO ELEMENTS'}</small></button>
        <div className={`result-card ${lastResult ? 'visible' : ''}`} aria-live="polite">{lastResult ? <><span className="result-emoji" aria-hidden="true">{lastResult.emoji}</span><div><span className="eyebrow">Latest result · generation {lastResult.generation}</span><h2>{lastResult.name}</h2><p>{lastResult.description}</p></div><button className="source-chip" onClick={() => setInspectId(lastResult.id)}>{sourceLabel(lastResultSource ?? lastResult.source)} ↗</button></> : <p>Your next discovery will crystallize here.</p>}</div>
      </section> : <section className="workbench panel" aria-labelledby="workbench-heading"><div className="workbench-heading"><div><span className="eyebrow">Spatial laboratory</span><h1 id="workbench-heading">Make a beautiful mess.</h1><p>Drag discoveries together to combine them. Every object is a real button, so touch and keyboard play work too.</p></div><div className="workbench-toolbar"><button disabled={!selectedWorkbench} onClick={duplicateWorkbench}>Duplicate</button><button disabled={!selectedWorkbenchMaterial} onClick={() => selectedWorkbenchMaterial && splitMaterial(selectedWorkbenchMaterial, selectedWorkbench)}>Split</button><button disabled={!selectedWorkbenchMaterial} onClick={() => selectedWorkbenchMaterial && setInspectId(selectedWorkbenchMaterial.id)}>Details</button><button disabled={!selectedWorkbench} onClick={removeWorkbench}>Remove</button></div></div>
        <Workbench items={game.workspace} materials={materialMap} pending={workbenchPending} selectedId={selectedWorkbenchId} onSelect={setSelectedWorkbenchId} onMove={moveWorkbench} onCombine={combineWorkbench} onDropMaterial={placeOnWorkbench} />
      </section>}

      <aside className="side-stack"><ModelPanel status={status} onInitialize={() => { signal('ai.cache_requested', 'model-lab', { ...status }); localAi.initialize().catch((error) => { reportError(error, 'local-ai', { operation: 'initialize', ...status }); toast('The local model could not be cached', 'warning') }) }} />
        <section className="achievement-panel panel"><div className="panel-heading"><div><span className="eyebrow">Your legend</span><h2>Achievements</h2></div><span className="count-badge">{game.achievements.length}/{Object.keys(ACHIEVEMENTS).length}</span></div><div className="achievement-grid">{Object.entries(ACHIEVEMENTS).map(([id, badge]) => <div key={id} className={game.achievements.includes(id) ? 'earned' : ''} title={badge.description}><span>{badge.icon}</span><small>{badge.name}</small></div>)}</div></section>
      </aside>
    </main>
    <footer><p>Forked with attribution from <a href="https://github.com/BloodyFish/OpenAlchemy">OpenAlchemy</a>. Inspired by tactile open crafting games; rebuilt for deterministic local inference.</p><div className="footer-actions"><button onClick={() => { setFeedbackOpen(true); signal('feedback.opened', 'feedback-form') }}>Feedback</button><button onClick={() => setPrivacyOpen(true)}>Privacy</button><button onClick={() => setSettingsOpen(true)}>Settings</button><a href="https://github.com/ty-everett/VectorCraft">Source</a><span>•</span><span title={RELEASE_SHA}>release {RELEASE_SHA.slice(0, 7)}</span></div></footer>

    {inspected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setInspectId(null)}><section className="modal-card detail-card" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" onClick={() => setInspectId(null)} aria-label="Close item details">×</button><div className="detail-hero"><span>{inspected.emoji}</span><div><span className="eyebrow">Generation {inspected.generation} · {sourceLabel(inspected.source)}</span><h2 id="detail-title">{inspected.name}</h2><p>{inspected.description}</p></div></div>
      <div className="detail-stats"><span><strong>{inspected.craftCount}</strong>crafts</span><span><strong>{recipesForMaterial(game.recipes, inspected.id).length}</strong>known paths</span><span><strong>{usesForMaterial(game.recipes, inspected.id).length}</strong>downstream uses</span></div>
      <div className="detail-section"><span className="eyebrow">Recipe lineage</span>{recipesForMaterial(game.recipes, inspected.id).length ? recipesForMaterial(game.recipes, inspected.id).map((recipe) => <div className="lineage-row" key={recipe.id}><span>{materialMap.get(recipe.inputs[0])?.emoji} {materialMap.get(recipe.inputs[0])?.name}</span><i>+</i><span>{materialMap.get(recipe.inputs[1])?.emoji} {materialMap.get(recipe.inputs[1])?.name}</span><small>×{recipe.craftCount}</small></div>) : <p className="muted">Origin element — no parent recipe.</p>}</div>
      <div className="detail-actions"><button onClick={() => favorite(inspected.id)}>{game.favorites.includes(inspected.id) ? '★ Favorited' : '☆ Favorite'}</button><button onClick={() => { placeOnWorkbench(inspected.id); setMode('workbench'); setInspectId(null) }}>Place</button><button disabled={!recipesForMaterial(game.recipes, inspected.id).length} onClick={() => { splitMaterial(inspected); setInspectId(null) }}>Split</button><button onClick={() => void shareMaterial(inspected)}>Share card</button><button disabled={!recipesForMaterial(game.recipes, inspected.id).length} onClick={() => void copySignedPacket(inspected)}>Copy packet</button></div>
    </section></div>}
    {!game.settings.contributionAcknowledged && <ContributionModal onPrivacy={() => setPrivacyOpen(true)} onAccept={() => setGame((current) => ({ ...current, settings: { ...current.settings, contributionAcknowledged: true } }))} />}
    {feedbackOpen && <FeedbackModal status={status} onClose={() => setFeedbackOpen(false)} onSent={() => toast('Feedback received — thank you', 'good')} />}
    {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
    {settingsOpen && <SettingsModal game={game} onChange={(settings) => setGame((current) => ({ ...current, settings }))} onClose={() => setSettingsOpen(false)} />}
    {importCandidate && <ImportModal candidate={importCandidate} onClose={() => setImportCandidate(null)} onMerge={() => { setGame((current) => mergeGames(current, importCandidate)); setImportCandidate(null); toast('Worlds merged', 'good'); signal('world.imported', 'inventory', { mode: 'merge' }) }} onReplace={() => { setGame(importCandidate); setImportCandidate(null); toast('World replaced', 'good'); signal('world.imported', 'inventory', { mode: 'replace' }) }} />}
    <div className="toast-stack" aria-live="polite">{toasts.map((item) => <div className={`toast ${item.tone}`} key={item.id}>{item.message}</div>)}</div>
  </div>
}
