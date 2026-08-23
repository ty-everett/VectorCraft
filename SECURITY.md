# Security policy

Please report security vulnerabilities privately to the repository owner rather than opening a public issue. Include the affected release, browser/OS, reproduction steps, and impact, but do not send active secrets or private wallet material.

VectorCraft has no application backend, account system, or server-side inference. Its network dependencies are static application delivery through CARS, open model files from Hugging Face, and privacy-bounded UserCom feedback/diagnostics. Releases are built from GitHub Actions and deployed with a repository-scoped CARS identity.
