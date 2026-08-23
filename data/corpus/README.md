# VectorCraft deterministic corpus

`vectorcraft-deterministic-v2.jsonl` is the shipped, reviewed recipe corpus generated from `frontend/src/data/corpus.ts`. Its original VectorCraft recipes are released under CC0-1.0 so they can be evaluated, transformed into forward/inverse fine-tuning examples, and reused by the project.

Regenerate it with:

```bash
npm run corpus:export
```

UserCom `recipe.contributed` exports can be staged with:

```bash
npm run corpus:stage -- /path/to/usercom-export.json data/corpus/candidates.json 2
```

Pass `-` as the export path to read a UserCom JSON export from standard input.

The staging tool recursively finds `vectorcraft.recipe.v1` packets, verifies every P-256 signature, excludes semantic-collapse outcomes, counts support once per public device key, and requires two independent devices by default. Staged candidates still require human safety/quality review and an offline MiniLM near-duplicate sweep before promotion into `corpus.ts`. Promotion is always an explicit source change, so a release maps every known pair to one repeatable result.

The contribution packet is a provenance signal, not proof that a recipe is safe, original, or correct. Clan tags never affect the recipe result and are not used as an endorsement signal.
