import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";

/**
 * SENTINEL-6 policy validator.
 *
 * Fails closed: an unreadable directory, an empty directory, a parse error,
 * an unrecognised document kind, or a validator that ran zero checks are all
 * treated as failures. A clean report requires checksRun > 0 and no failures.
 */

export interface PolicyCheck {
  file: string;
  check: string;
  passed: boolean;
  detail?: string;
}

export interface PolicyValidationReport {
  directory: string;
  filesChecked: number;
  checksRun: number;
  failures: PolicyCheck[];
  checks: PolicyCheck[];
  passed: boolean;
}

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const RULE_ID = /^[A-Z][A-Z0-9]*-\d{3}$/;
const PROFILE_ID = /^S6-[A-Z0-9][A-Z0-9-]*$/;
const MUTATION_ID = /^[a-z][a-z0-9_]*$/;

type Doc = Record<string, unknown>;

function isRecord(value: unknown): value is Doc {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.every((item) => nonEmptyString(item)) ? (value as string[]) : undefined;
}

class Recorder {
  readonly checks: PolicyCheck[] = [];
  constructor(private readonly file: string) {}
  check(name: string, passed: boolean, detail?: string): void {
    const entry: PolicyCheck = { file: this.file, check: name, passed };
    if (!passed && detail !== undefined) entry.detail = detail;
    this.checks.push(entry);
  }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

function validateGovernancePolicy(doc: Doc, r: Recorder): void {
  r.check("policy.name", nonEmptyString(doc.policy), "`policy` must be a non-empty string");
  r.check("policy.version", nonEmptyString(doc.version), "`version` must be a non-empty string");

  const hasRules = doc.rules !== undefined;
  const hasDefault = doc.default !== undefined;
  r.check("policy.non_vacuous", hasRules || hasDefault, "policy must declare `rules` or a `default`");

  if (hasRules) {
    const rules = Array.isArray(doc.rules) ? doc.rules : undefined;
    r.check("policy.rules.non_empty", rules !== undefined && rules.length > 0, "`rules` must be a non-empty list");
    const ids: string[] = [];
    (rules ?? []).forEach((rule, index) => {
      const ok = isRecord(rule) && nonEmptyString(rule.id) && RULE_ID.test(rule.id) && nonEmptyString(rule.statement);
      r.check(`policy.rules[${index}].shape`, ok, "each rule needs an id like AUTH-001 and a non-empty statement");
      if (isRecord(rule) && nonEmptyString(rule.id)) ids.push(rule.id);
    });
    const dupes = duplicates(ids);
    r.check("policy.rules.unique_ids", dupes.length === 0, `duplicate rule ids: ${dupes.join(", ")}`);
  }

  if (hasDefault) {
    r.check("policy.default.fail_closed", doc.default === "deny", "`default` must be `deny` (fail closed)");
  }

  const allowed = doc.allowed === undefined ? [] : stringList(doc.allowed);
  const gated = doc.requires_explicit_human_mandate === undefined ? [] : stringList(doc.requires_explicit_human_mandate);
  const forbidden = doc.forbidden_autonomous_actions === undefined ? [] : stringList(doc.forbidden_autonomous_actions);
  r.check("policy.allowed.shape", allowed !== undefined, "`allowed` must be a list of strings");
  r.check("policy.requires_explicit_human_mandate.shape", gated !== undefined, "`requires_explicit_human_mandate` must be a list of strings");
  r.check("policy.forbidden_autonomous_actions.shape", forbidden !== undefined, "`forbidden_autonomous_actions` must be a list of strings");

  const allowedSet = new Set(allowed ?? []);
  const escalated = [...(gated ?? []), ...(forbidden ?? [])].filter((action) => allowedSet.has(action)).sort();
  r.check(
    "policy.no_allow_overlap",
    escalated.length === 0,
    `actions both allowed and gated/forbidden: ${escalated.join(", ")}`,
  );

  if (doc.failure_action !== undefined) {
    r.check("policy.failure_action.shape", nonEmptyString(doc.failure_action), "`failure_action` must be a non-empty string");
  }
}

function validateAdversaryProfile(doc: Doc, r: Recorder): void {
  r.check("profile.version", nonEmptyString(doc.version), "`version` must be a non-empty string");
  r.check(
    "profile.id",
    nonEmptyString(doc.profile_id) && PROFILE_ID.test(doc.profile_id),
    "`profile_id` must match S6-<UPPER-KEBAB>",
  );
  r.check("profile.threat_class", nonEmptyString(doc.threat_class), "`threat_class` must be a non-empty string");
  r.check("profile.objective", nonEmptyString(doc.objective), "`objective` must be a non-empty string");

  const mutations = Array.isArray(doc.attack_mutations) ? doc.attack_mutations : undefined;
  r.check("profile.attack_mutations.non_empty", mutations !== undefined && mutations.length > 0, "`attack_mutations` must be a non-empty list");
  const mutationIds: string[] = [];
  (mutations ?? []).forEach((mutation, index) => {
    const ok = isRecord(mutation) && nonEmptyString(mutation.id) && MUTATION_ID.test(mutation.id) && nonEmptyString(mutation.action);
    r.check(`profile.attack_mutations[${index}].shape`, ok, "each mutation needs a snake_case id and a non-empty action");
    if (isRecord(mutation) && nonEmptyString(mutation.id)) mutationIds.push(mutation.id);
  });
  const dupeMutations = duplicates(mutationIds);
  r.check("profile.attack_mutations.unique_ids", dupeMutations.length === 0, `duplicate mutation ids: ${dupeMutations.join(", ")}`);

  const roles = isRecord(doc.sentinel_roles) ? Object.entries(doc.sentinel_roles) : undefined;
  r.check("profile.sentinel_roles.non_empty", roles !== undefined && roles.length > 0, "`sentinel_roles` must be a non-empty mapping");
  for (const [role, spec] of roles ?? []) {
    r.check(`profile.sentinel_roles.${role}.focus`, isRecord(spec) && nonEmptyString(spec.focus), "each role needs a non-empty `focus`");
  }

  const assertions = stringList(doc.assertions);
  r.check("profile.assertions.non_empty", assertions !== undefined && assertions.length > 0, "`assertions` must be a non-empty list of strings");
  const dupeAssertions = duplicates(assertions ?? []);
  r.check("profile.assertions.unique", dupeAssertions.length === 0, `duplicate assertions: ${dupeAssertions.join(", ")}`);

  r.check(
    "profile.failure_severity",
    typeof doc.failure_severity === "string" && SEVERITIES.has(doc.failure_severity),
    "`failure_severity` must be one of critical|high|medium|low",
  );
}

export function validatePolicyDocument(file: string, doc: unknown): PolicyCheck[] {
  const r = new Recorder(file);
  if (!isRecord(doc)) {
    r.check("document.mapping", false, "document must be a YAML mapping");
    return r.checks;
  }
  r.check("document.mapping", true);
  const isPolicy = doc.policy !== undefined;
  const isProfile = doc.profile_id !== undefined;
  r.check(
    "document.kind",
    isPolicy !== isProfile,
    isPolicy && isProfile
      ? "document declares both `policy` and `profile_id`"
      : "unrecognised document: expected `policy` (governance policy) or `profile_id` (adversary profile)",
  );
  if (isPolicy && !isProfile) validateGovernancePolicy(doc, r);
  if (isProfile && !isPolicy) validateAdversaryProfile(doc, r);
  return r.checks;
}

export function validatePolicySource(file: string, source: string): PolicyCheck[] {
  let doc: unknown;
  try {
    doc = parse(source, { strict: true, uniqueKeys: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] ?? error.message : String(error);
    return [{ file, check: "document.parse", passed: false, detail: message }];
  }
  return [{ file, check: "document.parse", passed: true }, ...validatePolicyDocument(file, doc)];
}

export function validatePolicyDirectory(directory: string): PolicyValidationReport {
  const checks: PolicyCheck[] = [];
  let files: string[] = [];
  try {
    if (!statSync(directory).isDirectory()) throw new Error("not a directory");
    files = readdirSync(directory)
      .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
      .sort();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ file: directory, check: "directory.readable", passed: false, detail: message });
  }

  if (checks.length === 0) {
    checks.push({
      file: directory,
      check: "directory.non_empty",
      passed: files.length > 0,
      ...(files.length > 0 ? {} : { detail: "no *.yaml / *.yml policy documents found" }),
    });
  }

  for (const name of files) {
    checks.push(...validatePolicySource(basename(name), readFileSync(join(directory, name), "utf8")));
  }

  const failures = checks.filter((item) => !item.passed);
  return {
    directory,
    filesChecked: files.length,
    checksRun: checks.length,
    failures,
    checks,
    passed: files.length > 0 && checks.length > 0 && failures.length === 0,
  };
}
