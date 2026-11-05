/**
 * @cashlayer/eerc-adapter
 * Standardized eERC Adapter Interface and Implementations for CashLayer Private Payroll.
 */

import { Point, TransferProof } from "@cashlayer/shared";

// ===========================================================================
// Standardized IEERCAdapter Interface (PROJECT.md § Interface Contracts)
// ===========================================================================

export interface IEERCAdapter {
  initialize(
    rpcUrl: string,
    tokenAddress: `0x${string}`,
    registrarAddress?: `0x${string}`
  ): Promise<void>;

  registerAccount(
    privateKey: `0x${string}`
  ): Promise<{ publicKey: Point; txHash?: `0x${string}` }>;

  getEncryptedBalance(
    userAddress: `0x${string}`,
    viewingKey?: string
  ): Promise<{
    encrypted: [bigint, bigint, bigint, bigint];
    decrypted?: bigint;
  }>;

  preparePayrollTransfer(params: {
    senderPrivateKey: `0x${string}`;
    recipientAddress: `0x${string}`;
    amount: bigint;
    senderBalance: bigint;
    auditorAddress: `0x${string}`;
  }): Promise<{
    proof: TransferProof;
    balancePCT: string[];
    receiverEncryptedAmount: string[];
    auditorPCT: string[];
  }>;

  executeBatchTransfers(params: {
    batchId: `0x${string}`;
    transfers: Array<{ recipient: `0x${string}`; amount: bigint }>;
    senderPrivateKey: `0x${string}`;
  }): Promise<{ txHashes: `0x${string}`[]; receiptStatuses: number[] }>;

  auditorDecrypt(
    auditorPrivateKey: string,
    fromBlock?: bigint
  ): Promise<
    Array<{
      txHash: `0x${string}`;
      amount: bigint;
      sender: `0x${string}`;
      recipient: `0x${string}`;
      blockNumber: bigint;
    }>
  >;
}

// Re-export adapters and modules
export * from "./crypto.js";
export * from "./mockAdapter.js";
export * from "./liveAdapter.js";
export * from "./auditor.js";
