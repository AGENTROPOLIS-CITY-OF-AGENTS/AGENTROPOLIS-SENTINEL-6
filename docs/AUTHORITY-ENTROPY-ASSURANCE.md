# SENTINEL-6 Authority Entropy Assurance

Status: ASSURANCE REQUIREMENT  
Date: 2026-09-18

SENTINEL-6 must verify the executable reality of AGENTROPOLIS authority graphs, capability leases, revocation propagation, and economic/physical blast-radius controls.

## New assurance questions

For every privileged workflow:

1. What authority graph edge makes the action reachable?
2. Who granted the edge?
3. Is the lease still valid?
4. Can the actor delegate it?
5. What downstream systems become reachable?
6. Does revocation remove descendants?
7. Can retries or concurrency exceed the intended limit?
8. Can a connector session bypass current AEGIS policy?
9. Can context continuity leak permission continuity?
10. Can settlement or device state mutate without a verified receipt?

## Pressure scenarios

SENTINEL-6 should adversarially test:

- stolen session with valid connector cookies/tokens;
- compromised forum or collaboration identity;
- prompt-injected privileged agent;
- subagent attempting authority amplification;
- expired lease replay;
- duplicate economic settlement;
- cross-chain partial failure;
- stale rail capability metadata;
- Arc adapter finality mismatch;
- missing or forged receipt;
- revoked parent with active child lease;
- context capsule imported into a runtime with different permissions;
- physical action emitted from unverified model output.

## Authority entropy evidence

Track:

- number of active privileged edges;
- average and maximum delegation depth;
- stale edges;
- orphaned child leases;
- uncovered connectors;
- unreceipted privileged actions;
- economic exposure;
- cross-rail exposure;
- physical-impact exposure.

## Closure rule

A security fix is not closed until SENTINEL-6 can produce evidence that:

- the vulnerable authority path is removed or bounded;
- descendant authority was revoked where required;
- replay and retry paths do not restore the privilege;
- receipts demonstrate the intended new behavior;
- blast radius is recomputed;
- high-risk downstream consumers are re-audited.

## Arc-specific assurance

When PAYRAIL selects Arc, SENTINEL-6 verifies the configured/discovered rail profile rather than assuming static provider behavior.

Tests should cover:

- chain identity;
- supported asset;
- current gas mode;
- max fee bound;
- deterministic finality expectation;
- recipient binding;
- replay / idempotency;
- cross-chain adapter state;
- entitlement mutation only after verified policy-required finality.

Provider capability is evidence, not authority.
