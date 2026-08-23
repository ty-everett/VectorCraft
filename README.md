# VectorCraft

VectorCraft is a private-by-design crafting game where every novel combination is invented by an open-weights language model running locally in the player's browser. There is no inference API, application server, or account.

Production: [vectorcraft.metanet.app](https://vectorcraft.metanet.app)

Source: [github.com/ty-everett/VectorCraft](https://github.com/ty-everett/VectorCraft)

## Local AI stack

- **Crafting on supported Chromium/WebGPU:** `HuggingFaceTB/SmolLM2-360M-Instruct`, using the compact Apache-2.0 `q4f16` ONNX artifact.
- **Crafting on Safari, iPhone, and WASM-only browsers:** `HuggingFaceTB/SmolLM2-135M-Instruct`, using the Apache-2.0 8-bit ONNX artifact. Apple WebKit is pinned to single-threaded WASM for compatibility.
- **Semantic inventory search:** `Xenova/all-MiniLM-L6-v2`, a 384-dimensional Apache-2.0 sentence-embedding model running through Transformers.js.
- **Storage:** recipes and discoveries stay in `localStorage`; Transformers.js stores downloaded model artifacts in the browser cache.

The model files are fetched from Hugging Face only when needed. Inference and semantic search happen on-device. The initial model download is approximately 272 MB on WebGPU or 137 MB on the portable WASM profile; the embedding model is approximately 23 MB.

## Feedback, diagnostics, and privacy

VectorCraft submits privacy-bounded product events, client crashes, unhandled promise rejections, worker errors, and local-model failures to UserCom. Events contain the release, event name, browser-provided user agent, viewport, runtime profile, connectivity state, safe error class/message/stack, and source-map coordinates. The client recursively redacts secret-shaped keys and values and never includes prompts, model output, discoveries, recipes, wallet data, or raw application state.

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

## Attribution and licensing

This repository is a fork of [BloodyFish/OpenAlchemy](https://github.com/BloodyFish/OpenAlchemy) and preserves the upstream history. VectorCraft replaces the former Python/NiceGUI and Gemini implementation with a new static React/TypeScript application.

The new VectorCraft implementation is MIT licensed. OpenAlchemy did not declare a license when it was forked, so its historical commits are not relicensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.
