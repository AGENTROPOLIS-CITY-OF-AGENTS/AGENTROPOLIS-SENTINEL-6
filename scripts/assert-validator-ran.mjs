#!/usr/bin/env node
// Fails CI unless the SENTINEL-6 validators demonstrably executed.
// "Workflow green" without validator execution is treated as FAIL.
//
// Asserts:
//   1. node --test ran > 0 tests in EVERY compiled test file (each file is
//      run separately), with 0 failed, 0 cancelled, 0 skipped and 0 todo.
//   2. `sentinel-6 validate policies` checked > 0 files, ran > 0 checks,
//      and reported no failures.
//   3. `sentinel-6 doctor` reports deployAuthority === false and a non-empty
//      phase list.
import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync } from "node:fs";

const violations = [];
const fail = (message) => violations.push(message);

const testFiles = readdirSync("dist/tests")
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => `dist/tests/${name}`);
if (testFiles.length === 0) fail("no compiled test files found in dist/tests");

const tests = { files: testFiles.length, tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0, perFile: {} };
for (const file of testFiles) {
  // Run each file on its own so a file that registers zero tests cannot hide
  // behind other files. node --test reports such a file as a single synthetic
  // subtest named after the file path.
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", file], { encoding: "utf8" });
  const tap = `${run.stdout}\n${run.stderr}`;
  const count = (key) => {
    const match = tap.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
    return match ? Number(match[1]) : NaN;
  };
  const topLevel = [...tap.matchAll(/^# Subtest: (.+)$/gm)].map((match) => match[1]);
  const synthetic = topLevel.some((name) => name === file || name.endsWith(`/${file}`));
  const result = {
    tests: count("tests"),
    pass: count("pass"),
    fail: count("fail"),
    cancelled: count("cancelled"),
    skipped: count("skipped"),
    todo: count("todo"),
    exitCode: run.status,
  };
  tests.perFile[file] = result.tests;
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    if (!Number.isFinite(result[key])) fail(`${file}: could not read '# ${key}' from TAP output`);
    else tests[key] += result[key];
  }
  if (synthetic || !(result.tests > 0)) fail(`${file}: registered zero tests`);
  if (run.status !== 0) fail(`${file}: test runner exited ${run.status}`);
}
if (!(tests.tests > 0)) fail(`test runner executed ${tests.tests} tests (must be > 0)`);
if (tests.fail !== 0) fail(`${tests.fail} tests failed`);
if (tests.cancelled !== 0) fail(`${tests.cancelled} tests cancelled`);
if (tests.skipped !== 0) fail(`${tests.skipped} tests skipped (skips hide unexecuted checks)`);
if (tests.todo !== 0) fail(`${tests.todo} tests marked todo`);
if (tests.pass !== tests.tests) fail(`pass (${tests.pass}) != tests (${tests.tests})`);

const validateRun = spawnSync(process.execPath, ["dist/src/cli.js", "validate", "policies"], { encoding: "utf8" });
let policies = { exitCode: validateRun.status };
try {
  const report = JSON.parse(validateRun.stdout);
  policies = { ...policies, filesChecked: report.filesChecked, checksRun: report.checksRun, failed: report.failed, passed: report.passed };
} catch {
  fail("policy validator did not emit a JSON report");
}
if (!(policies.filesChecked > 0)) fail(`policy validator checked ${policies.filesChecked} files (must be > 0)`);
if (!(policies.checksRun > 0)) fail(`policy validator ran ${policies.checksRun} checks (must be > 0)`);
if (policies.failed !== 0 || policies.passed !== true || validateRun.status !== 0) fail("policy validator reported failures");

const doctorRun = spawnSync(process.execPath, ["dist/src/cli.js", "doctor"], { encoding: "utf8" });
let doctor = { exitCode: doctorRun.status };
try {
  const report = JSON.parse(doctorRun.stdout);
  doctor = { ...doctor, deployAuthority: report.deployAuthority, phases: Array.isArray(report.phases) ? report.phases.length : 0 };
} catch {
  fail("doctor did not emit a JSON report");
}
if (doctor.deployAuthority !== false) fail("doctor must report deployAuthority === false");
if (!(doctor.phases > 0)) fail("doctor reported no audit phases");

const summary = { assertion: "sentinel-6/validator-executed", tests, policies, doctor, violations, passed: violations.length === 0 };
console.log(JSON.stringify(summary, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### SENTINEL-6 validator execution\n\n- tests: ${tests.pass}/${tests.tests} passed across ${tests.files} files (fail ${tests.fail}, skipped ${tests.skipped})\n- policy validator: ${policies.checksRun} checks over ${policies.filesChecked} files, ${policies.failed} failed\n- doctor: deployAuthority=${doctor.deployAuthority}, phases=${doctor.phases}\n- result: ${summary.passed ? "PASS" : "FAIL"}\n`,
  );
}
if (violations.length > 0) process.exit(1);
