# ProofRun Record: VectorCraft deterministic corpus and signed contribution integrity

- ProofRun version: `1`
- Flow definition: `docs/proofrun/flows/vectorcraft-deterministic-corpus.proofrun.yaml`
- Run ID: `20260823T223400Z-vectorcraft-deterministic-corpus`
- Started at: `2026-08-23T22:10:45Z`
- Completed at: `2026-08-23T22:34:00Z`
- Outcome: `pass`
- Operator: `Codex`

## Scope

- Environment: production at `https://vectorcraft.metanet.app`
- Candidate release: `d438ea50e227001c97f0a1ac3baf0e9de77a4a5c`
- Deterministic engine: VectorCraft v2 recipe keys, CC0 reviewed corpus, and fixed browser-model profiles
- Contribution transport: UserCom `recipe.contributed` signals with anonymous P-256 signatures
- Spend: no wallet, blockchain confirmation, or transaction was required

## Results

| Step | Result | Evidence |
| --- | --- | --- |
| Exact contribution disclosure | pass | A fresh production session required the player to review the exact recipe fields, local exclusions, anonymous signature, CC0 purpose, and Privacy notice before entering the workshop. |
| Deterministic corpus craft | pass | `Earth + Earth` produced `Mountain`; a repeat used the same stable recipe and returned through `craft.recalled`. UserCom signals `7045044` and `7045056` contain the matching signed packets from the v0.3 runtime parent. |
| Deterministic local AI | pass | Generation uses sorted inputs, stable recipe IDs, greedy decoding with `do_sample=false`, deterministic fallback, a fixed prompt, and a fixed model profile. The verification suite passed all 16 tests. |
| Signed contribution integrity | pass | Two independently generated ProofRun packets replayed after the UserCom Unicode fix, and `npm run corpus:stage` verified both P-256 signatures before staging one candidate supported by two distinct device keys. |
| Semantic collapse | pass | Exact-name candidates collapsed at score `1`, including the final-release craft recorded by signals `7045146` and `7045152`. Tests cover the MiniLM `0.86` threshold, normalized embeddings, and stable-ID tie-breaking. |
| Reviewed corpus pipeline | pass | `npm run corpus:export` rebuilt the checked-in 50-recipe CC0 artifact; the staging command rejects invalid signatures, collapsed outcomes, and candidates lacking two independent devices. |
| Delivery and recall | pass | UserCom recorded `recipe.contribution_sent` for new, recalled, and collapsed outcomes. Delivery used the durable retry queue and never blocked crafting. |

## Privacy And Corpus Policy

- Only the disclosed final recipe packet is contributed: normalized inputs, final output, provenance, outcome, similarity, generation, profile, optional challenge/clan identifiers, timestamp, public key, and signature.
- Prompts, raw model responses, embeddings, inventory, search text, feedback body, and unrelated browser state stay on the device.
- Similar outputs collapse into the existing material before contribution. Collapsed outcomes remain operational evidence but are excluded from corpus promotion.
- Corpus promotion is an operator-reviewed, reproducible step; this run did not automatically publish user data into the hard-coded corpus.

## Evidence

- Application commit: `d438ea50e227001c97f0a1ac3baf0e9de77a4a5c`
- GitHub Actions run: `32670372891`
- CARS deployment: `0784146366745a68b3baa39ec6bc565b`
- UserCom Unicode fix: `p2ppsr/usercom@132c5e3ca26f2bebbb465c036ef29c224ad0fd15`
- UserCom production workflow: `32670019103`
- Production error signals for the candidate release: `0`
