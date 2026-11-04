---
description: Security review for NMT Academy changes
---
Security review the diff.

Must-check:
- AuthN/AuthZ bypasses
- IDOR on attempts, notes, mistakes, exports
- Secret leakage in logs/client bundles
- XSS via lesson HTML (content is text — keep it that way)
- CSRF/cookie flags assumptions
- Dangerous scripts touching production SQLite
- Dependency or workflow permission issues

Report only confirmed or strongly evidenced issues with paths.
