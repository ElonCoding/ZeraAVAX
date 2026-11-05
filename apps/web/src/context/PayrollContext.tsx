import React, { createContext, useContext, useState, useEffect } from "react";
import { AuditorPCT } from "@cashlayer/shared";
import { MockEERCAdapter, BabyJub, Poseidon } from "@cashlayer/eerc-adapter";
import {
  OnChainBatchRecord,
  OnChainTxLog,
  EmployeeIncomingPayment,
  ComplianceAttestationRecord,
  AuditorReconciliationItem,
  WebPayrollItem,
} from "../types";
import { CryptoService } from "../services/cryptoService";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";

interface PayrollContextType {
  tokenAddress: `0x${string}`;
  complianceVerifierAddress: `0x${string}`;
  batches: OnChainBatchRecord[];
  txLogs: OnChainTxLog[];
  attestations: ComplianceAttestationRecord[];
  isAuditorAuthorized: (address: `0x${string}`) => boolean;
  employerBalance: bigint;
  createAndSubmitBatch: (params: {
    items: WebPayrollItem[];
    employerAddress: `0x${string}`;
    onProgress?: (status: "Draft" | "Ready" | "Submitted" | "Confirmed") => void;
  }) => Promise<OnChainBatchRecord>;
  getEmployeeIncomingPayments: (employeeAddress: `0x${string}`) => EmployeeIncomingPayment[];
  getEmployeeBalance: (employeeAddress: `0x${string}`, viewingKey: string) => bigint;
  reconcileAuditorBatch: (
    batchId: `0x${string}`,
    auditorAddress: `0x${string}`,
    auditorKey: string
  ) => {
    isAuthorized: boolean;
    isCompliant: boolean;
    totalDecrypted: bigint;
    expectedTotal: bigint;
    discrepancies: string[];
    reportHash: `0x${string}`;
    reconciledTxs: AuditorReconciliationItem[];
  };
  submitComplianceAttestation: (params: {
    batchId: `0x${string}`;
    auditorAddress: `0x${string}`;
    reportHash: `0x${string}`;
    isCompliant: boolean;
    totalDecrypted: bigint;
    expectedTotal: bigint;
  }) => Promise<ComplianceAttestationRecord>;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokenAddress] = useState<`0x${string}`>("0xcccccccccccccccccccccccccccccccccccccccc");
  const [complianceVerifierAddress] = useState<`0x${string}`>("0xvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
  const [adapter] = useState(() => new MockEERCAdapter({ tokenAddress }));

  const [authorizedAuditors, setAuthorizedAuditors] = useState<Set<string>>(
    () => new Set([DEMO_ACCOUNTS.find((a) => a.role === "auditor")?.address.toLowerCase() || ""])
  );

  const [batches, setBatches] = useState<OnChainBatchRecord[]>([]);
  const [txLogs, setTxLogs] = useState<OnChainTxLog[]>([]);
  const [attestations, setAttestations] = useState<ComplianceAttestationRecord[]>([]);
  const [employerBalance, setEmployerBalance] = useState<bigint>(100000000n);

  // Initialize with seed data on mount
  useEffect(() => {
    // Seed initial batch for demonstration
    const seedBatchId: `0x${string}` = "0x8fa40bc78864705a63901b0f592d3080aa98c81ef40763ea119f4a9b60e6e701";
    const employer = DEMO_ACCOUNTS[0].address;
    const alice = DEMO_ACCOUNTS[1];
    const bob = DEMO_ACCOUNTS[2];

    const aliceAmt = 1250000n;
    const bobAmt = 1100000n;

    // Encrypt for Alice and Auditor
    const aliceEnc = Poseidon.processPoseidonEncryption({
      inputs: [aliceAmt],
      publicKey: alice.babyJubPublicKey,
      nonce: 101n,
    });
    const aliceAuditorEnc = Poseidon.processPoseidonEncryption({
      inputs: [aliceAmt],
      publicKey: DEMO_ACCOUNTS[6].babyJubPublicKey,
      nonce: 102n,
    });

    const bobEnc = Poseidon.processPoseidonEncryption({
      inputs: [bobAmt],
      publicKey: bob.babyJubPublicKey,
      nonce: 201n,
    });
    const bobAuditorEnc = Poseidon.processPoseidonEncryption({
      inputs: [bobAmt],
      publicKey: DEMO_ACCOUNTS[6].babyJubPublicKey,
      nonce: 202n,
    });

    const tx1: OnChainTxLog = {
      txHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
      batchId: seedBatchId,
      blockNumber: 12054231n,
      sender: employer,
      recipient: alice.address,
      auditorPCT: aliceAuditorEnc.auditorPCT as AuditorPCT,
      receiverEncryptedAmount: aliceEnc.auditorPCT,
      calldataPreview: "0xa9059cbb" + "0".repeat(60) + "eerc7proof" + aliceEnc.auditorPCT[0].slice(2, 10),
      status: 1,
      gasUsed: 423500n,
      timestamp: Date.now() - 3600000,
      zeroPlaintextVerified: true,
    };

    const tx2: OnChainTxLog = {
      txHash: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
      batchId: seedBatchId,
      blockNumber: 12054232n,
      sender: employer,
      recipient: bob.address,
      auditorPCT: bobAuditorEnc.auditorPCT as AuditorPCT,
      receiverEncryptedAmount: bobEnc.auditorPCT,
      calldataPreview: "0xa9059cbb" + "0".repeat(60) + "eerc7proof" + bobEnc.auditorPCT[0].slice(2, 10),
      status: 1,
      gasUsed: 421200n,
      timestamp: Date.now() - 3550000,
      zeroPlaintextVerified: true,
    };

    const initialBatch: OnChainBatchRecord = {
      batchId: seedBatchId,
      employer,
      tokenAddress,
      employeeCount: 2,
      totalGrossAmount: (aliceAmt + bobAmt).toString(),
      rosterCommitment: CryptoService.computeRosterCommitment([
        { address: alice.address, amount: aliceAmt },
        { address: bob.address, amount: bobAmt },
      ]),
      status: "Confirmed",
      txHashes: [tx1.txHash, tx2.txHash],
      createdAt: Date.now() - 3700000,
      confirmedAt: Date.now() - 3500000,
      recipients: [
        { address: alice.address, amount: aliceAmt.toString(), department: "Engineering" },
        { address: bob.address, amount: bobAmt.toString(), department: "Product" },
      ],
    };

    setBatches([initialBatch]);
    setTxLogs([tx1, tx2]);
  }, [tokenAddress]);

  const isAuditorAuthorized = (address: `0x${string}`): boolean => {
    return authorizedAuditors.has(address.toLowerCase());
  };

  /**
   * Executes the full state machine for payroll batch creation & execution:
   * Draft -> Ready -> Submitted -> Confirmed
   */
  const createAndSubmitBatch = async (params: {
    items: WebPayrollItem[];
    employerAddress: `0x${string}`;
    onProgress?: (status: "Draft" | "Ready" | "Submitted" | "Confirmed") => void;
  }): Promise<OnChainBatchRecord> => {
    const { items, employerAddress, onProgress } = params;

    const validation = CryptoService.validateAndSummarizeBatch(items);
    if (!validation.valid || !validation.summary || !validation.sanitizedItems) {
      throw new Error(validation.errors[0] || "Invalid batch items");
    }

    if (validation.summary.totalPlaintextGross > employerBalance) {
      throw new Error(
        `Insufficient balance: Required ${validation.summary.totalPlaintextGross.toString()}, Available ${employerBalance.toString()}`
      );
    }

    const batchId: `0x${string}` = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}` as `0x${string}`;

    // Step 1: Draft
    const newRecord: OnChainBatchRecord = {
      batchId,
      employer: employerAddress,
      tokenAddress,
      employeeCount: validation.summary.employeeCount,
      totalGrossAmount: validation.summary.totalPlaintextGross.toString(),
      rosterCommitment: validation.summary.rosterCommitment,
      status: "Draft",
      txHashes: [],
      createdAt: Date.now(),
      recipients: validation.sanitizedItems.map((r) => ({
        address: r.address,
        amount: r.amount.toString(),
        department: r.department,
      })),
    };

    setBatches((prev) => [newRecord, ...prev]);
    onProgress?.("Draft");
    await new Promise((r) => setTimeout(r, 400));

    // Step 2: Ready
    newRecord.status = "Ready";
    setBatches((prev) => prev.map((b) => (b.batchId === batchId ? { ...b, status: "Ready" } : b)));
    onProgress?.("Ready");
    await new Promise((r) => setTimeout(r, 400));

    // Step 3: Submitted (transfers occurring)
    newRecord.status = "Submitted";
    setBatches((prev) => prev.map((b) => (b.batchId === batchId ? { ...b, status: "Submitted" } : b)));
    onProgress?.("Submitted");
    await new Promise((r) => setTimeout(r, 500));

    // Step 4: Execute each transfer, generate encrypted ciphertexts for recipient and auditor
    const newTxLogs: OnChainTxLog[] = [];
    const txHashes: `0x${string}`[] = [];
    const auditorAcc = DEMO_ACCOUNTS.find((a) => a.role === "auditor") || DEMO_ACCOUNTS[6];

    let startBlock = 12054250n + BigInt(batches.length * 10);

    for (let i = 0; i < validation.sanitizedItems.length; i++) {
      const item = validation.sanitizedItems[i];
      const txHash: `0x${string}` = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}` as `0x${string}`;
      txHashes.push(txHash);

      // Find recipient demo account or derive public key
      const recipientAcc = DEMO_ACCOUNTS.find((a) => a.address.toLowerCase() === item.address.toLowerCase());
      const recPK = recipientAcc ? recipientAcc.babyJubPublicKey : BabyJub.Base8;

      const recEnc = Poseidon.processPoseidonEncryption({
        inputs: [item.amount],
        publicKey: recPK,
        nonce: BigInt(Date.now() + i),
      });

      const audEnc = Poseidon.processPoseidonEncryption({
        inputs: [item.amount],
        publicKey: auditorAcc.babyJubPublicKey,
        nonce: BigInt(Date.now() + i + 1000),
      });

      const log: OnChainTxLog = {
        txHash,
        batchId,
        blockNumber: startBlock + BigInt(i),
        sender: employerAddress,
        recipient: item.address,
        auditorPCT: audEnc.auditorPCT as AuditorPCT,
        receiverEncryptedAmount: recEnc.auditorPCT,
        calldataPreview: `0xa9059cbb${recEnc.auditorPCT[0].slice(2, 10)}${audEnc.auditorPCT[0].slice(2, 10)}`,
        status: 1,
        gasUsed: 420000n + BigInt(Math.floor(Math.random() * 5000)),
        timestamp: Date.now(),
        zeroPlaintextVerified: true,
      };

      newTxLogs.push(log);
    }

    // Deduct employer balance
    setEmployerBalance((prev) => prev - validation.summary!.totalPlaintextGross);

    // Step 5: Confirmed
    newRecord.status = "Confirmed";
    newRecord.txHashes = txHashes;
    newRecord.confirmedAt = Date.now();

    setBatches((prev) =>
      prev.map((b) => (b.batchId === batchId ? { ...newRecord } : b))
    );
    setTxLogs((prev) => [...newTxLogs, ...prev]);
    onProgress?.("Confirmed");

    return newRecord;
  };

  /**
   * Retrieves incoming payments for an employee (strictly isolating peer payments).
   */
  const getEmployeeIncomingPayments = (
    employeeAddress: `0x${string}`
  ): EmployeeIncomingPayment[] => {
    const lower = employeeAddress.toLowerCase();
    const employeeAcc = DEMO_ACCOUNTS.find((a) => a.address.toLowerCase() === lower);

    return txLogs
      .filter((l) => l.recipient.toLowerCase() === lower && l.status === 1)
      .map((log) => {
        let decAmount = 0n;
        if (employeeAcc) {
          try {
            decAmount = CryptoService.decryptCiphertext(
              employeeAcc.babyJubSecret,
              log.receiverEncryptedAmount
            );
          } catch {
            decAmount = 0n;
          }
        }
        return {
          txHash: log.txHash,
          batchId: log.batchId,
          blockNumber: log.blockNumber,
          sender: log.sender,
          decryptedAmount: decAmount,
          timestamp: log.timestamp,
          proofVerified: true,
        };
      });
  };

  /**
   * Computes current confidential balance by decrypting all incoming payments.
   */
  const getEmployeeBalance = (employeeAddress: `0x${string}`, viewingKey: string): bigint => {
    const lower = employeeAddress.toLowerCase();
    let total = 0n;
    const incoming = txLogs.filter((l) => l.recipient.toLowerCase() === lower && l.status === 1);

    for (const log of incoming) {
      try {
        const amt = CryptoService.decryptCiphertext(viewingKey, log.receiverEncryptedAmount);
        total += amt;
      } catch {
        // Viewing key mismatch
      }
    }
    return total;
  };

  /**
   * Auditor reconciliation: decrypts uint256[7] auditorPCT for target batch
   */
  const reconcileAuditorBatch = (
    batchId: `0x${string}`,
    auditorAddress: `0x${string}`,
    auditorKey: string
  ) => {
    const isAuth = isAuditorAuthorized(auditorAddress);
    if (!isAuth) {
      return {
        isAuthorized: false,
        isCompliant: false,
        totalDecrypted: 0n,
        expectedTotal: 0n,
        discrepancies: ["Auditor is not authorized or registered on ComplianceVerifier"],
        reportHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        reconciledTxs: [],
      };
    }

    const batch = batches.find((b) => b.batchId.toLowerCase() === batchId.toLowerCase());
    const expectedTotal = batch ? BigInt(batch.totalGrossAmount) : 0n;

    const relevantLogs = txLogs.filter(
      (l) => l.batchId.toLowerCase() === batchId.toLowerCase() && l.status === 1
    );

    let totalDecrypted = 0n;
    const reconciledTxs: AuditorReconciliationItem[] = [];

    for (const log of relevantLogs) {
      try {
        const decAmt = CryptoService.decryptCiphertext(auditorKey, log.auditorPCT);
        totalDecrypted += decAmt;
        reconciledTxs.push({
          txHash: log.txHash,
          sender: log.sender,
          recipient: log.recipient,
          decryptedAmount: decAmt,
          blockNumber: log.blockNumber,
          isMatch: true,
        });
      } catch (e: any) {
        reconciledTxs.push({
          txHash: log.txHash,
          sender: log.sender,
          recipient: log.recipient,
          decryptedAmount: 0n,
          blockNumber: log.blockNumber,
          isMatch: false,
        });
      }
    }

    const discrepancies: string[] = [];
    if (totalDecrypted !== expectedTotal) {
      discrepancies.push(
        `Discrepancy: Decrypted total (${totalDecrypted.toString()}) does not match expected batch total (${expectedTotal.toString()})`
      );
    }

    const isCompliant = discrepancies.length === 0 && relevantLogs.length > 0;
    const reportHash = Poseidon.hash([
      BigInt(batchId),
      totalDecrypted,
      BigInt(isCompliant ? 1 : 0),
    ]);
    const reportHashHex: `0x${string}` = `0x${reportHash.toString(16).padStart(64, "0")}` as `0x${string}`;

    return {
      isAuthorized: true,
      isCompliant,
      totalDecrypted,
      expectedTotal,
      discrepancies,
      reportHash: reportHashHex,
      reconciledTxs,
    };
  };

  /**
   * One-click on-chain compliance attestation submission
   */
  const submitComplianceAttestation = async (params: {
    batchId: `0x${string}`;
    auditorAddress: `0x${string}`;
    reportHash: `0x${string}`;
    isCompliant: boolean;
    totalDecrypted: bigint;
    expectedTotal: bigint;
  }): Promise<ComplianceAttestationRecord> => {
    const txHash: `0x${string}` = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}` as `0x${string}`;

    const record: ComplianceAttestationRecord = {
      batchId: params.batchId,
      auditorAddress: params.auditorAddress,
      reportHash: params.reportHash,
      isCompliant: params.isCompliant,
      totalDecrypted: params.totalDecrypted,
      expectedTotal: params.expectedTotal,
      attestedAt: Date.now(),
      txHash,
    };

    setAttestations((prev) => [record, ...prev]);
    return record;
  };

  return (
    <PayrollContext.Provider
      value={{
        tokenAddress,
        complianceVerifierAddress,
        batches,
        txLogs,
        attestations,
        isAuditorAuthorized,
        employerBalance,
        createAndSubmitBatch,
        getEmployeeIncomingPayments,
        getEmployeeBalance,
        reconcileAuditorBatch,
        submitComplianceAttestation,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error("usePayroll must be used within a PayrollProvider");
  }
  return context;
};
