/**
 * Compliance Auditor Module for CashLayer Private Payroll.
 * Discovers and decrypts on-chain PrivateTransfer logs, reconciles batch totals,
 * generates cryptographic compliance attestations, and interacts with ComplianceVerifier.sol.
 */

import { AuditorReport, DecryptedTransaction } from "@cashlayer/shared";
import { Poseidon } from "./crypto.js";
import { IEERCAdapter } from "./index.js";

export interface ReconcileBatchParams {
  batchId: `0x${string}`;
  expectedTotal: bigint;
  employeeCount?: number;
  auditorPrivateKey: string;
  auditorAddress: `0x${string}`;
  fromBlock?: bigint;
}

export class ComplianceAuditor {
  constructor(
    public adapter: IEERCAdapter,
    public complianceVerifierAddress?: `0x${string}`
  ) {}

  /**
   * Generates a 32-byte cryptographic compliance attestation hash:
   * reportHash = Poseidon.hash([batchId, totalDisbursed, isCompliant ? 1 : 0])
   */
  static computeReportHash(
    batchId: `0x${string}`,
    totalDisbursed: bigint,
    isCompliant: boolean
  ): `0x${string}` {
    const bIdBigInt = BigInt(batchId);
    const compliantBigInt = BigInt(isCompliant ? 1 : 0);
    const hash = Poseidon.hash([bIdBigInt, totalDisbursed, compliantBigInt]);
    return `0x${hash.toString(16).padStart(64, "0")}` as `0x${string}`;
  }

  /**
   * Queries and decrypts all transactions associated with the auditor's key.
   */
  async fetchDecryptedTransactions(
    auditorPrivateKey: string,
    fromBlock?: bigint
  ): Promise<DecryptedTransaction[]> {
    const rawTxs = await this.adapter.auditorDecrypt(auditorPrivateKey, fromBlock);
    return rawTxs.map((tx) => ({
      txHash: tx.txHash,
      amount: tx.amount,
      sender: tx.sender,
      recipient: tx.recipient,
      blockNumber: tx.blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
    }));
  }

  /**
   * Reconciles decrypted transaction disbursements against employer-reported totals.
   */
  async reconcileBatch(params: ReconcileBatchParams): Promise<AuditorReport> {
    const transactions = await this.fetchDecryptedTransactions(
      params.auditorPrivateKey,
      params.fromBlock
    );

    let totalDisbursed = 0n;
    for (const tx of transactions) {
      totalDisbursed += tx.amount;
    }

    const discrepancies: string[] = [];

    if (totalDisbursed !== params.expectedTotal) {
      discrepancies.push(
        `Discrepancy detected: Decrypted sum (${totalDisbursed.toString()}) does not match expected batch total (${params.expectedTotal.toString()})`
      );
    }

    if (params.employeeCount !== undefined && transactions.length !== params.employeeCount) {
      discrepancies.push(
        `Transaction count mismatch: Found ${transactions.length} disbursements, expected ${params.employeeCount}`
      );
    }

    const isCompliant = discrepancies.length === 0 && (transactions.length > 0 || params.expectedTotal === 0n);

    const reportHash = ComplianceAuditor.computeReportHash(
      params.batchId,
      totalDisbursed,
      isCompliant
    );

    return {
      batchId: params.batchId,
      auditorAddress: params.auditorAddress,
      totalDisbursed,
      employeeCount: transactions.length,
      isCompliant,
      discrepancies,
      reportHash,
      timestamp: Math.floor(Date.now() / 1000),
      transactions,
    };
  }
}
