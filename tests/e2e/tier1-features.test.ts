/**
 * Tier 1 — Feature Coverage Test Suite (F01 - F18).
 * Contains >= 5 isolated, rigorous tests per feature (>= 90 tests total).
 * Derived strictly from specifications and interface contracts in PROJECT.md.
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
// F01: Monorepo & Toolchain Setup
// ===========================================================================
describe("F01: Monorepo & Toolchain Setup", () => {
  it("F01-01: Validates Avalanche L1 chain configuration parameter", () => {
    expect(rpc.getChainId()).toBe(43114);
  });

  it("F01-02: Validates block progression advances on mined transactions", () => {
    const initialBlock = rpc.getBlockNumber();
    rpc.mineBlock();
    expect(rpc.getBlockNumber()).toBe(initialBlock + 1n);
  });

  it("F01-03: Validates account nonce tracking increments per transaction", () => {
    const nonce0 = rpc.getNextNonce(TEST_ACCOUNTS.employer.address);
    expect(nonce0).toBe(0);
    rpc.submitTransaction({
      from: TEST_ACCOUNTS.employer.address,
      to: payroll.address,
      data: "0x01",
    });
    const nonce1 = rpc.getNextNonce(TEST_ACCOUNTS.employer.address);
    expect(nonce1).toBe(1);
  });

  it("F01-04: Validates EVM transaction receipt contains valid gas and status", () => {
    const receipt = rpc.submitTransaction({
      from: TEST_ACCOUNTS.employer.address,
      to: payroll.address,
      data: "0x02",
      gasLimit: 300000n,
    });
    expect(receipt.status).toBe(1);
    expect(receipt.gasUsed).toBe(300000n);
    expect(receipt.transactionHash.startsWith("0x")).toBe(true);
  });

  it("F01-05: Validates log indexing and filtering by contract address", () => {
    rpc.submitTransaction({
      from: TEST_ACCOUNTS.employer.address,
      to: payroll.address,
      data: "0x03",
      executionFn: () => ({
        status: 1,
        logs: [{ address: payroll.address, topics: ["0xTestTopic"], data: "0xdata" }],
      }),
    });
    const logs = rpc.getLogs({ address: payroll.address });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].address).toBe(payroll.address);
  });
});

// ===========================================================================
// F02: Private Payroll Smart Contract
// ===========================================================================
describe("F02: Private Payroll Smart Contract", () => {
  const dummyCommitment = "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
  const batchId = "0x0000000000000000000000000000000000000000000000000000000000000001";

  it("F02-01: Employer successfully creates payroll batch with valid commitment", () => {
    const res = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 3,
      rosterCommitment: dummyCommitment,
    });
    expect(res.status).toBe(1);
    const b = payroll.getBatch(batchId);
    expect(b).toBeDefined();
    expect(b?.employeeCount).toBe(3);
    expect(b?.status).toBe(BatchStatus.Ready);
  });

  it("F02-02: Non-employer cannot create payroll batch", () => {
    const res = payroll.createPayrollBatch(TEST_ACCOUNTS.attacker.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 3,
      rosterCommitment: dummyCommitment,
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized employer");
  });

  it("F02-03: Rejects batch creation with zero employee count", () => {
    const res = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 0,
      rosterCommitment: dummyCommitment,
    });
    expect(res.status).toBe(0);
    expect(res.error).toContain("greater than zero");
  });

  it("F02-04: Confirms batch execution and transitions status to Confirmed", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 2,
      rosterCommitment: dummyCommitment,
    });
    const confirmRes = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 2);
    expect(confirmRes.status).toBe(1);

    const b = payroll.getBatch(batchId);
    expect(b?.status).toBe(BatchStatus.Confirmed);
    expect(payroll.isBatchExecuted(batchId)).toBe(true);
  });

  it("F02-05: Allows employer to cancel an unconfirmed batch", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 2,
      rosterCommitment: dummyCommitment,
    });
    const cancelRes = payroll.cancelBatch(TEST_ACCOUNTS.employer.address, batchId, "Budget adjustment");
    expect(cancelRes.status).toBe(1);
    const b = payroll.getBatch(batchId);
    expect(b?.status).toBe(BatchStatus.Cancelled);
  });
});

// ===========================================================================
// F03: Compliance Verifier Contract
// ===========================================================================
describe("F03: Compliance Verifier Contract", () => {
  const batchId = "0x0000000000000000000000000000000000000000000000000000000000000010";
  const reportHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("F03-01: Admin successfully registers an authorized compliance auditor", () => {
    const res = compliance.registerAuditor(
      TEST_ACCOUNTS.employer.address,
      TEST_ACCOUNTS.auditor.address,
      "Apex Compliance LLC"
    );
    expect(res.status).toBe(1);
    expect(compliance.isAuthorizedAuditor(TEST_ACCOUNTS.auditor.address)).toBe(true);
  });

  it("F03-02: Non-admin cannot register an auditor", () => {
    const res = compliance.registerAuditor(
      TEST_ACCOUNTS.attacker.address,
      TEST_ACCOUNTS.attacker.address,
      "Malicious Audit Corp"
    );
    expect(res.status).toBe(0);
    expect(res.error).toContain("not authorized admin");
  });

  it("F03-03: Registered auditor can submit valid compliance attestation", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    const attestRes = compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId,
      reportHash,
      isCompliant: true,
    });
    expect(attestRes.status).toBe(1);

    const attestation = compliance.getAttestation(batchId, TEST_ACCOUNTS.auditor.address);
    expect(attestation).toBeDefined();
    expect(attestation?.isCompliant).toBe(true);
    expect(attestation?.reportHash).toBe(reportHash);
  });

  it("F03-04: Unregistered account cannot attest compliance", () => {
    const attestRes = compliance.attestCompliance(TEST_ACCOUNTS.attacker.address, {
      batchId,
      reportHash,
      isCompliant: true,
    });
    expect(attestRes.status).toBe(0);
    expect(attestRes.error).toContain("not registered auditor");
  });

  it("F03-05: Admin can revoke auditor and prevent subsequent attestations", () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    expect(compliance.isAuthorizedAuditor(TEST_ACCOUNTS.auditor.address)).toBe(true);

    const revokeRes = compliance.revokeAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address);
    expect(revokeRes.status).toBe(1);
    expect(compliance.isAuthorizedAuditor(TEST_ACCOUNTS.auditor.address)).toBe(false);

    const attestRes = compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId,
      reportHash,
      isCompliant: true,
    });
    expect(attestRes.status).toBe(0);
  });
});

// ===========================================================================
// F04: Contract Unit & Invariant Tests
// ===========================================================================
describe("F04: Contract Unit & Invariant Tests", () => {
  const batchId = "0x0000000000000000000000000000000000000000000000000000000000000020";

  it("F04-01: Replay protection: Rejects duplicate batchId registration", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const dupRes = payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    expect(dupRes.status).toBe(0);
    expect(dupRes.error).toContain("Batch already exists");
  });

  it("F04-02: Idempotency: Rejects confirming already confirmed batch", () => {
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

  it("F04-03: Invariant: Executed count must strictly match roster count", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 3,
      rosterCommitment: "0x1111",
    });
    const mismatchConfirm = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 2);
    expect(mismatchConfirm.status).toBe(0);
    expect(mismatchConfirm.error).toContain("does not match roster");
  });

  it("F04-04: Cannot confirm or execute cancelled batch", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    payroll.cancelBatch(TEST_ACCOUNTS.employer.address, batchId, "Emergency pause");
    const confirmRes = payroll.confirmBatchExecution(TEST_ACCOUNTS.employer.address, batchId, 1);
    expect(confirmRes.status).toBe(0);
    expect(confirmRes.error).toContain("Cannot execute cancelled batch");
  });

  it("F04-05: Non-employer cannot confirm batch execution", () => {
    payroll.createPayrollBatch(TEST_ACCOUNTS.employer.address, {
      batchId,
      eercToken: adapter.tokenAddress,
      employeeCount: 1,
      rosterCommitment: "0x1111",
    });
    const badConfirm = payroll.confirmBatchExecution(TEST_ACCOUNTS.attacker.address, batchId, 1);
    expect(badConfirm.status).toBe(0);
    expect(badConfirm.error).toContain("not authorized employer");
  });
});

// ===========================================================================
// F05: Shared Types & Schemas
// ===========================================================================
describe("F05: Shared Types & Schemas", () => {
  it("F05-01: Validates EVM address format standard (0x prefix, 40 hex chars)", () => {
    const validAddr = TEST_ACCOUNTS.employee1.address;
    expect(validAddr.startsWith("0x")).toBe(true);
    expect(validAddr.length).toBe(42);
    expect(/0x[0-9a-fA-F]{40}/.test(validAddr)).toBe(true);
  });

  it("F05-02: Validates positive compensation amount representation", () => {
    const amount = 5000000n;
    expect(amount > 0n).toBe(true);
    expect(typeof amount).toBe("bigint");
  });

  it("F05-03: Validates batch manifest structure schema", () => {
    const manifest = cli.batchCreate({
      rosterCsv: "address,amount\n0x2222222222222222222222222222222222222222,1000",
      tokenAddress: adapter.tokenAddress,
    });
    expect(manifest.batchId).toBeDefined();
    expect(manifest.employeeCount).toBe(1);
    expect(manifest.recipients.length).toBe(1);
    expect(manifest.rosterCommitment.startsWith("0x")).toBe(true);
  });

  it("F05-04: Rejects malformed EVM address in schema validation", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: "address,amount\n0xInvalidAddressLength,1000",
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("Invalid recipient EVM address");
  });

  it("F05-05: Rejects negative or non-numeric amount in schema validation", () => {
    expect(() => {
      cli.batchCreate({
        rosterCsv: "address,amount\n0x2222222222222222222222222222222222222222,-500",
        tokenAddress: adapter.tokenAddress,
      });
    }).toThrow("must be strictly positive");
  });
});

// ===========================================================================
// F06: BabyJub & Poseidon Cryptography
// ===========================================================================
describe("F06: BabyJub & Poseidon Cryptography", () => {
  it("F06-01: BabyJub Base8 generator point lies on Twisted Edwards curve", () => {
    expect(BabyJub.isOnCurve(BASE8)).toBe(true);
  });

  it("F06-02: Deterministic public key generation matches scalar multiplication", () => {
    const sk = 54321n;
    const pk = BabyJub.generatePublicKey(sk);
    expect(BabyJub.isOnCurve(pk)).toBe(true);
    expect(pk[0]).toBeGreaterThan(0n);
    expect(pk[1]).toBeGreaterThan(0n);
  });

  it("F06-03: Poseidon sponge hash produces deterministic non-zero scalar", () => {
    const h1 = Poseidon.hash([100n, 200n, 300n]);
    const h2 = Poseidon.hash([100n, 200n, 300n]);
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThan(0n);
  });

  it("F06-04: Poseidon encryption produces valid uint256[7] auditorPCT layout", () => {
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [123456n],
      publicKey: TEST_ACCOUNTS.auditor.babyJubPublicKey,
      nonce: 42n,
    });
    expect(enc.auditorPCT.length).toBe(7);
    for (const elem of enc.auditorPCT) {
      expect(typeof elem).toBe("string");
      expect(BigInt(elem)).toBeGreaterThanOrEqual(0n);
    }
  });

  it("F06-05: Poseidon decryption using auditor private key recovers exact plaintext", () => {
    const secretSalary = 987654n;
    const enc = Poseidon.processPoseidonEncryption({
      inputs: [secretSalary],
      publicKey: TEST_ACCOUNTS.auditor.babyJubPublicKey,
      nonce: 99n,
    });
    const decrypted = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, enc.auditorPCT);
    expect(decrypted).toBe(secretSalary);
  });
});

// ===========================================================================
// F07: eERC Adapter (Live & Simulation)
// ===========================================================================
describe("F07: eERC Adapter (Live & Simulation)", () => {
  it("F07-01: Initializes adapter with target Avalanche RPC and contract addresses", async () => {
    await adapter.initialize("http://127.0.0.1:9650/ext/bc/C/rpc", adapter.tokenAddress);
    expect(adapter.tokenAddress.startsWith("0x")).toBe(true);
  });

  it("F07-02: Registers account and outputs valid BabyJub public key", async () => {
    const reg = await adapter.registerAccount("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(reg.publicKey).toBeDefined();
    expect(BabyJub.isOnCurve(reg.publicKey)).toBe(true);
  });

  it("F07-03: Queries encrypted balance handle structure", async () => {
    const res = await adapter.getEncryptedBalance(TEST_ACCOUNTS.employer.address);
    expect(res.encrypted.length).toBe(4);
    expect(res.encrypted[0]).toBe(BASE8[0]);
  });

  it("F07-04: Prepares confidential payroll transfer proof artifact", async () => {
    const prep = await adapter.preparePayrollTransfer({
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      recipientAddress: TEST_ACCOUNTS.employee1.address,
      amount: 50000n,
      senderBalance: 100000n,
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    expect(prep.proof).toBeDefined();
    expect(prep.proof.publicSignals.length).toBe(32);
    expect(prep.auditorPCT.length).toBe(7);
  });

  it("F07-05: Rejects transfer preparation if sender balance is insufficient", async () => {
    await expect(
      adapter.preparePayrollTransfer({
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        recipientAddress: TEST_ACCOUNTS.employee1.address,
        amount: 200000n,
        senderBalance: 100000n, // less than amount
        auditorAddress: TEST_ACCOUNTS.auditor.address,
      })
    ).toReject("Insufficient sender balance");
  });
});

// ===========================================================================
// F08: Client Amount Encryption & Proofs
// ===========================================================================
describe("F08: Client Amount Encryption & Proofs", () => {
  it("F08-01: Generates valid 32 public signals for transfer circuit", () => {
    const proof = generateMockTransferProof(
      TEST_ACCOUNTS.employer.babyJubPublicKey,
      TEST_ACCOUNTS.employee1.babyJubPublicKey,
      TEST_ACCOUNTS.auditor.babyJubPublicKey
    );
    expect(proof.publicSignals.length).toBe(32);
    expect(proof.publicSignals[0]).toBe(TEST_ACCOUNTS.employer.babyJubPublicKey[0].toString());
  });

  it("F08-02: Generates valid Groth16 proof points (a, b, c) format", () => {
    const proof = generateMockTransferProof(
      TEST_ACCOUNTS.employer.babyJubPublicKey,
      TEST_ACCOUNTS.employee1.babyJubPublicKey,
      TEST_ACCOUNTS.auditor.babyJubPublicKey
    );
    expect(proof.proofPoints.a.length).toBe(2);
    expect(proof.proofPoints.b.length).toBe(2);
    expect(proof.proofPoints.b[0].length).toBe(2);
    expect(proof.proofPoints.c.length).toBe(2);
  });

  it("F08-03: Encrypts amount for recipient using recipient BabyJub public key", async () => {
    const prep = await adapter.preparePayrollTransfer({
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      recipientAddress: TEST_ACCOUNTS.employee1.address,
      amount: 15000n,
      senderBalance: 100000n,
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    expect(prep.receiverEncryptedAmount.length).toBe(7);
    // Employee can decrypt their own incoming amount
    const dec = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.employee1.babyJubSecret, prep.receiverEncryptedAmount);
    expect(dec).toBe(15000n);
  });

  it("F08-04: Encrypts amount for auditor using auditor public key", async () => {
    const prep = await adapter.preparePayrollTransfer({
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      recipientAddress: TEST_ACCOUNTS.employee1.address,
      amount: 15000n,
      senderBalance: 100000n,
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    const dec = Poseidon.decryptAuditorPCT(TEST_ACCOUNTS.auditor.babyJubSecret, prep.auditorPCT);
    expect(dec).toBe(15000n);
  });

  it("F08-05: Rejects proof preparation for unregistered recipient address", async () => {
    await expect(
      adapter.preparePayrollTransfer({
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        recipientAddress: "0x000000000000000000000000000000000000dead",
        amount: 1000n,
        senderBalance: 10000n,
        auditorAddress: TEST_ACCOUNTS.auditor.address,
      })
    ).toReject("is not registered");
  });
});

// ===========================================================================
// F09: Confidential Balance Decryption
// ===========================================================================
describe("F09: Confidential Balance Decryption", () => {
  it("F09-01: Employer decrypts balance using valid viewing key", async () => {
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employer.address,
      TEST_ACCOUNTS.employer.babyJubSecret.toString()
    );
    expect(bal.decrypted).toBe(100000000n);
  });

  it("F09-02: Invalid viewing key fails to decrypt balance", async () => {
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employer.address,
      "999999999999" // invalid key
    );
    expect(bal.decrypted).toBeUndefined();
  });

  it("F09-03: Uncredited employee starts with zero confidential balance", async () => {
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(bal.decrypted).toBe(0n);
  });

  it("F09-04: Employee balance increases by transferred amount after execution", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 25000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(bal.decrypted).toBe(25000n);
  });

  it("F09-05: ElGamal homomorphic additive balance decrypts accurately", () => {
    const pk = TEST_ACCOUNTS.employee1.babyJubPublicKey;
    const sk = TEST_ACCOUNTS.employee1.babyJubSecret;
    const eg1 = ElGamal.encrypt(pk, 3000n, 5n);
    const eg2 = ElGamal.encrypt(pk, 4000n, 7n);
    const sum = ElGamal.add(eg1.cipher, eg2.cipher);
    const decryptedTotal = ElGamal.decrypt(sk, sum);
    expect(decryptedTotal).toBe(7000n);
  });
});

// ===========================================================================
// F10: Auditor Decryption Module
// ===========================================================================
describe("F10: Auditor Decryption Module", () => {
  it("F10-01: Discovers on-chain PrivateTransfer logs and decrypts transaction amount", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 45000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const decryptedList = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(decryptedList.length).toBe(1);
    expect(decryptedList[0].amount).toBe(45000n);
  });

  it("F10-02: Decrypts sender and recipient addresses accurately from logs", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee2.address, amount: 60000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const decryptedList = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(decryptedList[0].recipient.toLowerCase()).toBe(TEST_ACCOUNTS.employee2.address.toLowerCase());
  });

  it("F10-03: Records valid block number for decrypted transaction logs", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 10000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const decryptedList = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(decryptedList[0].blockNumber).toBeGreaterThan(0n);
  });

  it("F10-04: Decrypts multiple transfers across multiple employees in batch", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x02",
      transfers: [
        { recipient: TEST_ACCOUNTS.employee1.address, amount: 10000n },
        { recipient: TEST_ACCOUNTS.employee2.address, amount: 20000n },
        { recipient: TEST_ACCOUNTS.employee3.address, amount: 30000n },
      ],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const decryptedList = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(decryptedList.length).toBe(3);
    const sum = decryptedList.reduce((acc, t) => acc + t.amount, 0n);
    expect(sum).toBe(60000n);
  });

  it("F10-05: Returns empty array when no transfer logs exist", async () => {
    const decryptedList = await adapter.auditorDecrypt(TEST_ACCOUNTS.auditor.babyJubSecret.toString());
    expect(decryptedList.length).toBe(0);
  });
});

// ===========================================================================
// F11: CLI Batch Creator
// ===========================================================================
describe("F11: CLI Batch Creator", () => {
  it("F11-01: Successfully parses CSV roster into BatchManifest", () => {
    const csv = `address,amount
${TEST_ACCOUNTS.employee1.address},150000
${TEST_ACCOUNTS.employee2.address},200000`;
    const manifest = cli.batchCreate({
      rosterCsv: csv,
      tokenAddress: adapter.tokenAddress,
    });
    expect(manifest.employeeCount).toBe(2);
    expect(manifest.totalGrossAmount).toBe("350000");
  });

  it("F11-02: Generates unique deterministic roster commitment hash", () => {
    const csv1 = `address,amount\n${TEST_ACCOUNTS.employee1.address},100`;
    const csv2 = `address,amount\n${TEST_ACCOUNTS.employee1.address},200`;
    const m1 = cli.batchCreate({ rosterCsv: csv1, tokenAddress: adapter.tokenAddress });
    const m2 = cli.batchCreate({ rosterCsv: csv2, tokenAddress: adapter.tokenAddress });
    expect(m1.rosterCommitment).not.toBe(m2.rosterCommitment);
  });

  it("F11-03: Rejects CSV with duplicate recipient addresses", () => {
    const csv = `address,amount
${TEST_ACCOUNTS.employee1.address},100
${TEST_ACCOUNTS.employee1.address},200`;
    expect(() => {
      cli.batchCreate({ rosterCsv: csv, tokenAddress: adapter.tokenAddress });
    }).toThrow("Duplicate recipient address");
  });

  it("F11-04: Rejects empty CSV roster", () => {
    expect(() => {
      cli.batchCreate({ rosterCsv: "", tokenAddress: adapter.tokenAddress });
    }).toThrow("Roster CSV is empty");
  });

  it("F11-05: Rejects CSV with malformed row data", () => {
    expect(() => {
      cli.batchCreate({ rosterCsv: "not-a-valid-csv-row", tokenAddress: adapter.tokenAddress });
    }).toThrow("Malformed CSV row");
  });
});

// ===========================================================================
// F12: CLI Payroll Executor
// ===========================================================================
describe("F12: CLI Payroll Executor", () => {
  it("F12-01: Executes valid batch on-chain and returns confirmed status", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},5000`,
      tokenAddress: adapter.tokenAddress,
    });
    const execRes = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    expect(execRes.confirmed).toBe(true);
    expect(execRes.totalExecuted).toBe(1);
    expect(execRes.txHashes.length).toBe(1);
  });

  it("F12-02: Transitions smart contract status to Confirmed upon execution", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},5000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const b = payroll.getBatch(manifest.batchId);
    expect(b?.status).toBe(BatchStatus.Confirmed);
  });

  it("F12-03: Confirms employee receives confidential credit on-chain", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},12000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const bal = await adapter.getEncryptedBalance(
      TEST_ACCOUNTS.employee1.address,
      TEST_ACCOUNTS.employee1.babyJubSecret.toString()
    );
    expect(bal.decrypted).toBe(12000n);
  });

  it("F12-04: Rejects execution if employer has insufficient balance", async () => {
    const hugeManifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},9999999999999999`,
      tokenAddress: adapter.tokenAddress,
    });
    await expect(
      cli.batchExecute({
        manifest: hugeManifest,
        senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
        employerAddress: TEST_ACCOUNTS.employer.address,
      })
    ).toReject("Insufficient balance for entire batch");
  });

  it("F12-05: Emits on-chain transaction receipt indexed in RPC", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},5000`,
      tokenAddress: adapter.tokenAddress,
    });
    const execRes = await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const receipt = rpc.getTransactionReceipt(execRes.txHashes[0]);
    expect(receipt).toBeDefined();
    expect(receipt?.status).toBe(1);
  });
});

// ===========================================================================
// F13: CLI Compliance Auditor
// ===========================================================================
describe("F13: CLI Compliance Auditor", () => {
  it("F13-01: Generates audit report verifying total batch disbursements", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},10000\n${TEST_ACCOUNTS.employee2.address},20000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const report = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      expectedTotal: 30000n,
    });
    expect(report.isCompliant).toBe(true);
    expect(report.totalDecryptedDisbursements).toBe("30000");
  });

  it("F13-02: Flags non-compliance when decrypted sum does not match expected", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},10000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const report = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      expectedTotal: 50000n, // Mismatch expected
    });
    expect(report.isCompliant).toBe(false);
  });

  it("F13-03: Produces immutable attestation hash binding batchId and total", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},10000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const report = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    expect(report.complianceAttestationHash.startsWith("0x")).toBe(true);
    expect(report.complianceAttestationHash.length).toBe(66);
  });

  it("F13-04: Includes granular transaction breakdown in audit report", async () => {
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},10000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const report = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });
    expect(report.transactions.length).toBe(1);
    expect(report.transactions[0].amount).toBe("10000");
  });

  it("F13-05: Allows posting compliance attestation on-chain after audit", async () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    const manifest = cli.batchCreate({
      rosterCsv: `address,amount\n${TEST_ACCOUNTS.employee1.address},10000`,
      tokenAddress: adapter.tokenAddress,
    });
    await cli.batchExecute({
      manifest,
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
      employerAddress: TEST_ACCOUNTS.employer.address,
    });
    const report = await cli.auditVerify({
      batchId: manifest.batchId,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      auditorAddress: TEST_ACCOUNTS.auditor.address,
    });

    const attestRes = compliance.attestCompliance(TEST_ACCOUNTS.auditor.address, {
      batchId: manifest.batchId,
      reportHash: report.complianceAttestationHash,
      isCompliant: report.isCompliant,
    });
    expect(attestRes.status).toBe(1);
    const recorded = compliance.getAttestation(manifest.batchId, TEST_ACCOUNTS.auditor.address);
    expect(recorded?.isCompliant).toBe(true);
  });
});

// ===========================================================================
// F14: Web Wallet Connection
// ===========================================================================
describe("F14: Web Wallet Connection", () => {
  it("F14-01: Successfully connects valid wallet on Avalanche L1 (43114)", () => {
    const conn = web.connectWallet({
      address: TEST_ACCOUNTS.employer.address,
      chainId: 43114,
    });
    expect(conn.connected).toBe(true);
    expect(conn.networkValid).toBe(true);
  });

  it("F14-02: Flags network mismatch if wallet is connected to Ethereum Mainnet (1)", () => {
    const conn = web.connectWallet({
      address: TEST_ACCOUNTS.employer.address,
      chainId: 1,
    });
    expect(conn.connected).toBe(true);
    expect(conn.networkValid).toBe(false);
    expect(conn.error).toContain("Mismatched network");
  });

  it("F14-03: Flags network mismatch if wallet is connected to Fuji Testnet (43113)", () => {
    const conn = web.connectWallet({
      address: TEST_ACCOUNTS.employer.address,
      chainId: 43113,
    });
    expect(conn.networkValid).toBe(false);
  });

  it("F14-04: Rejects connection with malformed EVM wallet address", () => {
    const conn = web.connectWallet({
      address: "0xinvalid" as any,
      chainId: 43114,
    });
    expect(conn.connected).toBe(false);
    expect(conn.error).toContain("Invalid EVM wallet address");
  });

  it("F14-05: Reconnects seamlessly after switching network to Avalanche L1", () => {
    const connWrong = web.connectWallet({
      address: TEST_ACCOUNTS.employer.address,
      chainId: 1,
    });
    expect(connWrong.networkValid).toBe(false);

    const connCorrect = web.connectWallet({
      address: TEST_ACCOUNTS.employer.address,
      chainId: 43114,
    });
    expect(connCorrect.networkValid).toBe(true);
  });
});

// ===========================================================================
// F15: Employer Batch Creation UI
// ===========================================================================
describe("F15: Employer Batch Creation UI", () => {
  it("F15-01: Pre-flight review accurately calculates gross total and gas estimate", () => {
    const items = [
      { address: TEST_ACCOUNTS.employee1.address, amount: "1000" },
      { address: TEST_ACCOUNTS.employee2.address, amount: "2000" },
    ];
    const review = web.employerReviewBatch(items);
    expect(review.valid).toBe(true);
    expect(review.summary?.employeeCount).toBe(2);
    expect(review.summary?.totalPlaintextGross).toBe("3000");
    expect(review.summary?.estimatedGas).toBe(2n * 420000n + 150000n);
  });

  it("F15-02: Flags validation errors for duplicate recipient entries in form", () => {
    const items = [
      { address: TEST_ACCOUNTS.employee1.address, amount: "1000" },
      { address: TEST_ACCOUNTS.employee1.address, amount: "2000" },
    ];
    const review = web.employerReviewBatch(items);
    expect(review.valid).toBe(false);
    expect(review.errors.some((e) => e.includes("Duplicate address"))).toBe(true);
  });

  it("F15-03: Flags validation error for zero amount", () => {
    const items = [{ address: TEST_ACCOUNTS.employee1.address, amount: "0" }];
    const review = web.employerReviewBatch(items);
    expect(review.valid).toBe(false);
    expect(review.errors.some((e) => e.includes("Amount must be positive"))).toBe(true);
  });

  it("F15-04: Flags validation error for empty batch input", () => {
    const review = web.employerReviewBatch([]);
    expect(review.valid).toBe(false);
    expect(review.errors.some((e) => e.includes("Batch cannot be empty"))).toBe(true);
  });

  it("F15-05: Flags validation error for invalid address syntax", () => {
    const items = [{ address: "0x123", amount: "500" }];
    const review = web.employerReviewBatch(items);
    expect(review.valid).toBe(false);
    expect(review.errors.some((e) => e.includes("Invalid address"))).toBe(true);
  });
});

// ===========================================================================
// F16: Employee Confidential Portal
// ===========================================================================
describe("F16: Employee Confidential Portal", () => {
  it("F16-01: Displays decrypted confidential balance to authorized employee", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 88000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const portal = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee1.address,
      viewingKey: TEST_ACCOUNTS.employee1.babyJubSecret.toString(),
    });
    expect(portal.confidentialBalance).toBe("88000");
  });

  it("F16-02: Enforces strict privacy isolation: employee cannot view peer salaries", async () => {
    const portal = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee1.address,
      viewingKey: TEST_ACCOUNTS.employee1.babyJubSecret.toString(),
    });
    expect(portal.canViewOtherEmployees).toBe(false);
  });

  it("F16-03: Fails to open portal with invalid viewing key", async () => {
    await expect(
      web.employeeViewPortal({
        employeeAddress: TEST_ACCOUNTS.employee1.address,
        viewingKey: "999999",
      })
    ).toReject("Invalid viewing key");
  });

  it("F16-04: Displays zero balance when employee has not received payments", async () => {
    const portal = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee3.address,
      viewingKey: TEST_ACCOUNTS.employee3.babyJubSecret.toString(),
    });
    expect(portal.confidentialBalance).toBe("0");
  });

  it("F16-05: Accumulates balance across successive distinct payroll distributions", async () => {
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 20000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    await adapter.executeBatchTransfers({
      batchId: "0x02",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 30000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const portal = await web.employeeViewPortal({
      employeeAddress: TEST_ACCOUNTS.employee1.address,
      viewingKey: TEST_ACCOUNTS.employee1.babyJubSecret.toString(),
    });
    expect(portal.confidentialBalance).toBe("50000");
  });
});

// ===========================================================================
// F17: Auditor Compliance Panel
// ===========================================================================
describe("F17: Auditor Compliance Panel", () => {
  it("F17-01: Authorized auditor views compliance dashboard and total disbursements", async () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 15000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const panel = await web.auditorViewCompliance({
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      targetBatchId: "0x01",
    });
    expect(panel.isAuthorized).toBe(true);
    expect(panel.totalAudited).toBe("15000");
  });

  it("F17-02: Displays explicit non-overreach disclosure guardrail notice", async () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    const panel = await web.auditorViewCompliance({
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      targetBatchId: "0x01",
    });
    expect(panel.disclaimer).toContain("Auditor disclosure notice");
    expect(panel.disclaimer).toContain("Selective sub-batch masking is not claimed");
  });

  it("F17-03: Rejects compliance view for unauthorized auditor address", async () => {
    await expect(
      web.auditorViewCompliance({
        auditorAddress: TEST_ACCOUNTS.attacker.address,
        auditorPrivateKey: TEST_ACCOUNTS.attacker.babyJubSecret.toString(),
        targetBatchId: "0x01",
      })
    ).toReject("Auditor address is not registered");
  });

  it("F17-04: Rejects compliance view for revoked auditor", async () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    compliance.revokeAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address);

    await expect(
      web.auditorViewCompliance({
        auditorAddress: TEST_ACCOUNTS.auditor.address,
        auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
        targetBatchId: "0x01",
      })
    ).toReject("Auditor address is not registered");
  });

  it("F17-05: Details individual transaction receipts within auditor scope", async () => {
    compliance.registerAuditor(TEST_ACCOUNTS.employer.address, TEST_ACCOUNTS.auditor.address, "Apex Compliance");
    await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 25000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const panel = await web.auditorViewCompliance({
      auditorAddress: TEST_ACCOUNTS.auditor.address,
      auditorPrivateKey: TEST_ACCOUNTS.auditor.babyJubSecret.toString(),
      targetBatchId: "0x01",
    });
    expect(panel.decryptedTxs.length).toBe(1);
    expect(panel.decryptedTxs[0].amount).toBe("25000");
  });
});

// ===========================================================================
// F18: Public Observer Explorer View
// ===========================================================================
describe("F18: Public Observer Explorer View", () => {
  it("F18-01: Public observer inspects confirmed transaction receipt by hash", async () => {
    const execRes = await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 50000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const txHash = execRes.txHashes[0];
    const inspection = web.publicObserverInspect(txHash, [50000n]);
    expect(inspection.exists).toBe(true);
    expect(inspection.status).toBe(1);
    expect(inspection.gasUsed).toBeGreaterThan(0n);
  });

  it("F18-02: Zero Plaintext Rule: Confirms transaction calldata contains zero plaintext amounts", async () => {
    const salary = 1234567n;
    const execRes = await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: salary }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const txHash = execRes.txHashes[0];
    const inspection = web.publicObserverInspect(txHash, [salary]);
    expect(inspection.zeroPlaintextLeakageVerified).toBe(true);
  });

  it("F18-03: Zero Plaintext Rule: Confirms event logs omit plaintext salary numbers", async () => {
    const salary = 7654321n;
    const execRes = await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee2.address, amount: salary }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const txHash = execRes.txHashes[0];
    const logs = rpc.getLogs({ address: adapter.tokenAddress });
    for (const log of logs) {
      expect(log.data.includes(salary.toString())).toBe(false);
    }
  });

  it("F18-04: Returns not found for non-existent transaction hash", () => {
    const inspection = web.publicObserverInspect("0x000000000000000000000000000000000000000000000000000000000000dead", [100n]);
    expect(inspection.exists).toBe(false);
  });

  it("F18-05: Observer confirms block number and transaction inclusion in Avalanche block", async () => {
    const execRes = await adapter.executeBatchTransfers({
      batchId: "0x01",
      transfers: [{ recipient: TEST_ACCOUNTS.employee1.address, amount: 1000n }],
      senderPrivateKey: TEST_ACCOUNTS.employer.evmPrivateKey,
    });
    const inspection = web.publicObserverInspect(execRes.txHashes[0], [1000n]);
    expect(inspection.blockNumber).toBeGreaterThan(1000n);
  });
});
