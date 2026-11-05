/**
 * Core Domain Models & Cryptographic Types for CashLayer Private Payroll.
 * Conforms to IPrivatePayroll.sol, IComplianceVerifier.sol, and @avalabs/eerc-sdk specs.
 */

// ===========================================================================
// Smart Contract State Machine Enums & Batch Types
// ===========================================================================

export enum BatchStatus {
  None = 0,
  Draft = 1,
  Ready = 2,
  Submitted = 3,
  Confirmed = 4,
  Cancelled = 5,
}

export interface PayrollItem {
  recipient: `0x${string}`;
  amount: bigint;
  department?: string;
  notes?: string;
}

export interface PayrollRoster {
  employer: `0x${string}`;
  eercToken: `0x${string}`;
  items: PayrollItem[];
  totalGrossAmount: bigint;
  employeeCount: number;
}

export interface PayrollBatch {
  batchId: `0x${string}`;
  employer: `0x${string}`;
  eercToken: `0x${string}`;
  employeeCount: number;
  status: BatchStatus;
  rosterCommitment: `0x${string}`;
  createdAt: bigint;
  confirmedAt: bigint;
}

export interface BatchManifest {
  batchId: `0x${string}`;
  tokenAddress: `0x${string}`;
  employeeCount: number;
  totalGrossAmount: string;
  rosterCommitment: `0x${string}`;
  recipients: Array<{
    address: `0x${string}`;
    amount: string;
    department?: string;
  }>;
  createdAt?: string;
}

// ===========================================================================
// Compliance Attestation & Auditor Types
// ===========================================================================

export interface ComplianceAttestation {
  batchId: `0x${string}`;
  auditor: `0x${string}`;
  reportHash: `0x${string}`;
  verifiedAt: bigint;
  isCompliant: boolean;
}

export interface AuditorReport {
  batchId: `0x${string}`;
  auditorAddress: `0x${string}`;
  totalDisbursed: bigint;
  employeeCount: number;
  isCompliant: boolean;
  discrepancies: string[];
  reportHash: `0x${string}`;
  timestamp: number;
  transactions?: DecryptedTransaction[];
}

export interface BatchReconciliationResult {
  batchId: `0x${string}`;
  isCompliant: boolean;
  totalDecrypted: bigint;
  expectedTotal: bigint;
  discrepancy: bigint;
  employeeCount: number;
  transactions: DecryptedTransaction[];
}

// ===========================================================================
// Cryptographic Types (BabyJubjub, Poseidon, Twisted ElGamal)
// ===========================================================================

export type Point = [bigint, bigint];

export interface ElGamalCipherText {
  c1: Point;
  c2: Point;
}

export interface ProofPoints {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

export interface TransferProof {
  proofPoints: ProofPoints;
  publicSignals: string[]; // 32 public signals
}

export type AuditorPCT = [string, string, string, string, string, string, string];

export interface KeyPair {
  privateKey: bigint;
  publicKey: Point;
  address?: `0x${string}`;
}

export interface DecryptedTransaction {
  txHash: `0x${string}`;
  amount: bigint;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  blockNumber: bigint;
  timestamp?: number;
}

export type UserRole = "employer" | "employee" | "auditor" | "observer";
