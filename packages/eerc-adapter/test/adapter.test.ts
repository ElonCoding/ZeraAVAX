import assert from "node:assert";
import {
  MockEERCAdapter,
  ComplianceAuditor,
  BabyJub,
  Poseidon,
} from "../src/index.js";
import { BASE8, Point } from "@cashlayer/shared";

console.log("==============================================================================");
console.log("   Running @cashlayer/eerc-adapter Integration Tests");
console.log("==============================================================================");

let passed = 0;
let failed = 0;

async function it(name: string, fn: () => Promise<void>) {
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

async function run() {
  const employerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const emp1Addr = "0x2222222222222222222222222222222222222222" as `0x${string}`;
  const emp2Addr = "0x3333333333333333333333333333333333333333" as `0x${string}`;
  const auditorAddr = "0x7777777777777777777777777777777777777777" as `0x${string}`;

  const employerSk = 10000001n;
  const emp1Sk = 20000001n;
  const emp2Sk = 30000001n;
  const auditorSk = 70000001n;

  const employerPK = BabyJub.generatePublicKey(employerSk);
  const emp1PK = BabyJub.generatePublicKey(emp1Sk);
  const emp2PK = BabyJub.generatePublicKey(emp2Sk);
  const auditorPK = BabyJub.generatePublicKey(auditorSk);

  let adapter: MockEERCAdapter;

  await it("initializes MockEERCAdapter with RPC and contract addresses", async () => {
    adapter = new MockEERCAdapter({
      tokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
      registrarAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
      auditorAddress: auditorAddr,
      auditorPK,
    });
    await adapter.initialize("http://127.0.0.1:9650/ext/bc/C/rpc", adapter.tokenAddress);
    assert.strictEqual(adapter.tokenAddress, "0xcccccccccccccccccccccccccccccccccccccccc");
  });

  await it("registers account and returns BabyJub public key", async () => {
    const reg = await adapter.registerAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    assert.strictEqual(BabyJub.isOnCurve(reg.publicKey), true);
    assert.strictEqual(reg.txHash?.startsWith("0x"), true);
  });

  await it("manages confidential balance and decrypts with valid viewing key", async () => {
    adapter.registerAccountExplicit(employerAddr, employerSk, employerPK);
    adapter.setBalance(employerAddr, 5000000n);

    // Without viewing key
    const balNoKey = await adapter.getEncryptedBalance(employerAddr);
    assert.strictEqual(balNoKey.encrypted.length, 4);
    assert.strictEqual(balNoKey.decrypted, undefined);

    // With valid viewing key
    const balValid = await adapter.getEncryptedBalance(employerAddr, employerSk.toString());
    assert.strictEqual(balValid.decrypted, 5000000n);

    // With invalid viewing key
    const balInvalid = await adapter.getEncryptedBalance(employerAddr, "999999999");
    assert.strictEqual(balInvalid.decrypted, undefined);
  });

  await it("prepares payroll transfer proof and ciphertexts", async () => {
    adapter.registerAccountExplicit(emp1Addr, emp1Sk, emp1PK);

    const prep = await adapter.preparePayrollTransfer({
      senderPrivateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      recipientAddress: emp1Addr,
      amount: 50000n,
      senderBalance: 100000n,
      auditorAddress: auditorAddr,
    });

    assert.strictEqual(prep.proof.publicSignals.length, 32);
    assert.strictEqual(prep.auditorPCT.length, 7);
    assert.strictEqual(prep.receiverEncryptedAmount.length, 7);

    // Recipient can decrypt receiverEncryptedAmount
    const decEmp = Poseidon.decryptAuditorPCT(emp1Sk, prep.receiverEncryptedAmount);
    assert.strictEqual(decEmp, 50000n);

    // Auditor can decrypt auditorPCT
    const decAud = Poseidon.decryptAuditorPCT(auditorSk, prep.auditorPCT);
    assert.strictEqual(decAud, 50000n);
  });

  await it("rejects transfer preparation when balance is insufficient", async () => {
    let rejected = false;
    try {
      await adapter.preparePayrollTransfer({
        senderPrivateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        recipientAddress: emp1Addr,
        amount: 500000n,
        senderBalance: 100000n, // less than amount
        auditorAddress: auditorAddr,
      });
    } catch (err: any) {
      rejected = err.message.includes("Insufficient sender balance");
    }
    assert.strictEqual(rejected, true);
  });

  await it("rejects transfer preparation for unregistered recipient", async () => {
    let rejected = false;
    try {
      await adapter.preparePayrollTransfer({
        senderPrivateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        recipientAddress: "0x000000000000000000000000000000000000dead",
        amount: 1000n,
        senderBalance: 50000n,
        auditorAddress: auditorAddr,
      });
    } catch (err: any) {
      rejected = err.message.includes("is not registered");
    }
    assert.strictEqual(rejected, true);
  });

  await it("executes batch transfers and updates balances correctly", async () => {
    adapter.registerAccountExplicit(emp2Addr, emp2Sk, emp2PK);

    // Employer initial balance: 1,000,000
    const employerKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const employerDerivedAddr = `0x${employerKey.slice(2, 42).padEnd(40, "0")}`.toLowerCase() as `0x${string}`;
    adapter.setBalance(employerDerivedAddr, 1000000n);

    const exec = await adapter.executeBatchTransfers({
      batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      transfers: [
        { recipient: emp1Addr, amount: 150000n },
        { recipient: emp2Addr, amount: 250000n },
      ],
      senderPrivateKey: employerKey,
    });

    assert.strictEqual(exec.txHashes.length, 2);
    assert.deepStrictEqual(exec.receiptStatuses, [1, 1]);

    const emp1Bal = await adapter.getEncryptedBalance(emp1Addr, emp1Sk.toString());
    assert.strictEqual(emp1Bal.decrypted, 150000n);

    const emp2Bal = await adapter.getEncryptedBalance(emp2Addr, emp2Sk.toString());
    assert.strictEqual(emp2Bal.decrypted, 250000n);
  });

  await it("auditor successfully decrypts transactions from on-chain logs", async () => {
    const decrypted = await adapter.auditorDecrypt(auditorSk.toString());
    assert.strictEqual(decrypted.length, 2);
    assert.strictEqual(decrypted[0].amount, 150000n);
    assert.strictEqual(decrypted[1].amount, 250000n);
  });

  await it("ComplianceAuditor reconciles batch totals and generates report hash", async () => {
    const auditor = new ComplianceAuditor(adapter);
    const report = await auditor.reconcileBatch({
      batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      expectedTotal: 400000n, // 150,000 + 250,000
      employeeCount: 2,
      auditorPrivateKey: auditorSk.toString(),
      auditorAddress: auditorAddr,
    });

    assert.strictEqual(report.isCompliant, true);
    assert.strictEqual(report.totalDisbursed, 400000n);
    assert.strictEqual(report.employeeCount, 2);
    assert.strictEqual(report.discrepancies.length, 0);
    assert.strictEqual(report.reportHash.startsWith("0x"), true);
  });

  await it("ComplianceAuditor flags discrepancy when reported total does not match disbursements", async () => {
    const auditor = new ComplianceAuditor(adapter);
    const report = await auditor.reconcileBatch({
      batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      expectedTotal: 500000n, // reported 500k, but actual disbursements are 400k!
      employeeCount: 2,
      auditorPrivateKey: auditorSk.toString(),
      auditorAddress: auditorAddr,
    });

    assert.strictEqual(report.isCompliant, false);
    assert.strictEqual(report.discrepancies.length > 0, true);
    assert.strictEqual(report.discrepancies[0].includes("Discrepancy detected"), true);
  });

  console.log("------------------------------------------------------------------------------");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("✔ ALL ADAPTER TESTS PASSED");
  }
}

run();
