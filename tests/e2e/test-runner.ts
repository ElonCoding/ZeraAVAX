#!/usr/bin/env node
/**
 * Standalone Executable Test Runner for CashLayer Private Payroll E2E.
 * Executes all 4 tiers of tests:
 *   - Tier 1: Feature Coverage (F01 - F18) (>=90 tests)
 *   - Tier 2: Boundary & Corner Cases (>=60 tests)
 *   - Tier 3: Pairwise Combinatorial Interactions (>=18 tests)
 *   - Tier 4: Real-World Workload Scenarios (>=5 scenarios)
 *
 * Supports --format=tap|json|summary and --tier=1|2|3|4|all
 * Exits with code 0 if all tests pass, 1 if any fail.
 */

import { runAllSuites, formatTap, RunSummary } from "./helpers/test-framework.ts";
import * as fs from "fs";
import * as path from "path";

// Parse CLI flags
const args = process.argv.slice(2);
let format: "tap" | "json" | "summary" = "summary";
let selectedTier: "1" | "2" | "3" | "4" | "all" = "all";
let reportPath: string | null = null;

for (const arg of args) {
  if (arg.startsWith("--format=")) {
    format = arg.split("=")[1] as any;
  } else if (arg.startsWith("--tier=")) {
    selectedTier = arg.split("=")[1] as any;
  } else if (arg.startsWith("--save-report=")) {
    reportPath = arg.split("=")[1];
  }
}

async function main() {
  const startTime = Date.now();

  // Dynamically load selected tiers
  if (selectedTier === "all" || selectedTier === "1") {
    await import("./tier1-features.test.ts");
  }
  if (selectedTier === "all" || selectedTier === "2") {
    await import("./tier2-boundaries.test.ts");
  }
  if (selectedTier === "all" || selectedTier === "3") {
    await import("./tier3-pairwise.test.ts");
  }
  if (selectedTier === "all" || selectedTier === "4") {
    await import("./tier4-realworld.test.ts");
  }

  const summary: RunSummary = await runAllSuites();
  const totalDuration = Date.now() - startTime;

  if (format === "tap") {
    console.log(formatTap(summary));
  } else if (format === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    // Colorized summary
    console.log("\n" + "=".repeat(78));
    console.log("   CashLayer Private Payroll — Opaque-Box E2E Test Suite Harness");
    console.log("=".repeat(78));
    console.log(`Execution Mode:  Tier ${selectedTier.toUpperCase()}`);
    console.log(`Total Suites:    ${summary.suites.length}`);
    console.log(`Total Tests:     ${summary.total}`);
    console.log(`Passed:          \x1b[32m${summary.passed}\x1b[0m`);
    console.log(`Failed:          ${summary.failed > 0 ? `\x1b[31m${summary.failed}\x1b[0m` : `0`}`);
    console.log(`Skipped:         ${summary.skipped}`);
    console.log(`Total Duration:  ${totalDuration}ms`);
    console.log("-".repeat(78));

    // Suite breakdown
    for (const suite of summary.suites) {
      const icon = suite.failed === 0 ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m";
      const stats = `(${suite.passed}/${suite.total} passed, ${suite.durationMs}ms)`;
      console.log(` ${icon} ${suite.suiteName.padEnd(52)} ${stats}`);

      if (suite.failed > 0) {
        for (const test of suite.tests) {
          if (test.status === "failed") {
            console.log(`    \x1b[31m✖ ${test.name}\x1b[0m`);
            console.log(`      Error: ${test.error?.message}`);
          }
        }
      }
    }

    console.log("=".repeat(78));
    if (summary.failed === 0) {
      console.log("\x1b[32m✔ ALL E2E TEST TIERS COMPLETED SUCCESSFULLY (100% PASS RATE)\x1b[0m\n");
    } else {
      console.log(`\x1b[31m✖ ${summary.failed} TEST(S) FAILED\x1b[0m\n`);
    }
  }

  // Save report if requested
  if (reportPath) {
    const reportData = format === "tap" ? formatTap(summary) : JSON.stringify(summary, null, 2);
    fs.writeFileSync(path.resolve(reportPath), reportData, "utf8");
    console.log(`Report written to ${reportPath}`);
  }

  process.exitCode = summary.failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
