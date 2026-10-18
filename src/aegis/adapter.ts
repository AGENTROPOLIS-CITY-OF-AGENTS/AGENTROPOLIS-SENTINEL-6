import type { Finding, RiskPosture } from "../types.js";

export interface AegisDecision {
  posture: RiskPosture;
  reasons: string[];
  requiresHumanApproval: boolean;
}

export interface AegisAdapter {
  evaluate(findings: readonly Finding[]): Promise<AegisDecision>;
}

/**
 * Strictness order (higher = stricter). QUARANTINE is the strictest posture:
 * a quarantined subject has no execution path at all, while HUMAN_APPROVAL
 * still permits execution once an approval is supplied.
 *
 * Canon (AXIOM AUTHORITY-CANON / RECOVERY-CONTRACT, PROPOSED 2026-10-18):
 * leaving QUARANTINE is never "tightening". Any exit from QUARANTINE is a
 * relaxation that must go through the recovery contract (54T policy check +
 * independent validation + human approval). This adapter can only hold or
 * tighten; it never relaxes.
 */
export const POSTURE_STRICTNESS: Readonly<Record<RiskPosture, number>> = Object.freeze({
  ALLOW: 0,
  OBSERVE: 1,
  RESTRICT: 2,
  HUMAN_APPROVAL: 3,
  QUARANTINE: 4
});

function isKnownPosture(value: unknown): value is RiskPosture {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(POSTURE_STRICTNESS, value);
}

export function isTightening(current: RiskPosture, proposed: RiskPosture): boolean {
  if (!isKnownPosture(current) || !isKnownPosture(proposed)) return false;
  if (current === "QUARANTINE") return proposed === "QUARANTINE";
  return POSTURE_STRICTNESS[proposed] >= POSTURE_STRICTNESS[current];
}

/** @deprecated kept for API compatibility; use isTightening. */
export function mayTighten(current: RiskPosture, proposed: RiskPosture): boolean {
  return isTightening(current, proposed);
}

export function enforceNoAutomaticRelaxation(current: RiskPosture, proposed: RiskPosture): RiskPosture {
  // Fail closed: an unknown or corrupted current posture is treated as QUARANTINE.
  if (!isKnownPosture(current)) return "QUARANTINE";
  return isTightening(current, proposed) ? proposed : current;
}
