# GREENRAILS Receipt Verification

Status: declarative draft with reference implementation. Tier: T5 (SENTINEL-6).
Monitor: `monitors/greenrails-settlement.yaml`. Implementation: `src/receipts/greenrails.ts`.
Tests: `tests/greenrails-receipt.test.ts`.

All GREENRAILS surfaces are MOCK and must display exactly:
`MOCK SETTLEMENT · NO FUNDS WILL MOVE`.

## Purpose

SENTINEL-6 independently recomputes and checks every settlement receipt so that
(a) a tampered receipt is detected and (b) a mock receipt can never be mistaken for a
live one. SENTINEL verifies; it does not sign, release, or grant authority.

## Receipt shape

```json
{
  "domain": "agentropolis.greenrails.receipt.mock.v1",
  "body": {
    "settlementId": "grs_...", "quoteId": "grq_...",
    "idempotencyKey": "greenrails:release:grq_...:payrail:1",
    "transition": "USDC_RELEASED -> RECEIPT_FINALIZED",
    "state": "RECEIPT_FINALIZED",
    "mandateHash": "<sha256>", "actorId": "...", "decision": "ALLOW",
    "evidenceHashes": ["<nft transfer evidence>", "<usdc release evidence>"],
    "banner": "MOCK SETTLEMENT · NO FUNDS WILL MOVE",
    "timestamp": "2026-09-08T00:00:00Z",
    "previousHash": "<sha256 of prior receipt, optional>"
  },
  "hash": "<sha256 of canonical body>",
  "signature": "<sha256(domain || 0x00 || hash)>"
}
```

## Procedure

1. Domain check. `domain` must be in the allowlist. While `live_funds_enabled` is
   false the allowlist is exactly `["agentropolis.greenrails.receipt.mock.v1"]`. Any
   other domain, including a plausible-looking `...live.v1`, fails with `UNKNOWN_DOMAIN`.
2. Canonicalize body. Sort object keys recursively, no whitespace, JSON string
   encoding for scalars (`canonicalReceiptHash`). Key order in transit is irrelevant.
3. Recompute hash. `sha256(canonical body)` must equal `hash`, else `HASH_MISMATCH`.
4. Recompute signature. Mock signature is `sha256(domain || 0x00 || hash)`. The domain
   separator is inside the signed material, so a mock signature never validates under
   any other domain (`SIGNATURE_MISMATCH`). Live signing is undefined until all four
   AEGIS launch gates are closed; there is no live key.
5. Banner check. `body.banner` must be byte-exact `MOCK SETTLEMENT · NO FUNDS WILL MOVE`
   (U+00B7 middle dot), else `BANNER_MISSING`.
6. State check. `body.state` must be one of the canonical names, else `UNKNOWN_STATE`.
7. Dual-evidence check. `RECEIPT_FINALIZED` requires at least two evidence hashes
   (NFT transfer confirmed + USDC released), else `FINALIZED_WITHOUT_DUAL_EVIDENCE`.
8. Chain check (when a series is available). `previousHash` must equal the prior
   receipt's `hash`; reuse `verifyChain` semantics from `src/receipts/writer.ts`.

Any failure raises `GR-ANOM-003 receipt_signature_failures` (threshold 1 in 300s),
which halts new reservations and routes the settlement to `MANUAL_REVIEW`.

## What this does not do

- It does not prove funds moved. Nothing moves; the domain says so.
- It does not authorize a release. Only the 54T sealed signer, under an approved
  mandate and threshold, produces release receipts.
- It does not replace on-chain verification of `NFT_TRANSFER_CONFIRMED` or
  `USDC_RELEASED`; those are separate monitor inputs.

## Running

```sh
npm run check   # typecheck + build + node --test dist/tests/*.test.js
```
