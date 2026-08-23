import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'

const input = process.argv[2]
if (!input) throw new Error('Usage: npm run corpus:stage -- <usercom-export.json> [candidate-output.json] [minimum-support]')
const output = resolve(process.argv[3] || 'data/corpus/candidates.json')
const minimumSupport = Math.max(1, Number(process.argv[4] || 2))

function canonicalPayload(payload) {
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    engineVersion: payload.engineVersion,
    recipeId: payload.recipeId,
    recipeKey: payload.recipeKey,
    inputs: payload.inputs.map((item) => ({ name: item.name, emoji: item.emoji })),
    output: { name: payload.output.name, emoji: payload.output.emoji, description: payload.output.description },
    source: payload.source,
    outcome: payload.outcome,
    collapsedInto: payload.collapsedInto,
    similarity: payload.similarity,
    generation: payload.generation,
    modelProfile: payload.modelProfile,
    challengeId: payload.challengeId,
    clanTag: payload.clanTag,
    craftedAt: payload.craftedAt,
  })
}

function packetsIn(value, packets = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try { return packetsIn(JSON.parse(value), packets) } catch { return packets }
  }
  if (!value || typeof value !== 'object') return packets
  if (value.type === 'vectorcraft.recipe.v1' && value.payload && value.signer && value.signature) packets.push(value)
  for (const nested of Object.values(value)) packetsIn(nested, packets)
  return packets
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

async function verify(packet) {
  if (packet.signer?.algorithm !== 'ECDSA-P256-SHA256') return false
  try {
    const key = await webcrypto.subtle.importKey('jwk', packet.signer.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64Url(packet.signature), new TextEncoder().encode(canonicalPayload(packet.payload)))
  } catch {
    return false
  }
}

async function readInput() {
  if (input !== '-') return readFile(resolve(input), 'utf8')
  let value = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) value += chunk
  return value
}

const raw = JSON.parse(await readInput())
const packets = packetsIn(raw)
const verified = []
for (const packet of packets) if (await verify(packet)) verified.push(packet)

const groups = new Map()
for (const { payload, signer } of verified) {
  if (payload.outcome === 'collapsed') continue
  const outputKey = `${payload.recipeKey}::${payload.output.name.trim().toLocaleLowerCase('en')}`
  const group = groups.get(outputKey) || { recipeKey: payload.recipeKey, inputs: payload.inputs, output: payload.output, support: 0, signers: new Set(), sources: new Set(), firstSeen: payload.craftedAt, lastSeen: payload.craftedAt }
  const signerId = `${signer.publicKey.x || ''}.${signer.publicKey.y || ''}`
  if (!group.signers.has(signerId)) { group.signers.add(signerId); group.support += 1 }
  group.sources.add(payload.source)
  if (payload.craftedAt < group.firstSeen) group.firstSeen = payload.craftedAt
  if (payload.craftedAt > group.lastSeen) group.lastSeen = payload.craftedAt
  groups.set(outputKey, group)
}

const candidates = [...groups.values()]
  .filter((group) => group.support >= minimumSupport)
  .map((group) => ({ recipeKey: group.recipeKey, inputs: group.inputs, output: group.output, independentDeviceSupport: group.support, sources: [...group.sources].sort(), firstSeen: group.firstSeen, lastSeen: group.lastSeen, reviewState: 'pending-human-and-semantic-review' }))
  .sort((first, second) => second.independentDeviceSupport - first.independentDeviceSupport || first.recipeKey.localeCompare(second.recipeKey))

await writeFile(output, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), minimumIndependentDeviceSupport: minimumSupport, packetsFound: packets.length, signaturesVerified: verified.length, candidates }, null, 2)}\n`)
console.log(`Verified ${verified.length}/${packets.length} packets; staged ${candidates.length} candidates in ${output}`)
