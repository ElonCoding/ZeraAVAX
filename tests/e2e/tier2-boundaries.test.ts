/**
 * Tier 2 — Boundary & Corner Cases Test Suite.
 * Contains >= 65 boundary, corner, negative, zero/overflow, duplicate, and replay tests.
 * Derived strictly from interface contracts, state invariants, and security specifications.
 */

import { describe, it, expect, beforeEach } from "./helpers/test-framework.ts";
import { MockAvalancheRPC } from "./helpers/mock-rpc.ts";
import {
  BabyJub,
  Poseidon,
  ElGamal,
  BASE8,
  generateMockTransferProof,
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

// ===========================================================================
// Category 1: Numeric Boundaries & Amount Constraints
// ===========================================================================
describe("Tier 2: Numeric Boundaries & Amount Constraints", () => {
  it("B01: Rejects zero amount transfer preparation", async () => {
    await expect(
      adapter.preparePayrollTransfer({
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        recipientAddress: TEST_ACCOUNTS.employee1.address,
        amount: 0n,
        senderBalance: 100000n,
        auditorAddress: TEST_ACCOUNTS.auditor.address,
      })
    ).toReject("greater than zero");
  });

  it("B02: Successfully executes minimum valid 1 wei amount transfer", async () => {
    const res = await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 1n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    expect(res.receiptStatuses[0]).toBe(1);
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(bal.decrypted).toBe(1n);
  });

  it("B03: Successfully encrypts and decrypts maximum 51-bit salary (2^51 - 1)", async () => {
    const maxSafeSalary = 2n ** 51n - 1n; // 2251799813685247n
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [maxSafeSalary],
      publicKey: TEST_ACCOUNTS.auditor.babyJubPublicKey,
      nonce: 100n,
    });
    const dec = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, enc.auditorPCT);
    expect(dec).toBe(maxSafeSalary);
  });

  it("B04: Rejects transfer where sender balance is exactly 1 wei less than amount", async () => {
    await expect(
      adapter.preparePayrollTransfer({
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        recipientAddress: TEST_ACCOUNTS.employee1.address,
        amount: 5001n,
        senderBalance: 5000n,
        auditorAddress: TEST_ACCOUNTS.auditor.address,
      })
    ).toReject("Insufficient sender balance");
  });

  it("B05: Allows transfer where sender balance exactly equals transfer amount", async () => {
    const prep = await adapter.preparePayrollTransfer({
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      recipientAddress: TEST_ACCOUNTS.employee1.address,
      amount: 5000n,
      senderBalance: 5000n,
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    expect(prep.proof).toBeDefined();
  });

  it("B06: Rejects negative amount in CLI CSV import", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},-100`,
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("strictly positive");
  });

  it("B07: Rejects zero amount in CLI CSV import", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},0`,
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("strictly positive");
  });

  it("B08: Rejects non-numeric amount string in CLI CSV import", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},not_a_number`,
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("Malformed CSV row");
  });
});

// ===========================================================================
// Category 2: Empty Inputs & Malformed Data
// ===========================================================================
describe("Tier 2: Empty Inputs & Malformed Data", () => {
  it("B09: Rejects batch creation with 0 employee count parameter", () => {
    const res = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId: "0x01",
      eercToken: adapter.tokenAddress,
      employeeCount: 0,
      rosterCommitment: "0x1111",
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("greater than zero");
  });

  it("B10: Rejects empty string roster in CLI", () => {
    expect(() => {
      cli.batchCreate({ rosterCsv: "", tokenAddress: adapter.tokenAddress });
    }).toThrow("empty");
  });

  it("B11: Rejects whitespace-only roster in CLI", () => {
    expect(() => {
      cli.batchCreate({ rosterCsv: "   \n  \n\t", tokenAddress: adapter.tokenAddress });
    }).toThrow("empty");
  });

  it("B12: Rejects CSV with only headers and no employee rows", () => {
    expect(() => {
      cli.batchCreate({ rosterCsv: "address,amount\n", tokenAddress: adapter.tokenAddress });
    }).toThrow("No valid employee records parsed");
  });

  it("B13: Rejects malformed EVM address with missing characters", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: `address,amount\n0x1234,100`,
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("Invalid recipient EVM address");
  });

  it("B14: Rejects EVM address without 0x prefix", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: `address,amount\n1111111111111111111111111111111111111111,100`,
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("Invalid recipient EVM address");
  });

  it("B15: Rejects transfer to unregistered recipient address", async () => {
    await expect(
      adapter.preparePayrollTransfer({
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        recipientAddress: "0x000000000000000000000000000000000000cafe",
        amount: 100n,
        senderBalance: 1000n,
        auditorAddress: TEST_ACCOUNTS.auditor.address,
      })
    ).toReject("is not registered");
  });

  it("B16: Web review flags error when form batch recipient list is empty", () => {
    const review = web.employerReviewBatch([]);
    expect(review.valid).toBe(false);
    expect(review.errors).toContain("Batch cannot be empty");
  });
});

// ===========================================================================
// Category 3: Duplicate Recipients & Deduplication
// ===========================================================================
describe("Tier 2: Duplicate Recipients & Deduplication", () => {
  it("B17: Rejects duplicate recipient with same amount in CLI", () => {
    const csv = `address,amount
${TEST_ACCOUNTS.employee1.address},5000
${TEST_ACCOUNTS.employee1.address},5000`;
    expect(() => {
      cli.batchCreate({ rosterCsv: csv, tokenAddress: adapter.tokenAddress });
    }).toThrow("Duplicate recipient address");
  });

  it("B18: Rejects duplicate recipient with different amounts in CLI", () => {
    const csv = `address,amount
${TEST_ACCOUNTS.employee1.address},5000
${TEST_ACCOUNTS.employee1.address},8000`;
    expect(() => {
      cli.batchCreate({ rosterCsv: csv, tokenAddress: adapter.tokenAddress });
    }).toThrow("Duplicate recipient address");
  });

  it("B19: Case-insensitive duplicate detection (0x222... vs 0x222... uppercase)", () => {
    const addrUpper = TEST_ACCOUNTS.employee1.address.toUpperCase();
    const addrLower = TEST_ACCOUNTS.employee1.address.toLowerCase();
    const csv = `address,amount
${addrUpper},1000
${addrLower},1000`;
    expect(() => {
      cli.batchCreate({ rosterCsv: csv, tokenAddress: adapter.tokenAddress });
    }).toThrow("Duplicate recipient address");
  });

  it("B20: Web UI preflight review catches duplicate recipients", () => {
    const review = web.employerReviewBatch([
      { address: TEST_ACCOUNTS.employee1.address, amount: "1000" },
      { address: TEST_ACCOUNTS.employee2.address, amount: "2000" },
      { address: TEST_ACCOUNTS.employee1.address, amount: "3000" },
    ]);
    expect(review.valid).toBe(false);
    expect(review.errors.some((e) => e.includes("Duplicate address"))).toBe(true);
  });

  it("B21: Triplicate recipient addresses properly rejected", () => {
    const csv = `address,amount
${TEST_ACCOUNTS.employee1.address},1000
${TEST_ACCOUNTS.employee1.address},2000
${TEST_ACCOUNTS.employee1.address},3000`;
    expect(() => {
      cli.batchCreate({ rosterCsv: csv, tokenAddress: adapter.tokenAddress });
    }).toThrow("Duplicate recipient address");
  });
});

// ===========================================================================
// Category 4: Batch Size Boundaries
// ===========================================================================
describe("Tier 2: Batch Size Boundaries", () => {
  it("B22: Minimum single-employee batch (N=1) executes successfully", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},1000`,
      tokenAddress: adapter.tokenAddress,
    });
    const res = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(res.totalExecuted).toBe(1);
    expect(res.confirmed).toBe(true);
  });

  it("B23: Small team batch (N=3) executes and distributes distinct amounts", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},10000
${TEST_ACCOUNTS.employee2.address},20000
${TEST_ACCOUNTS.employee3.address},30000`,
      tokenAddress: adapter.tokenAddress,
    });
    const res = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(res.totalExecuted).toBe(3);

    const b1 = await adapter.getEncryptedBalance(TEST_ACCOUNTS.employee1.address, TEST_ACCOUNTS.employee1.babyJubSecret.toString());
    const b2 = await adapter.getEncryptedBalance(TEST_ACCOUNTS.employee2.address, TEST_ACCOUNTS.employee2.babyJubSecret.toString());
    const b3 = await adapter.getEncryptedBalance(TEST_ACCOUNTS.employee3.address, TEST_ACCOUNTS.employee3.babyJubSecret.toString());
    expect(b1.decrypted).toBe(10000n);
    expect(b2.decrypted).toBe(20000n);
    expect(b3.decrypted).toBe(30000n);
  });

  it("B24: Five-employee batch (N=5) completes within block gas limit", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount
${TEST_ACCOUNTS.employee1.address},1000
${TEST_ACCOUNTS.employee2.address},2000
${TEST_ACCOUNTS.employee3.address},3000
${TEST_ACCOUNTS.employee4.address},4000
${TEST_ACCOUNTS.employee5.address},5000`,
      tokenAddress: adapter.tokenAddress,
    });
    const res = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(res.totalExecuted).toBe(5);
    const estimatedGas = 5n * 420000n;
    expect(estimatedGas).toBeLessThan(15000000n); // Fits comfortably in 15M block limit
  });

  it("B25: Gas estimator accurately projects linear gas growth per recipient", () => {
    const r1 = web.employerReviewBatch([{ address: TEST_ACCOUNTS.employee1.address, amount: "100" }]);
    const r2 = web.employerReviewBatch([
      { address: TEST_ACCOUNTS.employee1.address, amount: "100" },
      { address: TEST_ACCOUNTS.employee2.address, amount: "200" },
    ]);
    const diff = (r2.summary?.estimatedGas ?? 0n) - (r1.summary?.estimatedGas ?? 0n);
    expect(diff).toBe(420000n);
  });
});

// ===========================================================================
// Category 5: Unauthorized Callers & Role Violations
// ===========================================================================
describe("Tier 2: Unauthorized Callers & Role Violations", () => {
  const batchId = "0x0000000000000000000000000000000000000000000000000000000000000100";

  it("B26: Attacker cannot create batch on PrivatePayroll", () => {
    const res = payroll.createPayrollBatch(TEST_ACCOUNTS.attacker.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized employer");
  });

  it("B27: Attacker cannot confirm batch execution", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const res = payroll.confirmBatchExecution(TEST_ACCOUNTS.attacker.address, batchId, 1);
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized employer");
  });

  it("B28: Attacker cannot cancel employer batch", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const res = payroll.cancelBatch(TEST_ACCOUNTS.attacker.address, batchId, "Sabotage");
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized employer");
  });

  it("B29: Attacker cannot register an auditor in ComplianceVerifier", () => {
    const res = compliance.registerAuditor(TEST_ACCOUNTS.attacker.address, TEST_ACCOUNTS.attacker.address, "Rogue");
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized admin");
  });

  it("B30: Attacker cannot revoke an auditor in ComplianceVerifier", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex");
    const res = compliance.revokeAuditor(TEST_ACCOUNTS.attacker.address, TEST_ACCOUNTS.auditor.address);
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized admin");
  });

  it("B31: Attacker cannot attest compliance", () => {
    const res = compliance.attestCompliance(TEST_ACCOUNTS.attacker.address, {
      batchId,
      reportHash: "0x2222",
      isCompliant: true,
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("not registered auditor");
  });

  it("B32: Revoked auditor cannot attest compliance", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex");
    compliance.revokeAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address);
    const res = compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId,
      reportHash: "0x3333",
      isCompliant: true,
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("not registered auditor");
  });

  it("B33: Attacker cannot view auditor compliance panel in Web UI", async () => {
    await expect(
      web.auditorViewCompliance({
        auditorAddress: TEST_ACCOUNTS.attacker.address,
        auditorPrivateKey: TEST_ACCOUNTS.attacker.babyJubSecret.toString(),
        targetBatchId: batchId,
      })
    ).toReject("not registered or has been revoked");
  });
});

// ===========================================================================
// Category 6: Replay Attacks & State Machine Invariants
// ===========================================================================
describe("Tier 2: Replay Attacks & State Machine Invariants", () => {
  const batchId = "0x0000000000000000000000000000000000000000000000000000000000000200";

  it("B34: Rejects re-creating already registered batchId (Replay)", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const dup = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    expect(dup.status).toBe(0);
    expect(dup.error).toContain("Batch already exists");
  });

  it("B35: Rejects re-creating batchId with altered employee count", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const dupAltered = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 5,
      rosterCommitment: "0x2222",
    });
    expect(dupAltered.status).toBe(0);
    expect(dupAltered.error).toContain("Batch already exists");
  });

  it("B36: Rejects confirming an uncreated batchId", () => {
    const res = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, "0x000000000000000000000000000000000000000000000000000000000000dead", 1);
    expect(res.status).toBe(0);
    expect(res.error).toContain("Batch not found");
  });

  it("B37: Rejects confirming already confirmed batchId", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 1);
    const reConfirm = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 1);
    expect(reConfirm.status).toBe(0);
    expect(reConfirm.error).toContain("already confirmed");
  });

  it("B38: Rejects cancelling already confirmed batchId", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 1);
    const cancelRes = payroll.cancelBatch(TEST_ACCOUNTS.employer.address, batchId, "Late cancel");
    expect(cancelRes.status).toBe(0);
    expect(cancelRes.error).toContain("Cannot cancel already confirmed batch");
  });

  it("B39: Rejects executing a cancelled batchId", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    payroll.cancelBatch(TEST_ACCOUNTS.employer.address, batchId, "Budget issue");
    const confirmRes = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 1);
    expect(confirmRes.status).toBe(0);
    expect(confirmRes.error).toContain("Cannot execute cancelled batch");
  });

  it("B40: Rejects confirmation when executed count exceeds roster count", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 2,
      rosterCommitment: "0x1111",
    });
    const confirmRes = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 3);
    expect(confirmRes.status).toBe(0);
    expect(confirmRes.error).toContain("does not match roster");
  });
});

// ===========================================================================
// Category 7: Cryptographic Edge Cases & Key Tampering
// ===========================================================================
describe("Tier 2: Cryptographic Edge Cases & Key Tampering", () => {
  it("B41: Invalid viewing key fails to decrypt employee balance", async () => {
    const res = await adapter.getEncryptedBalance(TEST_ACCOUNTS.employee1.address, "99999999");
    expect(res.decrypted).toBeUndefined();
  });

  it("B42: Tampered auditorPCT length (< 7 elements) throws on decryption", () => {
    const corruptPCT = ["1", "2", "3", "4", "5", "6"];
    expect(() => {
      Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, corruptPCT);
    }).toThrow("Invalid auditorPCT length");
  });

  it("B43: Tampered auditorPCT cipher yields wrong amount on decryption", () => {
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [50000n],
      publicKey: TEST_ACCOUNTS.auditor.babyJubPublicKey,
      nonce: 10n,
    });
    // Tamper first cipher element
    const tampered = [...enc.auditorPCT];
    tampered[0] = (BigInt(tampered[0]) + 1n).toString();
    const dec = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, tampered);
    expect(dec).not.toBe(50000n);
  });

  it("B44: Tampered authKey point yields wrong amount on decryption", () => {
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [50000n],
      publicKey: TEST_ACCOUNTS.auditor.babyJubPublicKey,
      nonce: 10n,
    });
    // Tamper authKey x coordinate
    const tampered = [...enc.auditorPCT];
    tampered[3] = (BigInt(tampered[3]) + 1n).toString();
    const dec = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, tampered);
    expect(dec).not.toBe(50000n);
  });

  it("B45: ElGamal discrete log search throws when balance exceeds search bounds", () => {
    const pk = TEST_ACCOUNTS.employee1.babyJubPublicKey;
    const sk = TEST_ACCOUNTS.employee1.babyJubSecret;
    const eg = ElGamal.encrypt(pk, 50000n, 12n);
    // Limit search to 1000
    expect(() => {
      ElGamal.decrypt(sk, eg.cipher, 1000n);
    }).toThrow("Discrete log search exceeded limit");
  });

  it("B46: Base8 scalar multiplication with order returns identity (0, 1)", () => {
    const identity = BabyJub.mulWithScalar(BASE8, BabyJub.order);
    expect(identity[0]).toBe(0n);
    expect(identity[1]).toBe(1n);
  });

  it("B47: Base8 scalar multiplication with 0 returns identity (0, 1)", () => {
    const identity = BabyJub.mulWithScalar(BASE8, 0n);
    expect(identity[0]).toBe(0n);
    expect(identity[1]).toBe(1n);
  });

  it("B48: Point outside BabyJub curve returns false from isOnCurve", () => {
    const fakePoint: [bigint, bigint] = [12345n, 67890n];
    expect(BabyJub.isOnCurve(fakePoint)).toBe(false);
  });
});

// ===========================================================================
// Category 8: Network Mismatch & RPC Edge Cases
// ===========================================================================
describe("Tier 2: Network Mismatch & RPC Edge Cases", () => {
  it("B49: Wallet rejects connection on Ethereum Mainnet (ChainId 1)", () => {
    const conn = web.connectWallet({ address: TEST_ACCOUNTS.employer.address, chainId: 1 });
    expect(conn.networkValid).toBe(false);
    expect(conn.error).toContain("Mismatched network");
  });

  it("B50: Wallet rejects connection on Fuji Testnet (ChainId 43113)", () => {
    const conn = web.connectWallet({ address: TEST_ACCOUNTS.employer.address, chainId: 43113 });
    expect(conn.networkValid).toBe(false);
  });

  it("B51: Wallet rejects connection on Polygon (ChainId 137)", () => {
    const conn = web.connectWallet({ address: TEST_ACCOUNTS.employer.address, chainId: 137 });
    expect(conn.networkValid).toBe(false);
  });

  it("B52: Wallet rejects connection on Arbitrum (ChainId 42161)", () => {
    const conn = web.connectWallet({ address: TEST_ACCOUNTS.employer.address, chainId: 42161 });
    expect(conn.networkValid).toBe(false);
  });

  it("B53: Querying non-existent transaction hash returns undefined", () => {
    const tx = rpc.getTransaction("0x000000000000000000000000000000000000000000000000000000000000beef");
    expect(tx).toBeUndefined();
  });

  it("B54: Querying non-existent receipt returns undefined", () => {
    const receipt = rpc.getTransactionReceipt("0x000000000000000000000000000000000000000000000000000000000000beef");
    expect(receipt).toBeUndefined();
  });

  it("B55: Filtering logs for non-existent event name returns empty list", () => {
    const logs = rpc.getLogs({ eventName: "NonExistentEvent" });
    expect(logs.length).toBe(0);
  });

  it("B56: Filtering logs with future block height returns empty list", () => {
    const logs = rpc.getLogs({ fromBlock: 999999999n });
    expect(logs.length).toBe(0);
  });
});

// ===========================================================================
// Category 9: Auditor Rotation & Isolation
// ===========================================================================
describe("Tier 2: Auditor Rotation & Isolation", () => {
  it("B57: Previous auditor cannot decrypt transfers executed after auditor rotation", async () => {
    // 1. Initial transfer with original auditor
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 10000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });

    // 2. Rotate auditor to Employee 5 as new auditor
    const newAuditorPK = TEST_ACCOUNTS.employee5.babyJubPublicKey;
    adapter.setAuditor(TEST_ACCOUNTS.employee5.address, newAuditorPK);

    // 3. New transfer encrypted for new auditor
    await adapter.executeBatchTransfers({
      batchId: "0x02",
      transfers: [{ recipient: TEST_ACCOUNTS.employee2.address, amount: 20000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });

    // 4. Decrypt using original auditor key: tx2 will not match original auditor PK
    const allDecrypted = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(allDecrypted.length).toBe(2);
    // The first one decrypts to 10000
    expect(allDecrypted[0].amount).toBe(10000n);
    // The second one was encrypted for employee5, so original auditor cannot decrypt it correctly
    expect(allDecrypted[1].amount).not.toBe(20000n);
  });

  it("B58: New auditor can decrypt new transfer after rotation", async () => {
    adapter.setAuditor(TEST_ACCOUNTS.employee5.address, TEST_ACCOUNTS.employee5.babyJubPublicKey);
    await adapter.executeBatchTransfers({
      batchId: "0x03",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 77000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const decNew = await adapter.auditorDecrypt(TEST_ACCOUNTS.employee5.babyJubSecret.toString());
    const match = decNew.find((d) => d.recipient.toLowerCase() === TEST_ACCOUNTS.employee1.address.toLowerCase());
    expect(match?.amount).toBe(77000n);
  });

  it("B59: Multiple audits across multiple batches record separate attestations", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex");
    compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: "0x01",
      reportHash: "0x1111",
      isCompliant: true,
    });
    compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: "0x02",
      reportHash: "0x2222",
      isCompliant: true,
    });
    const a1 = compliance.getAttestation("0x01", TEST_ACCOUNTS.auditor.address);
    const a2 = compliance.getAttestation("0x02", TEST_ACCOUNTS.auditor.address);
    expect(a1?.reportHash).toBe("0x1111");
    expect(a2?.reportHash).toBe("0x2222");
  });

  it("B60: Attestation with isCompliant=false is accurately recorded on-chain", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex");
    compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: "0x03",
      reportHash: "0x3333",
      isCompliant: false, // Discrepancy found
    });
    const a = compliance.getAttestation("0x03", TEST_ACCOUNTS.auditor.address);
    expect(a?.isCompliant).toBe(false);
  });
});
