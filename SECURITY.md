# Security policy

Please report security vulnerabilities privately to the repository owner rather than opening a public issue. Include the affected release, browser/OS, reproduction steps, and impact, but do not send active secrets or private wallet material.

VectorCraft has no application backend, account system, or server-side inference. Its network dependencies are static application delivery through CARS, open model files from Hugging Face, and UserCom recipe contributions, feedback, and privacy-bounded diagnostics. Releases are built from GitHub Actions and deployed with a repository-scoped CARS identity.

Recipe packets use a P-256 signing key stored as a device-local JWK. The private JWK never leaves browser storage; only the public JWK and ECDSA-SHA256 signature are contributed. Signatures establish packet integrity and a stable anonymous device identity, not authorship, safety, copyright clearance, or wallet identity. The corpus staging tool verifies signatures and independent-device support, but all promotions remain human-reviewed source changes.

The browser worker uses fixed open-model identifiers, deterministic greedy decoding, strict output parsing, and a deterministic safe fallback. MiniLM semantic collapse prevents near-duplicate inventory growth at a fixed `0.86` threshold. No contributed text is executed as code or automatically loaded into the production corpus.
