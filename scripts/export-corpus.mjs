import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'frontend/src/data/corpus.ts')
const outputPath = resolve(root, process.argv[2] || 'data/corpus/vectorcraft-deterministic-v2.jsonl')
const source = await readFile(sourcePath, 'utf8')
const expression = /\{ inputs: \['([^']+)', '([^']+)'\], name: '([^']+)', emoji: '([^']+)', description: '([^']+)' \}/g
const recipes = [...source.matchAll(expression)].map((match) => ({
  schemaVersion: 1,
  license: 'CC0-1.0',
  engineVersion: 'vectorcraft-deterministic-v2',
  inputs: [match[1], match[2]].sort((first, second) => first.localeCompare(second)),
  output: { name: match[3], emoji: match[4], description: match[5] },
}))

if (recipes.length === 0) throw new Error(`No corpus recipes parsed from ${sourcePath}`)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${recipes.map((recipe) => JSON.stringify(recipe)).join('\n')}\n`)
console.log(`Exported ${recipes.length} deterministic CC0 recipes to ${outputPath}`)
