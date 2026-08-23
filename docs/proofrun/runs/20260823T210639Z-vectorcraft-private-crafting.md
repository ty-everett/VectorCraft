# ProofRun Record: VectorCraft private local-AI crafting and semantic search

- ProofRun version: `1`
- Flow definition: `docs/proofrun/flows/vectorcraft-private-crafting.proofrun.yaml`
- Run ID: `20260823T210639Z-vectorcraft-private-crafting`
- Started at: `2026-08-23T20:59:28Z`
- Completed at: `2026-08-23T21:06:39Z`
- Outcome: `pass`
- Operator: `Codex`

## Scope

- Environment: production at `https://vectorcraft.metanet.app`
- Candidate release: `5d4c6a6c5ee99a160460edb0f7d57da4c4e35c6a`
- Desktop: production browser with WebGPU
- Mobile: iPhone 16 simulator, iOS 18.5 Safari
- Spend: no wallet or blockchain transaction was required

## Results

| Step | Result | Evidence |
| --- | --- | --- |
| Production preflight | pass | HTTPS returned 200 and the CARS workload was 2/2 Ready on server2 and server3. |
| Desktop novel craft | pass | A fresh pair produced `Dna 2`, labeled `LOCAL AI`; the model panel reported WebGPU and SmolLM2 360M Instruct. |
| iPhone Safari novel craft | pass | After resetting the disposable simulator world, a fresh pair produced `Steam`, labeled `LOCAL AI`, without fallback or a page hang. |
| Runtime telemetry | pass | UserCom signal `7042032` records desktop WebGPU/SmolLM2 360M (~272 MB); signal `7042011` records iPhone `portable-wasm`/SmolLM2 135M (~137 MB), both on the candidate release. |
| Semantic search | pass | Searching `biology` ranked DNA first in the desktop production browser; the same local MiniLM search path was exercised in iPhone Safari during candidate QA. |
| Persistence and recall | pass | Reload preserved the disposable world and repeated recipes returned through the recall path without another model load. |

## Privacy And Reliability

- Prompts, selected materials, discoveries, model output, and game state remained in the browser.
- UserCom received only the release, runtime profile, bounded counts, acquisition class, and safe operational fields.
- The iPhone Safari profile used single-threaded ONNX WASM to avoid unsupported Safari WebGPU and cross-origin-isolation requirements.
- The simulator world was reset before the final novel craft so stale malformed QA recipes could not satisfy the proof.

## Evidence

- CARS deployment: `e0044d6e523575d89b21d29342e2a299`
- GitHub Actions run: `32665970367`
- Raw iPhone evidence: `network-ops/artifacts/proofrun/ty-everett/VectorCraft/20260823T210400Z-safari-local-ai/ios-safari-local-ai-success.jpeg`

