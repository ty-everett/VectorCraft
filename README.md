# VectorCraft

VectorCraft is a private-by-design crafting game where every novel combination is invented by an open-weights language model running locally in the player's browser. There is no inference API, application server, account, or telemetry pipeline.

Production: [vectorcraft.metanet.app](https://vectorcraft.metanet.app)

Source: [github.com/ty-everett/VectorCraft](https://github.com/ty-everett/VectorCraft)

## Local AI stack

- **Crafting:** `HuggingFaceTB/SmolLM2-360M-Instruct`, using the Apache-2.0 Transformers.js-compatible ONNX build. WebGPU uses the compact `q4f16` artifact; browsers without WebGPU fall back to quantized WASM execution.
- **Semantic inventory search:** `Xenova/all-MiniLM-L6-v2`, a 384-dimensional Apache-2.0 sentence-embedding model running through Transformers.js.
- **Storage:** recipes and discoveries stay in `localStorage`; Transformers.js stores downloaded model artifacts in the browser cache.

The model files are fetched from Hugging Face only when needed. Inference and semantic search happen on-device. The initial model download is approximately 272 MB on WebGPU and 386 MB on the WASM fallback; the embedding model is approximately 23 MB.

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

## Attribution and licensing

This repository is a fork of [BloodyFish/OpenAlchemy](https://github.com/BloodyFish/OpenAlchemy) and preserves the upstream history. VectorCraft replaces the former Python/NiceGUI and Gemini implementation with a new static React/TypeScript application.

The new VectorCraft implementation is MIT licensed. OpenAlchemy did not declare a license when it was forked, so its historical commits are not relicensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.
