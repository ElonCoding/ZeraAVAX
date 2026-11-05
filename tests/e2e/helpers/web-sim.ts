/**
 * Web UI Flow Simulator for CashLayer Private Payroll.
 * Simulates user interactions and business rules for the 4 primary personas:
 * 1. Employer View (wallet connect, CSV/form batch creation, preflight review, execution)
 * 2. Employee View (private balance check, viewing key decryption, isolation from peers)
 * 3. Auditor View (compliance dashboard, non-overreach guardrails, attestation submission)
 * 4. Public Observer View (on-chain explorer inspection, zero-plaintext calldata audit)
 */

import { MockAvalancheRPC } from "./mock-rpc.ts";
import { SimulatedEERCAdapter } from "./eerc-sim.ts";
import { SimulatedPrivatePayroll, SimulatedComplianceVerifier } from "./contract-sim.ts";
import { Poseidon } from "./crypto-sim.ts";

export class WebAppSimulator {
  constructor(
    private rpc: MockAvalancheRPC,
    private adapter: SimulatedEERCAdapter,
    private payroll: SimulatedPrivatePayroll,
    private compliance: SimulatedComplianceVerifier
  ) {}

  // -------------------------------------------------------------------------
  // Wallet Connection & Network Detection
  // -------------------------------------------------------------------------
  connectWallet(params: {
    address: `0x${string}`;
    chainId: number;
  }): { connected: boolean; networkValid: boolean; error?: string } {
    if (!params.address || !params.address.startsWith("0x") || params.address.length !== 42) {
      return { connected: false, networkValid: false, error: "Invalid EVM wallet address" };
    }
    const targetChainId = this.rpc.getChainId();
    if (params.chainId !== targetChainId) {
      return {
        connected: true,
        networkValid: false,
        error: `Mismatched network: Connected to ${params.chainId}, expected CashLayer Avalanche L1 (${targetChainId})`,
      };
    }
    return { connected: true, networkValid: true };
  }

  // -------------------------------------------------------------------------
  // Employer Workflow
  // -------------------------------------------------------------------------
  employerReviewBatch(recipients: Array<{ address: string; amount: string }>): {
    valid: boolean;
    errors: string[];
    summary?: {
      employeeCount: number;
      totalPlaintextGross: string;
      estimatedGas: bigint;
      deduplicatedCount: number;
    };
  } {
    const errors: string[] = [];
    const seen = new Set<string>();
    let totalGross = 0n;

    if (recipients.length === 0) {
      errors.push("Batch cannot be empty");
      return { valid: false, errors };
    }

    for (let i = 0; i < recipients.length; i++) {
      const item = recipients[i];
      const addr = item.address.trim().toLowerCase();
      if (!addr.startsWith("0x") || addr.length !== 42) {
        errors.push(`Row ${i + 1}: Invalid address "${item.address}"`);
      }
      if (seen.has(addr)) {
        errors.push(`Row ${i + 1}: Duplicate address "${item.address}"`);
      }
      seen.add(addr);

      try {
        const amt = BigInt(item.amount);
        if (amt <= 0n) {
          errors.push(`Row ${i + 1}: Amount must be positive`);
        }
        totalGross += amt;
      } catch {
        errors.push(`Row ${i + 1}: Invalid numeric amount "${item.amount}"`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      summary: {
        employeeCount: recipients.length,
        totalPlaintextGross: totalGross.toString(),
        estimatedGas: BigInt(recipients.length) * 420000n + 150000n,
        deduplicatedCount: seen.size,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Employee Workflow
  // -------------------------------------------------------------------------
  async employeeViewPortal(params: {
    employeeAddress: `0x${string}`;
    viewingKey: string;
  }): Promise<{
    address: `0x${string}`;
    confidentialBalance: string;
    canViewOtherEmployees: boolean;
  }> {
    const balRes = await this.adapter.getEncryptedBalance(params.employeeAddress, params.viewingKey);
    if (balRes.decrypted === undefined) {
      throw new Error("Employee Portal: Decryption failed. Invalid viewing key.");
    }

    return {
      address: params.employeeAddress,
      confidentialBalance: balRes.decrypted.toString(),
      canViewOtherEmployees: false, // Strict privacy isolation
    };
  }

  // -------------------------------------------------------------------------
  // Auditor Workflow & Guardrails
  // -------------------------------------------------------------------------
  async auditorViewCompliance(params: {
    auditorAddress: `0x${string}`;
    auditorPrivateKey: string;
    targetBatchId: `0x${string}`;
  }): Promise<{
    isAuthorized: boolean;
    disclaimer: string;
    decryptedTxs: Array<{ txHash: string; amount: string; recipient: string }>;
    totalAudited: string;
  }> {
    const isAuthorized = this.compliance.isAuthorizedAuditor(params.auditorAddress);
    if (!isAuthorized) {
      throw new Error("Auditor Panel: Auditor address is not registered or has been revoked");
    }

    const decrypted = await this.adapter.auditorDecrypt(params.auditorPrivateKey);
    const total = decrypted.reduce((acc, t) => acc + t.amount, 0n);

    return {
      isAuthorized: true,
      disclaimer:
        "Auditor disclosure notice: eERC auditor key decrypts all private transfers on this token contract while active. Selective sub-batch masking is not claimed without separate token instances.",
      decryptedTxs: decrypted.map((d) => ({
        txHash: d.txHash,
        amount: d.amount.toString(),
        recipient: d.recipient,
      })),
      totalAudited: total.toString(),
    };
  }

  // -------------------------------------------------------------------------
  // Public Observer Workflow
  // -------------------------------------------------------------------------
  publicObserverInspect(txHash: `0x${string}`, sensitivePlaintexts: bigint[]): {
    exists: boolean;
    blockNumber?: bigint;
    status?: 1 | 0;
    gasUsed?: bigint;
    zeroPlaintextLeakageVerified: boolean;
  } {
    const tx = this.rpc.getTransaction(txHash);
    const receipt = this.rpc.getTransactionReceipt(txHash);
    if (!tx || !receipt) {
      return { exists: false, zeroPlaintextLeakageVerified: false };
    }

    const leakCheck = this.rpc.assertZeroPlaintextLeakage(txHash, sensitivePlaintexts);

    return {
      exists: true,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed,
      zeroPlaintextLeakageVerified: !leakCheck.leaked,
    };
  }
}
