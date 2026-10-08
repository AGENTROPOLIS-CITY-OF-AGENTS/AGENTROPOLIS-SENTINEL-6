import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validatePolicyDirectory, validatePolicyDocument, validatePolicySource } from "../src/policies/validate.js";

// Compiled to dist/tests/*.js, so the repository root is two levels up.
const root = fileURLToPath(new URL("../../", import.meta.url));
const policiesDir = `${root}policies`;
const invalidDir = `${root}tests/fixtures/policies-invalid`;
const emptyDir = `${root}tests/fixtures/policies-empty`;
const cli = `${root}dist/src/cli.js`;

function failedChecks(checks: { check: string; passed: boolean }[]): string[] {
  return checks.filter((item) => !item.passed).map((item) => item.check);
}

test("repository policies validate cleanly and the validator actually ran checks", () => {
  const report = validatePolicyDirectory(policiesDir);
  assert.deepEqual(report.failures, []);
  assert.equal(report.passed, true);
  assert.ok(report.filesChecked >= 2, `expected >= 2 policy files, got ${report.filesChecked}`);
  assert.ok(report.checksRun >= 20, `expected >= 20 checks, got ${report.checksRun}`);
});

test("deliberately invalid fixtures are all rejected", () => {
  const report = validatePolicyDirectory(invalidDir);
  assert.equal(report.passed, false);
  assert.equal(report.filesChecked, 4);
  const failedFiles = new Set(report.failures.map((item) => item.file));
  assert.deepEqual([...failedFiles].sort(), ["broken-profile.yaml", "malformed.yaml", "permissive-deployment.yaml", "unknown-kind.yaml"]);
});

test("permissive deployment policy is rejected (default allow, allow/gate overlap)", () => {
  const failed = failedChecks(validatePolicyDocument("x.yaml", {
    policy: "weakened",
    version: "1",
    default: "allow",
    allowed: ["production_deployment"],
    forbidden_autonomous_actions: ["production_deployment"],
  }));
  assert.ok(failed.includes("policy.default.fail_closed"));
  assert.ok(failed.includes("policy.no_allow_overlap"));
});

test("vacuous policy with neither rules nor default is rejected", () => {
  assert.ok(failedChecks(validatePolicyDocument("x.yaml", { policy: "empty", version: "1" })).includes("policy.non_vacuous"));
});

test("duplicate or malformed rule ids are rejected", () => {
  const failed = failedChecks(validatePolicyDocument("x.yaml", {
    policy: "p",
    version: "1",
    rules: [{ id: "AUTH-001", statement: "a" }, { id: "AUTH-001", statement: "b" }, { id: "bad", statement: "c" }],
  }));
  assert.ok(failed.includes("policy.rules.unique_ids"));
  assert.ok(failed.includes("policy.rules[2].shape"));
});

test("broken adversary profile fails every structural requirement it violates", () => {
  const failed = failedChecks(validatePolicyDocument("x.yaml", {
    version: "1.0",
    profile_id: "lowercase",
    threat_class: "T",
    objective: "",
    attack_mutations: [{ id: "dup", action: "a" }, { id: "dup", action: "b" }],
    sentinel_roles: {},
    assertions: [],
    failure_severity: "catastrophic",
  }));
  for (const expected of [
    "profile.id",
    "profile.objective",
    "profile.attack_mutations.unique_ids",
    "profile.sentinel_roles.non_empty",
    "profile.assertions.non_empty",
    "profile.failure_severity",
  ]) {
    assert.ok(failed.includes(expected), `expected ${expected} to fail; failed=${failed.join(",")}`);
  }
});

test("unknown document kind and ambiguous kind fail closed", () => {
  assert.ok(failedChecks(validatePolicyDocument("x.yaml", { name: "mystery" })).includes("document.kind"));
  assert.ok(failedChecks(validatePolicyDocument("x.yaml", { policy: "p", profile_id: "S6-X", version: "1" })).includes("document.kind"));
  assert.ok(failedChecks(validatePolicyDocument("x.yaml", ["not", "a", "mapping"])).includes("document.mapping"));
});

test("malformed YAML and duplicate keys fail at parse", () => {
  assert.deepEqual(failedChecks(validatePolicySource("x.yaml", "policy: a\npolicy: b\nversion: '1'\n")), ["document.parse"]);
  assert.deepEqual(failedChecks(validatePolicySource("x.yaml", "rules: [\n")), ["document.parse"]);
});

test("empty or missing policy directory fails closed (zero checks is never a pass)", () => {
  const empty = validatePolicyDirectory(emptyDir);
  assert.equal(empty.passed, false);
  assert.equal(empty.filesChecked, 0);
  const missing = validatePolicyDirectory(`${root}does-not-exist`);
  assert.equal(missing.passed, false);
  assert.deepEqual(failedChecks(missing.checks), ["directory.readable"]);
});

test("CLI validate exits 0 on repository policies and 1 on the invalid fixture set", () => {
  const ok = spawnSync(process.execPath, [cli, "validate", policiesDir], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const okReport = JSON.parse(ok.stdout) as { checksRun: number; passed: boolean };
  assert.equal(okReport.passed, true);
  assert.ok(okReport.checksRun > 0);

  const bad = spawnSync(process.execPath, [cli, "validate", invalidDir], { encoding: "utf8" });
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  const badReport = JSON.parse(bad.stdout) as { failed: number; passed: boolean };
  assert.equal(badReport.passed, false);
  assert.ok(badReport.failed > 0);

  const empty = spawnSync(process.execPath, [cli, "validate", emptyDir], { encoding: "utf8" });
  assert.equal(empty.status, 1, empty.stdout + empty.stderr);
});
