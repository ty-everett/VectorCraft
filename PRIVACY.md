# VectorCraft privacy notice

Last updated: 2026-08-23

VectorCraft runs model inference in the player's browser. Model prompts, raw model responses, the complete inventory, workspace layout, favorites, saved progress, private signing key, and model cache are not sent to VectorCraft or UserCom. Model files are downloaded from Hugging Face and cached by the browser.

After the first-run acknowledgement, every craft sends one recipe contribution to UserCom. The contribution includes:

- the two ingredient names and emoji;
- the final discovery name, emoji, and description;
- recipe and engine identifiers, source, and whether the result was new, recalled, or semantically merged;
- the merged item identifier and cosine similarity score when a duplicate is collapsed;
- generation, local model profile, daily challenge identifier when relevant, optional clan tag, and craft timestamp;
- the application release, CC0-1.0 contribution license, device-local P-256 public key, and recipe signature.

The public key is an anonymous game identity used to verify provenance and count independent support. It is not an account and is not connected to a wallet. The matching private key stays in browser storage. Contributions retry from a bounded local queue when connectivity returns and may be reviewed, deduplicated, and promoted into the open hard-coded corpus. Clan tags are optional, public contribution content; do not put personal or sensitive information in them.

VectorCraft separately sends limited operational events and error reports to UserCom so the project can measure whether the game works and diagnose crashes. These records can include the event name, time, release commit, page path without query parameters, explicitly supplied campaign parameters, broad direct/internal/external referrer class, browser-provided user agent, language, viewport, broad mobile/browser/runtime profile, online and connection state, safe error class/message/stack, and an app-generated anonymous/session identifier. The full referrer and URL query are not sent. Secret-shaped keys, email-shaped values, long encoded values, prompts, responses, craft content, transactions, wallet material, and raw application state are removed from this standard telemetry path. Exact recipes are sent only through the separately disclosed signed contribution path above.

The feedback form sends the text and topic a player enters. Email is optional and used only to reply. If “Include diagnostics” is selected, the feedback also includes the bounded release, browser, viewport, model profile, and connectivity fields described above.

Saved game progress can be removed with the game's Reset control; the local signing identity, pending contributions, bounded pending diagnostic queue, and model caches can be removed with the browser's site-data controls. Contributions, operational events, and feedback records are retained for corpus curation, product support, reliability analysis, and abuse prevention under the operator's normal UserCom retention practices.

Questions or deletion requests can be opened through the in-product Feedback control or the public repository's issue tracker. Do not include secrets, wallet keys, or private transaction data in feedback or issues.
