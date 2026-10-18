import test from "node:test";
import assert from "node:assert/strict";
import { enforceNoAutomaticRelaxation, isTightening, POSTURE_STRICTNESS } from "../src/aegis/adapter.js";
import type { RiskPosture } from "../src/types.js";

const ALL: RiskPosture[] = ["ALLOW", "OBSERVE", "RESTRICT", "HUMAN_APPROVAL", "QUARANTINE"];

test("QUARANTINE is strictly the strictest posture", () => {
  for (const p of ALL) if (p !== "QUARANTINE") assert.ok(POSTURE_STRICTNESS.QUARANTINE > POSTURE_STRICTNESS[p]);
});

test("leaving QUARANTINE is never tightening (incl. HUMAN_APPROVAL)", () => {
  for (const p of ALL) {
    if (p === "QUARANTINE") continue;
    assert.equal(isTightening("QUARANTINE", p), false);
    assert.equal(enforceNoAutomaticRelaxation("QUARANTINE", p), "QUARANTINE");
  }
});

test("HUMAN_APPROVAL -> QUARANTINE is tightening", () => {
  assert.equal(enforceNoAutomaticRelaxation("HUMAN_APPROVAL", "QUARANTINE"), "QUARANTINE");
});

test("no automatic relaxation anywhere", () => {
  for (const c of ALL) for (const p of ALL) {
    const out = enforceNoAutomaticRelaxation(c, p);
    assert.ok(POSTURE_STRICTNESS[out] >= POSTURE_STRICTNESS[c], `${c}->${p} relaxed to ${out}`);
  }
});

test("unknown current posture fails closed to QUARANTINE; unknown proposed is ignored", () => {
  assert.equal(enforceNoAutomaticRelaxation("BOGUS" as RiskPosture, "ALLOW"), "QUARANTINE");
  assert.equal(enforceNoAutomaticRelaxation("RESTRICT", "BOGUS" as RiskPosture), "RESTRICT");
});

test("existing behaviour preserved", () => {
  assert.equal(enforceNoAutomaticRelaxation("QUARANTINE", "ALLOW"), "QUARANTINE");
  assert.equal(enforceNoAutomaticRelaxation("OBSERVE", "RESTRICT"), "RESTRICT");
});
