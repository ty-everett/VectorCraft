# VectorCraft

VectorCraft is a browser-native crafting game where every novel combination is invented by an open-weights language model running locally in the player's browser. There is no inference API, application server, or account. Crafting is order-independent and deterministic for a fixed engine/model profile: the same ingredient pair resolves through greedy decoding without sampling, with semantic duplicates collapsed into the existing item.

Production: [vectorcraft.metanet.app](https://vectorcraft.metanet.app)

Source: [github.com/ty-everett/VectorCraft](https://github.com/ty-everett/VectorCraft)

## Local AI stack

- **Crafting on supported Chromium/WebGPU:** `HuggingFaceTB/SmolLM2-360M-Instruct`, using the compact Apache-2.0 `q4f16` ONNX artifact.
- **Crafting on Safari, iPhone, and WASM-only browsers:** `HuggingFaceTB/SmolLM2-135M-Instruct`, using the Apache-2.0 8-bit ONNX artifact. Apple WebKit is pinned to single-threaded WASM for compatibility.
- **Semantic inventory search and duplicate collapse:** `Xenova/all-MiniLM-L6-v2`, a 384-dimensional Apache-2.0 sentence-embedding model running through Transformers.js. Generated candidates at or above cosine similarity `0.86` merge into the nearest existing item.
- **Storage:** recipes and discoveries stay in `localStorage`; Transformers.js stores downloaded model artifacts in the browser cache.

The model files are fetched from Hugging Face only when needed. Inference and semantic search happen on-device. The initial model download is approximately 272 MB on WebGPU or 137 MB on the portable WASM profile; the embedding model is approximately 23 MB.

## Game systems

- A reviewed 50-recipe deterministic corpus makes early discoveries immediate, while unknown pairs use local AI.
- Forge and spatial Workbench modes support touch, pointer, keyboard, duplicate, split, provenance, favorites, sorting, semantic search, versioned import/merge/export, and recipe recall.
- Daily challenges, six achievements, procedural Web Audio cues, optional haptics, generated share cards, and optional clan tags provide growth loops without an account or server-owned game state.
- Save schema v2 migrates existing v1 worlds and records stable material/recipe identity, generation, provenance, use counts, workbench layout, challenge state, achievements, and settings.

## Recipe contributions, feedback, diagnostics, and privacy

After an explicit first-run acknowledgement, every craft queues an exact anonymous recipe contribution to UserCom: the ingredient names/emoji, final name/emoji/description, source/outcome, generation, semantic-collapse score when applicable, model profile, optional daily challenge and clan tag, timestamp, release, and a device-local P-256 public key/signature. The private key, prompt, raw model response, inventory, workspace, favorites, wallets, transactions, secrets, and unrelated state stay local. Contributions are CC0 and retry after network interruption.

Separate privacy-bounded product and crash events contain the release, event name, browser-provided user agent, viewport, runtime profile, connectivity state, safe error class/message/stack, and source-map coordinates. This standard telemetry path recursively redacts craft content and secret-shaped keys and values.

The in-product feedback form sends only the text a player enters, an optional reply email, the chosen topic, and—when the checkbox remains enabled—the same bounded release/browser/model diagnostics. See [PRIVACY.md](PRIVACY.md), [SUPPORT.md](SUPPORT.md), and [SECURITY.md](SECURITY.md).

## Develop

```bash
npm ci
npm --prefix frontend ci
npm run verify
npm run dev
```

The Vite development server listens on `http://localhost:4173`.

## Deployment

VectorCraft is a frontend-only BRC-102 application deployed through Babbage CARS. Pushes to `main` run verification, construct a CARS artifact, preflight the dedicated deploy identity, ensure project balance, and publish the release. The only repository secret is the scoped `CARS_PRIVATE_KEY` deploy identity.

Operational ownership, DNS, monitoring, release evidence, and commercial-readiness accounting live in `ty-everett/network-ops`. Production readiness intentionally excludes only the Metanet App Catalogue listing.

## Corpus curation

`npm run corpus:export` regenerates the reviewed CC0 JSONL corpus in `data/corpus`. `npm run corpus:stage -- <usercom-export.json>` verifies contributed P-256 signatures, counts independent device support, excludes collapse outcomes, and stages candidates for human and offline semantic review. Contributions never automatically change production; promotion is a reviewed source commit so every release remains deterministic. See [data/corpus/README.md](data/corpus/README.md).

## Attribution and licensing

This repository is a fork of [BloodyFish/OpenAlchemy](https://github.com/BloodyFish/OpenAlchemy) and preserves the upstream history. VectorCraft replaces the former Python/NiceGUI and Gemini implementation with a new static React/TypeScript application.

The new VectorCraft implementation is MIT licensed. OpenAlchemy did not declare a license when it was forked, so its historical commits are not relicensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.
