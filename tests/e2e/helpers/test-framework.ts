/**
 * Lightweight, robust, zero-dependency testing harness for CashLayer Private Payroll E2E.
 * Provides BDD-style describe/it/expect, hooks, TAP v13 output, and JSON test reports.
 */

export interface TestResult {
  suite: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: Error;
}

export interface SuiteSummary {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  tests: TestResult[];
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  suites: SuiteSummary[];
}

type TestFn = () => void | Promise<void>;
type HookFn = () => void | Promise<void>;

interface RegisteredSuite {
  name: string;
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  tests: { name: string; fn: TestFn }[];
}

class TestRegistry {
  private suites: RegisteredSuite[] = [];
  private currentSuite: RegisteredSuite | null = null;
  private globalBeforeEachHooks: HookFn[] = [];
  private globalAfterEachHooks: HookFn[] = [];

  registerSuite(name: string, fn: () => void): void {
    const suite: RegisteredSuite = {
      name,
      beforeEachHooks: [...this.globalBeforeEachHooks],
      afterEachHooks: [...this.globalAfterEachHooks],
      tests: [],
    };
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    this.suites.push(suite);
    fn();
    this.currentSuite = prevSuite;
  }

  addTest(name: string, fn: TestFn): void {
    if (!this.currentSuite) {
      throw new Error(`Test "${name}" registered outside of a describe() block`);
    }
    this.currentSuite.tests.push({ name, fn });
  }

  addBeforeEach(fn: HookFn): void {
    if (!this.currentSuite) {
      this.globalBeforeEachHooks.push(fn);
    } else {
      this.currentSuite.beforeEachHooks.push(fn);
    }
  }

  addAfterEach(fn: HookFn): void {
    if (!this.currentSuite) {
      this.globalAfterEachHooks.push(fn);
    } else {
      this.currentSuite.afterEachHooks.push(fn);
    }
  }

  getSuites(): RegisteredSuite[] {
    return this.suites;
  }

  clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();

export function describe(suiteName: string, fn: () => void): void {
  registry.registerSuite(suiteName, fn);
}

export function it(testName: string, fn: TestFn): void {
  registry.addTest(testName, fn);
}

export function beforeEach(fn: HookFn): void {
  registry.addBeforeEach(fn);
}

export function afterEach(fn: HookFn): void {
  registry.addAfterEach(fn);
}

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export class Matcher<T = any> {
  constructor(private actual: T, private isNot: boolean = false) {}

  get not(): Matcher<T> {
    return new Matcher(this.actual, !this.isNot);
  }

  toBe(expected: any): void {
    const pass = Object.is(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(
        `Expected ${String(this.actual)} ${this.isNot ? "NOT to be" : "to be"} ${String(expected)}`
      );
    }
  }

  toEqual(expected: any): void {
    const pass = deepEqual(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(
        `Expected deep equality:\nActual:   ${JSON.stringify(this.actual)}\nExpected: ${JSON.stringify(expected)}`
      );
    }
  }

  toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? "NOT to be" : "to be"} defined`);
    }
  }

  toBeUndefined(): void {
    const pass = this.actual === undefined;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? "NOT to be" : "to be"} undefined`);
    }
  }

  toBeNull(): void {
    const pass = this.actual === null;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected value ${this.isNot ? "NOT to be" : "to be"} null`);
    }
  }

  toBeTruthy(): void {
    const pass = Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} to be truthy`);
    }
  }

  toBeFalsy(): void {
    const pass = !this.actual;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} to be falsy`);
    }
  }

  toBeGreaterThan(expected: number | bigint): void {
    const pass = (this.actual as any) > expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} > ${String(expected)}`);
    }
  }

  toBeGreaterThanOrEqual(expected: number | bigint): void {
    const pass = (this.actual as any) >= expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} >= ${String(expected)}`);
    }
  }

  toBeLessThan(expected: number | bigint): void {
    const pass = (this.actual as any) < expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} < ${String(expected)}`);
    }
  }

  toBeLessThanOrEqual(expected: number | bigint): void {
    const pass = (this.actual as any) <= expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected ${String(this.actual)} <= ${String(expected)}`);
    }
  }

  toContain(expected: any): void {
    let pass = false;
    if (typeof this.actual === "string") {
      pass = this.actual.includes(String(expected));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.some((item) => deepEqual(item, expected));
    } else if (this.actual instanceof Set) {
      pass = this.actual.has(expected);
    }
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected collection ${this.isNot ? "NOT to contain" : "to contain"} ${String(expected)}`);
    }
  }

  toHaveLength(expected: number): void {
    const len = (this.actual as any)?.length;
    const pass = len === expected;
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected length ${expected}, but got ${len}`);
    }
  }

  toMatch(pattern: RegExp | string): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    const pass = regex.test(String(this.actual));
    if (this.isNot ? pass : !pass) {
      throw new AssertionError(`Expected "${String(this.actual)}" to match ${regex}`);
    }
  }

  toThrow(expectedMessageOrRegex?: string | RegExp): void {
    if (typeof this.actual !== "function") {
      throw new AssertionError("expect(fn).toThrow() requires a function");
    }
    let threw = false;
    let caught: any = null;
    try {
      (this.actual as any)();
    } catch (err) {
      threw = true;
      caught = err;
    }

    if (this.isNot ? threw : !threw) {
      throw new AssertionError(`Expected function ${this.isNot ? "NOT to throw" : "to throw"}`);
    }

    if (threw && expectedMessageOrRegex) {
      const msg = caught?.message || String(caught);
      if (typeof expectedMessageOrRegex === "string") {
        if (!msg.includes(expectedMessageOrRegex)) {
          throw new AssertionError(`Expected error message to contain "${expectedMessageOrRegex}", got: "${msg}"`);
        }
      } else {
        if (!expectedMessageOrRegex.test(msg)) {
          throw new AssertionError(`Expected error message to match ${expectedMessageOrRegex}, got: "${msg}"`);
        }
      }
    }
  }

  async toReject(expectedMessageOrRegex?: string | RegExp): Promise<void> {
    let threw = false;
    let caught: any = null;
    try {
      if (typeof this.actual === "function") {
        await (this.actual as any)();
      } else {
        await this.actual;
      }
    } catch (err) {
      threw = true;
      caught = err;
    }

    if (this.isNot ? threw : !threw) {
      throw new AssertionError(`Expected promise ${this.isNot ? "NOT to reject" : "to reject"}`);
    }

    if (threw && expectedMessageOrRegex) {
      const msg = caught?.message || String(caught);
      if (typeof expectedMessageOrRegex === "string") {
        if (!msg.includes(expectedMessageOrRegex)) {
          throw new AssertionError(`Expected rejection message to contain "${expectedMessageOrRegex}", got: "${msg}"`);
        }
      } else {
        if (!expectedMessageOrRegex.test(msg)) {
          throw new AssertionError(`Expected rejection message to match ${expectedMessageOrRegex}, got: "${msg}"`);
        }
      }
    }
  }
}

export function expect<T = any>(actual: T): Matcher<T> {
  return new Matcher(actual);
}

// ---------------------------------------------------------------------------
// Suite Execution Engine
// ---------------------------------------------------------------------------

export async function runAllSuites(): Promise<RunSummary> {
  const suites = registry.getSuites();
  const startOverall = Date.now();
  const suiteSummaries: SuiteSummary[] = [];

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const suite of suites) {
    const suiteStart = Date.now();
    const results: TestResult[] = [];
    let suitePassed = 0;
    let suiteFailed = 0;

    for (const test of suite.tests) {
      totalTests++;
      const testStart = Date.now();
      let status: 'passed' | 'failed' = 'passed';
      let error: Error | undefined = undefined;

      try {
        // Run beforeEach
        for (const hook of suite.beforeEachHooks) {
          await hook();
        }

        // Run test
        await test.fn();

        // Run afterEach
        for (const hook of suite.afterEachHooks) {
          await hook();
        }

        suitePassed++;
        totalPassed++;
      } catch (err: any) {
        status = 'failed';
        error = err;
        suiteFailed++;
        totalFailed++;
      }

      results.push({
        suite: suite.name,
        name: test.name,
        status,
        durationMs: Date.now() - testStart,
        error,
      });
    }

    suiteSummaries.push({
      suiteName: suite.name,
      total: suite.tests.length,
      passed: suitePassed,
      failed: suiteFailed,
      skipped: 0,
      durationMs: Date.now() - suiteStart,
      tests: results,
    });
  }

  return {
    total: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    durationMs: Date.now() - startOverall,
    suites: suiteSummaries,
  };
}

// ---------------------------------------------------------------------------
// Reporters
// ---------------------------------------------------------------------------

export function formatTap(summary: RunSummary): string {
  const lines: string[] = [];
  lines.push("TAP version 13");
  lines.push(`1..${summary.total}`);

  let testIndex = 1;
  for (const suite of summary.suites) {
    for (const test of suite.tests) {
      if (test.status === "passed") {
        lines.push(`ok ${testIndex} - [${test.suite}] ${test.name} (${test.durationMs}ms)`);
      } else {
        lines.push(`not ok ${testIndex} - [${test.suite}] ${test.name}`);
        lines.push("  ---");
        lines.push(`  message: ${JSON.stringify(test.error?.message || "Unknown error")}`);
        if (test.error?.stack) {
          lines.push(`  stack: |`);
          for (const s of test.error.stack.split("\n")) {
            lines.push(`    ${s}`);
          }
        }
        lines.push("  ...");
      }
      testIndex++;
    }
  }

  lines.push(`# tests ${summary.total}`);
  lines.push(`# pass ${summary.passed}`);
  lines.push(`# fail ${summary.failed}`);
  lines.push(`# duration ${summary.durationMs}ms`);

  return lines.join("\n");
}
