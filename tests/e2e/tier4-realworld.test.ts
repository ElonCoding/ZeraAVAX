/**
 * Tier 4 — Real-World Application Workload Scenarios.
 * Contains 6 comprehensive, realistic corporate payroll scenarios:
 * 1. Standard Monthly Corporate Payroll (5 employees, multi-role verification)
 * 2. Quarterly Performance Bonus with Additive Homomorphic Balances
 * 3. Global Remote Contractor Payouts (Consecutive Micro-Batches)
 * 4. Regulatory Tax Compliance Audit & Verification
 * 5. Multi-Department Enterprise Payroll with Segregation of Duties
 * 6. Disrupted Network Recovery & Idempotent Reconciliation
 */

import { describe, it, expect, beforeEach } from "./helpers/test-framework.ts";
import { MockAvalancheRPC } from "./helpers/mock-rpc.ts";
import {
  BabyJub,
  Poseidon,
  ElGamal,
} from "./helpers/crypto-sim.ts";
import {
  SimulatedPrivatePayroll,
  SimulatedComplianceVerifier,
  BatchStatus,
} from "./helpers/contract-sim.ts";
import { SimulatedEERCAdapter } from "./helpers/eerc-sim.ts";
import { PayrollCLI } from "./helpers/cli-sim.ts";
import { WebAppSimulator } from "./helpers/web-sim.ts";
import { TEST_ACCOUNTS } from "./helpers/test-accounts.ts";

let rpc: MockAvalancheRPC;
let payroll: SimulatedPrivatePayroll;
let compliance: SimulatedComplianceVerifier;
let adapter: SimulatedEERCAdapter;
let cli: PayrollCLI;
let web: WebAppSimulator;

beforeEach(() => {
  rpc = new MockAvalancheRPC(43114);
  payroll = new SimulatedPrivatePayroll(rpc, TEST_ACCOUNTS.employer.address);
  compliance = new SimulatedComplianceVerifier(rpc, TEST_ACCOUNTS.employer.address);
  adapter = new SimulatedEERCAdapter(rpc);
  cli = new PayrollCLI(adapter, payroll);
  web = new WebAppSimulator(rpc, adapter, payroll, compliance);
});

describe("Tier 4: Real-World Corporate Payroll Scenarios", () => {
  // -------------------------------------------------------------------------
  // Scenario 1: Standard Monthly Corporate Payroll Run
  // -------------------------------------------------------------------------
  it("Scenario 1: End-to-End Standard Monthly Corporate Payroll (5 Employees, Multi-Persona)", async () => {
    // Stage 1: Setup auditor registration
    compliance.registerAuditor(
      TEST_ACCOUNTS.employer.address,
      TEST_ACCOUNTS.auditor.address,
      "Apex Global Compliance LLC"
    );

    // Stage 2: Employer prepares monthly payroll roster
    const salaryAlice = 1250000n;
    const salaryBob = 1100000n;
    const salaryCharlie = 950000n;
    const salaryDiana = 980000n;
    const salaryEvan = 1050000n;
    const totalGross = salaryAlice + salaryBob + salaryCharlie + salaryDiana + salaryEvan; // 5,330,000 units

    const rosterCsv = `address,amount
${TEST_ACCOUNTS.employee1.address},${salaryAlice}
${TEST_ACCOUNTS.employee2.address},${salaryBob}
${TEST_ACCOUNTS.employee3.address},${salaryCharlie}
${TEST_ACCOUNTS.employee4.address},${salaryDiana}
${TEST_ACCOUNTS.employee5.address},${salaryEvan}`;

    // Stage 3: Employer Web UI Pre-Flight Review
    const formItems = [
      { address: TEST_ACCOUNTS.employee1.address, amount: salaryAlice.toString() },
      { address: TEST_ACCOUNTS.employee2.address, amount: salaryBob.toString() },
      { address: TEST_ACCOUNTS.employee3.address, amount: salaryCharlie.toString() },
      { address: TEST_ACCOUNTS.employee4.address, amount: salaryDiana.toString() },
      { address: TEST_ACCOUNTS.employee5.address, amount: salaryEvan.toString() },
    ];
    const preflight = web.employerReviewBatch(formItems);
    expect(preflight.valid).toBe(true);
    expect(preflight.summary?.employeeCount).toBe(5);
    expect(preflight.summary?.totalPlaintextGross).toBe(totalGross.toString());

    // Stage 4: CLI batch generation & execution
    const manifest = cli.batchCreate({ rosterCsv, tokenAddress: adapter.tokenAddress });
    expect(manifest.employeeCount).toBe(5);

    const execResult = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(execResult.confirmed).toBe(true);
    expect(execResult.txHashes.length).toBe(5);

    // Stage 5: On-chain PrivatePayroll contract state verification
    const onChainBatch = payroll.getBatch(manifest.batchId);
    expect(onChainBatch?.status).toBe(BatchStatus.Confirmed);
    expect(onChainBatch?.employeeCount).toBe(5);
    expect(payroll.isBatchExecuted(manifest.batchId)).toBe(true);

    // Stage 6: Confidential Employee Portal Verifications
    const portalAlice = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee1.address,
      viewingKey: TEST_ACCOUNTS.employee1.babyJubSecret.toString(),
    });
    expect(portalAlice.confidentialBalance).toBe(salaryAlice.toString());
    expect(portalAlice.canViewOtherEmployees).toBe(false);

    const portalBob = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee2.address,
      viewingKey: TEST_ACCOUNTS.employee2.babyJubSecret.toString(),
    });
    expect(portalBob.confidentialBalance).toBe(salaryBob.toString());

    // Stage 7: Auditor Compliance Audit & Attestation
    const auditReport = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      expectedTotal: totalGross,
    });
    expect(auditReport.isCompliant).toBe(true);
    expect(auditReport.transactionCount).toBe(5);
    expect(auditReport.totalDecryptedDisbursements).toBe(totalGross.toString());

    compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: manifest.batchId,
      reportHash: auditReport.complianceAttestationHash,
      isCompliant: true,
    });
    const attestation = compliance.getAttestation(manifest.batchId, TEST_ACCOUNTS.auditor.address);
    expect(attestation?.isCompliant).toBe(true);

    // Stage 8: Public Observer Blockchain Audit (Zero Plaintext Leakage)
    for (const txHash of execResult.txHashes) {
      const inspect = web.publicObserverInspect(txHash, [
        salaryAlice,
        salaryBob,
        salaryCharlie,
        salaryDiana,
        salaryEvan,
      ]);
      expect(inspect.exists).toBe(true);
      expect(inspect.status).toBe(1);
      expect(inspect.zeroPlaintextLeakageVerified).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Quarterly Performance Bonus with Additive Homomorphic Balances
  // -------------------------------------------------------------------------
  it("Scenario 2: Quarterly Performance Bonus Distribution & Additive Homomorphic Balances", async () => {
    // 1. Initial Month 1 Salary
    const baseAlice = 1000000n;
    const baseBob = 900000n;
    const m1 = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},${baseAlice}
${TEST_ACCOUNTS.employee2.address},${baseBob}`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest: m1,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });

    // 2. Performance Bonus Batch (Quarterly)
    const bonusAlice = 250000n; // High rating bonus
    const bonusBob = 150000n;
    const m2 = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},${bonusAlice}
${TEST_ACCOUNTS.employee2.address},${bonusBob}`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest: m2,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });

    // 3. Employee 1 verifies additive balance: 1,000,000 + 250,000 = 1,250,000
    const bAlice = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(bAlice.decrypted).toBe(baseAlice + bonusAlice);

    // 4. Employee 2 verifies additive balance: 900,000 + 150,000 = 1,050,000
    const bBob = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee2.address,
      TEST_ACCOUNTS.employee2.babyJubSecret.toString()
    );
    expect(bBob.decrypted).toBe(baseBob + bonusBob);

    // 5. Auditor independently verifies both batches
    const auditM1 = await cli.auditVerify({
      batchId: m1.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      expectedTotal: baseAlice + baseBob + bonusAlice + bonusBob, // total across logs
    });
    expect(auditM1.isCompliant).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Global Remote Contractor Payouts (Frequent Micro-Batches)
  // -------------------------------------------------------------------------
  it("Scenario 3: Global Remote Contractor Payouts across Consecutive Blocks", async () => {
    // 3 weekly milestone disbursements to external contractor (Charlie)
    const payouts = [150000n, 200000n, 175000n];
    const txList: `0x${string}`[] = [];

    for (let week = 0; week < payouts.length; week++) {
      const manifest = cli.batchCreate({
        rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee3.address},${payouts[week]}`,
        tokenAddress: adapter.tokenAddress,
      });
      const res = await cli.batchExecute({
        manifest,
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        employerAddress: TEST_ACCOUNTS.employer.address,
      });
      expect(res.confirmed).toBe(true);
      txList.push(res.txHashes[0]);
    }

    // Verify contractor's cumulative balance
    const totalExpected = payouts.reduce((a, b) => a + b, 0n);
    const contractorBal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee3.address,
      TEST_ACCOUNTS.employee3.babyJubSecret.toString()
    );
    expect(contractorBal.decrypted).toBe(totalExpected);

    // Verify all 3 transactions have ascending block numbers
    for (let i = 1; i < txList.length; i++) {
      const receiptPrev = rpc.getTransactionReceipt(txList[i - 1]);
      const receiptCurr = rpc.getTransactionReceipt(txList[i]);
      expect(receiptCurr?.blockNumber).toBeGreaterThan(receiptPrev?.blockNumber ?? 0n);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Regulatory Tax Compliance Audit & Investigation
  // -------------------------------------------------------------------------
  it("Scenario 4: Formal Regulatory Compliance Audit & Immutable Ledger Investigation", async () => {
    compliance.registerAuditor(
      TEST_ACCOUNTS.employer.address,
      TEST_ACCOUNTS.auditor.address,
      "Internal Revenue & Financial Conduct Authority"
    );

    // Execute payroll
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},500000
${TEST_ACCOUNTS.employee2.address},500000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });

    // Auditor queries logs from block 0 to current
    const auditReport = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      expectedTotal: 1000000n,
    });
    expect(auditReport.isCompliant).toBe(true);
    expect(auditReport.transactions.length).toBe(2);

    // Auditor commits compliance attestation on Avalanche L1
    compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: manifest.batchId,
      reportHash: auditReport.complianceAttestationHash,
      isCompliant: true,
    });

    const attestation = compliance.getAttestation(manifest.batchId, TEST_ACCOUNTS.auditor.address);
    expect(attestation).toBeDefined();
    expect(attestation?.isCompliant).toBe(true);
    expect(attestation?.reportHash).toBe(auditReport.complianceAttestationHash);
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Multi-Department Enterprise Payroll with Segregation of Duties
  // -------------------------------------------------------------------------
  it("Scenario 5: Multi-Department Enterprise Payroll with Strict Role Separation", async () => {
    // Dept 1: Core Engineering
    const manifestEng = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},800000
${TEST_ACCOUNTS.employee5.address},750000`,
      tokenAddress: adapter.tokenAddress,
    });

    // Dept 2: Product & Design
    const manifestProd = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee2.address},700000
${TEST_ACCOUNTS.employee3.address},650000`,
      tokenAddress: adapter.tokenAddress,
    });

    // Segregation of Duties: Unauthorized operator (Attacker) cannot execute batches
    await expect(
      cli.batchExecute({
        manifest: manifestEng,
        senderPrivateKey: TEST_ACCOUNTS.attacker.evmPrivateKey,
        employerAddress: TEST_ACCOUNTS.attacker.address, // Unauthorized
      })
    ).toReject("Caller is not authorized employer");

    // Authorized CFO executes Engineering batch
    const execEng = await cli.batchExecute({
      manifest: manifestEng,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(execEng.confirmed).toBe(true);

    // Authorized CFO executes Product batch
    const execProd = await cli.batchExecute({
      manifest: manifestProd,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(execProd.confirmed).toBe(true);

    // Both batches are confirmed independently on-chain
    expect(payroll.isBatchExecuted(manifestEng.batchId)).toBe(true);
    expect(payroll.isBatchExecuted(manifestProd.batchId)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Disrupted Network Recovery & Idempotent Reconciliation
  // -------------------------------------------------------------------------
  it("Scenario 6: Disrupted Network Recovery & Idempotent Reconciliation without Double-Spend", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},100000`,
      tokenAddress: adapter.tokenAddress,
    });

    // 1. Initial broadcast succeeds on chain
    const execRes = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(execRes.confirmed).toBe(true);

    // 2. Simulated network disconnect: Employer app reconnects and queries batch status
    const batchState = payroll.getBatch(manifest.batchId);
    expect(batchState?.status).toBe(BatchStatus.Confirmed);

    // 3. User blindly clicks "Submit" again — contract rejects duplicate execution
    await expect(
      cli.batchExecute({
        manifest,
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        employerAddress: TEST_ACCOUNTS.employer.address,
      })
    ).toReject("Batch already exists (Replay Protection)");

    // 4. Employee received exactly ONE payment (no double spend)
    const empBal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(empBal.decrypted).toBe(100000n);
  });
});
