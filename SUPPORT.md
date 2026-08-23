# VectorCraft support

Use the **Feedback** control in the VectorCraft footer for bugs, local-AI problems, accessibility feedback, and feature ideas. It accepts anonymous reports and can attach privacy-bounded release/browser/model diagnostics. Public, reproducible issues may also be filed at <https://github.com/ty-everett/VectorCraft/issues>.

For local-AI problems, include the device model, OS/browser version, whether the model download showed progress, and the exact visible error or fallback label. Do not include passwords, wallet keys, authentication tokens, transaction material, or private personal data.

VectorCraft preserves play when local inference fails by creating a deterministic `LOCAL FALLBACK` result. That label indicates the game recovered but the language model did not complete; please report it when it repeats.

If a recipe contribution or bounded diagnostic event cannot be delivered, it remains in a bounded browser queue and retries; crafting is never blocked. Clearing all site data removes pending records and the anonymous signing identity. The ordinary Reset button intentionally preserves them.
