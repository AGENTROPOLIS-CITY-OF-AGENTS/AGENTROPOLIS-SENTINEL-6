# SENTINEL-6 System Watch Verification Pack — 2026-09-27

## Hermes adversarial cases
- forged email display name / header smuggling
- multiple SPF/DKIM/DMARC clauses and mismatched alignment
- corrupt backup snapshot advertised as successful restore
- duplicate transcript persistence
- source-completion runaway / ENOSPC
- cron error redaction
- plugin installed but not loaded after boot
- update then Kanban worker spawn
- same-name local/remote profile route collision
- long Slack payload fallback

## SAM adversarial cases
- two-router restart/recovery
- JS<->Python cross-router reachability
- relay reservation loss/reacquisition
- constrained JS Datalog budget
- 300+ Python stream cycles
- dropped gossip with key/ban/policy pull reconciliation
- encoded dot-segment ingress
- browser origin/reload/revocation continuity

## APCP closure
For any repo claiming APCP compliance, SENTINEL requires evidence of:
F2 capability mapping
F3 architecture/polyglot review
F4 AEGIS review
F5 independent SENTINEL verification
signed compliance receipt

Enrollment alone is never compliance.
