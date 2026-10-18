import test from "node:test";
import assert from "node:assert/strict";
import { mayTighten, enforceNoAutomaticRelaxation } from "../src/aegis/adapter.js";
test("QUARANTINE -> HUMAN_APPROVAL is not tightening", () => { assert.equal(mayTighten("QUARANTINE", "HUMAN_APPROVAL"), false); });
test("QUARANTINE held against HUMAN_APPROVAL proposal", () => { assert.equal(enforceNoAutomaticRelaxation("QUARANTINE", "HUMAN_APPROVAL"), "QUARANTINE"); });
test("HUMAN_APPROVAL -> QUARANTINE tightens", () => { assert.equal(enforceNoAutomaticRelaxation("HUMAN_APPROVAL", "QUARANTINE"), "QUARANTINE"); });
test("QUARANTINE -> ALLOW held (existing test)", () => { assert.equal(enforceNoAutomaticRelaxation("QUARANTINE", "ALLOW"), "QUARANTINE"); });
