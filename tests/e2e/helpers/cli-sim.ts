/**
 * CLI Command Simulator for CashLayer Private Payroll.
 * Implements the 4 CLI commands from PROJECT.md:
 * 1. batch create --roster <path/content> --token <addr> --output <file>
 * 2. batch execute --batch <json> --key <privkey> --rpc <url>
 * 3. audit verify --batch-id <id> --auditor-key <key> --rpc <url>
 * 4. employee balance --employee <addr> --viewing-key <key> --rpc <url>
 */

import { SimulatedEERCAdapter } from "./eerc-sim.ts";
import { SimulatedPrivatePayroll } from "./contract-sim.ts";
import { Poseidon } from "./crypto-sim.ts";

export interface BatchManifest {
  batchId: `0x${string}`;
  tokenAddress: `0x${string}`;
  employeeCount: number;
  totalGrossAmount: string; // Plaintext kept locally by employer; never broadcast on-chain!
  rosterCommitment: `0x${string}`;
  recipients: Array<{ recipient: `0x${string}`; amount: string }>;
  createdAt: number;
}

export interface AuditReport {
  batchId: `0x${string}`;
  auditorAddress: `0x${string}`;
  totalDecryptedDisbursements: string;
  transactionCount: number;
  transactions: Array<{
    txHash: `0x${string}`;
    sender: `0x${string}`;
    recipient: `0x${string}`;
    amount: string;
    blockNumber: number;
  }>;
  isCompliant: boolean;
  complianceAttestationHash: `0x${string}`;
}

export class PayrollCLI {
  public static nonceCounter: bigint = 1n;

  constructor(
    private adapter: SimulatedEERCAdapter,
    private payroll: SimulatedPrivatePayroll
  ) {}

  /**
   * Command 1: batch create --roster <csv> --token <addr>
   */
  batchCreate(params: {
    rosterCsv: string;
    tokenAddress: `0x${string}`;
    batchId?: `0x${string}`;
  }): BatchManifest {
    const lines = params.rosterCsv
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error("CLI Error: Roster CSV is empty");
    }

    const recipients: Array<{ recipient: `0x${string}`; amount: string }> = [];
    const seen = new Set<string>();
    let totalGross = 0n;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line.toLowerCase().includes("address")) continue; // Skip header

      const [addrRaw, amountRaw] = line.split(",").map((s) => s.trim());
      if (!addrRaw || !amountRaw) {
        throw new Error(`CLI Error: Malformed CSV row at index ${i}: "${line}"`);
      }

      if (!addrRaw.toLowerCase().startsWith("0x") || addrRaw.length !== 42) {
        throw new Error(`CLI Error: Invalid recipient EVM address: ${addrRaw}`);
      }

      const addrLower = addrRaw.toLowerCase() as `0x${string}`;
      if (seen.has(addrLower)) {
        throw new Error(`CLI Error: Duplicate recipient address detected: ${addrRaw}`);
      }
      seen.add(addrLower);

      let amount: bigint;
      try {
        amount = BigInt(amountRaw);
      } catch {
        throw new Error(`CLI Error: Malformed CSV row at index ${i}: Invalid numeric amount "${amountRaw}"`);
      }
      if (amount <= 0n) {
        throw new Error(`CLI Error: Amount must be strictly positive: ${amountRaw}`);
      }

      totalGross += amount;
      recipients.push({ recipient: addrLower, amount: amount.toString() });
    }

    if (recipients.length === 0) {
      throw new Error("CLI Error: No valid employee records parsed");
    }

    const commitmentHash = Poseidon.hash(
      recipients.map((r) => Poseidon.hash([BigInt(r.recipient), BigInt(r.amount)]))
    );
    const rosterCommitment = `0x${commitmentHash.toString(16).padStart(64, "0")}` as `0x${string}`;

    // Generate deterministic unique batchId
    const batchId =
      params.batchId ??
      (`0x${Poseidon.hash([BigInt(Date.now()), commitmentHash, BigInt(PayrollCLI.nonceCounter++)])
        .toString(16)
        .padStart(64, "0")}` as `0x${string}`);

    return {
      batchId,
      tokenAddress: params.tokenAddress,
      employeeCount: recipients.length,
      totalGrossAmount: totalGross.toString(),
      rosterCommitment,
      recipients,
      createdAt: Date.now(),
    };
  }

  /**
   * Command 2: batch execute --batch <manifest> --key <privkey>
   */
  async batchExecute(params: {
    manifest: BatchManifest;
    senderPrivateKey: `0x${string}`;
    employerAddress: `0x${string}`;
  }): Promise<{
    batchId: `0x${string}`;
    txHashes: `0x${string}`[];
    confirmed: boolean;
    totalExecuted: number;
  }> {
    // 1. Create on-chain batch in PrivatePayroll
    const createRes = this.payroll.createPayrollBatch(params.employerAddress, {
      batchId: params.manifest.batchId,
      eercToken: params.manifest.tokenAddress,
      employeeCount: params.manifest.employeeCount,
      rosterCommitment: params.manifest.rosterCommitment,
    });
    if (createRes.status !== 1) {
      throw new Error(`CLI Error: Contract batch creation failed: ${createRes.error}`);
    }

    // 2. Execute confidential transfers via eERC adapter
    const transferItems = params.manifest.recipients.map((r) => ({
      recipient: r.recipient,
      amount: BigInt(r.amount),
    }));

    const execRes = await this.adapter.executeBatchTransfers({
      batchId: params.manifest.batchId,
      transfers: transferItems,
      senderPrivateKey: params.senderPrivateKey,
    });

    // 3. Confirm batch in PrivatePayroll
    const confirmRes = this.payroll.confirmBatchExecution(
      params.employerAddress,
      params.manifest.batchId,
      transferItems.length
    );
    if (confirmRes.status !== 1) {
      throw new Error(`CLI Error: Contract batch confirmation failed: ${confirmRes.error}`);
    }

    return {
      batchId: params.manifest.batchId,
      txHashes: execRes.txHashes,
      confirmed: true,
      totalExecuted: transferItems.length,
    };
  }

  /**
   * Command 3: audit verify --batch-id <id> --auditor-key <key>
   */
  async auditVerify(params: {
    batchId: `0x${string}`;
    auditorPrivateKey: string;
    auditorAddress: `0x${string}`;
    expectedTotal?: bigint;
  }): Promise<AuditReport> {
    const decryptedTxs = await this.adapter.auditorDecrypt(params.auditorPrivateKey);
    let totalDisbursements = 0n;

    const reportTxs = decryptedTxs.map((tx) => {
      totalDisbursements += tx.amount;
      return {
        txHash: tx.txHash,
        sender: tx.sender,
        recipient: tx.recipient,
        amount: tx.amount.toString(),
        blockNumber: Number(tx.blockNumber),
      };
    });

    const isCompliant =
      params.expectedTotal !== undefined
        ? totalDisbursements === params.expectedTotal
        : reportTxs.length > 0;

    const attestationHash = `0x${Poseidon.hash([
      BigInt(params.batchId),
      totalDisbursements,
      BigInt(isCompliant ? 1 : 0),
    ])
      .toString(16)
      .padStart(64, "0")}` as `0x${string}`;

    return {
      batchId: params.batchId,
      auditorAddress: params.auditorAddress,
      totalDecryptedDisbursements: totalDisbursements.toString(),
      transactionCount: reportTxs.length,
      transactions: reportTxs,
      isCompliant,
      complianceAttestationHash: attestationHash,
    };
  }

  /**
   * Command 4: employee balance --employee <addr> --viewing-key <key>
   */
  async employeeBalance(params: {
    employeeAddress: `0x${string}`;
    viewingKey: string;
  }): Promise<{
    employeeAddress: `0x${string}`;
    decryptedBalance: string;
  }> {
    const bal = await this.adapter.getEncryptedBalance(params.employeeAddress, params.viewingKey);
    if (bal.decrypted === undefined) {
      throw new Error("CLI Error: Failed to decrypt balance with provided viewing key");
    }
    return {
      employeeAddress: params.employeeAddress,
      decryptedBalance: bal.decrypted.toString(),
    };
  }
}
