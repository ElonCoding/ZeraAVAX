import { Point, TransferProof, AuditorPCT } from "@cashlayer/shared";

export type PersonaRole = "employer" | "employee" | "auditor" | "observer";

export interface DemoAccount {
  id: string;
  name: string;
  role: PersonaRole;
  address: `0x${string}`;
  evmPrivateKey: `0x${string}`;
  babyJubSecret: bigint;
  babyJubPublicKey: Point;
  description: string;
}

export interface WebPayrollItem {
  id: string;
  address: string;
  amount: string;
  department?: string;
  notes?: string;
}

export interface WebBatchPreflightSummary {
  employeeCount: number;
  totalPlaintextGross: bigint;
  deduplicatedCount: number;
  estimatedGas: bigint;
  rosterCommitment: `0x${string}`;
  zeroPlaintextShieldValid: boolean;
}

export interface OnChainBatchRecord {
  batchId: `0x${string}`;
  employer: `0x${string}`;
  tokenAddress: `0x${string}`;
  employeeCount: number;
  totalGrossAmount: string;
  rosterCommitment: `0x${string}`;
  status: "Draft" | "Ready" | "Submitted" | "Confirmed" | "Cancelled";
  txHashes: `0x${string}`[];
  createdAt: number;
  confirmedAt?: number;
  recipients: Array<{
    address: `0x${string}`;
    amount: string;
    department?: string;
  }>;
}

export interface OnChainTxLog {
  txHash: `0x${string}`;
  batchId: `0x${string}`;
  blockNumber: bigint;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  auditorPCT: AuditorPCT;
  receiverEncryptedAmount: string[];
  calldataPreview: string;
  status: 1 | 0;
  gasUsed: bigint;
  timestamp: number;
  zeroPlaintextVerified: boolean;
}

export interface AuditorReconciliationItem {
  txHash: `0x${string}`;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  decryptedAmount: bigint;
  blockNumber: bigint;
  isMatch: boolean;
}

export interface ComplianceAttestationRecord {
  batchId: `0x${string}`;
  auditorAddress: `0x${string}`;
  reportHash: `0x${string}`;
  isCompliant: boolean;
  totalDecrypted: bigint;
  expectedTotal: bigint;
  attestedAt: number;
  txHash: `0x${string}`;
}

export interface EmployeeIncomingPayment {
  txHash: `0x${string}`;
  batchId: `0x${string}`;
  blockNumber: bigint;
  sender: `0x${string}`;
  decryptedAmount: bigint;
  timestamp: number;
  proofVerified: boolean;
}
