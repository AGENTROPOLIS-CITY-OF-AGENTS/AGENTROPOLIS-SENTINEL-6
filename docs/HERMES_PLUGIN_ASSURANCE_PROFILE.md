# Hermes Plugin Assurance Profile

## Purpose

Hermes plugins are executable capabilities. Catalog presence is an upstream trust signal, not authorization to run inside AGENTROPOLIS.

Sentinel-6 provides the independent assurance layer between catalog discovery and governed execution.

## Assurance path

```text
Hermes catalog candidate
  -> provenance capture
  -> pinned SHA verification
  -> manifest/capability declaration review
  -> static + dependency + secret-handling review
  -> runtime permission classification
  -> behavior/sandbox validation where feasible
  -> drift/entropy assessment
  -> risk tier
  -> assurance receipt
  -> Skill/Capability Registry status
```

## Required checks

### Provenance
- exact repository
- exact 40-character commit SHA
- catalog entry identity
- maintainer/source metadata
- update path
- removed/revoked status

### Capability declaration
Compare declared behavior with observed or inspectable behavior:
- tools
- hooks
- middleware
- required environment variables
- network access
- filesystem access
- process/shell access
- device/computer-use access
- browser access
- storage writes
- external service writes
- credential classes

Undeclared capability creep is a security failure.

### Credential handling
Reject or restrict plugins that:
- read arbitrary secret stores
- log secret values
- transmit credentials outside declared endpoints
- depend on ambient/global credentials when scoped credentials can be used
- self-update executable code outside the pinned/reviewed path

### Update rules
A change in any of the following invalidates the previous assurance epoch until reviewed:
- pinned SHA
- declared capability set
- dependency graph with material execution impact
- credential requirements
- platform/runtime requirements
- install/bootstrap code
- network destinations

## Risk tiers

Suggested defaults:

- **LOW**: read-only transforms, local parsing, no secrets, no external writes
- **MEDIUM**: authenticated reads, limited storage writes, bounded SaaS actions
- **HIGH**: shell/process control, browser automation, CRM mutation, media project mutation, device control, production writes
- **CRITICAL**: financial execution, identity/permission mutation, secrets administration, destructive infrastructure, irreversible external effects

ATG may raise the effective risk tier based on the requested operation even if the plugin's baseline tier is lower.

## District Capability Packs

Packs do not receive one blanket assurance decision. Every plugin inside a pack retains its own assurance state and epoch.

Initial pack classes:
- Voice Gateway
- Media Production
- 54.TAILORS
- Gaming Runtime
- Continuity / Memory
- Business Operations
- Sentinel / 54T Security

## Assurance receipt

Every reviewed plugin should produce a signed/traceable assurance receipt containing:
- plugin identity
- repository
- pinned SHA
- capability fingerprint
- observed/declarative delta
- risk tier
- permitted operation classes
- denied operation classes
- credential classes
- review timestamp
- reviewer/toolchain provenance
- expiry/review trigger
- assurance state: approved | restricted | denied | revoked

## Runtime rule

A plugin may execute only when the Execution Envelope references an assurance state valid for the same capability epoch.

If the plugin SHA or capability fingerprint no longer matches the assured epoch, fail closed and return the item to review.

## Sentinel posture

Treat third-party capability code as potentially compromised until evidence says otherwise. Catalog curation lowers uncertainty; it does not eliminate it.

Architecture limits exposure. Governance limits failure.
