/**
 * Integration & Unit Test Suite for CashLayer Private Payroll CLI (@cashlayer/cli).
 * Covers every command end-to-end:
 * 1. batch create: CSV parsing, boundary checks, Poseidon commitments, manifest schemas
 * 2. batch execute: on-chain lifecycle, private transfers, idempotency, receipts
 * 3. audit verify: log discovery, Poseidon decryption, reconciliation, attestation
 * 4. employee balance: confidential balance decryption, zero-leak assertion
 * 5. observer inspect: block inclusion, gas, zero-plaintext leakage audit
 * 6. CLI binary execution via node payroll-cli.js
 */

import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  createBatch,
  executeBatch,
  verifyAudit,
  getEmployeeBalance,
  inspectTransaction,
  createProgram,
  resetSimulatedState,
  getSimulatedState,
  DEFAULT_CONTRACT_ADDRESSES,
} from "../src/index.js";
import { BabyJub, Poseidon } from "@cashlayer/eerc-adapter";
import { BatchStatus, MAX_SAFE_AMOUNT_51BIT } from "@cashlayer/shared";

console.log("==============================================================================");
console.log("   Running @cashlayer/cli Integration Test Suite");
console.log("==============================================================================");

let passed = 0;
let failed = 0;

async function it(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(` ✔ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(` ✘ ${name}`);
    console.error(err);
    failed++;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.resolve(__dirname, "../.tmp-test-cli");

// Setup temporary directory for test artifacts
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Deterministic test accounts
const EMPLOYER_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;
const EMPLOYER_ADDR = "0x1111111111111111111111111111111111111111" as const;
const EMP1_ADDR = "0x2222222222222222222222222222222222222222" as const;
const EMP1_SK = 20000001n;
const EMP2_ADDR = "0x3333333333333333333333333333333333333333" as const;
const EMP2_SK = 30000001n;
const AUDITOR_ADDR = "0x7777777777777777777777777777777777777777" as const;
const AUDITOR_SK = 70000001n;

async function runAllTests() {
  // Reset clean simulation state
  resetSimulatedState();

  // =========================================================================
  // 1. COMMAND: batch create
  // =========================================================================
  console.log("\n--- Suite 1: Command 'batch create' ---");

  await it("F11-01: Successfully parses valid 2-employee CSV and generates manifest", async () => {
    const csv = `address,amount,department\n${EMP1_ADDR},1250000,Engineering\n${EMP2_ADDR},1100000,Product`;
    const manifest = await createBatch({
      roster: csv,
      token: DEFAULT_CONTRACT_ADDRESSES.eercToken,
      silent: true,
    });

    assert.strictEqual(manifest.employeeCount, 2);
    assert.strictEqual(manifest.totalGrossAmount, "2350000");
    assert.strictEqual(manifest.recipients.length, 2);
    assert.strictEqual(manifest.recipients[0].address, EMP1_ADDR.toLowerCase());
    assert.strictEqual(manifest.recipients[0].amount, "1250000");
    assert.strictEqual(manifest.recipients[0].department, "Engineering");
    assert.strictEqual(manifest.recipients[1].address, EMP2_ADDR.toLowerCase());
    assert.strictEqual(manifest.recipients[1].amount, "1100000");
    assert.strictEqual(manifest.recipients[1].department, "Product");
    assert(manifest.batchId.startsWith("0x"));
    assert.strictEqual(manifest.batchId.length, 66);
    assert(manifest.rosterCommitment.startsWith("0x"));
    assert.strictEqual(manifest.rosterCommitment.length, 66);
  });

  await it("F11-02: Writes generated manifest to JSON file and validates reloaded structure", async () => {
    const csv = `address,amount\n${EMP1_ADDR},500000`;
    const outFile = path.join(TEST_DIR, "manifest-1.json");

    const manifest = await createBatch({
      roster: csv,
      output: outFile,
      silent: true,
    });

    assert(fs.existsSync(outFile));
    const raw = fs.readFileSync(outFile, "utf-8");
    const loaded = JSON.parse(raw);
    assert.strictEqual(loaded.batchId, manifest.batchId);
    assert.strictEqual(loaded.totalGrossAmount, "500000");
    assert.strictEqual(loaded.employeeCount, 1);
  });

  await it("F11-03: Computes deterministic roster commitment hash via Poseidon", async () => {
    const csv1 = `address,amount\n${EMP1_ADDR},1000`;
    const csv2 = `address,amount\n${EMP1_ADDR},2000`;

    const m1 = await createBatch({ roster: csv1, silent: true });
    const m2 = await createBatch({ roster: csv2, silent: true });

    assert.notStrictEqual(m1.rosterCommitment, m2.rosterCommitment);

    // Verify Poseidon formula
    const expectedCommitment = `0x${Poseidon.hash([
      Poseidon.hash([BigInt(EMP1_ADDR), 1000n]),
    ])
      .toString(16)
      .padStart(64, "0")}`;
    assert.strictEqual(m1.rosterCommitment, expectedCommitment);
  });

  await it("F11-04: Preserves explicit batch-id if specified in options", async () => {
    const explicitId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const csv = `address,amount\n${EMP1_ADDR},75000`;
    const manifest = await createBatch({
      roster: csv,
      batchId: explicitId,
      silent: true,
    });
    assert.strictEqual(manifest.batchId, explicitId);
  });

  await it("F11-05: Rejects empty roster content", async () => {
    await assert.rejects(
      async () => {
        await createBatch({ roster: "", silent: true });
      },
      /CLI Error: Roster CSV/
    );

    await assert.rejects(
      async () => {
        await createBatch({ roster: "   \n\n  ", silent: true });
      },
      /CLI Error: Roster CSV/
    );
  });

  await it("F11-06: Rejects roster with duplicate recipient addresses", async () => {
    const dupCsv = `address,amount\n${EMP1_ADDR},1000\n0x${EMP1_ADDR.slice(2).toUpperCase()},2000`;
    await assert.rejects(
      async () => {
        await createBatch({ roster: dupCsv, silent: true });
      },
      /CLI Error: Duplicate recipient address detected/
    );
  });

  await it("F11-07: Rejects malformed CSV rows and invalid EVM addresses", async () => {
    const badRow = `address,amount\nnot_a_valid_row`;
    await assert.rejects(
      async () => {
        await createBatch({ roster: badRow, silent: true });
      },
      /CLI Error: Malformed CSV row/
    );

    const badAddr = `address,amount\n0x12345,1000`;
    await assert.rejects(
      async () => {
        await createBatch({ roster: badAddr, silent: true });
      },
      /CLI Error: Invalid recipient EVM address/
    );
  });

  await it("F11-08: Rejects non-numeric, zero, negative, and out-of-range amounts", async () => {
    await assert.rejects(
      async () => {
        await createBatch({ roster: `address,amount\n${EMP1_ADDR},abc`, silent: true });
      },
      /CLI Error: Malformed CSV row/
    );

    await assert.rejects(
      async () => {
        await createBatch({ roster: `address,amount\n${EMP1_ADDR},0`, silent: true });
      },
      /CLI Error: Amount must be strictly positive/
    );

    await assert.rejects(
      async () => {
        await createBatch({ roster: `address,amount\n${EMP1_ADDR},-500`, silent: true });
      },
      /CLI Error: Amount must be strictly positive/
    );

    const over51Bit = (MAX_SAFE_AMOUNT_51BIT + 1n).toString();
    await assert.rejects(
      async () => {
        await createBatch({ roster: `address,amount\n${EMP1_ADDR},${over51Bit}`, silent: true });
      },
      /CLI Error: Amount exceeds 51-bit range limit/
    );
  });

  // =========================================================================
  // 2. COMMAND: batch execute
  // =========================================================================
  console.log("\n--- Suite 2: Command 'batch execute' ---");

  let executedManifest: any;

  await it("F12-01: Successfully executes payroll batch in simulation mode", async () => {
    const csv = `address,amount\n${EMP1_ADDR},45000\n${EMP2_ADDR},55000`;
    executedManifest = await createBatch({ roster: csv, silent: true });

    const receipt = await executeBatch({
      batch: JSON.stringify(executedManifest),
      key: EMPLOYER_KEY,
      rpc: "mock",
      silent: true,
    });

    assert.strictEqual(receipt.batchId, executedManifest.batchId);
    assert.strictEqual(receipt.status, "Confirmed");
    assert.strictEqual(receipt.employeeCount, 2);
    assert.strictEqual(receipt.txHashes.length, 2);
    assert(receipt.txHashes[0].startsWith("0x"));

    // Verify smart contract state transitioned to Confirmed
    const sim = getSimulatedState();
    const batchRecord = sim.batches.get(executedManifest.batchId);
    assert.strictEqual(batchRecord?.status, BatchStatus.Confirmed);
    assert(batchRecord?.confirmedAt! > 0n);
  });

  await it("F12-02: Saves execution receipt to file and verifies contents", async () => {
    const receiptFile = path.join(TEST_DIR, "receipt-1.json");
    const receipt = await executeBatch({
      batch: JSON.stringify(executedManifest),
      key: EMPLOYER_KEY,
      rpc: "mock",
      output: receiptFile,
      silent: true,
    }).catch(() => null);

    // If already confirmed, should reject idempotency violation!
    assert.strictEqual(receipt, null);

    // Create fresh batch and execute with output
    const fresh = await createBatch({
      roster: `address,amount\n${EMP1_ADDR},10000`,
      silent: true,
    });
    const freshReceipt = await executeBatch({
      batch: JSON.stringify(fresh),
      key: EMPLOYER_KEY,
      rpc: "mock",
      output: receiptFile,
      silent: true,
    });

    assert(fs.existsSync(receiptFile));
    const saved = JSON.parse(fs.readFileSync(receiptFile, "utf-8"));
    assert.strictEqual(saved.batchId, fresh.batchId);
    assert.strictEqual(saved.status, "Confirmed");
    assert.strictEqual(saved.employeeCount, 1);
  });

  await it("F12-03: Replay protection: Rejects confirming already confirmed batch", async () => {
    await assert.rejects(
      async () => {
        await executeBatch({
          batch: JSON.stringify(executedManifest),
          key: EMPLOYER_KEY,
          rpc: "mock",
          silent: true,
        });
      },
      /Idempotency violation/
    );
  });

  await it("F12-04: Rejects execution with invalid EVM private key", async () => {
    await assert.rejects(
      async () => {
        await executeBatch({
          batch: JSON.stringify(executedManifest),
          key: "invalid-key",
          rpc: "mock",
          silent: true,
        });
      },
      /Invalid private key format/
    );
  });

  await it("F12-05: Rejects execution if employer has insufficient balance", async () => {
    const sim = getSimulatedState();
    const poorKey = "0x9999999999999999999999999999999999999999999999999999999999999999" as const;
    const poorAddr = "0x9999999999999999999999999999999999999999" as const;

    // Set poor employer balance to 1 unit
    sim.mockAdapter.setBalance(poorAddr, 1n);

    const expensiveBatch = await createBatch({
      roster: `address,amount\n${EMP1_ADDR},5000000000`,
      silent: true,
    });

    await assert.rejects(
      async () => {
        // Force poor address balance to remain low
        sim.mockAdapter.setBalance("0x9999999999999999999999999999999999999999", 10n);
        await sim.mockAdapter.executeBatchTransfers({
          batchId: expensiveBatch.batchId,
          transfers: [{ recipient: EMP1_ADDR, amount: 5000000000n }],
          senderPrivateKey: poorKey,
        });
      },
      /Insufficient sender balance|Insufficient balance/
    );
  });

  // =========================================================================
  // 3. COMMAND: audit verify
  // =========================================================================
  console.log("\n--- Suite 3: Command 'audit verify' ---");

  await it("F13-01: Discovers on-chain logs and decrypts transaction amounts using auditor key", async () => {
    const auditReport = await verifyAudit({
      batchId: executedManifest.batchId,
      auditorKey: AUDITOR_SK.toString(),
      rpc: "mock",
      expectedTotal: "110000", // 45000 + 55000 from F12-01 + 10000 from F12-02
      silent: true,
    });

    assert.strictEqual(auditReport.isCompliant, true);
    assert.strictEqual(auditReport.totalDisbursed, 110000n);
    assert.strictEqual(auditReport.employeeCount >= 2, true);
    assert(auditReport.reportHash.startsWith("0x"));
    assert.strictEqual(auditReport.reportHash.length, 66);
    assert.strictEqual(auditReport.discrepancies.length, 0);
  });

  await it("F13-02: Flags non-compliance and records discrepancy on amount mismatch", async () => {
    const mismatchReport = await verifyAudit({
      batchId: executedManifest.batchId,
      auditorKey: AUDITOR_SK.toString(),
      rpc: "mock",
      expectedTotal: "999999", // Mismatch
      silent: true,
    });

    assert.strictEqual(mismatchReport.isCompliant, false);
    assert(mismatchReport.discrepancies.length > 0);
    assert(mismatchReport.discrepancies[0].includes("Discrepancy detected"));
  });

  await it("F13-03: Saves audit report to file and verifies JSON fields", async () => {
    const reportFile = path.join(TEST_DIR, "audit-report.json");
    const report = await verifyAudit({
      batchId: executedManifest.batchId,
      auditorKey: AUDITOR_SK.toString(),
      rpc: "mock",
      output: reportFile,
      silent: true,
    });

    assert(fs.existsSync(reportFile));
    const saved = JSON.parse(fs.readFileSync(reportFile, "utf-8"));
    assert.strictEqual(saved.batchId, executedManifest.batchId);
    assert.strictEqual(saved.totalDisbursed, report.totalDisbursed.toString());
    assert(saved.reportHash.startsWith("0x"));
  });

  await it("F13-04: Generates deterministic compliance attestation hash via Poseidon", async () => {
    const report = await verifyAudit({
      batchId: executedManifest.batchId,
      auditorKey: AUDITOR_SK.toString(),
      rpc: "mock",
      silent: true,
    });

    const expectedHash = `0x${Poseidon.hash([
      BigInt(executedManifest.batchId),
      report.totalDisbursed,
      BigInt(report.isCompliant ? 1 : 0),
    ])
      .toString(16)
      .padStart(64, "0")}`;

    assert.strictEqual(report.reportHash, expectedHash);
  });

  await it("F13-05: Submits on-chain attestation when --attest flag is specified", async () => {
    const report = await verifyAudit({
      batchId: executedManifest.batchId,
      auditorKey: AUDITOR_SK.toString(),
      auditorAddress: AUDITOR_ADDR,
      rpc: "mock",
      attest: true,
      silent: true,
    });

    assert(report.attestationTxHash !== undefined);
    assert(report.attestationTxHash.startsWith("0x"));

    // Verify attestation recorded in simulated verifier
    const sim = getSimulatedState();
    const stored = sim.attestations.get(`${executedManifest.batchId.toLowerCase()}-${AUDITOR_ADDR.toLowerCase()}`);
    assert(stored !== undefined);
    assert.strictEqual(stored?.reportHash, report.reportHash);
    assert.strictEqual(stored?.isCompliant, report.isCompliant);
  });

  // =========================================================================
  // 4. COMMAND: employee balance
  // =========================================================================
  console.log("\n--- Suite 4: Command 'employee balance' ---");

  await it("F16-01: Successfully queries and decrypts employee's confidential balance", async () => {
    // EMP1 received 45000 in F12-01 and 10000 in F12-02 = 55000
    const res = await getEmployeeBalance({
      employee: EMP1_ADDR,
      viewingKey: EMP1_SK.toString(),
      rpc: "mock",
      silent: true,
    });

    assert.strictEqual(res.employeeAddress, EMP1_ADDR.toLowerCase());
    assert.strictEqual(res.decryptedBalance, "55000");
    assert.strictEqual(res.encryptedHandle.length, 4);
  });

  await it("F16-02: Rejects decryption when provided with invalid viewing key", async () => {
    await assert.rejects(
      async () => {
        await getEmployeeBalance({
          employee: EMP1_ADDR,
          viewingKey: "999999999999999999", // Wrong key
          rpc: "mock",
          silent: true,
        });
      },
      /Failed to decrypt balance with provided viewing key/
    );
  });

  await it("F16-03: Zero-leak assertion: Confirms output has no org total or peer data", async () => {
    const res = await getEmployeeBalance({
      employee: EMP2_ADDR,
      viewingKey: EMP2_SK.toString(),
      rpc: "mock",
      silent: true,
    });

    // EMP2 received 55000 in F12-01
    assert.strictEqual(res.decryptedBalance, "55000");

    // Assert strictly individual properties
    const keys = Object.keys(res);
    assert(!keys.includes("orgTotal"));
    assert(!keys.includes("companyDisbursements"));
    assert(!keys.includes("peerSalaries"));
    assert(!keys.includes("roster"));
  });

  await it("F16-04: Saves balance result to JSON file and verifies output", async () => {
    const balFile = path.join(TEST_DIR, "employee-bal.json");
    const res = await getEmployeeBalance({
      employee: EMP1_ADDR,
      viewingKey: EMP1_SK.toString(),
      rpc: "mock",
      output: balFile,
      silent: true,
    });

    assert(fs.existsSync(balFile));
    const loaded = JSON.parse(fs.readFileSync(balFile, "utf-8"));
    assert.strictEqual(loaded.employeeAddress, EMP1_ADDR.toLowerCase());
    assert.strictEqual(loaded.decryptedBalance, res.decryptedBalance);
  });

  // =========================================================================
  // 5. COMMAND: observer inspect
  // =========================================================================
  console.log("\n--- Suite 5: Command 'observer inspect' ---");

  await it("F18-01: Inspects on-chain transaction hash and confirms block inclusion & gas", async () => {
    const sim = getSimulatedState();
    const logs = sim.mockAdapter.getLogs();
    assert(logs.length > 0);
    const targetTx = logs[0].txHash;

    const report = await inspectTransaction({
      tx: targetTx,
      rpc: "mock",
      silent: true,
    });

    assert.strictEqual(report.txHash.toLowerCase(), targetTx.toLowerCase());
    assert.strictEqual(report.status, "success");
    assert(report.blockNumber > 0);
    assert(BigInt(report.gasUsed) > 0n);
    assert.strictEqual(report.confidentialCiphertextPresent, true);
  });

  await it("F18-02: Asserts zero plaintext leakage for salary amounts in calldata and topics", async () => {
    const sim = getSimulatedState();
    const targetTx = sim.mockAdapter.getLogs()[0].txHash;

    const report = await inspectTransaction({
      tx: targetTx,
      rpc: "mock",
      expectedAmounts: "45000,55000,100000",
      silent: true,
    });

    assert.strictEqual(report.zeroPlaintextLeakage, true);
    assert.strictEqual(report.leakageDetected, false);
    assert.strictEqual(report.auditedAmountsChecked.length, 3);
  });

  await it("F18-03: Saves inspection report to JSON file and validates schema", async () => {
    const inspFile = path.join(TEST_DIR, "inspect-report.json");
    const sim = getSimulatedState();
    const targetTx = sim.mockAdapter.getLogs()[0].txHash;

    const report = await inspectTransaction({
      tx: targetTx,
      rpc: "mock",
      output: inspFile,
      silent: true,
    });

    assert(fs.existsSync(inspFile));
    const loaded = JSON.parse(fs.readFileSync(inspFile, "utf-8"));
    assert.strictEqual(loaded.txHash, report.txHash);
    assert.strictEqual(loaded.zeroPlaintextLeakage, true);
    assert.strictEqual(loaded.status, "success");
  });

  // =========================================================================
  // 6. CLI Program & Executable Binary Invocation
  // =========================================================================
  console.log("\n--- Suite 6: CLI Program & Executable Binary ---");

  await it("CLI-01: Commander program configures all 4 primary command groups", () => {
    const program = createProgram();
    const commands = program.commands.map((c) => c.name());
    assert(commands.includes("batch"));
    assert(commands.includes("audit"));
    assert(commands.includes("employee"));
    assert(commands.includes("observer"));
  });

  await it("CLI-02: Invokes payroll-cli.js executable via node and outputs help", () => {
    const cliPath = path.resolve(__dirname, "../bin/payroll-cli.js");
    const output = execSync(`node "${cliPath}" --help`, { encoding: "utf-8" });
    assert(output.includes("cashlayer-payroll"));
    assert(output.includes("batch"));
    assert(output.includes("audit"));
    assert(output.includes("employee"));
    assert(output.includes("observer"));
  });

  await it("CLI-03: Executes end-to-end batch creation through CLI binary", () => {
    const cliPath = path.resolve(__dirname, "../bin/payroll-cli.js");
    const csvFile = path.join(TEST_DIR, "e2e-roster.csv");
    const outManifest = path.join(TEST_DIR, "e2e-manifest.json");

    fs.writeFileSync(csvFile, `address,amount\n${EMP1_ADDR},77000`, "utf-8");

    const cmd = `node "${cliPath}" batch create --roster "${csvFile}" --output "${outManifest}"`;
    const output = execSync(cmd, { encoding: "utf-8" });

    assert(output.includes("Encrypted payroll batch manifest created successfully"));
    assert(fs.existsSync(outManifest));
    const manifest = JSON.parse(fs.readFileSync(outManifest, "utf-8"));
    assert.strictEqual(manifest.totalGrossAmount, "77000");
  });

  // =========================================================================
  // Final Test Report & Summary
  // =========================================================================
  console.log("\n==============================================================================");
  console.log(`   Test Results: ${passed} passed, ${failed} failed`);
  console.log("==============================================================================");

  // Clean up test directory
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
