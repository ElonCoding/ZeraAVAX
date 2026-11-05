/**
 * High-Fidelity Smart Contract Simulator for IPrivatePayroll and IComplianceVerifier.
 * Strictly adheres to Solidity specifications, state machine transitions, replay protection,
 * and zero-plaintext data storage.
 */

import { MockAvalancheRPC, SimulatedLog } from "./mock-rpc.ts";

export enum BatchStatus {
  None = 0,
  Draft = 1,
  Ready = 2,
  Submitted = 3,
  Confirmed = 4,
  Cancelled = 5,
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

export interface ComplianceAttestation {
  batchId: `0x${string}`;
  auditor: `0x${string}`;
  reportHash: `0x${string}`;
  verifiedAt: bigint;
  isCompliant: boolean;
}

export class SimulatedPrivatePayroll {
  public address: `0x${string}` = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  private batches: Map<`0x${string}`, PayrollBatch> = new Map();
  private executedBatches: Set<`0x${string}`> = new Set();
  private ownerEmployer: `0x${string}`;

  constructor(private rpc: MockAvalancheRPC, employerAddress: `0x${string}`) {
    this.ownerEmployer = employerAddress.toLowerCase() as `0x${string}`;
  }

  createPayrollBatch(
    caller: `0x${string}`,
    params: {
      batchId: `0x${string}`;
      eercToken: `0x${string}`;
      employeeCount: number;
      rosterCommitment: `0x${string}`;
    }
  ): { status: 1 | 0; error?: string } {
    const callerLower = caller.toLowerCase() as `0x${string}`;
    if (callerLower !== this.ownerEmployer) {
      return { status: 0, error: "PrivatePayroll: Caller is not authorized employer" };
    }

    if (this.batches.has(params.batchId)) {
      return { status: 0, error: "PrivatePayroll: Batch already exists (Replay Protection)" };
    }

    if (params.employeeCount === 0) {
      return { status: 0, error: "PrivatePayroll: Employee count must be greater than zero" };
    }

    const receipt = this.rpc.submitTransaction({
      from: caller,
      to: this.address,
      data: `0x${params.batchId.slice(2)}${params.rosterCommitment.slice(2)}`,
      executionFn: () => {
        const batch: PayrollBatch = {
          batchId: params.batchId,
          employer: callerLower,
          eercToken: params.eercToken,
          employeeCount: params.employeeCount,
          status: BatchStatus.Ready,
          rosterCommitment: params.rosterCommitment,
          createdAt: this.rpc.getBlockNumber(),
          confirmedAt: 0n,
        };
        this.batches.set(params.batchId, batch);

        const log: Omit<SimulatedLog, "blockNumber" | "transactionHash" | "logIndex"> = {
          address: this.address,
          topics: [
            "0xBatchCreated",
            params.batchId,
            callerLower,
            params.eercToken,
          ],
          data: `0x${params.employeeCount.toString(16).padStart(8, "0")}${params.rosterCommitment.slice(2)}`,
          eventName: "BatchCreated",
          args: {
            batchId: params.batchId,
            employer: callerLower,
            eercToken: params.eercToken,
            employeeCount: params.employeeCount,
            rosterCommitment: params.rosterCommitment,
          },
        };
        return { status: 1, logs: [log] };
      },
    });

    return receipt.status === 1 ? { status: 1 } : { status: 0, error: receipt.revertReason };
  }

  confirmBatchExecution(
    caller: `0x${string}`,
    batchId: `0x${string}`,
    executedCount: number
  ): { status: 1 | 0; error?: string } {
    const callerLower = caller.toLowerCase() as `0x${string}`;
    if (callerLower !== this.ownerEmployer) {
      return { status: 0, error: "PrivatePayroll: Caller is not authorized employer" };
    }

    const batch = this.batches.get(batchId);
    if (!batch) {
      return { status: 0, error: "PrivatePayroll: Batch not found" };
    }

    if (batch.status === BatchStatus.Confirmed) {
      return { status: 0, error: "PrivatePayroll: Batch already confirmed (Idempotency violation)" };
    }

    if (batch.status === BatchStatus.Cancelled) {
      return { status: 0, error: "PrivatePayroll: Cannot execute cancelled batch" };
    }

    if (executedCount !== batch.employeeCount) {
      return { status: 0, error: `PrivatePayroll: Executed count ${executedCount} does not match roster ${batch.employeeCount}` };
    }

    const receipt = this.rpc.submitTransaction({
      from: caller,
      to: this.address,
      data: `0xconfirm-${batchId.slice(2)}`,
      executionFn: () => {
        batch.status = BatchStatus.Confirmed;
        batch.confirmedAt = this.rpc.getBlockNumber();
        this.executedBatches.add(batchId);

        const log: Omit<SimulatedLog, "blockNumber" | "transactionHash" | "logIndex"> = {
          address: this.address,
          topics: ["0xBatchConfirmed", batchId, callerLower],
          data: `0x${executedCount.toString(16).padStart(8, "0")}`,
          eventName: "BatchConfirmed",
          args: {
            batchId,
            employer: callerLower,
            executedCount,
            timestamp: batch.confirmedAt,
          },
        };
        return { status: 1, logs: [log] };
      },
    });

    return receipt.status === 1 ? { status: 1 } : { status: 0, error: receipt.revertReason };
  }

  cancelBatch(caller: `0x${string}`, batchId: `0x${string}`, reason: string): { status: 1 | 0; error?: string } {
    const callerLower = caller.toLowerCase() as `0x${string}`;
    if (callerLower !== this.ownerEmployer) {
      return { status: 0, error: "PrivatePayroll: Caller is not authorized employer" };
    }

    const batch = this.batches.get(batchId);
    if (!batch) {
      return { status: 0, error: "PrivatePayroll: Batch not found" };
    }

    if (batch.status === BatchStatus.Confirmed) {
      return { status: 0, error: "PrivatePayroll: Cannot cancel already confirmed batch" };
    }

    batch.status = BatchStatus.Cancelled;
    return { status: 1 };
  }

  getBatch(batchId: `0x${string}`): PayrollBatch | undefined {
    return this.batches.get(batchId);
  }

  isBatchExecuted(batchId: `0x${string}`): boolean {
    return this.executedBatches.has(batchId);
  }
}

export class SimulatedComplianceVerifier {
  public address: `0x${string}` = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  private registeredAuditors: Map<`0x${string}`, string> = new Map();
  private attestations: Map<string, ComplianceAttestation> = new Map();
  private admin: `0x${string}`;

  constructor(private rpc: MockAvalancheRPC, adminAddress: `0x${string}`) {
    this.admin = adminAddress.toLowerCase() as `0x${string}`;
  }

  registerAuditor(caller: `0x${string}`, auditor: `0x${string}`, organizationName: string): { status: 1 | 0; error?: string } {
    if (caller.toLowerCase() !== this.admin) {
      return { status: 0, error: "ComplianceVerifier: Caller is not authorized admin" };
    }
    const auditorLower = auditor.toLowerCase() as `0x${string}`;
    this.registeredAuditors.set(auditorLower, organizationName);

    this.rpc.submitTransaction({
      from: caller,
      to: this.address,
      data: `0xregisterAuditor-${auditorLower}`,
      executionFn: () => ({
        status: 1,
        logs: [
          {
            address: this.address,
            topics: ["0xAuditorRegistered", auditorLower],
            data: Buffer.from(organizationName).toString("hex"),
            eventName: "AuditorRegistered",
            args: { auditor: auditorLower, organizationName },
          },
        ],
      }),
    });

    return { status: 1 };
  }

  revokeAuditor(caller: `0x${string}`, auditor: `0x${string}`): { status: 1 | 0; error?: string } {
    if (caller.toLowerCase() !== this.admin) {
      return { status: 0, error: "ComplianceVerifier: Caller is not authorized admin" };
    }
    const auditorLower = auditor.toLowerCase() as `0x${string}`;
    if (!this.registeredAuditors.has(auditorLower)) {
      return { status: 0, error: "ComplianceVerifier: Auditor not registered" };
    }
    this.registeredAuditors.delete(auditorLower);

    this.rpc.submitTransaction({
      from: caller,
      to: this.address,
      data: `0xrevokeAuditor-${auditorLower}`,
      executionFn: () => ({
        status: 1,
        logs: [
          {
            address: this.address,
            topics: ["0xAuditorRevoked", auditorLower],
            data: "0x",
            eventName: "AuditorRevoked",
            args: { auditor: auditorLower },
          },
        ],
      }),
    });

    return { status: 1 };
  }

  attestCompliance(
    caller: `0x${string}`,
    params: {
      batchId: `0x${string}`;
      reportHash: `0x${string}`;
      isCompliant: boolean;
    }
  ): { status: 1 | 0; error?: string } {
    const callerLower = caller.toLowerCase() as `0x${string}`;
    if (!this.isAuthorizedAuditor(callerLower)) {
      return { status: 0, error: "ComplianceVerifier: Caller is not registered auditor" };
    }

    const key = `${params.batchId.toLowerCase()}-${callerLower}`;
    const attestation: ComplianceAttestation = {
      batchId: params.batchId,
      auditor: callerLower,
      reportHash: params.reportHash,
      verifiedAt: this.rpc.getBlockNumber(),
      isCompliant: params.isCompliant,
    };
    this.attestations.set(key, attestation);

    this.rpc.submitTransaction({
      from: caller,
      to: this.address,
      data: `0xattestCompliance-${params.batchId.slice(2)}`,
      executionFn: () => ({
        status: 1,
        logs: [
          {
            address: this.address,
            topics: ["0xComplianceAttested", params.batchId, callerLower, params.reportHash],
            data: params.isCompliant ? "0x01" : "0x00",
            eventName: "ComplianceAttested",
            args: {
              batchId: params.batchId,
              auditor: callerLower,
              reportHash: params.reportHash,
              isCompliant: params.isCompliant,
            },
          },
        ],
      }),
    });

    return { status: 1 };
  }

  isAuthorizedAuditor(account: `0x${string}`): boolean {
    return this.registeredAuditors.has(account.toLowerCase() as `0x${string}`);
  }

  getAttestation(batchId: `0x${string}`, auditor: `0x${string}`): ComplianceAttestation | undefined {
    return this.attestations.get(`${batchId.toLowerCase()}-${auditor.toLowerCase()}`);
  }
}
