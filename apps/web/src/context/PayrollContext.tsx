import React, { createContext, useContext, useState, useEffect } from "react";
import { AuditorPCT } from "@cashlayer/shared";
import { BabyJub, Poseidon } from "@cashlayer/eerc-adapter";
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
import { useWallet } from "./WalletContext";

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
  const { isRealWalletConnected } = useWallet();
  const [tokenAddress] = useState<`0x${string}`>("0xcccccccccccccccccccccccccccccccccccccccc");
  const [complianceVerifierAddress] = useState<`0x${string}`>("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

  const [authorizedAuditors] = useState<Set<string>>(
    () => new Set([
      DEMO_ACCOUNTS.find((a) => a.role === "auditor")?.address.toLowerCase() || "",
      "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    ])
  );

  // Clean state — no dummy seed clutter
  const [batches, setBatches] = useState<OnChainBatchRecord[]>([]);
  const [txLogs, setTxLogs] = useState<OnChainTxLog[]>([]);
  const [attestations, setAttestations] = useState<ComplianceAttestationRecord[]>([]);
  const [employerBalance, setEmployerBalance] = useState<bigint>(100000000n);

  const isAuditorAuthorized = (address: `0x${string}`): boolean => {
    return authorizedAuditors.has(address.toLowerCase());
  };

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

    // Trigger REAL Web3 wallet popup if MetaMask or Core installed
    if (typeof window !== "undefined") {
      const w = window as any;
      const provider = w.avalanche || w.ethereum;
      if (provider) {
        try {
          const msg = `CashLayer Avalanche Enterprise Payroll Batch\n\nCommitment: ${validation.summary.rosterCommitment}\nEmployees: ${validation.summary.employeeCount}\nTotal: ${validation.summary.totalPlaintextGross.toString()}\nChain: Fuji (43113)`;
          await provider.request({
            method: "personal_sign",
            params: [msg, employerAddress],
          });
        } catch (err: any) {
          throw new Error(`Wallet action cancelled: ${err.message || "User denied signature"}`);
        }
      }
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

    // Step 3: Submitted
    newRecord.status = "Submitted";
    setBatches((prev) => prev.map((b) => (b.batchId === batchId ? { ...b, status: "Submitted" } : b)));
    onProgress?.("Submitted");
    await new Promise((r) => setTimeout(r, 500));

    // Step 4: Execute transfers & generate Poseidon ciphertexts
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

      const txLog: OnChainTxLog = {
        txHash,
        batchId,
        blockNumber: startBlock + BigInt(i),
        sender: employerAddress,
        recipient: item.address,
        auditorPCT: audEnc.auditorPCT as AuditorPCT,
        receiverEncryptedAmount: recEnc.auditorPCT,
        calldataPreview: "0xa9059cbb" + "0".repeat(60) + "eerc7proof" + recEnc.auditorPCT[0].slice(2, 10),
        status: 1,
        gasUsed: 420000n + BigInt(i * 1200),
        timestamp: Date.now(),
        zeroPlaintextVerified: true,
      };

      newTxLogs.push(txLog);
    }

    // Step 5: Confirmed
    newRecord.status = "Confirmed";
    newRecord.confirmedAt = Date.now();
    newRecord.txHashes = txHashes;

    setBatches((prev) => [newRecord, ...prev.filter((b) => b.batchId !== batchId)]);
    setTxLogs((prev) => [...newTxLogs, ...prev]);
    setEmployerBalance((prev) => prev - validation.summary!.totalPlaintextGross);
    onProgress?.("Confirmed");

    return newRecord;
  };

  const getEmployeeIncomingPayments = (employeeAddress: `0x${string}`): EmployeeIncomingPayment[] => {
    return txLogs
      .filter((l) => l.recipient.toLowerCase() === employeeAddress.toLowerCase())
      .map((l) => {
        let decAmt = 0n;
        const employeeAcc = DEMO_ACCOUNTS.find(
          (a) => a.address.toLowerCase() === employeeAddress.toLowerCase()
        );
        if (employeeAcc) {
          try {
            decAmt = CryptoService.decryptCiphertext(
              employeeAcc.babyJubSecret,
              l.receiverEncryptedAmount
            );
          } catch {
            decAmt = 0n;
          }
        }

        return {
          txHash: l.txHash,
          batchId: l.batchId,
          sender: l.sender,
          receiverEncryptedAmount: l.receiverEncryptedAmount,
          decryptedAmount: decAmt,
          blockNumber: l.blockNumber,
          timestamp: l.timestamp,
          proofVerified: true,
        };
      });
  };

  const getEmployeeBalance = (employeeAddress: `0x${string}`, viewingKeyStr: string): bigint => {
    const relevant = txLogs.filter(
      (l) => l.recipient.toLowerCase() === employeeAddress.toLowerCase()
    );

    let sum = 0n;
    for (const log of relevant) {
      try {
        const dec = CryptoService.decryptCiphertext(viewingKeyStr, log.receiverEncryptedAmount);
        sum += dec;
      } catch {
        // ignore invalid keys
      }
    }

    return sum;
  };

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
        discrepancies: ["Auditor not authorized in ComplianceVerifier contract"],
        reportHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        reconciledTxs: [],
      };
    }

    const targetBatch = batches.find((b) => b.batchId.toLowerCase() === batchId.toLowerCase());
    const relevantLogs = txLogs.filter((l) => l.batchId.toLowerCase() === batchId.toLowerCase());

    const expectedTotal = targetBatch ? BigInt(targetBatch.totalGrossAmount) : 0n;
    let totalDecrypted = 0n;
    const reconciledTxs: AuditorReconciliationItem[] = [];

    for (const log of relevantLogs) {
      try {
        const dec = CryptoService.decryptCiphertext(auditorKey, log.auditorPCT);
        totalDecrypted += dec;
        reconciledTxs.push({
          txHash: log.txHash,
          sender: log.sender,
          recipient: log.recipient,
          decryptedAmount: dec,
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

  const submitComplianceAttestation = async (params: {
    batchId: `0x${string}`;
    auditorAddress: `0x${string}`;
    reportHash: `0x${string}`;
    isCompliant: boolean;
    totalDecrypted: bigint;
    expectedTotal: bigint;
  }): Promise<ComplianceAttestationRecord> => {
    if (typeof window !== "undefined") {
      const w = window as any;
      const provider = w.avalanche || w.ethereum;
      if (provider) {
        try {
          const msg = `Compliance Attestation on Avalanche L1\nBatch ID: ${params.batchId}\nReport: ${params.reportHash}\nStatus: ${params.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}`;
          await provider.request({
            method: "personal_sign",
            params: [msg, params.auditorAddress],
          });
        } catch (err: any) {
          throw new Error(`Attestation rejected: ${err.message || "User denied signature"}`);
        }
      }
    }

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
