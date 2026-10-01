import test from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_BANNER,
  MOCK_RECEIPT_DOMAIN,
  SUCCESS_STATES,
  FAILURE_STATES,
  canonicalReceiptHash,
  sealMockReceipt,
  verifyGreenrailsReceipt,
  type GreenrailsReceiptBody,
} from "../src/receipts/greenrails.js";

const body = (): GreenrailsReceiptBody => ({
  settlementId: "grs_01",
  quoteId: "grq_01",
  idempotencyKey: "greenrails:release:grq_01:payrail:1",
  transition: "USDC_RELEASED -> RECEIPT_FINALIZED",
  state: "RECEIPT_FINALIZED",
  mandateHash: "ab".repeat(32),
  actorId: "sentinel-6",
  decision: "ALLOW",
  evidenceHashes: ["nft".padEnd(64, "0"), "usdc".padEnd(64, "0")],
  banner: MOCK_BANNER,
  timestamp: "2026-09-08T00:00:00Z",
});

test("canonical hash is independent of key order", () => {
  const a = body();
  const b = Object.fromEntries(Object.entries(a).reverse()) as unknown as GreenrailsReceiptBody;
  assert.equal(canonicalReceiptHash(a), canonicalReceiptHash(b));
});

test("sealed mock receipt verifies and carries mock domain", () => {
  const r = sealMockReceipt(body());
  assert.equal(r.domain, MOCK_RECEIPT_DOMAIN);
  assert.deepEqual(verifyGreenrailsReceipt(r), { ok: true, failures: [] });
});

test("tampered body fails hash and signature", () => {
  const r = sealMockReceipt(body());
  const tampered = { ...r, body: { ...r.body, decision: "DENY" } };
  const v = verifyGreenrailsReceipt(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.failures.includes("HASH_MISMATCH"));
  assert.ok(v.failures.includes("SIGNATURE_MISMATCH"));
});

test("receipt under a non-mock domain is rejected even with a consistent signature", () => {
  const r = sealMockReceipt(body());
  const live = { ...r, domain: "agentropolis.greenrails.receipt.live.v1" };
  const v = verifyGreenrailsReceipt(live);
  assert.equal(v.ok, false);
  assert.ok(v.failures.includes("UNKNOWN_DOMAIN"));
  assert.ok(v.failures.includes("SIGNATURE_MISMATCH"));
});

test("mock banner must be byte-exact", () => {
  const r = sealMockReceipt({ ...body(), banner: "MOCK SETTLEMENT - NO FUNDS WILL MOVE" });
  assert.ok(verifyGreenrailsReceipt(r).failures.includes("BANNER_MISSING"));
});

test("RECEIPT_FINALIZED requires NFT and USDC evidence", () => {
  const r = sealMockReceipt({ ...body(), evidenceHashes: ["nft".padEnd(64, "0")] });
  assert.ok(verifyGreenrailsReceipt(r).failures.includes("FINALIZED_WITHOUT_DUAL_EVIDENCE"));
});

test("canonical state names are exact", () => {
  assert.deepEqual([...SUCCESS_STATES], [
    "QUOTED", "USDC_RESERVED", "INPUT_AUTHORIZED", "XENTS_ROUTED",
    "NFT_TRANSFER_PENDING", "NFT_TRANSFER_CONFIRMED", "USDC_RELEASED", "RECEIPT_FINALIZED",
  ]);
  assert.equal(FAILURE_STATES.length, 10);
  const r = sealMockReceipt({ ...body(), state: "COMPLETE" as never });
  assert.ok(verifyGreenrailsReceipt(r).failures.includes("UNKNOWN_STATE"));
});
