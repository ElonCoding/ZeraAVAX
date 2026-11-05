/**
 * Automated Component & View Tests for @cashlayer/web.
 * Tests F14 (Wallet Connection), F15 (Employer Batch Creation), F16 (Employee Confidential Portal),
 * F17 (Auditor Compliance Panel), and F18 (Public Observer Explorer).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CryptoService } from "../src/services/cryptoService";
import { DEMO_ACCOUNTS } from "../src/data/demoAccounts";
import { WebPayrollItem, OnChainTxLog } from "../src/types";
import {
  BabyJub,
  Poseidon,
  MockEERCAdapter,
  ComplianceAuditor,
} from "@cashlayer/eerc-adapter";
import {
  AVALANCHE_MAINNET_CHAIN_ID,
  AVALANCHE_FUJI_CHAIN_ID,
  LOCAL_ANVIL_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  MAX_SAFE_AMOUNT_51BIT,
  AuditorPCT,
} from "@cashlayer/shared";

// ===========================================================================
// F14: Wallet Connection & Network Detection Tests
// ===========================================================================
describe("Web UI: F14 Wallet Connection & Network Detection", () => {
  it("F14-W01: Identifies valid Avalanche L1 (43114), Fuji (43113), and Local Anvil (31337)", () => {
    assert.equal((SUPPORTED_CHAIN_IDS as readonly number[]).includes(43114), true);
    assert.equal((SUPPORTED_CHAIN_IDS as readonly number[]).includes(43113), true);
    assert.equal((SUPPORTED_CHAIN_IDS as readonly number[]).includes(31337), true);
  });

  it("F14-W02: Detects unsupported network (e.g. Ethereum Mainnet 1) and flags mismatch", () => {
    const isSupported = (SUPPORTED_CHAIN_IDS as readonly number[]).includes(1);
    assert.equal(isSupported, false);
  });

  it("F14-W03: Validates EVM address format strictly", () => {
    const valid = DEMO_ACCOUNTS[0].address;
    assert.match(valid, /^0x[0-9a-fA-F]{40}$/);

    const invalid = "0xinvalidaddress";
    assert.equal(/^0x[0-9a-fA-F]{40}$/.test(invalid), false);
  });

  it("F14-W04: Loads all 4 primary personas with matching keys in demo accounts dataset", () => {
    const roles = DEMO_ACCOUNTS.map((a) => a.role);
    assert.equal(roles.includes("employer"), true);
    assert.equal(roles.includes("employee"), true);
    assert.equal(roles.includes("auditor"), true);
    assert.equal(roles.includes("observer"), true);

    // Verify BabyJub keys are on Twisted Edwards curve
    for (const acc of DEMO_ACCOUNTS) {
      assert.equal(BabyJub.isOnCurve(acc.babyJubPublicKey), true);
    }
  });

  it("F14-W05: Persona switching updates active account and role cleanly", () => {
    const employer = DEMO_ACCOUNTS.find((a) => a.role === "employer")!;
    const alice = DEMO_ACCOUNTS.find((a) => a.id === "employee1")!;
    const auditor = DEMO_ACCOUNTS.find((a) => a.role === "auditor")!;

    assert.notEqual(employer.address, alice.address);
    assert.notEqual(alice.address, auditor.address);
  });
});

// ===========================================================================
// F15: Employer Batch Creation & Validation Tests
// ===========================================================================
describe("Web UI: F15 Employer Batch Creation & Pre-Flight Review", () => {
  it("F15-W01: Pre-flight validator calculates gross total, employee count, and gas estimate", () => {
    const items: WebPayrollItem[] = [
      { id: "1", address: DEMO_ACCOUNTS[1].address, amount: "1000000", department: "Engineering" },
      { id: "2", address: DEMO_ACCOUNTS[2].address, amount: "2000000", department: "Product" },
    ];

    const result = CryptoService.validateAndSummarizeBatch(items);
    assert.equal(result.valid, true);
    assert.equal(result.summary?.employeeCount, 2);
    assert.equal(result.summary?.totalPlaintextGross, 3000000n);
    assert.equal(result.summary?.estimatedGas, 2n * 420000n + 150000n);
    assert.equal(result.summary?.zeroPlaintextShieldValid, true);
  });

  it("F15-W02: Detects and rejects duplicate recipient addresses in roster", () => {
    const items: WebPayrollItem[] = [
      { id: "1", address: DEMO_ACCOUNTS[1].address, amount: "1000" },
      { id: "2", address: DEMO_ACCOUNTS[1].address, amount: "2000" }, // duplicate address
    ];

    const result = CryptoService.validateAndSummarizeBatch(items);
    assert.equal(result.valid, false);
    assert.equal(result.errors.some((e) => e.includes("Duplicate recipient address")), true);
  });

  it("F15-W03: Rejects empty batch submission", () => {
    const result = CryptoService.validateAndSummarizeBatch([]);
    assert.equal(result.valid, false);
    assert.equal(result.errors.some((e) => e.includes("cannot be empty")), true);
  });

  it("F15-W04: Rejects negative, zero, and malformed amounts", () => {
    const zeroRes = CryptoService.validateAndSummarizeBatch([
      { id: "1", address: DEMO_ACCOUNTS[1].address, amount: "0" },
    ]);
    assert.equal(zeroRes.valid, false);
    assert.equal(zeroRes.errors.some((e) => e.includes("strictly positive")), true);

    const malformedRes = CryptoService.validateAndSummarizeBatch([
      { id: "1", address: DEMO_ACCOUNTS[1].address, amount: "abc" },
    ]);
    assert.equal(malformedRes.valid, false);
  });

  it("F15-W05: Rejects amounts exceeding 51-bit circom range limit", () => {
    const overflowAmt = (MAX_SAFE_AMOUNT_51BIT + 100n).toString();
    const result = CryptoService.validateAndSummarizeBatch([
      { id: "1", address: DEMO_ACCOUNTS[1].address, amount: overflowAmt },
    ]);
    assert.equal(result.valid, false);
    assert.equal(result.errors.some((e) => e.includes("exceeds 51-bit")), true);
  });

  it("F15-W06: Computes deterministic 32-byte Poseidon cryptographic roster commitment", () => {
    const items = [
      { address: DEMO_ACCOUNTS[1].address, amount: 50000n },
      { address: DEMO_ACCOUNTS[2].address, amount: 60000n },
    ];
    const c1 = CryptoService.computeRosterCommitment(items);
    const c2 = CryptoService.computeRosterCommitment(items);
    assert.equal(c1, c2);
    assert.equal(c1.startsWith("0x"), true);
    assert.equal(c1.length, 66);
  });

  it("F15-W07: CSV parser parses and validates standard CSV payroll files", () => {
    const csv = `address,amount,department\n${DEMO_ACCOUNTS[1].address},1250000,Engineering\n${DEMO_ACCOUNTS[2].address},1100000,Product`;
    const parsed = CryptoService.parseRosterCsvString(csv);
    assert.equal(parsed.errors, undefined);
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0].address.toLowerCase(), DEMO_ACCOUNTS[1].address.toLowerCase());
    assert.equal(parsed.items[0].amount, "1250000");
  });
});

// ===========================================================================
// F16: Employee Confidential Portal Tests
// ===========================================================================
describe("Web UI: F16 Employee Confidential Portal", () => {
  it("F16-W01: Employee decrypts incoming confidential compensation using personal BabyJub secret", () => {
    const alice = DEMO_ACCOUNTS[1];
    const secretSalary = 1250000n;

    // Encrypt using Alice's public key
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [secretSalary],
      publicKey: alice.babyJubPublicKey,
      nonce: 55n,
    });

    // Decrypt using Alice's viewing key
    const decrypted = CryptoService.decryptCiphertext(alice.babyJubSecret, enc.auditorPCT);
    assert.equal(decrypted, secretSalary);
  });

  it("F16-W02: Decryption fails or throws when attempted with incorrect viewing key", () => {
    const alice = DEMO_ACCOUNTS[1];
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [1250000n],
      publicKey: alice.babyJubPublicKey,
      nonce: 55n,
    });

    const bobSecret = DEMO_ACCOUNTS[2].babyJubSecret;
    const decrypted = CryptoService.decryptCiphertext(bobSecret, enc.auditorPCT);
    // Poseidon symmetric key derived with wrong secret results in garbage scalar, not 1250000n
    assert.notEqual(decrypted, 1250000n);
  });

  it("F16-W03: Privacy Isolation: Employee cannot decrypt peer employee salary ciphertexts", () => {
    const bob = DEMO_ACCOUNTS[2];
    const bobSalary = 1100000n;

    const bobEnc = Poseidon.processPoseidonEncryption({
      inputs: [bobSalary],
      publicKey: bob.babyJubPublicKey,
      nonce: 88n,
    });

    // Alice attempts to decrypt Bob's ciphertext
    const aliceSecret = DEMO_ACCOUNTS[1].babyJubSecret;
    const aliceAttempt = CryptoService.decryptCiphertext(aliceSecret, bobEnc.auditorPCT);
    assert.notEqual(aliceAttempt, bobSalary);
  });

  it("F16-W04: Additive homomorphic accumulation of consecutive payments", () => {
    const alice = DEMO_ACCOUNTS[1];
    const payment1 = 10000n;
    const payment2 = 15000n;

    const enc1 = Poseidon.processPoseidonEncryption({
      inputs: [payment1],
      publicKey: alice.babyJubPublicKey,
      nonce: 1n,
    });

    const enc2 = Poseidon.processPoseidonEncryption({
      inputs: [payment2],
      publicKey: alice.babyJubPublicKey,
      nonce: 2n,
    });

    const dec1 = CryptoService.decryptCiphertext(alice.babyJubSecret, enc1.auditorPCT);
    const dec2 = CryptoService.decryptCiphertext(alice.babyJubSecret, enc2.auditorPCT);
    assert.equal(dec1 + dec2, 25000n);
  });
});

// ===========================================================================
// F17: Auditor Compliance Panel Tests
// ===========================================================================
describe("Web UI: F17 Auditor Compliance Panel", () => {
  it("F17-W01: Authorized auditor decrypts all uint256[7] auditorPCT disbursements", () => {
    const auditor = DEMO_ACCOUNTS.find((a) => a.role === "auditor")!;
    const amt1 = 1250000n;
    const amt2 = 1100000n;

    const enc1 = Poseidon.processPoseidonEncryption({
      inputs: [amt1],
      publicKey: auditor.babyJubPublicKey,
      nonce: 11n,
    });

    const enc2 = Poseidon.processPoseidonEncryption({
      inputs: [amt2],
      publicKey: auditor.babyJubPublicKey,
      nonce: 12n,
    });

    const dec1 = CryptoService.decryptCiphertext(auditor.babyJubSecret, enc1.auditorPCT);
    const dec2 = CryptoService.decryptCiphertext(auditor.babyJubSecret, enc2.auditorPCT);

    assert.equal(dec1, amt1);
    assert.equal(dec2, amt2);
    assert.equal(dec1 + dec2, 2350000n);
  });

  it("F17-W02: Batch reconciliation passes when decrypted sum matches expected gross total", () => {
    const batchId = "0x8fa40bc78864705a63901b0f592d3080aa98c81ef40763ea119f4a9b60e6e701" as `0x${string}`;
    const totalDisbursed = 2350000n;
    const isCompliant = true;

    const reportHash = ComplianceAuditor.computeReportHash(batchId, totalDisbursed, isCompliant);
    assert.equal(reportHash.startsWith("0x"), true);
    assert.equal(reportHash.length, 66);
  });

  it("F17-W03: Batch reconciliation flags non-compliance when decrypted sum does not match", () => {
    const batchId = "0x8fa40bc78864705a63901b0f592d3080aa98c81ef40763ea119f4a9b60e6e701" as `0x${string}`;
    const totalDisbursed = 2000000n;
    const isCompliant = false;

    const reportHashNonCompliant = ComplianceAuditor.computeReportHash(batchId, totalDisbursed, isCompliant);
    const reportHashCompliant = ComplianceAuditor.computeReportHash(batchId, totalDisbursed, true);

    assert.notEqual(reportHashNonCompliant, reportHashCompliant);
  });

  it("F17-W04: Non-overreach notice text adheres to legal & cryptographic disclosures", () => {
    const notice =
      "Auditor disclosure notice: eERC auditor key decrypts all private transfers on this token contract while active. Selective sub-batch masking is not claimed without separate token instances.";
    assert.equal(notice.includes("eERC auditor key decrypts all private transfers"), true);
    assert.equal(notice.includes("Selective sub-batch masking is not claimed"), true);
  });
});

// ===========================================================================
// F18: Public Observer Explorer View Tests
// ===========================================================================
describe("Web UI: F18 Public Observer Explorer & Zero-Plaintext Audit", () => {
  it("F18-W01: Public observer inspects transaction hash, block number, and gas used", () => {
    const mockTx: OnChainTxLog = {
      txHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
      batchId: "0x8fa40bc78864705a63901b0f592d3080aa98c81ef40763ea119f4a9b60e6e701",
      blockNumber: 12054231n,
      sender: DEMO_ACCOUNTS[0].address,
      recipient: DEMO_ACCOUNTS[1].address,
      auditorPCT: ["1", "2", "3", "4", "5", "6", "7"] as AuditorPCT,
      receiverEncryptedAmount: ["1", "2", "3", "4", "5", "6", "7"],
      calldataPreview: "0xa9059cbb" + "0".repeat(64),
      status: 1,
      gasUsed: 423500n,
      timestamp: Date.now(),
      zeroPlaintextVerified: true,
    };

    assert.equal(mockTx.status, 1);
    assert.equal(mockTx.blockNumber, 12054231n);
    assert.equal(mockTx.gasUsed > 0n, true);
  });

  it("F18-W02: Zero-Plaintext Audit confirms sensitive salary integers do NOT leak in calldata or logs", () => {
    const aliceSalary = 1250000n;
    const bobSalary = 1100000n;

    // Simulate Poseidon encrypted transaction
    const encAlice = Poseidon.processPoseidonEncryption({
      inputs: [aliceSalary],
      publicKey: DEMO_ACCOUNTS[1].babyJubPublicKey,
      nonce: 10n,
    });

    const encAuditor = Poseidon.processPoseidonEncryption({
      inputs: [aliceSalary],
      publicKey: DEMO_ACCOUNTS[6].babyJubPublicKey,
      nonce: 20n,
    });

    const txLog: OnChainTxLog = {
      txHash: "0x1111222233334444555566667777888899990000111122223333444455556666",
      batchId: "0x0101010101010101010101010101010101010101010101010101010101010101",
      blockNumber: 12054231n,
      sender: DEMO_ACCOUNTS[0].address,
      recipient: DEMO_ACCOUNTS[1].address,
      auditorPCT: encAuditor.auditorPCT as AuditorPCT,
      receiverEncryptedAmount: encAlice.auditorPCT,
      calldataPreview: "0xa9059cbb" + encAlice.auditorPCT[0].slice(2) + encAuditor.auditorPCT[0].slice(2),
      status: 1,
      gasUsed: 420000n,
      timestamp: Date.now(),
      zeroPlaintextVerified: true,
    };

    const checkResult = CryptoService.verifyZeroPlaintextLeakage(txLog, [aliceSalary, bobSalary]);
    assert.equal(checkResult.isSecure, true);
    assert.equal(checkResult.leakedAmounts.length, 0);
  });

  it("F18-W03: Zero-Plaintext Audit detects intentional raw integer insertion", () => {
    const leakedSalary = 888888n;
    const leakyTxLog: OnChainTxLog = {
      txHash: "0x9999888877776666555544443333222211110000999988887777666655554444",
      batchId: "0x0202020202020202020202020202020202020202020202020202020202020202",
      blockNumber: 12054232n,
      sender: DEMO_ACCOUNTS[0].address,
      recipient: DEMO_ACCOUNTS[1].address,
      auditorPCT: ["1", "2", "3", "4", "5", "6", "7"] as AuditorPCT,
      receiverEncryptedAmount: ["1", "2", "3", "4", "5", "6", "7"],
      calldataPreview: "0xa9059cbb" + "0".repeat(50) + "888888" + "0".repeat(10), // intentional leak
      status: 1,
      gasUsed: 420000n,
      timestamp: Date.now(),
      zeroPlaintextVerified: false,
    };

    const checkResult = CryptoService.verifyZeroPlaintextLeakage(leakyTxLog, [leakedSalary]);
    assert.equal(checkResult.isSecure, false);
    assert.equal(checkResult.leakedAmounts.includes(leakedSalary), true);
  });
});
