import type { RecipeContribution, SignedRecipePacket } from '../types'

const IDENTITY_KEY = 'vectorcraft:signing-identity:p256:v1'

interface StoredIdentity { publicKey: JsonWebKey; privateKey: JsonWebKey }

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((value) => { binary += String.fromCharCode(value) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function canonicalPayload(payload: RecipeContribution): string {
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

async function identity(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; publicJwk: JsonWebKey }> {
  const stored = localStorage.getItem(IDENTITY_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredIdentity
      const publicKey = await crypto.subtle.importKey('jwk', parsed.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
      const privateKey = await crypto.subtle.importKey('jwk', parsed.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
      return { publicKey, privateKey, publicJwk: parsed.publicKey }
    } catch {
      localStorage.removeItem(IDENTITY_KEY)
    }
  }
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk }))
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, publicJwk }
}

export async function signRecipe(payload: RecipeContribution): Promise<SignedRecipePacket> {
  const keys = await identity()
  const bytes = new TextEncoder().encode(canonicalPayload(payload))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, bytes)
  return {
    type: 'vectorcraft.recipe.v1',
    payload,
    signer: { algorithm: 'ECDSA-P256-SHA256', publicKey: keys.publicJwk },
    signature: encodeBase64Url(new Uint8Array(signature)),
  }
}
