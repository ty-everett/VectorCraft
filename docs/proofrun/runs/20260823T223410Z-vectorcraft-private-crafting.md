# ProofRun Record: VectorCraft private local-AI crafting and semantic search, v0.3

- ProofRun version: `1`
- Flow definition: `docs/proofrun/flows/vectorcraft-private-crafting.proofrun.yaml`
- Run ID: `20260823T223410Z-vectorcraft-private-crafting`
- Started at: `2026-08-23T22:23:32Z`
- Completed at: `2026-08-23T22:34:10Z`
- Outcome: `pass`
- Operator: `Codex`

## Scope

- Environment: production at `https://vectorcraft.metanet.app`
- Candidate release: `d438ea50e227001c97f0a1ac3baf0e9de77a4a5c`
- Desktop: production browser with WebGPU
- Mobile: iPhone 16 simulator, iOS 18.5 Safari in a fresh private session
- Spend: no wallet, blockchain confirmation, or transaction was required

## Results

| Step | Result | Evidence |
| --- | --- | --- |
| Production preflight | pass | HTTPS returned 200, UserCom health returned 200, and the CARS deployment was 2/2 Ready with zero restarts across server2 and server3. |
| Desktop local-AI craft | pass | `Air + DNA` produced `Living Being`, labeled `LOCAL AI`, using the desktop WebGPU SmolLM2 360M profile; signals `7045137` and `7045140` record contribution and success. |
| iPhone Safari local-AI craft | pass | `Air + DNA` produced `Oxygen`, labeled `LOCAL AI`, in about 50 seconds using the portable single-threaded WASM SmolLM2 135M profile; Safari did not crash, hang, or fall back. Signals `7045125` and `7045128` record contribution and success. |
| Mobile memory discipline | pass | The portable profile disposed MiniLM before generation and disposed the generator before reloading MiniLM, retaining only bounded raw vectors between phases. |
| Semantic search | pass | The desktop query `biology` ranked `Living Being` and DNA-related materials; the model panel reported `Semantic search ready`, confirming the MiniLM path loaded and scored the inventory. |
| Responsive interaction | pass | The first-run disclosure, mode switch, selected materials, inventory controls, craft action, result card, and `LOCAL AI` provenance remained operable at the iPhone viewport. |
| Diagnostics | pass | Final-release UserCom signals contain no `client.*error` event; the browser console reported zero errors and warnings. |

## Privacy And Reliability

- Inference, prompts, raw responses, embeddings, inventory, and game state remained in the browser.
- Players explicitly acknowledge final-recipe contribution; the Privacy notice lists every contributed field and every local exclusion.
- Standard operational telemetry remains content-redacted. Exact recipe content appears only in the separately signed `recipe.contributed` packet.
- The iPhone Safari profile avoids unsupported Safari WebGPU and cross-origin-isolation requirements while providing a deterministic WASM path.

## Evidence

- GitHub Actions run: `32670372891`
- CARS deployment: `0784146366745a68b3baa39ec6bc565b`
- iPhone screenshot: `network-ops/artifacts/proofrun/ty-everett/VectorCraft/20260823T222744Z-v03-safari-local-ai/ios-safari-v03-local-ai.png`
- iPhone UserCom signals: `7045119`, `7045122`, `7045125`, `7045128`, `7045131`
- Desktop UserCom signals: `7045134`, `7045137`, `7045140`, `7045143`, `7045158`
- Final-release client error signals: `0`
