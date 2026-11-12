# ENTITY54 / Hermes Security adversarial validation (draft)

Test with synthetic agents and credentials only. Cover spoofed identities, revoked/expired delegations, profile switching, runtime migration, plugin privilege escalation, prompt injection, replay, tampered security signals, unreachable AEGIS, and denied receipt integrity.

Pass criteria: zero unauthorized executions in bounded tests; no privilege inheritance on migration; no single advisory signal grants authority; independent receipt evidence. Record coverage, counterexamples, false positives, version hashes and review verdict. Not a production certification.