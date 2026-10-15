#!/usr/bin/env node
import { resolve } from "node:path";
import { auditTransitions } from "./commander/state-machine.js";
import { reviewerMandates } from "./models/router.js";
import { validatePolicyDirectory } from "./policies/validate.js";

const [command = "help", ...args] = process.argv.slice(2);

switch (command) {
  case "doctor":
    console.log(JSON.stringify({
      sentinel: "SENTINEL-6",
      runtime: "foundation",
      node: process.version,
      sourceOfTruth: "evidence",
      commander: "hermes-preferred",
      deployAuthority: false,
      reviewerMandates: Object.keys(reviewerMandates),
      phases: Object.keys(auditTransitions)
    }, null, 2));
    break;
  case "phases":
    console.log(JSON.stringify(auditTransitions, null, 2));
    break;
  case "validate": {
    const report = validatePolicyDirectory(resolve(args[0] ?? "policies"));
    console.log(JSON.stringify({
      validator: "sentinel-6/policies",
      directory: report.directory,
      filesChecked: report.filesChecked,
      checksRun: report.checksRun,
      failed: report.failures.length,
      passed: report.passed,
      failures: report.failures
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
    break;
  }
  default:
    console.log(`SENTINEL-6\n\nCommands:\n  doctor           Inspect runtime contract\n  phases           Print permitted state transitions\n  validate [dir]   Validate policy documents (default: ./policies); fails closed\n\nRuntime adapters for providers, MCPs and repositories are intentionally configured separately.`);
}
