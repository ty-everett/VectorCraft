# ProofRun Record: VectorCraft feedback, crash observability, and safe recovery

- ProofRun version: `1`
- Flow definition: `docs/proofrun/flows/vectorcraft-feedback-recovery.proofrun.yaml`
- Run ID: `20260823T210540Z-vectorcraft-feedback-recovery`
- Started at: `2026-08-23T20:26:46Z`
- Completed at: `2026-08-23T21:05:40Z`
- Outcome: `pass`
- Operator: `Codex`

## Scope

- Environment: controlled local failure proof plus production feedback acknowledgement
- Production release: `5d4c6a6c5ee99a160460edb0f7d57da4c4e35c6a`
- Feedback marker: public-safe production ProofRun marker with no email or personal data

## Results

| Step | Result | Evidence |
| --- | --- | --- |
| Privacy disclosure | pass | The production Privacy control disclosed local game content, bounded UserCom telemetry, diagnostic fields, and exclusions. |
| Anonymous feedback | pass | The production form acknowledged the submission without changing play state. |
| UserCom persistence | pass | Feedback row `312` exists with `source=vectorcraft`, `surface=feedback-form`, `status=new`, and subject `VectorCraft: idea`. |
| Feedback telemetry | pass | Signals `7042023` and `7042026` record `feedback.submitted` and `feedback.client_acknowledged`; the acknowledgement includes the exact release and `diagnostics=true`. |
| Controlled worker failure | pass | Local QA signal `7040700` captured `client.worker_error` with operation, runtime profile, model label, safe error name/message, and stack location. |
| Safe recovery | pass | Correlated signal `7040703` recorded `craft.fallback_succeeded`; crafting remained available and later production iPhone inference succeeded locally. |
| Redaction | pass | Telemetry inspection found no prompts, discoveries, raw model output, wallet/transaction data, secrets, or feedback body in signal context. |

## Reliability Notes

- Error collection covers global browser errors, unhandled promises, React render failures, worker failures, and local-model timeouts.
- Worker diagnostics include release, operation, safe error fields, runtime/profile/model metadata, and source-map coordinates.
- Telemetry and feedback delivery are best-effort and do not block the game.
- The controlled incompatibility was intentionally confined to the local QA origin; production Safari completed with `LOCAL AI`.

## Evidence

- Production UserCom feedback row: `312`
- Production feedback signals: `7042023`, `7042026`
- Controlled recovery signals: `7040700`, `7040703`
- UserCom health: HTTP 200

