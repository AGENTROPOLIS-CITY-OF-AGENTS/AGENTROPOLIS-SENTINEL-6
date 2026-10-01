import { createHash } from "node:crypto";

export const MOCK_BANNER = "MOCK SETTLEMENT · NO FUNDS WILL MOVE";
export const MOCK_RECEIPT_DOMAIN = "agentropolis.greenrails.receipt.mock.v1";

export const SUCCESS_STATES = [
  "QUOTED",
  "USDC_RESERVED",
  "INPUT_AUTHORIZED",
  "XENTS_ROUTED",
  "NFT_TRANSFER_PENDING",
  "NFT_TRANSFER_CONFIRMED",
  "USDC_RELEASED",
  "RECEIPT_FINALIZED",
] as const;

export const FAILURE_STATES = [
  "QUOTE_EXPIRED",
  "INPUT_FAILED",
  "INSUFFICIENT_LIQUIDITY",
  "NFT_OWNERSHIP_CHANGED",
  "NFT_TRANSFER_FAILED",
  "CHAIN_CONFIRMATION_TIMEOUT",
  "USDC_PAYOUT_FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "MANUAL_REVIEW",
] as const;

export type SettlementState = (typeof SUCCESS_STATES)[number] | (typeof FAILURE_STATES)[number];

export interface GreenrailsReceiptBody {
  settlementId: string;
  quoteId: string;
  idempotencyKey: string;
  transition: string;
  state: SettlementState;
  mandateHash: string;
  actorId: string;
  decision: string;
  evidenceHashes: string[];
  banner: string;
  timestamp: string;
  previousHash?: string;
}

export interface SignedGreenrailsReceipt {
  domain: string;
  body: GreenrailsReceiptBody;
  hash: string;
  signature: string;
}

export type VerifyFailure =
  | "UNKNOWN_DOMAIN"
  | "HASH_MISMATCH"
  | "SIGNATURE_MISMATCH"
  | "BANNER_MISSING"
  | "UNKNOWN_STATE"
  | "FINALIZED_WITHOUT_DUAL_EVIDENCE";

export interface VerifyResult {
  ok: boolean;
  failures: VerifyFailure[];
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function canonicalize(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k] as Json)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalReceiptHash(body: GreenrailsReceiptBody): string {
  return createHash("sha256").update(canonicalize(body as unknown as Json)).digest("hex");
}

/** Mock signature: sha256(domain || 0x00 || hash). Live signing is undefined until launch gates close. */
export function mockSign(domain: string, hash: string): string {
  return createHash("sha256").update(domain).update(Buffer.from([0])).update(hash).digest("hex");
}

export function sealMockReceipt(body: GreenrailsReceiptBody): SignedGreenrailsReceipt {
  const hash = canonicalReceiptHash(body);
  return { domain: MOCK_RECEIPT_DOMAIN, body, hash, signature: mockSign(MOCK_RECEIPT_DOMAIN, hash) };
}

const ALL_STATES: ReadonlySet<string> = new Set<string>([...SUCCESS_STATES, ...FAILURE_STATES]);

export function verifyGreenrailsReceipt(
  receipt: SignedGreenrailsReceipt,
  allowedDomains: readonly string[] = [MOCK_RECEIPT_DOMAIN],
): VerifyResult {
  const failures: VerifyFailure[] = [];
  if (!allowedDomains.includes(receipt.domain)) failures.push("UNKNOWN_DOMAIN");
  const hash = canonicalReceiptHash(receipt.body);
  if (hash !== receipt.hash) failures.push("HASH_MISMATCH");
  if (mockSign(receipt.domain, hash) !== receipt.signature) failures.push("SIGNATURE_MISMATCH");
  if (receipt.body.banner !== MOCK_BANNER) failures.push("BANNER_MISSING");
  if (!ALL_STATES.has(receipt.body.state)) failures.push("UNKNOWN_STATE");
  if (receipt.body.state === "RECEIPT_FINALIZED" && receipt.body.evidenceHashes.length < 2) {
    failures.push("FINALIZED_WITHOUT_DUAL_EVIDENCE");
  }
  return { ok: failures.length === 0, failures };
}
